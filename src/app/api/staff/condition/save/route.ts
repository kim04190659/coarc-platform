// =====================================================
//  src/app/api/staff/condition/save/route.ts
//  コンディション保存 — 入力されたコンディション情報を
//  Claude Haikuでコメント生成してからNotionに保存する
//
//  ■ POST body
//    { companyId, staffName, condition, workload, workStyle, memo }
//
//  ■ 処理フロー
//    1. Claude Haiku でAIコメントを生成（100字以内）
//    2. Notion コンディションDBに新規レコードを登録
//
//  ■ レスポンス
//    { success: true, pageId: string, aiComment: string }
// =====================================================

import { NextResponse } from 'next/server'
import { SHARED_NOTION_DBS } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'
import Anthropic from '@anthropic-ai/sdk'

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

// ── コンディション数値化（AI参考用）────────────────────

function conditionToScore(condition: string): number {
  if (condition.includes('5')) return 5
  if (condition.includes('4')) return 4
  if (condition.includes('3')) return 3
  if (condition.includes('2')) return 2
  return 1
}

// ── POST: コンディション保存 ───────────────────────────

export async function POST(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  try {
    const body = await request.json() as {
      companyId: string
      staffName: string
      condition: string   // ⭐5 絶好調 など
      workload:  string   // 高/中/低
      workStyle: string   // 出勤/テレワーク/休暇/病欠
      memo:      string
    }
    const { companyId, staffName, condition, workload, workStyle, memo } = body

    if (!companyId || !staffName || !condition) {
      return NextResponse.json(
        { error: 'companyId, staffName, condition は必須です' },
        { status: 400 },
      )
    }

    const company = getCompanyById(companyId)
    const today = new Date().toISOString().split('T')[0]

    // ── Claude Haiku でAIコメントを生成 ──────────────
    let aiComment = ''
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey })
        const score = conditionToScore(condition)
        const isAlert = score <= 2

        const res = await client.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 4096,  // CLAUDE.md ルール: 4096固定
          messages: [{
            role: 'user',
            content: `あなたは${company.name}のマネージャーをサポートするAIアシスタントです。
以下の社員コンディション情報をもとに、マネージャーへの短いアドバイスを生成してください。

【社員名】${staffName}
【コンディション】${condition}（${score}/5）
【業務負荷】${workload}
【勤務形態】${workStyle}
【メモ】${memo || 'なし'}

【出力形式】
- 100文字以内の具体的なアドバイスのみ出力
- ${isAlert ? '⚠️ 注意が必要な状態のため、具体的なサポートアクションを提案する' : '好調を維持するためのポジティブなコメントにする'}
- 敬語を使うこと
- 箇条書き禁止、自然な文章で`,
          }],
        })

        if (res.stop_reason === 'max_tokens') {
          console.warn('[staff/condition] AIコメント: max_tokens に達しました')
        }

        aiComment = res.content[0]?.type === 'text'
          ? res.content[0].text.trim()
          : ''
      } catch (aiErr) {
        console.warn('[staff/condition] AIコメント生成エラー（スキップ）:', aiErr)
      }
    }

    // ── Notion コンディションDBに保存 ─────────────────
    const title = `${today.substring(0, 7).replace('-', '年')}月 ${staffName} コンディション記録`

    const res = await fetch(`${NOTION_API}/pages`, {
      method: 'POST',
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        parent: { database_id: SHARED_NOTION_DBS.staffCondition },
        properties: {
          '件名': {
            title: [{ text: { content: title } }],
          },
          '企業名': {
            select: { name: company.shortName },
          },
          '社員名': {
            rich_text: [{ text: { content: staffName } }],
          },
          'コンディション': {
            select: { name: condition },
          },
          '業務負荷': {
            select: { name: workload },
          },
          '勤務形態': {
            select: { name: workStyle },
          },
          '記録日': {
            date: { start: today },
          },
          'メモ': {
            rich_text: [{ text: { content: memo || '' } }],
          },
          'AIコメント': {
            rich_text: [{ text: { content: aiComment } }],
          },
        },
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return NextResponse.json(
        { error: `Notion保存エラー (${res.status}): ${errBody}` },
        { status: 500 },
      )
    }

    const page = await res.json() as { id: string }
    return NextResponse.json({ success: true, pageId: page.id, aiComment })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[staff/condition/save] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
