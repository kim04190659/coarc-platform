// =====================================================
//  src/app/api/morning-brief/generate/route.ts
//  AIモーニングブリーフィング生成 — Sprint #38
//
//  ■ GET ?companyId=xxx
//    ①  問い合わせDB（未対応・高優先度）
//    ②  社員コンディションDB（直近7日間）
//    ③  顧客フィードバックDB（直近5件）
//    以上3DBを並列取得し、Claude Haiku で
//    「今日のブリーフィング」を生成して返す。
//
//  ■ 出力フォーマット
//    {
//      greeting:      string   // 朝の挨拶（1文）
//      todayFocus:    string   // 今日の最重要ポイント（1〜2文）
//      urgentItems:   string[] // 要注意事項（最大3件）
//      opportunities: string[] // 今日のチャンス・好機（最大2件）
//      staffMessage:  string   // チームへのエール（1文）
//      dataPoints: { contacts, staff, feedback }
//    }
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type MorningBriefResult = {
  greeting:      string    // 朝の挨拶（1文）
  todayFocus:    string    // 今日の最重要ポイント
  urgentItems:   string[]  // 要注意事項（最大3件）
  opportunities: string[]  // 今日のチャンス（最大2件）
  staffMessage:  string    // チームへのエール
  dataPoints: {
    unresolvedContacts: number   // 未対応件数
    staffCount:         number   // 取得したスタッフ数
    recentFeedback:     number   // 最近のフィードバック件数
    avgCondition:       number   // 平均コンディション（1〜5）
    lowConditionCount:  number   // コンディション2以下の人数
  }
  generatedAt: string   // ISO8601
}

// ── Notion ヘッダー ──────────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type':  'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── 未対応・高優先度の問い合わせを取得 ─────────────────

async function fetchUrgentContacts(dbId: string, notionKey: string) {
  if (!dbId) return []
  try {
    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        filter: {
          property: 'ステータス',
          select: { equals: '未対応' },
        },
        sorts: [{ property: '優先度', direction: 'descending' }],
        page_size: 10,
      }),
    })
    if (!res.ok) return []
    const data = await res.json() as { results: Record<string, unknown>[] }
    return data.results ?? []
  } catch {
    return []
  }
}

// ── 直近の社員コンディションを取得 ──────────────────────

async function fetchStaffConditions(dbId: string, notionKey: string) {
  if (!dbId) return []
  try {
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
    return data.results ?? []
  } catch {
    return []
  }
}

// ── 直近の顧客フィードバックを取得 ──────────────────────

async function fetchRecentFeedbacks(dbId: string, notionKey: string) {
  if (!dbId) return []
  try {
    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        page_size: 5,
      }),
    })
    if (!res.ok) return []
    const data = await res.json() as { results: Record<string, unknown>[] }
    return data.results ?? []
  } catch {
    return []
  }
}

// ── プロパティ取り出しヘルパー ────────────────────────

function getPropText(props: Record<string, unknown>, key: string): string {
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

// コンディションスコアをテキストから数値に変換
function parseConditionScore(text: string): number | null {
  const match = text.match(/[1-5]/)
  return match ? parseInt(match[0], 10) : null
}

// ── メイン GET ハンドラー ─────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId') ?? 'kitano-resort'

  const notionKey = process.env.NOTION_API_KEY ?? ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''

  if (!notionKey || !anthropicKey) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
  }

  const db = getCompanyDbConfig(companyId)
  const company = getCompanyById(companyId)

  // ── ① 並列でデータ取得 ──────────────────────────────
  const [contacts, conditions, feedbacks] = await Promise.all([
    fetchUrgentContacts(db.serviceContactDbId, notionKey),
    fetchStaffConditions(db.staffConditionDbId, notionKey),
    fetchRecentFeedbacks(db.customerFeedbackDbId, notionKey),
  ])

  // ── ② データ集計 ─────────────────────────────────────

  // 未対応件数
  const unresolvedCount = contacts.length

  // 高優先度問い合わせのタイトル（最大3件）
  const urgentContactsSummary = contacts.slice(0, 3).map((c) => {
    const props = c.properties as Record<string, unknown>
    const title = getPropText(props, '件名') || getPropText(props, 'タイトル') || '（件名なし）'
    const category = getPropText(props, 'カテゴリ')
    return category ? `${category}: ${title}` : title
  })

  // スタッフコンディション集計
  const conditionScores: number[] = []
  for (const c of conditions) {
    const props = c.properties as Record<string, unknown>
    const scoreText = getPropText(props, 'コンディション') || getPropText(props, 'スコア')
    const score = parseConditionScore(scoreText)
    if (score !== null) conditionScores.push(score)
  }
  const avgCondition = conditionScores.length > 0
    ? Math.round((conditionScores.reduce((a, b) => a + b, 0) / conditionScores.length) * 10) / 10
    : 3.0
  const lowConditionCount = conditionScores.filter(s => s <= 2).length

  // 直近フィードバックのサマリー（最大3件）
  const feedbackSummary = feedbacks.slice(0, 3).map((f) => {
    const props = f.properties as Record<string, unknown>
    const eval_ = getPropText(props, '評価') || getPropText(props, '満足度')
    const content = getPropText(props, 'コメント') || getPropText(props, 'フィードバック内容')
    return eval_ ? `${eval_}: ${content.slice(0, 30)}` : content.slice(0, 40)
  }).filter(Boolean)

  // ── ③ Haiku プロンプト生成 ───────────────────────────

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  // 入力データを整理（JSON切れ防止: 上位12件以内）
  const inputData = {
    company: company.name,
    industry: company.industry,
    date: today,
    urgentContacts: unresolvedCount,
    urgentContactDetails: urgentContactsSummary,
    avgCondition,
    lowConditionStaff: lowConditionCount,
    recentFeedback: feedbackSummary,
  }

  const outputFormat = [
    '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
    '{"greeting":"朝の挨拶1文","todayFocus":"今日の最重要ポイント1〜2文",',
    '"urgentItems":["要注意事項1","要注意事項2"],"opportunities":["チャンス1","チャンス2"],',
    '"staffMessage":"チームへのエール1文"}',
    '※ urgentItemsは最大3件・1文以内。opportunitiesは最大2件・1文以内。',
    '※ JSONのみ出力。説明文・コードブロック不要。',
  ].join('\n')

  const prompt = `あなたは${company.name}のAIアシスタントです。
以下のデータをもとに、スタッフが朝一番に読む「今日のブリーフィング」を生成してください。

【今日のデータ】
${JSON.stringify(inputData, null, 2)}

【ブリーフィング生成ルール】
- greeting: 今日の日付・天気的なニュアンスを含む温かい朝の挨拶
- todayFocus: 今日最も注意すべきことを1〜2文でまとめる
- urgentItems: 未対応件数・コンディション低下スタッフなど、今すぐ動くべき項目（最大3件）
- opportunities: データから見える「今日うまくいきそうなこと」「好機」（最大2件）
- staffMessage: チームの士気を高める一言（押しつけがましくなく、自然に）

${outputFormat}`

  // ── ④ Haiku 呼び出し ─────────────────────────────────

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  let result: MorningBriefResult

  try {
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    })

    if (response.stop_reason === 'max_tokens') {
      console.warn('[morning-brief] max_tokens に達したため出力が途中で切れた可能性があります')
    }

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    // コードブロック除去
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned) as {
      greeting: string
      todayFocus: string
      urgentItems: string[]
      opportunities: string[]
      staffMessage: string
    }

    result = {
      greeting:      parsed.greeting      ?? '今日もよろしくお願いします。',
      todayFocus:    parsed.todayFocus    ?? '',
      urgentItems:   parsed.urgentItems   ?? [],
      opportunities: parsed.opportunities ?? [],
      staffMessage:  parsed.staffMessage  ?? '',
      dataPoints: {
        unresolvedContacts: unresolvedCount,
        staffCount:         conditionScores.length,
        recentFeedback:     feedbacks.length,
        avgCondition,
        lowConditionCount,
      },
      generatedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[morning-brief] Haiku呼び出しエラー:', err)
    // フォールバック: データベースから生成したデフォルトブリーフィング
    result = {
      greeting:      `${company.name}のみなさん、おはようございます。今日も一日よろしくお願いします。`,
      todayFocus:    unresolvedCount > 0
        ? `未対応の問い合わせが${unresolvedCount}件あります。優先的にご確認ください。`
        : 'すべての問い合わせが対応済みです。引き続き高品質なサービスを目指しましょう。',
      urgentItems:   urgentContactsSummary.slice(0, 3),
      opportunities: [],
      staffMessage:  'チーム全員で今日も素晴らしいサービスを届けましょう。',
      dataPoints: {
        unresolvedContacts: unresolvedCount,
        staffCount:         conditionScores.length,
        recentFeedback:     feedbacks.length,
        avgCondition,
        lowConditionCount,
      },
      generatedAt: new Date().toISOString(),
    }
  }

  return NextResponse.json(result)
}
