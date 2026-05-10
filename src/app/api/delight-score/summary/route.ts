// =====================================================
//  src/app/api/delight-score/summary/route.ts
//  感動KPIサマリーAPI — Sprint 45
//
//  ■ GET ?companyId=xxx
//    ① 感動ログDBを全件取得（最大100件）
//    ② 総件数・平均スコア・カテゴリ分布・スコア分布・タグ頻度・スタッフ貢献を集計
//    ③ Haikuが AIインサイト3件 + AI施策提案3件 を生成
//    ④ DelightKpiSummary を返却
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type CategoryStat = {
  category: string
  count:    number
  avgScore: number
}

export type ScoreBar = {
  score: number   // 1〜5
  count: number
  pct:   number   // 0〜100
}

export type TagStat = {
  tag:   string
  count: number
}

export type DelightKpiSummary = {
  totalCount:        number
  avgScore:          number
  topCategory:       string
  categoryBreakdown: CategoryStat[]
  scoreDistribution: ScoreBar[]
  tagFrequency:      TagStat[]       // top 6
  topContributors:   { staffName: string; count: number; avgScore: number }[]  // top 5
  aiInsights:        string[]        // 3件
  aiRecommendations: string[]        // 3件
}

// ── Notion APIヘッダー ────────────────────────────────

function headers(key: string): Record<string, string> {
  return {
    'Authorization':  `Bearer ${key}`,
    'Content-Type':   'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── テキスト・数値取得ヘルパー ───────────────────────

function getText(props: Record<string, unknown>, key: string): string {
  const p = props[key] as Record<string, unknown> | undefined
  if (!p) return ''
  if (p.type === 'title'     && Array.isArray(p.title))     return (p.title     as { plain_text: string }[]).map(t => t.plain_text).join('')
  if (p.type === 'rich_text' && Array.isArray(p.rich_text)) return (p.rich_text as { plain_text: string }[]).map(t => t.plain_text).join('')
  if (p.type === 'select')   return (p.select as { name?: string } | null)?.name ?? ''
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

// ── Haiku で AIインサイト・施策提案を一括生成 ────────

async function generateInsights(
  companyName:       string,
  totalCount:        number,
  avgScore:          number,
  topCategory:       string,
  categoryBreakdown: CategoryStat[],
  tagFrequency:      TagStat[],
  anthropicKey:      string,
): Promise<{ insights: string[]; recommendations: string[] }> {
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const catText = categoryBreakdown.slice(0, 5).map(c =>
    `${c.category}（${c.count}件・平均${c.avgScore.toFixed(1)}点）`
  ).join('、')
  const tagText = tagFrequency.slice(0, 5).map(t => t.tag).join('・')

  const prompt = `あなたは${companyName}のAIサービス改善アドバイザーです。
以下の感動ログKPIを分析し、インサイトと施策提案を生成してください。

【感動ログKPI】
- 総記録件数: ${totalCount}件
- 平均感動スコア: ${avgScore.toFixed(2)}（5点満点）
- 最多カテゴリ: ${topCategory}
- カテゴリ内訳: ${catText}
- 頻出AIタグ: ${tagText}

【出力形式（JSON）— 必ずこの形式のみで回答すること】
{"insights":["インサイト1（30文字以内）","インサイト2","インサイト3"],"recommendations":["施策1（30文字以内）","施策2","施策3"]}
※ JSONのみ出力。説明文・コードブロック不要。`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  })

  // max_tokens 到達警告
  if (response.stop_reason === 'max_tokens') {
    console.warn('[delight-score/summary] max_tokens に達しました。出力が途中切れの可能性があります。')
  }

  const text    = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed  = JSON.parse(cleaned) as { insights: string[]; recommendations: string[] }
  return {
    insights:        parsed.insights        ?? [],
    recommendations: parsed.recommendations ?? [],
  }
}

// ── メイン GET ハンドラー ─────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const companyId   = searchParams.get('companyId') ?? 'kitano-resort'

  const notionKey    = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''

  if (!notionKey || !anthropicKey) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
  }

  const db      = getCompanyDbConfig(companyId)
  const company = getCompanyById(companyId)

  if (!db.delightLogDbId) {
    return NextResponse.json({ summary: null })
  }

  // ── ① 感動ログを全件取得（最大100件） ─────────────
  type LogRow = { staffName: string; category: string; score: number; tags: string[] }
  let logs: LogRow[] = []

  try {
    const res = await fetch(`${NOTION_API}/databases/${db.delightLogDbId}/query`, {
      method: 'POST',
      headers: headers(notionKey),
      body: JSON.stringify({
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        page_size: 100,
      }),
    })
    if (res.ok) {
      const data = await res.json() as { results: Record<string, unknown>[] }
      logs = data.results.map(page => {
        const props = page.properties as Record<string, unknown>
        return {
          staffName: getText(props, 'スタッフ名'),
          category:  getText(props, '感動カテゴリ'),
          score:     getNumber(props, '感動スコア'),
          tags:      getMultiSelect(props, 'AIタグ'),
        }
      })
    }
  } catch (err) {
    console.error('[delight-score/summary] 感動ログ取得エラー:', err)
  }

  if (logs.length === 0) {
    return NextResponse.json({ summary: null })
  }

  // ── ② 集計処理 ──────────────────────────────────

  const totalCount  = logs.length
  const validScores = logs.filter(l => l.score > 0)
  const avgScore    = validScores.length > 0
    ? validScores.reduce((sum, l) => sum + l.score, 0) / validScores.length
    : 0

  // カテゴリ別集計
  const catMap = new Map<string, { count: number; scoreSum: number }>()
  for (const log of logs) {
    if (!log.category) continue
    const entry = catMap.get(log.category) ?? { count: 0, scoreSum: 0 }
    entry.count++
    entry.scoreSum += log.score
    catMap.set(log.category, entry)
  }
  const categoryBreakdown: CategoryStat[] = Array.from(catMap.entries())
    .map(([category, { count, scoreSum }]) => ({
      category,
      count,
      avgScore: count > 0 ? scoreSum / count : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const topCategory = categoryBreakdown[0]?.category ?? '未設定'

  // スコア分布（1〜5）
  const scoreCounts = [0, 0, 0, 0, 0]  // index 0 = score 1
  for (const log of logs) {
    const idx = Math.round(log.score) - 1
    if (idx >= 0 && idx <= 4) scoreCounts[idx]++
  }
  const scoreDistribution: ScoreBar[] = scoreCounts.map((count, i) => ({
    score: i + 1,
    count,
    pct:   totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
  }))

  // タグ頻度（上位6件）
  const tagMap = new Map<string, number>()
  for (const log of logs) {
    for (const tag of log.tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
    }
  }
  const tagFrequency: TagStat[] = Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // スタッフ別集計（上位5名）
  const staffMap = new Map<string, { count: number; scoreSum: number }>()
  for (const log of logs) {
    if (!log.staffName) continue
    const entry = staffMap.get(log.staffName) ?? { count: 0, scoreSum: 0 }
    entry.count++
    entry.scoreSum += log.score
    staffMap.set(log.staffName, entry)
  }
  const topContributors = Array.from(staffMap.entries())
    .map(([staffName, { count, scoreSum }]) => ({
      staffName,
      count,
      avgScore: count > 0 ? scoreSum / count : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // ── ③ Haiku でAIインサイト・施策提案を生成 ────────
  let aiInsights:        string[] = []
  let aiRecommendations: string[] = []

  try {
    const result = await generateInsights(
      company.name,
      totalCount,
      avgScore,
      topCategory,
      categoryBreakdown,
      tagFrequency,
      anthropicKey,
    )
    aiInsights        = result.insights
    aiRecommendations = result.recommendations
  } catch (err) {
    console.error('[delight-score/summary] Haiku生成エラー:', err)
  }

  // ── ④ レスポンス ─────────────────────────────────
  const summary: DelightKpiSummary = {
    totalCount,
    avgScore,
    topCategory,
    categoryBreakdown,
    scoreDistribution,
    tagFrequency,
    topContributors,
    aiInsights,
    aiRecommendations,
  }

  return NextResponse.json({ summary })
}
