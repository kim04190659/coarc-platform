// =====================================================
//  src/app/api/knowledge/search/route.ts
//  AIナレッジ検索 — ナレッジベースDBを全件取得し、Claude Haikuで類似回答をサジェスト
//
//  ■ 処理フロー
//    1. ナレッジベースDB（共通DB）から企業別に全件取得
//    2. キーワードでフロント側フィルタリング（クライアント用）
//    3. Claude Haiku に問い合わせ内容を渡して類似ナレッジ + AI推奨回答を生成
//
//  ■ リクエスト（GET）
//    ?companyId=kitano-resort&query=チェックアウト
//
//  ■ レスポンス
//    {
//      items:       KnowledgeItem[]  // マッチしたナレッジ一覧
//      aiSuggestion: string          // Claude Haikuによる推奨回答（query指定時のみ）
//    }
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'
import Anthropic from '@anthropic-ai/sdk'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type KnowledgeItem = {
  pageId:    string
  title:     string
  category:  string
  content:   string   // 対応内容
  keywords:  string   // キーワード文字列
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── メインハンドラー ────────────────────────────────

export async function GET(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  const query     = searchParams.get('query') ?? ''

  if (!companyId) {
    return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
  }

  const company = getCompanyById(companyId)
  // ✅ 企業別DB方式: companyId から企業専用ナレッジDB IDを取得
  const dbConfig = getCompanyDbConfig(companyId)

  try {
    // ── ナレッジベースDB（企業別）から全件取得 ────────────
    // ✅ 企業専用DBにクエリ（企業名フィルタなし）
    const res = await fetch(`${NOTION_API}/databases/${dbConfig.knowledgeBaseDbId}/query`, {
      method: 'POST',
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        filter: {
          property: '有効フラグ',
          select: { equals: '有効' },
        },
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        page_size: 50,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return NextResponse.json(
        { error: `Notion APIエラー (${res.status}): ${errBody}` },
        { status: 500 },
      )
    }

    const data = await res.json() as { results: Record<string, unknown>[] }

    // ── Notionレスポンスを KnowledgeItem に変換 ────────
    const allItems: KnowledgeItem[] = data.results.map(page => {
      const props = page.properties as Record<string, {
        title?:     Array<{ plain_text?: string }>
        select?:    { name?: string }
        rich_text?: Array<{ plain_text?: string }>
      }>

      const getText = (prop: typeof props[string] | undefined) =>
        prop?.title?.[0]?.plain_text ?? prop?.rich_text?.[0]?.plain_text ?? ''

      // 企業別DB方式: タイトル→タイトル, 対応内容→内容, キーワード→タグ
      const tags = (props['タグ'] as { multi_select?: Array<{ name?: string }> } | undefined)?.multi_select ?? []
      return {
        pageId:   page.id as string,
        title:    getText(props['タイトル']) || getText(props['件名']),
        category: props['カテゴリ']?.select?.name ?? '',
        content:  getText(props['内容']) || getText(props['対応内容']),
        keywords: tags.map(t => t.name ?? '').join(' ') || getText(props['キーワード']),
      }
    })

    // ── キーワード検索フィルタリング ──────────────────
    const keyword = query.trim().toLowerCase()
    const items = keyword
      ? allItems.filter(item =>
          item.title.toLowerCase().includes(keyword)    ||
          item.content.toLowerCase().includes(keyword)  ||
          item.keywords.toLowerCase().includes(keyword) ||
          item.category.toLowerCase().includes(keyword)
        )
      : allItems

    // ── Claude Haiku でAI推奨回答を生成 ──────────────
    // queryがある場合のみAIサジェストを生成する
    let aiSuggestion = ''

    if (query.trim() && items.length > 0) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (anthropicKey) {
        try {
          const client = new Anthropic({ apiKey: anthropicKey })

          // 上位3件のナレッジを参考情報としてAIに渡す（トークン節約）
          const refKnowledge = items.slice(0, 3)
            .map((item, i) => `【${i + 1}】${item.title}\n対応: ${item.content}`)
            .join('\n\n')

          const res2 = await client.messages.create({
            model:      'claude-haiku-4-5-20251001',
            max_tokens: 4096,  // CLAUDE.md ルール: 4096固定
            messages: [{
              role: 'user',
              content: `あなたは${company.name}のカスタマーサポート担当者です。
以下の問い合わせ内容について、参考ナレッジをもとに推奨対応を生成してください。

【問い合わせ内容】
${query}

【参考ナレッジ】
${refKnowledge}

【出力形式】
- 200文字以内の具体的な推奨対応文のみを出力
- 箇条書きは使わず、自然な文章で
- 敬語を使うこと`,
            }],
          })

          if (res2.stop_reason === 'max_tokens') {
            console.warn('[knowledge/search] AI生成: max_tokens に達しました')
          }

          aiSuggestion = res2.content[0]?.type === 'text'
            ? res2.content[0].text.trim()
            : ''
        } catch (aiErr) {
          console.warn('[knowledge/search] AI生成エラー（スキップ）:', aiErr)
        }
      }
    }

    return NextResponse.json({ items, aiSuggestion })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[knowledge/search] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
