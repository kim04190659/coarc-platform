// =====================================================
//  src/app/api/feedback/save/route.ts
//  顧客フィードバックを Notion 企業別DBに保存するAPIルート
//
//  ■ 処理フロー
//    1. フロントエンドからフィードバック内容を受け取る
//    2. Claude Haiku で感情分析・キーワード抽出を実行
//    3. Notion 企業別フィードバックDBにレコードを保存
//
//  ■ リクエスト（POST）
//    {
//      companyId:    string  // 企業ID
//      feedbackId:   string  // フィードバックID（例: KR-FB-001）
//      rating:       string  // 評価（'⭐5 大変満足' | '⭐4 満足' | ... ）
//      category:     string  // カテゴリ
//      channel:      string  // チャネル
//      date:         string  // 受付日時（ISO 8601）
//      customerName: string  // 顧客名
//      content:      string  // フィードバック本文
//    }
//
//  ■ レスポンス
//    { success: true, pageId: string, aiAnalysis: object }  — 成功
//    { error: string }                                       — 失敗
// =====================================================

import { NextResponse } from 'next/server'
import { COMPANY_DB_CONFIG } from '@/config/company-db-config'
import Anthropic from '@anthropic-ai/sdk'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

/** Notion API 共通ヘッダー */
function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

/** rich_text プロパティ用ヘルパー（2000字トリム） */
function richText(text: string) {
  return [{ type: 'text', text: { content: text.slice(0, 2000) } }]
}

// ── AI感情分析の型 ───────────────────────────────────
type AiAnalysis = {
  sentiment:  'ポジティブ' | 'ネガティブ' | 'ニュートラル'
  score:      number   // 1〜5（感情強度）
  keywords:   string[] // 重要キーワード（最大5語）
  summary:    string   // 1文要約
  actionHint: string   // 対応ヒント（1文）
}

/**
 * Claude Haiku でフィードバックの感情分析を実行する
 * 失敗した場合は null を返す（保存処理は続行）
 */
async function analyzeWithAI(content: string, rating: string): Promise<AiAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `以下の顧客フィードバックを分析してください。

評価: ${rating}
内容: ${content}

【出力形式（JSONのみ・説明文不要）】
{"sentiment":"ポジティブ|ネガティブ|ニュートラル","score":1〜5,"keywords":["最大5語"],"summary":"1文要約","actionHint":"対応ヒント1文"}`,
      }],
    })

    if (res.stop_reason === 'max_tokens') {
      console.warn('[feedback/save] AI分析: max_tokens に達しました')
    }

    const text = res.content[0]?.type === 'text' ? res.content[0].text.trim() : ''
    // JSONブロック除去
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(jsonStr) as AiAnalysis
  } catch (err) {
    console.warn('[feedback/save] AI分析エラー（スキップ）:', err)
    return null
  }
}

export async function POST(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { companyId, feedbackId, rating, category, channel, date, customerName, content } = body

    if (!companyId || !content) {
      return NextResponse.json({ error: 'companyId と content は必須です' }, { status: 400 })
    }

    // 企業別 DB ID を取得
    const dbId = COMPANY_DB_CONFIG[companyId]?.customerFeedbackDbId
    if (!dbId) {
      return NextResponse.json(
        { error: `企業ID "${companyId}" のフィードバックDBが未設定です` },
        { status: 500 },
      )
    }

    // ── AI感情分析（失敗しても保存は続行）────────────────
    const aiAnalysis = await analyzeWithAI(content, rating ?? '')
    const aiJson = aiAnalysis ? JSON.stringify(aiAnalysis) : ''

    // ── Notion DBにレコードを追加 ──────────────────────────
    const pageBody = {
      parent: { database_id: dbId },
      properties: {
        '件名': {
          title: richText(`${feedbackId ?? ''}${rating ? ' ' + rating : ''}`),
        },
        '評価': {
          select: rating ? { name: rating } : null,
        },
        'カテゴリ': {
          select: category ? { name: category } : null,
        },
        'チャネル': {
          select: channel ? { name: channel } : null,
        },
        '受付日時': {
          date: date ? { start: date } : null,
        },
        '顧客名': {
          rich_text: richText(customerName ?? '匿名'),
        },
        'フィードバックID': {
          rich_text: richText(feedbackId ?? ''),
        },
        'フィードバック内容': {
          rich_text: richText(content),
        },
        'AI感情分析': {
          rich_text: richText(aiJson),
        },
        '対応状況': {
          select: { name: '未確認' },
        },
      },
    }

    const res = await fetch(`${NOTION_API}/pages`, {
      method: 'POST',
      headers: notionHeaders(notionKey),
      body: JSON.stringify(pageBody),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[feedback/save] Notion APIエラー:', res.status, errBody)
      return NextResponse.json(
        { error: `Notionへの保存に失敗 (${res.status}): ${errBody}` },
        { status: 500 },
      )
    }

    const page = await res.json() as { id: string }
    return NextResponse.json({ success: true, pageId: page.id, aiAnalysis })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[feedback/save] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
