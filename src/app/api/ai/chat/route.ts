// =====================================================
//  src/app/api/ai/chat/route.ts
//  フリーチャット API — Claude Haiku に自由質問して返す
//
//  ■ POST /api/ai/chat
//    body: {
//      question:  string   — ユーザーの質問
//      companyId: string   — 企業ID（ログ保存先の特定に使用）
//    }
//
//  ■ 処理フロー
//    1. Claude Haiku に質問を投げて回答を取得
//    2. 回答をユーザーに即時返却
//    3. バックグラウンドで Notion の AI質問ログDBに非同期保存
//       （ログ保存の失敗はユーザー体験に影響させない）
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── AI質問ログを Notion に非同期保存 ─────────────────
//    await しない → ユーザーへのレスポンスをブロックしない

function saveAiLog(params: {
  notionKey:    string
  logDbId:      string
  question:     string
  answer:       string
  source:       string
  elapsedMs:    number
}) {
  const { notionKey, logDbId, question, answer, source, elapsedMs } = params

  // ログDB IDが未設定の場合はスキップ
  if (!logDbId) return

  // 非同期で保存（エラーはログのみ）
  fetch(`${NOTION_API}/pages`, {
    method:  'POST',
    headers: notionHeaders(notionKey),
    body:    JSON.stringify({
      parent: { database_id: logDbId },
      properties: {
        '質問': {
          title: [{ text: { content: question.slice(0, 100) } }],  // 100文字で切る
        },
        '回答': {
          rich_text: [{ text: { content: answer.slice(0, 2000) } }],  // 2000文字で切る
        },
        'ソース': {
          select: { name: source },
        },
        '記録日時': {
          date: { start: new Date().toISOString() },
        },
        'モデル': {
          rich_text: [{ text: { content: 'claude-haiku-4-5-20251001' } }],
        },
        '応答時間ms': {
          number: elapsedMs,
        },
      },
    }),
  }).catch(err => {
    // ログ保存失敗はサイレントに処理（ユーザー体験を壊さない）
    console.error('[ai/chat] ログ保存エラー:', err)
  })
}

// ── メインハンドラー ────────────────────────────────

export async function POST(request: Request) {
  const notionKey    = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!anthropicKey) {
    return NextResponse.json({ error: 'Anthropic APIキーが未設定です' }, { status: 500 })
  }

  try {
    const body = await request.json() as {
      question:  string
      companyId: string
    }

    const { question, companyId } = body

    if (!question?.trim()) {
      return NextResponse.json({ error: '質問を入力してください' }, { status: 400 })
    }
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }

    // ✅ 企業別DB方式: companyId からAIログDB IDを取得
    const dbConfig = getCompanyDbConfig(companyId)

    // ── Claude Haiku に質問を投げる ────────────────────
    const client = new Anthropic({ apiKey: anthropicKey })
    const startMs = Date.now()

    const res = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role:    'user',
        content: question,
      }],
      system: `あなたはCoarcプラットフォームのAIアシスタントです。
企業の業務改善・経営課題・人材活用・DX推進に関するご質問にお答えします。
回答は日本語で、わかりやすく簡潔に行ってください。`,
    })

    const elapsedMs = Date.now() - startMs

    // stop_reason チェック
    if (res.stop_reason === 'max_tokens') {
      console.warn('[ai/chat] max_tokens に達しました（出力が途中の可能性あり）')
    }

    // 回答テキスト取得
    const answer = res.content[0]?.type === 'text' ? res.content[0].text : ''

    // ── Notion に非同期ログ保存（ユーザーへのレスポンスはブロックしない）──
    if (notionKey) {
      saveAiLog({
        notionKey,
        logDbId:   dbConfig.aiChatLogDbId,
        question,
        answer,
        source:    'フリーチャット',
        elapsedMs,
      })
    }

    return NextResponse.json({
      answer,
      elapsedMs,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai/chat] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
