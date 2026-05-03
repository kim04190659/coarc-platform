// =====================================================
//  src/app/api/kpi/summary/route.ts
//  企業の問い合わせ管理DBからKPIを集計して返すAPIルート
//
//  ■ 処理フロー
//    1. companyId → COMPANY_DB_CONFIG から DB ID を取得
//    2. Notion DB を全件クエリ（ページネーション対応・最大200件）
//    3. ステータス別・カテゴリ別・チャネル別・優先度別に集計
//    4. KPI指標（解決率・高優先度件数など）を算出して返す
//
//  ■ リクエスト（GET）
//    ?companyId=kitano-resort
//
//  ■ レスポンス
//    {
//      total: number           // 総件数
//      resolved: number        // 完了件数
//      resolutionRate: number  // 解決率（%）
//      highPriority: number    // 高優先度件数
//      unresponded: number     // 未対応件数
//      inProgress: number      // 対応中件数
//      byStatus:   Record<string, number>
//      byCategory: Record<string, number>
//      byChannel:  Record<string, number>
//      byPriority: Record<string, number>
//    }
// =====================================================

import { NextResponse } from 'next/server'
import { COMPANY_DB_CONFIG } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

/** Notion API 共通ヘッダー */
function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

export async function GET(request: Request) {
  // 環境変数チェック
  const apiKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Notion APIキーが設定されていません' }, { status: 500 })
  }

  // クエリパラメータから companyId を取得
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  if (!companyId) {
    return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
  }

  // 企業別 DB ID を取得
  const dbId = COMPANY_DB_CONFIG[companyId]?.serviceContactDbId
  if (!dbId) {
    return NextResponse.json(
      { error: `企業ID "${companyId}" の問い合わせDBが未設定です` },
      { status: 500 },
    )
  }

  try {
    // ── Notion DB を全件クエリ（ページネーション対応）────────────
    // 最大200件まで取得（デモ規模では十分）
    const allResults: Record<string, unknown>[] = []
    let hasMore = true
    let startCursor: string | undefined = undefined

    while (hasMore && allResults.length < 200) {
      const reqBody: Record<string, unknown> = { page_size: 100 }
      if (startCursor) reqBody.start_cursor = startCursor

      const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
        method: 'POST',
        headers: notionHeaders(apiKey),
        body: JSON.stringify(reqBody),
      })

      if (!res.ok) {
        const errBody = await res.text()
        console.error('[kpi/summary] Notion クエリエラー:', res.status, errBody)
        return NextResponse.json(
          { error: `Notion APIエラー (${res.status}): ${errBody}` },
          { status: 500 },
        )
      }

      const data = await res.json() as {
        results: Record<string, unknown>[]
        has_more: boolean
        next_cursor: string | null
      }
      allResults.push(...data.results)
      hasMore = data.has_more
      startCursor = data.next_cursor ?? undefined
    }

    // ── 集計処理 ─────────────────────────────────────────
    const byStatus:   Record<string, number> = {}
    const byCategory: Record<string, number> = {}
    const byChannel:  Record<string, number> = {}
    const byPriority: Record<string, number> = {}

    for (const page of allResults) {
      // Notion ページのプロパティを型安全に取り出す
      const props = page.properties as Record<string, {
        select?: { name?: string }
      }>

      const status   = props['ステータス']?.select?.name   ?? '不明'
      const category = props['カテゴリ']?.select?.name     ?? '不明'
      const channel  = props['チャネル']?.select?.name     ?? '不明'
      const priority = props['優先度']?.select?.name       ?? '不明'

      byStatus[status]     = (byStatus[status]     ?? 0) + 1
      byCategory[category] = (byCategory[category] ?? 0) + 1
      byChannel[channel]   = (byChannel[channel]   ?? 0) + 1
      byPriority[priority] = (byPriority[priority] ?? 0) + 1
    }

    const total       = allResults.length
    const resolved    = byStatus['完了']   ?? 0
    const unresponded = byStatus['未対応'] ?? 0
    const inProgress  = byStatus['対応中'] ?? 0
    const highPriority = byPriority['高']  ?? 0

    // 解決率（完了件数 ÷ 総件数）
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0

    return NextResponse.json({
      total,
      resolved,
      resolutionRate,
      highPriority,
      unresponded,
      inProgress,
      byStatus,
      byCategory,
      byChannel,
      byPriority,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[kpi/summary] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
