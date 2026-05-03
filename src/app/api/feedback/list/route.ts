// =====================================================
//  src/app/api/feedback/list/route.ts
//  企業の顧客フィードバック一覧を Notion DBから取得するAPIルート
//
//  ■ リクエスト（GET）
//    ?companyId=kitano-resort
//
//  ■ レスポンス
//    { feedbacks: FeedbackRecord[] }
// =====================================================

import { NextResponse } from 'next/server'
import { COMPANY_DB_CONFIG } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── 返却するフィードバックの型 ───────────────────────

export type FeedbackRecord = {
  pageId:      string
  feedbackId:  string
  rating:      string
  category:    string
  channel:     string
  date:        string
  customerName: string
  content:     string
  aiAnalysis:  string   // JSON文字列（parse済みオブジェクトはフロント側で処理）
  status:      string
}

export async function GET(request: Request) {
  const apiKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  if (!companyId) {
    return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
  }

  const dbId = COMPANY_DB_CONFIG[companyId]?.customerFeedbackDbId
  if (!dbId) {
    return NextResponse.json(
      { error: `企業ID "${companyId}" のフィードバックDBが未設定です` },
      { status: 500 },
    )
  }

  try {
    // Notion DBを受付日時の降順で取得（最新50件）
    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(apiKey),
      body: JSON.stringify({
        sorts: [{ property: '受付日時', direction: 'descending' }],
        page_size: 50,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return NextResponse.json(
        { error: `Notion APIエラー (${res.status}): ${errBody}` },
        { status: 500 },
      )
    }

    const data = await res.json() as {
      results: Record<string, unknown>[]
    }

    // ── Notion レスポンスをフラットな型に変換 ──────────
    const feedbacks: FeedbackRecord[] = data.results.map(page => {
      const props = page.properties as Record<string, {
        title?:     Array<{ plain_text?: string }>
        select?:    { name?: string }
        date?:      { start?: string }
        rich_text?: Array<{ plain_text?: string }>
      }>
      const id = page.id as string

      // rich_text / title のテキストを安全に取り出すヘルパー
      const getText = (prop: { title?: Array<{ plain_text?: string }>; rich_text?: Array<{ plain_text?: string }> } | undefined) =>
        prop?.title?.[0]?.plain_text
        ?? prop?.rich_text?.[0]?.plain_text
        ?? ''

      return {
        pageId:       id,
        feedbackId:   getText(props['フィードバックID']),
        rating:       props['評価']?.select?.name      ?? '',
        category:     props['カテゴリ']?.select?.name  ?? '',
        channel:      props['チャネル']?.select?.name  ?? '',
        date:         props['受付日時']?.date?.start   ?? '',
        customerName: getText(props['顧客名']),
        content:      getText(props['フィードバック内容']),
        aiAnalysis:   getText(props['AI感情分析']),
        status:       props['対応状況']?.select?.name  ?? '未確認',
      }
    })

    return NextResponse.json({ feedbacks })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[feedback/list] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
