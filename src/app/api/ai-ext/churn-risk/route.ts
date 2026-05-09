// =====================================================
//  src/app/api/ai-ext/churn-risk/route.ts
//  顧客離反リスクAI — Sprint #20
//
//  ■ GET ?companyId=xxx
//    顧客フィードバックDB + 問い合わせ管理DBを並列取得し、
//    Claude Haiku でリスクスコア（0〜100）・リスク要因・
//    改善アクションを生成して返す。
//
//  ■ 設計ポイント
//    - 2DB並列取得 → 上位12件に絞る（JSON切れ防止）
//    - フィードバック + 未解決問い合わせを統合分析
//    - Haiku max_tokens: 4096 固定
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type ChurnRiskResult = {
  riskLevel:       'high' | 'medium' | 'low'   // リスク判定
  riskScore:       number                        // 0〜100
  summary:         string                        // 2文以内の総評
  riskFactors:     ChurnRiskFactor[]             // 最大3件
  recommendations: ChurnRecommendation[]         // 最大4件
  dataPoints: {
    feedbackCount:  number
    contactCount:   number
    analyzedCount:  number
  }
}

type ChurnRiskFactor = {
  title:       string   // 20文字以内
  detail:      string   // 1〜2文
  severity:    '高' | '中' | '低'
}

type ChurnRecommendation = {
  priority:    '高' | '中' | '低'
  title:       string   // 20文字以内
  detail:      string   // 1〜2文
  timing:      string   // 例: 今週中・今月中・来月以降
  costEffect:  string   // 例: 月次CS対応コスト 約10%削減
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── 評価テキスト → 数値スコアに変換 ──────────────────
// 北野リゾート等のDBは評価が select 型（"⭐5 大変満足" 等）で格納されている

function parseEvaluationScore(selectName: string | undefined): number | null {
  if (!selectName) return null
  // "⭐5 大変満足" → 5, "⭐2 不満" → 2 のように先頭の数字を取得
  const match = selectName.match(/[1-5]/)
  return match ? parseInt(match[0], 10) : null
}

// ── フィードバックDB取得 ─────────────────────────────

async function fetchFeedbacks(dbId: string, notionKey: string) {
  if (!dbId) return []

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 20,
    }),
  })
  if (!res.ok) return []

  const data = await res.json() as { results: Record<string, unknown>[] }

  return data.results.map(page => {
    const props = page.properties as Record<string, {
      title?:      Array<{ plain_text?: string }>
      rich_text?:  Array<{ plain_text?: string }>
      select?:     { name?: string }
      number?:     number
    }>

    // title型 / rich_text型（text型）の両方を汎用取得
    const getText = (p: typeof props[string] | undefined) =>
      p?.title?.[0]?.plain_text ?? p?.rich_text?.[0]?.plain_text ?? ''

    // 評価は select 型（例: "⭐3 普通"）なので select?.name から読む
    // 数値型DBの場合は number でもフォールバック
    const rawScore = props['評価']?.select?.name ?? props['スコア']?.select?.name ?? null
    const score = rawScore
      ? parseEvaluationScore(rawScore)
      : (props['評価']?.number ?? null)

    // フィードバック内容は rich_text型（text型）の「フィードバック内容」プロパティ
    // 「件名」（title型）もフォールバックとして利用
    const content =
      getText(props['フィードバック内容']) ||
      getText(props['コメント'])           ||
      getText(props['内容'])               ||
      getText(props['件名'])               // title型をフォールバック

    // AI感情分析は text型（JSON文字列）— selectではないので sentimentとして短縮
    const aiJson = getText(props['AI感情分析'])
    let sentiment = props['感情']?.select?.name ?? ''
    if (!sentiment && aiJson) {
      try {
        const parsed = JSON.parse(aiJson) as { sentiment?: string }
        sentiment = parsed.sentiment ?? ''
      } catch { /* JSONパース失敗は無視 */ }
    }

    return {
      type:      'feedback' as const,
      content,
      score,     // 1〜5 の数値 or null
      scoreLabel: rawScore ?? '',  // "⭐2 不満" などの元テキスト
      sentiment,
      category:  props['カテゴリ']?.select?.name ?? props['分類']?.select?.name ?? '',
    }
  }).filter(f => f.content)
}

// ── 問い合わせDB取得 ────────────────────────────────

async function fetchContacts(dbId: string, notionKey: string) {
  if (!dbId) return []

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      // 未対応・対応中の案件を優先取得
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 20,
    }),
  })
  if (!res.ok) return []

  const data = await res.json() as { results: Record<string, unknown>[] }

  return data.results.map(page => {
    const props = page.properties as Record<string, {
      title?:      Array<{ plain_text?: string }>
      rich_text?:  Array<{ plain_text?: string }>
      select?:     { name?: string }
    }>

    const getText = (p: typeof props[string] | undefined) =>
      p?.title?.[0]?.plain_text ?? p?.rich_text?.[0]?.plain_text ?? ''

    return {
      type:     'contact' as const,
      content:  getText(props['件名']) || getText(props['内容']) || getText(props['問い合わせ内容']),
      status:   props['ステータス']?.select?.name ?? '',
      priority: props['優先度']?.select?.name ?? '',
      category: props['カテゴリ']?.select?.name ?? props['分類']?.select?.name ?? '',
    }
  }).filter(c => c.content)
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

  const dbConfig = getCompanyDbConfig(companyId)

  try {
    // ① 2DBを並列取得（フィードバック + 問い合わせ）
    const [feedbacks, contacts] = await Promise.all([
      fetchFeedbacks(dbConfig.customerFeedbackDbId, notionKey),
      fetchContacts(dbConfig.serviceContactDbId, notionKey),
    ])

    const totalFeedback = feedbacks.length
    const totalContacts = contacts.length

    // ② 上位12件に絞る（JSON途中切れ防止）
    // スコアありフィードバック → 低評価順（ネガティブ優先）
    // スコアなしフィードバック → 最新3件
    const negativeFeedbacks = feedbacks
      .filter(f => f.score !== null)
      .sort((a, b) => (a.score ?? 5) - (b.score ?? 5))  // 1 → 5 の昇順（低評価優先）
      .slice(0, 6)

    const otherFeedbacks = feedbacks
      .filter(f => f.score === null)
      .slice(0, 3)

    const priorityContacts = contacts
      .filter(c => c.status !== '解決済み' && c.status !== 'クローズ')
      .slice(0, 6)

    const allItems = [
      ...negativeFeedbacks,
      ...otherFeedbacks,
      ...priorityContacts,
    ].slice(0, 12)

    const analyzedCount = allItems.length

    if (analyzedCount === 0) {
      // データなしの場合はデフォルト値を返す
      return NextResponse.json({
        riskLevel: 'low',
        riskScore: 20,
        summary: 'データが不足しているため正確な分析ができません。フィードバックや問い合わせデータを蓄積してください。',
        riskFactors: [],
        recommendations: [],
        dataPoints: { feedbackCount: 0, contactCount: 0, analyzedCount: 0 },
      } satisfies ChurnRiskResult)
    }

    // ③ Haiku に分析依頼
    const dataText = allItems.map((item, i) => {
      if (item.type === 'feedback') {
        // scoreLabel は "⭐2 不満" 等の人間が読める形式
        const evalStr = item.scoreLabel || (item.score !== null ? `${item.score}点` : '評価なし')
        return `[フィードバック${i + 1}] 評価:${evalStr} 感情:${item.sentiment || '不明'} カテゴリ:${item.category || '未分類'} 内容:${item.content.slice(0, 80)}`
      } else {
        return `[問い合わせ${i + 1}] ステータス:${item.status || '不明'} 優先度:${item.priority || '未設定'} カテゴリ:${item.category || '未分類'} 件名:${item.content.slice(0, 80)}`
      }
    }).join('\n')

    // ── プロンプト出力制限（CLAUDE.md準拠）──
    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      '{"riskLevel":"high|medium|low","riskScore":0〜100の整数,',
      '"summary":"2文以内の総評",',
      '"riskFactors":[最大3件 {"severity":"高|中|低","title":"20文字以内","detail":"1〜2文"}],',
      '"recommendations":[最大4件 {"priority":"高|中|低","title":"20文字以内","detail":"1〜2文","timing":"時期","costEffect":"効果概算"}]}',
      '※ JSONのみ出力。説明文・コードブロック不要。簡潔さを最優先。',
    ].join('\n')

    const client = new Anthropic({ apiKey: anthropicKey })

    const startTime = Date.now()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `以下は顧客フィードバックと問い合わせデータです。顧客離反リスクを分析してください。

${dataText}

分析の観点:
- 低評価フィードバックの頻度・深刻度
- 未解決問い合わせの件数・内容
- 繰り返し発生している問題パターン
- 特定カテゴリへの集中度

${outputFormat}`,
      }],
    })

    const elapsed = Date.now() - startTime

    // stop_reason チェック（CLAUDE.md準拠）
    if (message.stop_reason === 'max_tokens') {
      console.warn('[churn-risk] max_tokens に達したため出力が切れている可能性があります')
    }

    // ④ JSONパース
    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    // コードブロックを除去してからパース
    const cleanedText = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    let result: Omit<ChurnRiskResult, 'dataPoints'>
    try {
      result = JSON.parse(cleanedText)
    } catch {
      console.error('[churn-risk] JSONパースエラー:', cleanedText.slice(0, 200))
      throw new Error('AI分析結果のJSONパースに失敗しました')
    }

    console.log(`[churn-risk] 分析完了 companyId=${companyId} score=${result.riskScore} elapsed=${elapsed}ms`)

    return NextResponse.json({
      ...result,
      dataPoints: {
        feedbackCount:  totalFeedback,
        contactCount:   totalContacts,
        analyzedCount,
      },
    } satisfies ChurnRiskResult)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[churn-risk] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
