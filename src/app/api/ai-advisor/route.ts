// =====================================================
//  src/app/api/ai-advisor/route.ts
//  AI経営顧問 — KPI + フィードバックを集約してClaude Haikuが経営提言を生成する
//
//  ■ 処理フロー
//    1. companyId から KPI集計（問い合わせ管理DB）を取得
//    2. 最新フィードバック上位10件を取得
//    3. Claude Haiku に送信 → 経営提言4件 + サマリー生成
//    4. JSON形式で返却
//
//  ■ リクエスト（GET）
//    ?companyId=kitano-resort
//
//  ■ レスポンス
//    {
//      summary:          string    // 経営状況サマリー（2文以内）
//      urgentItems:      string[]  // 緊急課題（最大3件）
//      recommendations:  Recommendation[]  // 提言4件
//      totalCostEffect:  string    // コスト試算合計
//      risks:            string[]  // リスク（最大2件）
//    }
// =====================================================

import { NextResponse } from 'next/server'
import { COMPANY_DB_CONFIG } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'
import Anthropic from '@anthropic-ai/sdk'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type Recommendation = {
  priority:   '高' | '中' | '低'
  title:      string   // 20文字以内
  detail:     string   // 1〜2文
  timing:     string   // 実施時期
  costEffect: string   // コスト・効果の概算
}

export type AdvisorResult = {
  summary:         string
  urgentItems:     string[]
  recommendations: Recommendation[]
  totalCostEffect: string
  risks:           string[]
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// rich_text / title のテキストを安全に取り出す
function getText(
  prop: { title?: Array<{ plain_text?: string }>; rich_text?: Array<{ plain_text?: string }> } | undefined
): string {
  return prop?.title?.[0]?.plain_text ?? prop?.rich_text?.[0]?.plain_text ?? ''
}

// ── KPI集計を取得 ──────────────────────────────────

async function fetchKpiData(apiKey: string, dbId: string) {
  // ページネーション対応で最大100件取得（デモ規模では十分）
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ page_size: 100 }),
  })
  if (!res.ok) return null

  const data = await res.json() as { results: Record<string, unknown>[] }

  const byStatus:   Record<string, number> = {}
  const byCategory: Record<string, number> = {}

  for (const page of data.results) {
    const props = page.properties as Record<string, { select?: { name?: string } }>
    const status   = props['ステータス']?.select?.name ?? '不明'
    const category = props['カテゴリ']?.select?.name   ?? '不明'
    byStatus[status]     = (byStatus[status]     ?? 0) + 1
    byCategory[category] = (byCategory[category] ?? 0) + 1
  }

  const total       = data.results.length
  const resolved    = byStatus['完了']   ?? 0
  const unresponded = byStatus['未対応'] ?? 0
  const highPriority = 0 // 簡略化（AIへの入力データ節約のため省略）

  return { total, resolved, unresponded, highPriority, byCategory }
}

// ── 最新フィードバックを取得 ────────────────────────

async function fetchRecentFeedbacks(apiKey: string, dbId: string) {
  if (!dbId) return []

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({
      sorts: [{ property: '受付日時', direction: 'descending' }],
      page_size: 10,  // Claude Haiku へのトークン節約のため最新10件に絞る
    }),
  })
  if (!res.ok) return []

  const data = await res.json() as { results: Record<string, unknown>[] }

  return data.results.slice(0, 10).map(page => {
    const props = page.properties as Record<string, {
      title?:     Array<{ plain_text?: string }>
      select?:    { name?: string }
      rich_text?: Array<{ plain_text?: string }>
    }>

    const aiRaw   = getText(props['AI感情分析'])
    let sentiment = ''
    let summary   = ''

    // AI感情分析JSONをパース（失敗しても続行）
    try {
      if (aiRaw) {
        const parsed = JSON.parse(aiRaw) as { sentiment?: string; summary?: string }
        sentiment = parsed.sentiment ?? ''
        summary   = parsed.summary   ?? ''
      }
    } catch { /* 無視 */ }

    return {
      rating:    props['評価']?.select?.name    ?? '',
      category:  props['カテゴリ']?.select?.name ?? '',
      sentiment,
      summary,
    }
  })
}

// ── メインハンドラー ────────────────────────────────

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

  const company = getCompanyById(companyId)
  const dbConfig = COMPANY_DB_CONFIG[companyId]
  if (!dbConfig?.serviceContactDbId) {
    return NextResponse.json({ error: `企業ID "${companyId}" のDBが未設定です` }, { status: 500 })
  }

  try {
    // ── データ収集（並列実行でレスポンス時間短縮）────────────
    const [kpi, feedbacks] = await Promise.all([
      fetchKpiData(notionKey, dbConfig.serviceContactDbId),
      fetchRecentFeedbacks(notionKey, dbConfig.customerFeedbackDbId ?? ''),
    ])

    if (!kpi) {
      return NextResponse.json({ error: 'KPIデータの取得に失敗しました' }, { status: 500 })
    }

    // ── カテゴリを件数降順で上位5件に絞る ─────────────────
    const topCategories = Object.entries(kpi.byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, count]) => `${cat}:${count}件`)
      .join('、')

    // ── フィードバックのサマリーテキスト ──────────────────
    const posCount  = feedbacks.filter(f => f.sentiment === 'ポジティブ').length
    const negCount  = feedbacks.filter(f => f.sentiment === 'ネガティブ').length
    const fbSummary = feedbacks
      .filter(f => f.summary)
      .slice(0, 5)
      .map(f => `[${f.sentiment || f.rating}] ${f.summary}`)
      .join('\n')

    // ── Claude Haiku にプロンプト送信 ────────────────────
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'Anthropic APIキーが未設定です' }, { status: 500 })
    }

    const client = new Anthropic({ apiKey: anthropicKey })

    // CLAUDE.md ルール: 上位12件以内に絞り、JSON出力形式を明示的に制限する
    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      '{"summary":"2文以内","urgentItems":["最大3件・1文以内"],"recommendations":[',
      '{"priority":"高|中|低","title":"20文字以内","detail":"1〜2文","timing":"時期","costEffect":"金額概算"}',
      '],"totalCostEffect":"年間約X万円","risks":["最大2件・1文以内"]}',
      '※ JSONのみ出力。説明文・コードブロック不要。簡潔さを最優先すること。',
      '※ recommendationsは必ず4件出力すること。',
    ].join('\n')

    const prompt = `あなたは中小企業向け経営コンサルタントです。
以下の${company.name}（${company.industry === 'hotel' ? 'ホテル業' : company.industry === 'medical' ? '医療業' : company.industry === 'food' ? '飲食業' : '小売業'}）の経営データを分析し、具体的な改善提言を生成してください。

【問い合わせKPIデータ】
- 総問い合わせ件数: ${kpi.total}件
- 解決済み: ${kpi.resolved}件（解決率${kpi.total > 0 ? Math.round(kpi.resolved / kpi.total * 100) : 0}%）
- 未対応: ${kpi.unresponded}件
- 主要カテゴリ: ${topCategories || 'データなし'}

【顧客フィードバック傾向（直近10件）】
- ポジティブ: ${posCount}件、ネガティブ: ${negCount}件
${fbSummary ? `- 主要な声:\n${fbSummary}` : '- フィードバックデータなし'}

${outputFormat}`

    const res = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,  // CLAUDE.md ルール: 4096固定
      messages:   [{ role: 'user', content: prompt }],
    })

    // CLAUDE.md ルール: stop_reason チェック
    if (res.stop_reason === 'max_tokens') {
      console.warn('[ai-advisor] max_tokens に達しました。出力が途中で切れている可能性があります')
    }

    const text    = res.content[0]?.type === 'text' ? res.content[0].text.trim() : ''
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result  = JSON.parse(jsonStr) as AdvisorResult

    return NextResponse.json(result)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-advisor] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
