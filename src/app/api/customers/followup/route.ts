// =====================================================
//  src/app/api/customers/followup/route.ts
//  再来店フォローアップ顧客取得API — Sprint #42
//
//  ■ GET ?companyId=xxx&days=14
//    ① Notion 顧客プロフィールDB から全顧客を取得
//    ② lastVisitDate から経過日数を計算し、days 以上の顧客を抽出
//    ③ 上位8件に対してHaikuでAI再来店メッセージを一括生成
//    ④ 経過日数の多い順に返却
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type FollowUpCustomer = {
  id:              string
  customerName:    string
  visitCount:      number
  preferTags:      string[]
  lastVisitDate:   string    // ISO8601（日付のみ）
  daysSinceVisit:  number    // 今日からの経過日数
  aiMessage:       string    // AI生成の再来店メッセージ
  aiProfile:       string    // 既存のAIプロファイル
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

// ── 経過日数を計算 ─────────────────────────────────

function calcDaysSince(dateStr: string): number {
  if (!dateStr) return 9999
  const last = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = today.getTime() - last.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// ── Haiku で再来店メッセージを一括生成 ───────────────

async function generateFollowUpMessages(
  companyName: string,
  industry: string,
  customers: Array<{ name: string; tags: string[]; visitCount: number; days: number }>,
  anthropicKey: string,
): Promise<string[]> {
  if (customers.length === 0) return []

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  // 顧客リストをJSON形式でプロンプトに埋め込む（上位12件まで）
  const customerList = customers.slice(0, 12).map((c, i) =>
    `${i + 1}. ${c.name}（来訪${c.visitCount}回・${c.days}日未来訪・好み:${c.tags.join('/')}）`
  ).join('\n')

  const prompt = `あなたは${companyName}（${industry}業）のAIサービスアドバイザーです。
以下の顧客リストに対して、それぞれに個別の再来店フォローアップメッセージを生成してください。

【顧客リスト】
${customerList}

【生成ルール】
- 各顧客に1つのメッセージ（50文字以内）
- 好みタグや来訪回数を活かした個別性の高いメッセージ
- 温かみがありながらプロフェッショナルなトーン
- 来訪回数が多い顧客はVIP感を出す

【出力形式（JSON）— 必ずこの形式のみで回答すること】
{"messages":["メッセージ1","メッセージ2","メッセージ3",...]}
※ JSONのみ出力。説明文・コードブロック不要。リストの順番通りに出力すること。`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned) as { messages: string[] }
  return parsed.messages ?? []
}

// ── メイン GET ハンドラー ─────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const companyId   = searchParams.get('companyId') ?? 'kitano-resort'
  const thresholdDays = parseInt(searchParams.get('days') ?? '14', 10)

  // 環境変数チェック
  const notionKey    = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''

  if (!notionKey || !anthropicKey) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
  }

  const db      = getCompanyDbConfig(companyId)
  const company = getCompanyById(companyId)

  if (!db.customerProfileDbId) {
    return NextResponse.json({ customers: [] })
  }

  // ── ① Notion から全顧客を取得（最終来訪日昇順） ───────
  let allCustomers: FollowUpCustomer[] = []
  try {
    const res = await fetch(`${NOTION_API}/databases/${db.customerProfileDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${notionKey}`,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VER,
      },
      body: JSON.stringify({
        // 最終来訪日の古い順（フォローアップ優先度が高い順）
        sorts: [{ property: '最終来訪日', direction: 'ascending' }],
        page_size: 100,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ customers: [] })
    }

    const data = await res.json() as { results: Record<string, unknown>[] }

    allCustomers = data.results.map((page) => {
      const props         = page.properties as Record<string, unknown>
      const lastVisitDate = getDate(props, '最終来訪日')
      return {
        id:             page.id as string,
        customerName:   getText(props, '顧客名'),
        visitCount:     getNumber(props, '来訪回数'),
        preferTags:     getMultiSelect(props, '好みタグ'),
        lastVisitDate,
        daysSinceVisit: calcDaysSince(lastVisitDate),
        aiProfile:      getText(props, 'AIプロファイル'),
        aiMessage:      '',    // 後で生成
        notionUrl:      page.url as string ?? '',
      }
    })
  } catch (err) {
    console.error('[customers/followup] Notion取得エラー:', err)
    return NextResponse.json({ customers: [] })
  }

  // ── ② 経過日数でフィルタリング ────────────────────────
  const overdueCustomers = allCustomers
    .filter(c => c.daysSinceVisit >= thresholdDays)
    .slice(0, 8)    // 上位8件のみ処理

  if (overdueCustomers.length === 0) {
    return NextResponse.json({ customers: [] })
  }

  // ── ③ Haiku でメッセージを一括生成 ───────────────────
  let messages: string[] = []
  try {
    messages = await generateFollowUpMessages(
      company.name,
      company.industry,
      overdueCustomers.map(c => ({
        name:       c.customerName,
        tags:       c.preferTags,
        visitCount: c.visitCount,
        days:       c.daysSinceVisit,
      })),
      anthropicKey,
    )
  } catch (err) {
    console.error('[customers/followup] Haiku生成エラー:', err)
    // フォールバックメッセージ
    messages = overdueCustomers.map(c =>
      `${c.customerName}様、最近お会いできていませんね。またのご来店をお待ちしております。`
    )
  }

  // ④ メッセージをマージして返却
  const result: FollowUpCustomer[] = overdueCustomers.map((c, i) => ({
    ...c,
    aiMessage: messages[i] ?? `${c.customerName}様のご来店をお待ちしております。`,
  }))

  return NextResponse.json({ customers: result })
}
