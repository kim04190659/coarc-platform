// =====================================================
//  src/app/api/kpi/goals/route.ts
//  KPI目標管理 — 企業別のKPI目標値をNotionから取得・更新する
//
//  ■ GET ?companyId=xxx
//    → 企業の全KPI目標をNotionから取得して返す
//
//  ■ POST { companyId, kpiName, targetValue }
//    → Notionの既存レコードを更新、なければ新規作成
//
//  ■ レスポンス（GET）
//    { goals: KpiGoal[] }
//
//  ■ レスポンス（POST）
//    { success: true, pageId: string }
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type KpiGoal = {
  pageId:   string
  kpiName:  string
  kpiType:  string   // KPI種別（解決率・未対応件数など）
  target:   number   // 目標値
  unit:     string   // 単位（%・件・ptなど）
  period:   string   // 期間（月次・四半期・年次）
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── GET: KPI目標一覧を取得 ───────────────────────────

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

  // ✅ 企業別DB方式: companyId から企業専用 KPI目標DB IDを取得
  const dbConfig = getCompanyDbConfig(companyId)

  try {
    // KPI目標DB（企業別）から全件取得（企業名フィルタなし）
    const res = await fetch(`${NOTION_API}/databases/${dbConfig.kpiGoalsDbId}/query`, {
      method: 'POST',
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        sorts: [{ property: 'KPI名', direction: 'ascending' }],
        page_size: 20,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return NextResponse.json(
        { error: `Notion APIエラー (${res.status}): ${errBody}` },
        { status: 500 },
      )
    }

    const data = await res.json() as { results: Record<string, unknown>[] }

    // Notionレスポンスを KpiGoal に変換
    const goals: KpiGoal[] = data.results.map(page => {
      const props = page.properties as Record<string, {
        title?:  Array<{ plain_text?: string }>
        select?: { name?: string }
        number?: number
      }>

      // 企業別DB方式のプロパティ名にマッピング
      return {
        pageId:  page.id as string,
        kpiName: props['KPI名']?.title?.[0]?.plain_text  ?? '',
        kpiType: props['カテゴリ']?.select?.name ?? props['KPI種別']?.select?.name ?? '',
        target:  props['目標値']?.number                  ?? 0,
        unit:    props['単位']?.select?.name              ?? '',
        period:  props['期間']?.select?.name              ?? '',
      }
    })

    return NextResponse.json({ goals })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[kpi/goals GET] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST: KPI目標値を更新 ────────────────────────────

export async function POST(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  try {
    const body = await request.json() as {
      pageId:      string  // 更新対象のNotionページID
      targetValue: number  // 新しい目標値
    }
    const { pageId, targetValue } = body

    if (!pageId || targetValue === undefined) {
      return NextResponse.json(
        { error: 'pageId と targetValue は必須です' },
        { status: 400 },
      )
    }

    // Notionページの目標値を更新する
    const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: 'PATCH',
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        properties: {
          '目標値': { number: targetValue },
          '更新日': { date: { start: new Date().toISOString().split('T')[0] } },
        },
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return NextResponse.json(
        { error: `Notion更新エラー (${res.status}): ${errBody}` },
        { status: 500 },
      )
    }

    const page = await res.json() as { id: string }
    return NextResponse.json({ success: true, pageId: page.id })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[kpi/goals POST] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
