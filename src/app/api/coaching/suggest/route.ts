// =====================================================
//  src/app/api/coaching/suggest/route.ts
//  AIリアルタイムコーチング提案API — Sprint #40
//
//  ■ POST ?companyId=xxx
//    Body: {
//      situation:        string   // スタッフが入力した現在の状況
//      contactCategory:  string   // 問い合わせカテゴリ（苦情・要望・問い合わせ等）
//      contactContent:   string   // 問い合わせ本文（コンテキスト用）
//      contactPriority?: string   // 優先度（高・中・低）
//    }
//
//    ① 感動ログDBから類似カテゴリの成功事例を取得（コンテキスト注入）
//    ② Haiku でベストアクションを提案
//    ③ 提案結果を返却
//
//  ■ 提案フォーマット
//    { phrase, cautions, successPatterns, similarCount }
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

type SuggestBody = {
  situation:        string   // 現在の状況説明
  contactCategory:  string   // 問い合わせカテゴリ
  contactContent:   string   // 問い合わせ本文
  contactPriority?: string   // 優先度
}

export type CoachingSuggestion = {
  phrase:          string    // 推奨フレーズ（最初の一言）
  cautions:        string[]  // 注意点（最大3件）
  successPatterns: string[]  // 過去の成功パターン（最大3件）
  similarCount:    number    // 類似事例の件数
}

// ── 感動ログから類似成功事例を取得 ─────────────────────

type DelightLogSummary = {
  category: string
  action:   string
  score:    number
}

async function fetchDelightLogs(
  dbId: string,
  notionKey: string,
): Promise<DelightLogSummary[]> {
  if (!dbId) return []
  try {
    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${notionKey}`,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VER,
      },
      body: JSON.stringify({
        // スコア上位の感動ログを取得（高スコア順）
        sorts: [{ property: '感動スコア', direction: 'descending' }],
        page_size: 12,  // 上位12件に絞る（JSON切れ防止）
      }),
    })
    if (!res.ok) return []
    const data = await res.json() as { results: Record<string, unknown>[] }

    return data.results.map((page) => {
      const props = page.properties as Record<string, unknown>

      // 感動カテゴリ（select型）
      const catProp = props['感動カテゴリ'] as Record<string, unknown> | undefined
      const category = (catProp?.select as { name?: string } | null)?.name ?? ''

      // 顧客への対応内容（rich_text型）
      const actProp = props['顧客への対応内容'] as Record<string, unknown> | undefined
      const action = Array.isArray(actProp?.rich_text)
        ? (actProp.rich_text as { plain_text: string }[]).map(t => t.plain_text).join('').slice(0, 80)
        : ''

      // 感動スコア（number型）
      const scoreProp = props['感動スコア'] as Record<string, unknown> | undefined
      const score = (scoreProp?.number as number | null) ?? 0

      return { category, action, score }
    }).filter(log => log.action.length > 0)  // 内容がある件のみ

  } catch {
    return []
  }
}

// ── Haiku でコーチング提案を生成 ─────────────────────────

async function generateCoachingSuggestion(
  companyName: string,
  industry: string,
  situation: string,
  contactCategory: string,
  contactContent: string,
  contactPriority: string,
  delightLogs: DelightLogSummary[],
  anthropicKey: string,
): Promise<CoachingSuggestion> {
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  // 感動ログをコンテキスト文字列に変換（上位8件まで）
  const delightContext = delightLogs.slice(0, 8).map((log, i) =>
    `${i + 1}. [${log.category}] スコア${log.score}: ${log.action}`
  ).join('\n')

  const outputFormat = [
    '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
    '{"phrase":"最初に使うべき推奨フレーズ（30文字以内）",',
    '"cautions":["注意点1（1文）","注意点2（1文）"],"successPatterns":["成功パターン1（1文）","成功パターン2（1文）"]}',
    '※ cautionsは最大3件・1文以内。successPatternsは最大3件・1文以内。',
    '※ JSONのみ出力。説明文・コードブロック不要。',
  ].join('\n')

  const prompt = `あなたは${companyName}（${industry}業）のベテランスタッフ向けAIコーチです。
現在対応中のスタッフに、この状況での最適な対応方法をリアルタイムでアドバイスしてください。

【問い合わせ情報】
カテゴリ: ${contactCategory} / 優先度: ${contactPriority || '中'}
内容: ${contactContent.slice(0, 150)}

【スタッフが報告した現在の状況】
${situation}

【過去の感動対応事例（スコア順）】
${delightContext || '（事例なし）'}

【アドバイス作成ルール】
- phrase: 今すぐ使える最初の一言（共感・謝罪・確認のどれか）。丁寧語で。
- cautions: このカテゴリ・状況での落とし穴（「確認します」だけは不満を高めやすい等）
- successPatterns: 過去の感動事例から学べる成功の共通点

${outputFormat}`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  })

  if (response.stop_reason === 'max_tokens') {
    console.warn('[coaching/suggest] max_tokens に達した可能性があります')
  }

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned) as {
    phrase: string
    cautions: string[]
    successPatterns: string[]
  }

  return {
    phrase:          parsed.phrase          ?? '大変ご不便をおかけし、申し訳ございません。',
    cautions:        parsed.cautions        ?? [],
    successPatterns: parsed.successPatterns ?? [],
    similarCount:    delightLogs.length,
  }
}

// ── メイン POST ハンドラー ────────────────────────────

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId') ?? 'kitano-resort'

  // 環境変数チェック（NOTION_TOKEN優先、NOTION_API_KEYにフォールバック）
  const notionKey    = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''

  if (!anthropicKey) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
  }

  const db      = getCompanyDbConfig(companyId)
  const company = getCompanyById(companyId)

  // リクエストボディ取得
  let body: SuggestBody
  try {
    body = await req.json() as SuggestBody
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
  }

  const { situation, contactCategory, contactContent, contactPriority = '中' } = body
  if (!situation || !contactCategory) {
    return NextResponse.json(
      { error: 'situation と contactCategory は必須です' },
      { status: 400 },
    )
  }

  // ── ① 感動ログDB から過去の成功事例を取得 ──────────────
  const delightLogs = notionKey && db.delightLogDbId
    ? await fetchDelightLogs(db.delightLogDbId, notionKey)
    : []

  // ── ② Haiku でコーチング提案を生成 ──────────────────────
  let suggestion: CoachingSuggestion
  try {
    suggestion = await generateCoachingSuggestion(
      company.name, company.industry,
      situation, contactCategory, contactContent, contactPriority,
      delightLogs,
      anthropicKey,
    )
  } catch (err) {
    console.error('[coaching/suggest] Haiku生成エラー:', err)
    // フォールバック
    suggestion = {
      phrase:          '大変ご不便をおかけし、申し訳ございません。まず状況を詳しくお聞かせください。',
      cautions:        ['「確認してから折り返します」だけでは不満を高める可能性があります'],
      successPatterns: ['最初に共感を示してから解決策を提示すると感動に転換しやすいです'],
      similarCount:    delightLogs.length,
    }
  }

  return NextResponse.json(suggestion)
}
