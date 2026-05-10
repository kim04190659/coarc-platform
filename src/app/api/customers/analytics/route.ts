// =====================================================
//  src/app/api/customers/analytics/route.ts
//  顧客分析ダッシュボードAPI — Sprint #43
//
//  ■ GET ?companyId=xxx
//    ① Notion 顧客プロフィールDB から全顧客を取得
//    ② VIP数・リピーター率・来訪分布・タグ頻度などを集計
//    ③ Haiku で AIインサイトを生成
//    ④ 分析結果を返却
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type CustomerSummary = {
  id:            string
  customerName:  string
  visitCount:    number
  preferTags:    string[]
  lastVisitDate: string
  aiProfile:     string
}

export type TagFrequency = {
  tag:   string
  count: number
}

export type VisitBracket = {
  label: string   // '1回', '2〜4回', '5〜9回', '10回以上'
  count: number
}

export type CustomerAnalytics = {
  totalCustomers:    number
  vipCount:          number       // 来訪10回以上
  repeaterCount:     number       // 来訪5〜9回
  newishCount:       number       // 来訪2〜4回
  firstTimerCount:   number       // 来訪1回
  avgVisitCount:     number       // 平均来訪回数
  overdueCount:      number       // 14日以上未来訪
  tagFrequencies:    TagFrequency[]  // 好みタグ頻度（降順）
  visitBrackets:     VisitBracket[]  // 来訪回数分布
  topCustomers:      CustomerSummary[]  // 上位5名（来訪回数順）
  aiInsights:        string[]     // Haikuが生成したインサイト（3件）
  aiRecommendations: string[]     // Haikuが生成した施策提案（3件）
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

// ── Haiku でインサイトと施策提案を生成 ───────────────

async function generateInsights(
  companyName: string,
  industry: string,
  analytics: Omit<CustomerAnalytics, 'aiInsights' | 'aiRecommendations'>,
  anthropicKey: string,
): Promise<{ insights: string[]; recommendations: string[] }> {
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  // タグ頻度の上位5件だけ送る
  const topTags = analytics.tagFrequencies.slice(0, 5)
    .map(t => `${t.tag}(${t.count}件)`)
    .join('・')

  const prompt = `あなたは${companyName}（${industry}業）のAI顧客分析アドバイザーです。
以下の顧客データを分析して、インサイトと施策提案を生成してください。

【顧客統計】
総顧客数: ${analytics.totalCustomers}名
VIP（10回以上）: ${analytics.vipCount}名
リピーター（5〜9回）: ${analytics.repeaterCount}名
2〜4回来訪: ${analytics.newishCount}名
1回来訪: ${analytics.firstTimerCount}名
平均来訪回数: ${analytics.avgVisitCount.toFixed(1)}回
14日以上未来訪: ${analytics.overdueCount}名
人気タグTOP5: ${topTags || '未設定'}

【出力形式（JSON）— 必ずこの形式のみで回答すること】
{"insights":["インサイト1（30文字以内）","インサイト2（30文字以内）","インサイト3（30文字以内）"],"recommendations":["施策提案1（40文字以内）","施策提案2（40文字以内）","施策提案3（40文字以内）"]}
※ JSONのみ出力。説明文・コードブロック不要。`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned) as { insights: string[]; recommendations: string[] }
  return {
    insights:        parsed.insights        ?? [],
    recommendations: parsed.recommendations ?? [],
  }
}

// ── メイン GET ハンドラー ─────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId') ?? 'kitano-resort'

  const notionKey    = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''

  if (!notionKey || !anthropicKey) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
  }

  const db      = getCompanyDbConfig(companyId)
  const company = getCompanyById(companyId)

  if (!db.customerProfileDbId) {
    return NextResponse.json({ error: '顧客プロフィールDBが設定されていません' }, { status: 400 })
  }

  // ── ① Notion から全顧客を取得 ────────────────────────
  let customers: CustomerSummary[] = []
  try {
    const res = await fetch(`${NOTION_API}/databases/${db.customerProfileDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${notionKey}`,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VER,
      },
      body: JSON.stringify({
        sorts: [{ property: '来訪回数', direction: 'descending' }],
        page_size: 100,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Notion取得エラー' }, { status: 500 })
    }

    const data = await res.json() as { results: Record<string, unknown>[] }
    customers = data.results.map((page) => {
      const props = page.properties as Record<string, unknown>
      return {
        id:            page.id as string,
        customerName:  getText(props, '顧客名'),
        visitCount:    getNumber(props, '来訪回数'),
        preferTags:    getMultiSelect(props, '好みタグ'),
        lastVisitDate: getDate(props, '最終来訪日'),
        aiProfile:     getText(props, 'AIプロファイル'),
      }
    })
  } catch (err) {
    console.error('[customers/analytics] Notion取得エラー:', err)
    return NextResponse.json({ error: 'データ取得エラー' }, { status: 500 })
  }

  const totalCustomers = customers.length
  if (totalCustomers === 0) {
    return NextResponse.json({
      totalCustomers: 0, vipCount: 0, repeaterCount: 0,
      newishCount: 0, firstTimerCount: 0, avgVisitCount: 0,
      overdueCount: 0, tagFrequencies: [], visitBrackets: [],
      topCustomers: [], aiInsights: [], aiRecommendations: [],
    })
  }

  // ── ② 集計処理 ───────────────────────────────────────

  // 来訪回数ブラケット
  const vipCount       = customers.filter(c => c.visitCount >= 10).length
  const repeaterCount  = customers.filter(c => c.visitCount >= 5 && c.visitCount < 10).length
  const newishCount    = customers.filter(c => c.visitCount >= 2 && c.visitCount < 5).length
  const firstTimerCount = customers.filter(c => c.visitCount < 2).length

  // 平均来訪回数
  const sumVisits = customers.reduce((acc, c) => acc + c.visitCount, 0)
  const avgVisitCount = sumVisits / totalCustomers

  // 14日以上未来訪
  const overdueCount = customers.filter(c => calcDaysSince(c.lastVisitDate) >= 14).length

  // タグ頻度集計
  const tagMap = new Map<string, number>()
  for (const c of customers) {
    for (const tag of c.preferTags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
    }
  }
  const tagFrequencies: TagFrequency[] = Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)

  // 来訪回数分布
  const visitBrackets: VisitBracket[] = [
    { label: '10回以上（VIP）', count: vipCount },
    { label: '5〜9回（リピーター）', count: repeaterCount },
    { label: '2〜4回', count: newishCount },
    { label: '1回', count: firstTimerCount },
  ]

  // 上位5名
  const topCustomers = customers.slice(0, 5)

  // ── ③ Haiku でインサイト生成 ──────────────────────────
  const baseAnalytics = {
    totalCustomers, vipCount, repeaterCount, newishCount,
    firstTimerCount, avgVisitCount, overdueCount,
    tagFrequencies, visitBrackets, topCustomers,
  }

  let aiInsights: string[] = []
  let aiRecommendations: string[] = []

  try {
    const result = await generateInsights(
      company.name, company.industry, baseAnalytics, anthropicKey,
    )
    aiInsights        = result.insights
    aiRecommendations = result.recommendations
  } catch (err) {
    console.error('[customers/analytics] Haiku生成エラー:', err)
    aiInsights        = ['顧客データの集計が完了しました。']
    aiRecommendations = ['VIP顧客への特別対応を検討してください。']
  }

  const result: CustomerAnalytics = {
    ...baseAnalytics,
    aiInsights,
    aiRecommendations,
  }

  return NextResponse.json(result)
}
