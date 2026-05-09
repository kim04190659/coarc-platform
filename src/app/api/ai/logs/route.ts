// =====================================================
//  src/app/api/ai/logs/route.ts
//  AI質問ログ取得 API
//
//  ■ GET /api/ai/logs?companyId=xxx&limit=50
//    → 最新のAI質問ログ一覧を返す
//
//  ■ レスポンス
//    { logs: AiChatLog[], total: number }
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type AiChatLog = {
  id:          string
  question:    string
  answer:      string
  source:      string   // フリーチャット / AIアドバイザー / 人材育成 / etc.
  recordedAt:  string   // ISO日時
  model:       string
  elapsedMs:   number | null
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── メインハンドラー ────────────────────────────────

export async function GET(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  if (!companyId) {
    return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
  }

  // ✅ 企業別DB方式: companyId からAIログDB IDを取得
  const dbConfig = getCompanyDbConfig(companyId)

  if (!dbConfig.aiChatLogDbId) {
    return NextResponse.json({ logs: [], total: 0 })
  }

  try {
    // ✅ 企業専用AIログDBにクエリ（記録日時の降順）
    const res = await fetch(`${NOTION_API}/databases/${dbConfig.aiChatLogDbId}/query`, {
      method:  'POST',
      headers: notionHeaders(notionKey),
      body:    JSON.stringify({
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        page_size: limit,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`AIログ取得エラー (${res.status}): ${err}`)
    }

    const data = await res.json() as { results: Record<string, unknown>[] }

    // Notionページをログ型にマッピング
    const logs: AiChatLog[] = data.results.map(page => {
      const props = page.properties as Record<string, {
        title?:     Array<{ plain_text?: string }>
        rich_text?: Array<{ plain_text?: string }>
        select?:    { name?: string }
        date?:      { start?: string }
        number?:    number | null
      }>

      const getText = (p: typeof props[string] | undefined) =>
        p?.title?.[0]?.plain_text ?? p?.rich_text?.[0]?.plain_text ?? ''

      return {
        id:         page.id as string,
        question:   getText(props['質問']),
        answer:     getText(props['回答']),
        source:     props['ソース']?.select?.name     ?? '',
        recordedAt: props['記録日時']?.date?.start     ?? (page.created_time as string ?? ''),
        model:      getText(props['モデル']),
        elapsedMs:  props['応答時間ms']?.number        ?? null,
      }
    })

    return NextResponse.json({ logs, total: logs.length })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai/logs] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
