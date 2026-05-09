// =====================================================
//  src/app/api/ai-ext/sales-forecast/route.ts
//  売上予測AI — Sprint #23
//
//  ■ GET ?companyId=xxx
//    KPI目標・フィードバック・社員コンディション・問い合わせの
//    4DBを並列取得して統合集計し、Claude Haiku で
//    業績の予測方向・確信度・ドライバー・リスクを生成する。
//
//  ■ 出力
//    - forecast:          上昇/横ばい/下降
//    - confidence:        high/medium/low（確信度）
//    - positiveDrivers:   成長ドライバー（最大3件）
//    - negativeRisks:     リスク要因（最大3件）
//    - recommendations:   優先アクション（最大4件・時期付き）
//    - disclaimer:        AI免責文言
//
//  ■ 設計ポイント
//    - 4DB並列取得で最速集計（Promise.allSettled で部分失敗許容）
//    - 各DBから要約統計値のみ抽出（JSON節約 + Haiku精度向上）
//    - 売上予測は不確実性が高いためdisclaimerを必ず付与
//    - Haiku max_tokens: 4096 固定
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type SalesForecastResult = {
  forecast:         '上昇' | '横ばい' | '下降'
  confidence:       'high' | 'medium' | 'low'
  summary:          string                     // 2文以内の総評
  positiveDrivers:  ForecastFactor[]           // 成長ドライバー（最大3件）
  negativeRisks:    ForecastFactor[]           // リスク要因（最大3件）
  recommendations:  ForecastAction[]           // 優先アクション（最大4件）
  disclaimer:       string                     // AI免責文言
  dataSnapshot: {
    kpiCount:         number   // 分析したKPI件数
    feedbackAvgScore: number   // フィードバック平均評価（1〜5）
    feedbackCount:    number
    conditionAvg:     number   // 社員コンディション平均（1〜5）
    staffCount:       number
    contactPending:   number   // 未解決問い合わせ件数
    contactTotal:     number
  }
}

type ForecastFactor = {
  title:  string   // 20文字以内
  detail: string   // 1〜2文
  impact: '大' | '中' | '小'
}

type ForecastAction = {
  priority: '高' | '中' | '低'
  title:    string   // 20文字以内
  detail:   string   // 1〜2文
  timing:   string   // 例: 今週中・今月末・来月以降
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── DB集計ヘルパー群 ────────────────────────────────

/** KPI目標DB: 目標設定状況を集計 */
async function summarizeKpi(dbId: string, notionKey: string) {
  if (!dbId) return { count: 0, types: [] as string[] }

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({ page_size: 20 }),
  })
  if (!res.ok) return { count: 0, types: [] as string[] }

  const data = await res.json() as { results: Record<string, unknown>[] }
  const types = new Set<string>()
  let count = 0

  for (const page of data.results) {
    const props = page.properties as Record<string, { select?: { name?: string }; rich_text?: Array<{ plain_text?: string }>; title?: Array<{ plain_text?: string }> }>
    const kpiType = props['KPI種別']?.select?.name ?? props['カテゴリ']?.select?.name ?? ''
    const target  = props['目標値']?.rich_text?.[0]?.plain_text ?? ''
    if (kpiType) types.add(kpiType)
    if (target)  count++
  }

  return { count, types: Array.from(types) }
}

/** フィードバックDB: 平均評価スコアを集計 */
async function summarizeFeedback(dbId: string, notionKey: string) {
  if (!dbId) return { avgScore: 0, count: 0, negativeCount: 0 }

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 30,
    }),
  })
  if (!res.ok) return { avgScore: 0, count: 0, negativeCount: 0 }

  const data = await res.json() as { results: Record<string, unknown>[] }
  let total = 0, count = 0, negativeCount = 0

  for (const page of data.results) {
    const props   = page.properties as Record<string, { select?: { name?: string }; number?: number }>
    const selName = props['評価']?.select?.name ?? ''
    const match   = selName.match(/[1-5]/)
    const score   = match ? parseInt(match[0]) : (props['評価']?.number ?? 0)
    if (score > 0) {
      total += score
      count++
      if (score <= 2) negativeCount++
    }
  }

  return {
    avgScore:      count > 0 ? Math.round((total / count) * 10) / 10 : 0,
    count,
    negativeCount,
  }
}

/** 社員コンディションDB: 平均スコアを集計 */
async function summarizeCondition(dbId: string, notionKey: string) {
  if (!dbId) return { avgScore: 0, staffCount: 0, highWorkloadCount: 0 }

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      sorts: [{ property: '記録日', direction: 'descending' }],
      page_size: 50,
    }),
  })
  if (!res.ok) return { avgScore: 0, staffCount: 0, highWorkloadCount: 0 }

  const data = await res.json() as { results: Record<string, unknown>[] }
  const seenStaff = new Set<string>()
  let total = 0, count = 0, highWorkloadCount = 0

  for (const page of data.results) {
    const props    = page.properties as Record<string, {
      title?: Array<{ plain_text?: string }>
      rich_text?: Array<{ plain_text?: string }>
      select?: { name?: string }
    }>
    const name     = props['社員名']?.title?.[0]?.plain_text ?? props['社員名']?.rich_text?.[0]?.plain_text ?? ''
    const condName = props['体調']?.select?.name ?? props['コンディション']?.select?.name ?? ''
    const workload = props['業務負荷']?.select?.name ?? ''

    // 社員ごとに最新1件のみカウント
    if (name && !seenStaff.has(name)) {
      seenStaff.add(name)
      const match = condName.match(/[1-5]/)
      const score = match ? parseInt(match[0]) : 0
      if (score > 0) { total += score; count++ }
      if (workload === '高') highWorkloadCount++
    }
  }

  return {
    avgScore:         count > 0 ? Math.round((total / count) * 10) / 10 : 0,
    staffCount:       seenStaff.size,
    highWorkloadCount,
  }
}

/** 問い合わせ管理DB: ステータス分布を集計 */
async function summarizeContacts(dbId: string, notionKey: string) {
  if (!dbId) return { total: 0, pending: 0, resolved: 0, highPriority: 0 }

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({ page_size: 50 }),
  })
  if (!res.ok) return { total: 0, pending: 0, resolved: 0, highPriority: 0 }

  const data  = await res.json() as { results: Record<string, unknown>[] }
  let pending = 0, resolved = 0, highPriority = 0

  for (const page of data.results) {
    const props    = page.properties as Record<string, { select?: { name?: string } }>
    const status   = props['ステータス']?.select?.name ?? ''
    const priority = props['優先度']?.select?.name ?? ''

    if (['未対応', '対応中'].includes(status))         pending++
    if (['解決済み', 'クローズ'].includes(status))      resolved++
    if (priority === '高')                              highPriority++
  }

  return { total: data.results.length, pending, resolved, highPriority }
}

// ── GET ─────────────────────────────────────────────

export async function GET(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'Anthropic APIキーが未設定です' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId') ?? 'kitano-resort'
  const dbConfig  = getCompanyDbConfig(companyId)

  try {
    // ① 4DBを並列取得（Promise.allSettled で部分失敗を許容）
    const [kpiRes, fbRes, condRes, contactRes] = await Promise.allSettled([
      summarizeKpi(dbConfig.kpiGoalsDbId, notionKey),
      summarizeFeedback(dbConfig.customerFeedbackDbId, notionKey),
      summarizeCondition(dbConfig.staffConditionDbId, notionKey),
      summarizeContacts(dbConfig.serviceContactDbId, notionKey),
    ])

    const kpi     = kpiRes.status     === 'fulfilled' ? kpiRes.value     : { count: 0, types: [] }
    const fb      = fbRes.status      === 'fulfilled' ? fbRes.value      : { avgScore: 0, count: 0, negativeCount: 0 }
    const cond    = condRes.status    === 'fulfilled' ? condRes.value    : { avgScore: 0, staffCount: 0, highWorkloadCount: 0 }
    const contact = contactRes.status === 'fulfilled' ? contactRes.value : { total: 0, pending: 0, resolved: 0, highPriority: 0 }

    // ② Haiku送信用サマリーテキスト生成
    const resolutionRate = contact.total > 0
      ? Math.round((contact.resolved / contact.total) * 100)
      : 0

    const summaryText = [
      `■ KPI設定状況: ${kpi.count}件のKPI目標を設定中（種別: ${kpi.types.join('・') || '未分類'}）`,
      `■ 顧客フィードバック: 平均評価 ${fb.avgScore}/5.0（${fb.count}件・低評価${fb.negativeCount}件）`,
      `■ 社員コンディション: 平均スコア ${cond.avgScore}/5.0（${cond.staffCount}名・高負荷${cond.highWorkloadCount}名）`,
      `■ 問い合わせ対応: 総${contact.total}件・未解決${contact.pending}件・解決率${resolutionRate}%・高優先度${contact.highPriority}件`,
    ].join('\n')

    // ── プロンプト出力制限（CLAUDE.md準拠）──
    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      '{"forecast":"上昇|横ばい|下降",',
      '"confidence":"high|medium|low",',
      '"summary":"2文以内の総評",',
      '"positiveDrivers":[最大3件 {"impact":"大|中|小","title":"20文字以内","detail":"1〜2文"}],',
      '"negativeRisks":[最大3件 {"impact":"大|中|小","title":"20文字以内","detail":"1〜2文"}],',
      '"recommendations":[最大4件 {"priority":"高|中|低","title":"20文字以内","detail":"1〜2文","timing":"時期"}],',
      '"disclaimer":"予測は参考情報です。最終判断は経営者が行ってください。"}',
      '※ JSONのみ出力。説明文・コードブロック不要。簡潔さを最優先。',
    ].join('\n')

    const client = new Anthropic({ apiKey: anthropicKey })

    const startTime = Date.now()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `以下は企業の4つの業績関連指標の統計サマリーです。これらの指標を統合的に分析し、今後3ヶ月の売上・業績の方向性を予測してください。

${summaryText}

分析の観点:
- フィードバック平均が高い（4.0以上）→ リピート・口コミによる売上貢献
- 問い合わせ解決率が高い（80%以上）→ 顧客維持に貢献
- 社員コンディションが良好（3.5以上）→ サービス品質維持・生産性向上
- KPI目標が明確に設定されている → 組織的な数値管理で成長可能性
- 逆に各指標が低い場合は下降リスク

売上予測の不確実性を踏まえ、confidence（確信度）を適切に設定してください。
データが少ない・指標が混在する場合はmedium以下にすること。

${outputFormat}`,
      }],
    })

    const elapsed = Date.now() - startTime

    if (message.stop_reason === 'max_tokens') {
      console.warn('[sales-forecast] max_tokens に達したため出力が切れている可能性があります')
    }

    // ③ JSONパース
    const rawText     = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleanedText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

    let result: Omit<SalesForecastResult, 'dataSnapshot'>
    try {
      result = JSON.parse(cleanedText)
    } catch {
      console.error('[sales-forecast] JSONパースエラー:', cleanedText.slice(0, 200))
      throw new Error('AI分析結果のJSONパースに失敗しました')
    }

    console.log(`[sales-forecast] 完了 companyId=${companyId} forecast=${result.forecast} confidence=${result.confidence} elapsed=${elapsed}ms`)

    return NextResponse.json({
      ...result,
      dataSnapshot: {
        kpiCount:         kpi.count,
        feedbackAvgScore: fb.avgScore,
        feedbackCount:    fb.count,
        conditionAvg:     cond.avgScore,
        staffCount:       cond.staffCount,
        contactPending:   contact.pending,
        contactTotal:     contact.total,
      },
    } satisfies SalesForecastResult)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sales-forecast] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
