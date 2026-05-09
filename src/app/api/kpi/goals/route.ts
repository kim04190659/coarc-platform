// =====================================================
//  src/app/api/kpi/goals/route.ts
//  KPI目標管理 — 企業別のKPI目標値をNotionから取得・更新する
//
//  ■ GET ?companyId=xxx
//    → 企業の全KPI目標をNotionから取得して返す
//
//  ■ POST { pageId, targetValue }
//    → NotionのKPI目標値（TEXT型）を更新する
//
//  ■ DB スキーマ（実際のNotion構成）
//    KPI名    : title
//    KPI種別  : select（顧客満足度/売上/社員満足度/業務効率/その他）
//    目標値   : text  ← number 型ではないので注意
//    単位     : text  ← select 型ではないので注意
//    期間     : text  ← select 型ではないので注意
//    更新日   : date
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type KpiGoal = {
  pageId:  string
  kpiName: string
  kpiType: string   // 顧客満足度 / 売上 / 社員満足度 / 業務効率 / その他
  target:  string   // 目標値（TEXT型のため文字列で持つ）
  unit:    string   // 単位（例: %, pt, 件）
  period:  string   // 期間（例: 月次, 四半期, 年次）
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
    // ✅ title型プロパティはsortキーに使えないため created_time で代替
    const res = await fetch(`${NOTION_API}/databases/${dbConfig.kpiGoalsDbId}/query`, {
      method: 'POST',
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
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
        title?:     Array<{ plain_text?: string }>
        rich_text?: Array<{ plain_text?: string }>
        select?:    { name?: string }
      }>

      // title / rich_text の両方に対応する汎用テキスト取得
      const getText = (p: typeof props[string] | undefined) =>
        p?.title?.[0]?.plain_text ?? p?.rich_text?.[0]?.plain_text ?? ''

      return {
        pageId:  page.id as string,
        kpiName: getText(props['KPI名']),
        // KPI種別 は select 型（正しい）
        kpiType: props['KPI種別']?.select?.name ?? '',
        // 目標値・単位・期間 は text 型（selectでもnumberでもない）
        target:  getText(props['目標値']),
        unit:    getText(props['単位']),
        period:  getText(props['期間']),
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
      targetValue: string  // 新しい目標値（TEXT型）
    }
    const { pageId, targetValue } = body

    if (!pageId || targetValue === undefined) {
      return NextResponse.json(
        { error: 'pageId と targetValue は必須です' },
        { status: 400 },
      )
    }

    // ✅ 目標値は TEXT 型なので rich_text で更新する（number ではない）
    const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: 'PATCH',
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        properties: {
          '目標値': {
            rich_text: [{ text: { content: String(targetValue) } }],
          },
          '更新日': {
            date: { start: new Date().toISOString().split('T')[0] },
          },
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
