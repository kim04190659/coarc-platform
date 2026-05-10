// =====================================================
//  src/app/api/delight-log/list/route.ts
//  感動ログ一覧取得API — Sprint #39
//
//  ■ GET ?companyId=xxx&limit=20
//    感動ログDBから最新順で取得して返す。
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type DelightLogItem = {
  id:              string
  logTitle:        string
  staffName:       string
  category:        string
  action:          string
  customerReaction: string
  tags:            string[]
  score:           number
  aiComment:       string
  recordedAt:      string   // ISO8601
  notionUrl:       string
}

// ── プロパティ取り出しヘルパー ────────────────────────

function getText(props: Record<string, unknown>, key: string): string {
  const p = props[key] as Record<string, unknown> | undefined
  if (!p) return ''
  if (p.type === 'title' && Array.isArray(p.title)) {
    return (p.title as { plain_text: string }[]).map(t => t.plain_text).join('')
  }
  if (p.type === 'rich_text' && Array.isArray(p.rich_text)) {
    return (p.rich_text as { plain_text: string }[]).map(t => t.plain_text).join('')
  }
  if (p.type === 'select') {
    return (p.select as { name?: string } | null)?.name ?? ''
  }
  if (p.type === 'number') {
    return String(p.number ?? '')
  }
  return ''
}

function getMultiSelect(props: Record<string, unknown>, key: string): string[] {
  const p = props[key] as Record<string, unknown> | undefined
  if (!p || p.type !== 'multi_select') return []
  return (p.multi_select as { name: string }[]).map(t => t.name)
}

function getDate(props: Record<string, unknown>, key: string): string {
  const p = props[key] as Record<string, unknown> | undefined
  if (!p || p.type !== 'date') return ''
  return (p.date as { start?: string } | null)?.start ?? ''
}

function getNumber(props: Record<string, unknown>, key: string): number {
  const p = props[key] as Record<string, unknown> | undefined
  if (!p || p.type !== 'number') return 0
  return (p.number as number | null) ?? 0
}

// ── メイン GET ハンドラー ─────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId') ?? 'kitano-resort'
  const limit     = parseInt(searchParams.get('limit') ?? '20', 10)

  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? ''
  if (!notionKey) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
  }

  const db = getCompanyDbConfig(companyId)
  if (!db.delightLogDbId) {
    return NextResponse.json({ logs: [] })
  }

  try {
    const res = await fetch(`${NOTION_API}/databases/${db.delightLogDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${notionKey}`,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VER,
      },
      body: JSON.stringify({
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        page_size: Math.min(limit, 50),
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ logs: [] })
    }

    const data = await res.json() as { results: Record<string, unknown>[] }

    const logs: DelightLogItem[] = data.results.map((page) => {
      const props = page.properties as Record<string, unknown>
      return {
        id:              page.id as string,
        logTitle:        getText(props, 'ログタイトル'),
        staffName:       getText(props, 'スタッフ名'),
        category:        getText(props, '感動カテゴリ'),
        action:          getText(props, '顧客への対応内容'),
        customerReaction: getText(props, '顧客の反応'),
        tags:            getMultiSelect(props, 'AIタグ'),
        score:           getNumber(props, '感動スコア'),
        aiComment:       getText(props, 'AIコメント'),
        recordedAt:      getDate(props, '記録日') || (page.created_time as string ?? ''),
        notionUrl:       page.url as string ?? '',
      }
    })

    return NextResponse.json({ logs })
  } catch (err) {
    console.error('[delight-log/list] エラー:', err)
    return NextResponse.json({ logs: [] })
  }
}
