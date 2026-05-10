// =====================================================
//  src/app/api/delight-log/save/route.ts
//  感動ログ保存API — Sprint #39
//
//  ■ POST ?companyId=xxx
//    Body: { staffName, action, customerReaction, staffNote? }
//
//    ① Haiku で感動カテゴリ・AIタグ・感動スコア・AIコメントを自動生成
//    ② Notion 感動ログDB に保存
//    ③ 保存結果を返却
//
//  ■ 感動カテゴリ（5種）
//    共感 / 先読み / 超期待 / 問題解決 / 記念日対応
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

type SaveDelightLogBody = {
  staffName:       string   // スタッフ名
  action:          string   // 顧客への対応内容
  customerReaction: string  // 顧客の反応
  staffNote?:      string   // 任意メモ（プロンプトに追加）
}

export type SaveDelightLogResult = {
  success:       boolean
  notionPageUrl: string
  category:      string   // 感動カテゴリ
  tags:          string[] // AIタグ
  score:         number   // 感動スコア 1〜5
  aiComment:     string   // AIからのコメント
  logTitle:      string   // 自動生成タイトル
}

// ── Haiku で感動を分析 ────────────────────────────────

type HaikuDelightAnalysis = {
  logTitle:  string    // 20文字以内のシーン名
  category:  '共感' | '先読み' | '超期待' | '問題解決' | '記念日対応'
  tags:      string[]  // 1〜3件
  score:     number    // 1〜5
  aiComment: string    // 1文
}

async function analyzeDelight(
  companyName: string,
  industry: string,
  staffName: string,
  action: string,
  customerReaction: string,
  staffNote: string,
  anthropicKey: string,
): Promise<HaikuDelightAnalysis> {
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const outputFormat = [
    '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
    '{"logTitle":"20文字以内のシーン名","category":"共感|先読み|超期待|問題解決|記念日対応",',
    '"tags":["タグ1","タグ2"],"score":5,"aiComment":"1文のフィードバック"}',
    '※ tags は ["ホスピタリティ","先回り","サプライズ","傾聴","問題解決","記念日","パーソナライズ"] から1〜3件選択。',
    '※ score は 1〜5 の整数。感動の大きさを表す（5が最高）。',
    '※ JSONのみ出力。説明文・コードブロック不要。',
  ].join('\n')

  const prompt = `あなたは${companyName}（${industry}業）のサービス品質AIアドバイザーです。
スタッフが記録した「感動の瞬間」を分析し、感動カテゴリ・AIタグ・スコアを評価してください。

【記録内容】
スタッフ名: ${staffName}
顧客への対応内容: ${action}
顧客の反応: ${customerReaction}
${staffNote ? `補足メモ: ${staffNote}` : ''}

【感動カテゴリの定義】
- 共感: 顧客の気持ちに寄り添い、感情的なつながりを生んだ対応
- 先読み: 顧客が言葉にする前に、ニーズを察知して先回りした対応
- 超期待: 期待を大きく超えるサービスを提供した対応
- 問題解決: 困っていた顧客の問題を見事に解決した対応
- 記念日対応: 誕生日・記念日・特別な日に合わせたパーソナライズ対応

${outputFormat}`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned) as HaikuDelightAnalysis
  return parsed
}

// ── Notion に保存 ─────────────────────────────────────

async function saveToNotion(
  dbId: string,
  notionKey: string,
  logTitle: string,
  staffName: string,
  category: string,
  action: string,
  customerReaction: string,
  tags: string[],
  score: number,
  aiComment: string,
): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  const body = {
    parent: { database_id: dbId },
    properties: {
      'ログタイトル': {
        title: [{ text: { content: logTitle } }],
      },
      'スタッフ名': {
        rich_text: [{ text: { content: staffName } }],
      },
      '感動カテゴリ': {
        select: { name: category },
      },
      '顧客への対応内容': {
        rich_text: [{ text: { content: action } }],
      },
      '顧客の反応': {
        rich_text: [{ text: { content: customerReaction } }],
      },
      'AIタグ': {
        multi_select: tags.map(t => ({ name: t })),
      },
      '感動スコア': {
        number: score,
      },
      'AIコメント': {
        rich_text: [{ text: { content: aiComment } }],
      },
      '記録日': {
        date: { start: today },
      },
    },
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: {
      'Authorization':   `Bearer ${notionKey}`,
      'Content-Type':    'application/json',
      'Notion-Version':  NOTION_VER,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Notion保存エラー: ${err}`)
  }

  const page = await res.json() as { url: string }
  return page.url
}

// ── メイン POST ハンドラー ────────────────────────────

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId') ?? 'kitano-resort'

  const notionKey   = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''

  if (!notionKey || !anthropicKey) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
  }

  const db      = getCompanyDbConfig(companyId)
  const company = getCompanyById(companyId)

  if (!db.delightLogDbId) {
    return NextResponse.json({ error: '感動ログDBが設定されていません' }, { status: 400 })
  }

  // ── リクエストボディ取得 ──────────────────────────────
  let body: SaveDelightLogBody
  try {
    body = await req.json() as SaveDelightLogBody
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
  }

  const { staffName, action, customerReaction, staffNote = '' } = body
  if (!staffName || !action || !customerReaction) {
    return NextResponse.json(
      { error: 'staffName, action, customerReaction は必須です' },
      { status: 400 },
    )
  }

  // ── Haiku 分析 ────────────────────────────────────────
  let analysis: HaikuDelightAnalysis
  try {
    analysis = await analyzeDelight(
      company.name, company.industry,
      staffName, action, customerReaction, staffNote,
      anthropicKey,
    )
  } catch (err) {
    console.error('[delight-log/save] Haiku分析エラー:', err)
    // フォールバック
    analysis = {
      logTitle:  `${staffName}の感動対応`,
      category:  '共感',
      tags:      ['ホスピタリティ'],
      score:     4,
      aiComment: '素晴らしい対応でした。この経験を活かし続けてください。',
    }
  }

  // ── Notion 保存 ───────────────────────────────────────
  let notionPageUrl = ''
  try {
    notionPageUrl = await saveToNotion(
      db.delightLogDbId, notionKey,
      analysis.logTitle, staffName, analysis.category,
      action, customerReaction,
      analysis.tags, analysis.score, analysis.aiComment,
    )
  } catch (err) {
    console.error('[delight-log/save] Notion保存エラー:', err)
    // Notion保存失敗でもAI分析結果は返す
  }

  const result: SaveDelightLogResult = {
    success:       true,
    notionPageUrl,
    category:      analysis.category,
    tags:          analysis.tags,
    score:         analysis.score,
    aiComment:     analysis.aiComment,
    logTitle:      analysis.logTitle,
  }

  return NextResponse.json(result)
}
