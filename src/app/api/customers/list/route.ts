// =====================================================
//  src/app/api/customers/list/route.ts
//  顧客プロフィール一覧取得API — Sprint #41
//
//  ■ GET ?companyId=xxx&limit=50
//    顧客プロフィールDBから一覧を取得して返す。
//    来訪回数の多い顧客を上位に表示（降順）。
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type CustomerProfile = {
  id:            string
  customerName:  string
  visitCount:    number
  preferTags:    string[]
  lastVisitDate: string    // ISO8601（日付のみ）
  aiProfile:     string    // AIが生成した顧客特徴文
  recommend:     string    // 次回推奨アクション
  notionUrl:     string
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
  return ''
}

function getNumber(props: Record<string, unknown>, key: string): number {
  const p = props[key] as Record<string, unknown> | undefined
  if (!p || p.type !== 'number') return 0
  return (p.number as number | null) ?? 0
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

// ── メイン GET ハンドラー ─────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId') ?? 'kitano-resort'
  const limit     = parseInt(searchParams.get('limit') ?? '50', 10)

  // NOTION_TOKEN を優先し、なければ NOTION_API_KEY にフォールバック
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? ''
  if (!notionKey) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
  }

  const db = getCompanyDbConfig(companyId)
  if (!db.customerProfileDbId) {
    return NextResponse.json({ customers: [] })
  }

  try {
    const res = await fetch(`${NOTION_API}/databases/${db.customerProfileDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${notionKey}`,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VER,
      },
      body: JSON.stringify({
        // 来訪回数の多い顧客を上位表示
        sorts: [{ property: '来訪回数', direction: 'descending' }],
        page_size: Math.min(limit, 100),
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ customers: [] })
    }

    const data = await res.json() as { results: Record<string, unknown>[] }

    const customers: CustomerProfile[] = data.results.map((page) => {
      const props = page.properties as Record<string, unknown>
      return {
        id:            page.id as string,
        customerName:  getText(props, '顧客名'),
        visitCount:    getNumber(props, '来訪回数'),
        preferTags:    getMultiSelect(props, '好みタグ'),
        lastVisitDate: getDate(props, '最終来訪日'),
        aiProfile:     getText(props, 'AIプロファイル'),
        recommend:     getText(props, '推奨アクション'),
        notionUrl:     page.url as string ?? '',
      }
    })

    return NextResponse.json({ customers })
  } catch (err) {
    console.error('[customers/list] エラー:', err)
    return NextResponse.json({ customers: [] })
  }
}
