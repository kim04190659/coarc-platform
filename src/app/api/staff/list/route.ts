// =====================================================
//  src/app/api/staff/list/route.ts
//  社員マスタ取得 — 企業別に社員一覧をNotionから取得し、
//  各社員の直近コンディションを付加して返す
//
//  ■ GET ?companyId=xxx
//    → 社員一覧 + 直近コンディション情報を返す
//
//  ■ レスポンス
//    { staff: StaffWithCondition[] }
// =====================================================

import { NextResponse } from 'next/server'
import { SHARED_NOTION_DBS } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type StaffProfile = {
  pageId:          string
  name:            string   // 社員名
  department:      string   // 部署
  role:            string   // 役職
  primaryFunction: string   // 得意機能
  skillSet:        string   // スキルセット（カンマ区切り）
  certifications:  string   // 資格
  status:          string   // 在籍状況
  joinYear:        number   // 入社年
}

export type StaffCondition = {
  pageId:      string
  staffName:   string
  condition:   string   // ⭐5 絶好調 〜 ⭐1 不調
  workload:    string   // 高/中/低
  workStyle:   string   // 出勤/テレワーク/休暇/病欠
  recordedAt:  string   // 記録日 (ISO)
  memo:        string
  aiComment:   string
}

export type StaffWithCondition = StaffProfile & {
  latestCondition: StaffCondition | null
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── 社員マスタ一覧取得 ────────────────────────────────

async function fetchStaffProfiles(
  notionKey: string,
  companyShortName: string,
): Promise<StaffProfile[]> {
  const res = await fetch(`${NOTION_API}/databases/${SHARED_NOTION_DBS.staffProfile}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      filter: {
        and: [
          {
            property: '企業名',
            select: { equals: companyShortName },
          },
          {
            property: '在籍状況',
            select: { equals: '在籍' },
          },
        ],
      },
      sorts: [{ property: '社員名', direction: 'ascending' }],
      page_size: 50,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`社員マスタ取得エラー (${res.status}): ${err}`)
  }

  const data = await res.json() as { results: Record<string, unknown>[] }

  return data.results.map(page => {
    const props = page.properties as Record<string, {
      title?:     Array<{ plain_text?: string }>
      select?:    { name?: string }
      rich_text?: Array<{ plain_text?: string }>
      number?:    number
    }>

    const getText = (p: typeof props[string] | undefined) =>
      p?.title?.[0]?.plain_text ?? p?.rich_text?.[0]?.plain_text ?? ''

    return {
      pageId:          page.id as string,
      name:            getText(props['社員名']),
      department:      getText(props['部署']),
      role:            props['役職']?.select?.name            ?? '',
      primaryFunction: props['得意機能']?.select?.name        ?? '',
      skillSet:        getText(props['スキルセット']),
      certifications:  getText(props['資格']),
      status:          props['在籍状況']?.select?.name        ?? '',
      joinYear:        props['入社年']?.number                 ?? 0,
    }
  })
}

// ── 最新コンディション取得（社員名ベース）────────────────

async function fetchLatestConditions(
  notionKey: string,
  companyShortName: string,
): Promise<Map<string, StaffCondition>> {
  const res = await fetch(`${NOTION_API}/databases/${SHARED_NOTION_DBS.staffCondition}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      filter: {
        property: '企業名',
        select: { equals: companyShortName },
      },
      sorts: [{ property: '記録日', direction: 'descending' }],
      page_size: 100,
    }),
  })

  if (!res.ok) return new Map()  // コンディション取得失敗は握りつぶす

  const data = await res.json() as { results: Record<string, unknown>[] }

  // 社員名ごとに最新1件だけ保持（降順取得済みなので先着優先）
  const conditionMap = new Map<string, StaffCondition>()

  for (const page of data.results) {
    const props = page.properties as Record<string, {
      title?:     Array<{ plain_text?: string }>
      rich_text?: Array<{ plain_text?: string }>
      select?:    { name?: string }
      date?:      { start?: string }
    }>

    const getText = (p: typeof props[string] | undefined) =>
      p?.title?.[0]?.plain_text ?? p?.rich_text?.[0]?.plain_text ?? ''

    const staffName = getText(props['社員名'])
    if (!staffName || conditionMap.has(staffName)) continue  // 最新1件のみ使用

    conditionMap.set(staffName, {
      pageId:     page.id as string,
      staffName,
      condition:  props['コンディション']?.select?.name ?? '',
      workload:   props['業務負荷']?.select?.name        ?? '',
      workStyle:  props['勤務形態']?.select?.name        ?? '',
      recordedAt: props['記録日']?.date?.start            ?? '',
      memo:       getText(props['メモ']),
      aiComment:  getText(props['AIコメント']),
    })
  }

  return conditionMap
}

// ── メインハンドラー ────────────────────────────────

export async function GET(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  if (!companyId) {
    return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
  }

  const company = getCompanyById(companyId)

  try {
    // 社員マスタ + コンディションを並列取得
    const [profiles, conditionMap] = await Promise.all([
      fetchStaffProfiles(notionKey, company.shortName),
      fetchLatestConditions(notionKey, company.shortName),
    ])

    // 社員マスタに最新コンディションを結合
    const staff: StaffWithCondition[] = profiles.map(p => ({
      ...p,
      latestCondition: conditionMap.get(p.name) ?? null,
    }))

    return NextResponse.json({ staff })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[staff/list] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
