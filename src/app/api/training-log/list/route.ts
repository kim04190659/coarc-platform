// =====================================================
//  src/app/api/training-log/list/route.ts
//  研修ログ一覧取得 API — Sprint #28
//
//  ■ GET ?companyId=xxx[&staffName=xxx][&gameId=xxx]
//    Notion の trainingLogDbId から研修ログを取得して返す。
//    trainingLogDbId が未設定の場合は空配列を返す。
//
//  ■ 出力
//    logs: TrainingLog[]  最大50件・実施日降順
// =====================================================

import { NextResponse }       from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'

// ── 型定義 ──────────────────────────────────────────

export type TrainingLog = {
  id:             string   // Notion ページ ID
  staffName:      string
  gameTitle:      string
  gameId:         string
  score:          number
  grade:          'S' | 'A' | 'B' | 'C' | 'D'
  scenariosPlayed: number
  playedAt:       string   // ISO8601
}

export type TrainingLogListResponse = {
  logs:    TrainingLog[]
  total:   number
  hasDb:   boolean   // false = trainingLogDbId 未設定
}

// ── Notion APIヘッダー ────────────────────────────────

function notionHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization':  `Bearer ${apiKey}`,
    'Content-Type':   'application/json',
    'Notion-Version': '2022-06-28',
  }
}

// ── GET ──────────────────────────────────────────────

export async function GET(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json<TrainingLogListResponse>(
      { logs: [], total: 0, hasDb: false },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const companyId  = searchParams.get('companyId')  ?? 'kitano-resort'
  const staffName  = searchParams.get('staffName')  ?? ''
  const gameId     = searchParams.get('gameId')     ?? ''

  // ── 企業の研修ログDBを取得 ──
  const dbConfig       = getCompanyDbConfig(companyId)
  const trainingLogDbId = dbConfig.trainingLogDbId

  if (!trainingLogDbId) {
    return NextResponse.json<TrainingLogListResponse>({
      logs: [], total: 0, hasDb: false,
    })
  }

  // ── Notion DB クエリ（フィルタ + 日時降順 + 最大50件） ──
  const filterConditions: object[] = []

  if (staffName) {
    filterConditions.push({
      property: '氏名',
      rich_text: { contains: staffName },
    })
  }

  if (gameId) {
    filterConditions.push({
      property: 'ゲームID',
      rich_text: { equals: gameId },
    })
  }

  const queryBody: Record<string, unknown> = {
    sorts: [
      { property: '実施日', direction: 'descending' },
    ],
    page_size: 50,
  }

  if (filterConditions.length === 1) {
    queryBody.filter = filterConditions[0]
  } else if (filterConditions.length > 1) {
    queryBody.filter = { and: filterConditions }
  }

  try {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${trainingLogDbId}/query`,
      {
        method:  'POST',
        headers: notionHeaders(notionKey),
        body:    JSON.stringify(queryBody),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[training-log/list] Notion APIエラー ${res.status}:`, errText.slice(0, 200))
      return NextResponse.json<TrainingLogListResponse>({
        logs: [], total: 0, hasDb: true,
      })
    }

    const data = await res.json() as {
      results: Array<{
        id: string
        properties: Record<string, {
          title?:     Array<{ plain_text: string }>
          rich_text?: Array<{ plain_text: string }>
          number?:    number | null
          select?:    { name: string } | null
          date?:      { start: string } | null
        }>
      }>
    }

    // ── Notion レスポンスをアプリ型に変換 ──
    const logs: TrainingLog[] = data.results.map(page => {
      const p = page.properties
      return {
        id:              page.id,
        staffName:       p['氏名']?.rich_text?.[0]?.plain_text  ?? '',
        gameTitle:       p['研修名']?.title?.[0]?.plain_text     ?? '',
        gameId:          p['ゲームID']?.rich_text?.[0]?.plain_text ?? '',
        score:           p['スコア']?.number                     ?? 0,
        grade:           (p['グレード']?.select?.name as TrainingLog['grade']) ?? 'C',
        scenariosPlayed: p['回答数']?.number                     ?? 0,
        playedAt:        p['実施日']?.date?.start               ?? '',
      }
    })

    return NextResponse.json<TrainingLogListResponse>({
      logs,
      total: logs.length,
      hasDb: true,
    })
  } catch (err) {
    console.error('[training-log/list] フェッチエラー:', err)
    return NextResponse.json<TrainingLogListResponse>({
      logs: [], total: 0, hasDb: true,
    })
  }
}
