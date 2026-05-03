// =====================================================
//  src/app/api/contacts/save/route.ts
//  問い合わせ対応をNotionに保存するAPIルート
//
//  ■ 処理内容
//    受け取った問い合わせ情報 + AI下書きを
//    各企業のNotionページ配下に子ページとして作成する
//
//  ■ 必要な環境変数
//    NOTION_TOKEN または NOTION_API_KEY — Notion統合トークン
//    （NOTION_TOKEN を優先して読み込む。どちらかが設定されていればOK）
//
//  ■ リクエスト（POST）
//    {
//      contactId:    string   // 問い合わせID（例: 'KR-001'）
//      companyId:    string   // 企業ID（例: 'kitano-resort'）
//      companyName:  string   // 企業表示名
//      notionPageId: string   // 企業NotionページID（保存先の親）
//      date:         string   // 受付日時（ISO 8601）
//      channel:      string   // チャネル
//      category:     string   // カテゴリ
//      status:       string   // 対応ステータス
//      priority:     string   // 優先度
//      customerName: string   // 顧客名
//      subject:      string   // 件名
//      content:      string   // 問い合わせ本文
//      draft:        string   // AI下書き（編集済みも可）
//    }
//
//  ■ レスポンス
//    { success: true, pageUrl: string }   — 成功
//    { error: string }                     — 失敗
// =====================================================

import { NextResponse } from 'next/server'

// Notion API の定数
const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

/** Notion API 共通ヘッダーを返す */
function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

/** ISO日時を「YYYY年MM月DD日 HH:mm」にフォーマット */
function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 優先度・ステータスに対応するNotionカラーを返す */
function priorityColor(p: string): string {
  return p === '高' ? 'red' : p === '中' ? 'orange' : 'gray'
}

function statusColor(s: string): string {
  return s === '未対応' ? 'red' : s === '対応中' ? 'yellow' : 'green'
}

export async function POST(request: Request) {
  // 環境変数チェック（NOTION_TOKEN を優先、なければ NOTION_API_KEY を試みる）
  const apiKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!apiKey) {
    console.error('[contacts/save] NOTION_TOKEN / NOTION_API_KEY が未設定です')
    return NextResponse.json(
      { error: 'Notion APIキーが設定されていません。Vercelの環境変数 NOTION_TOKEN を確認してください。' },
      { status: 500 },
    )
  }

  try {
    const body = await request.json()
    const {
      contactId, companyName, notionPageId,
      date, channel, category, status, priority,
      customerName, subject, content, draft,
    } = body

    // ── Notionページを作成 ──────────────────────────────
    // ページタイトル: [問い合わせ対応] チェックイン待ち時間が長すぎる
    const pageTitle = `[問い合わせ対応] ${subject}`

    const pageBody = {
      parent: { page_id: notionPageId },
      // ページのプロパティ（タイトルのみ。DBではなくページなのでプロパティはtitleのみ）
      properties: {
        title: {
          title: [{ type: 'text', text: { content: pageTitle } }],
        },
      },
      // ページ本文（ブロック構造）
      children: [
        // ── 受付情報テーブル ─────────────────────────────
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: '📋 受付情報' } }],
            color: 'default',
          },
        },
        // 問い合わせID・受付日
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: '問い合わせID: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: contactId } },
            ],
          },
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: '受付日時: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: formatDate(date) } },
            ],
          },
        },
        // 企業・顧客
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: '企業名: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: companyName } },
            ],
          },
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: '顧客名: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: `${customerName} 様` } },
            ],
          },
        },
        // チャネル・カテゴリ
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'チャネル: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: channel } },
            ],
          },
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'カテゴリ: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: category } },
            ],
          },
        },
        // 優先度・ステータス（カラー付き）
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: '優先度: ' }, annotations: { bold: true } },
              {
                type: 'text',
                text: { content: priority },
                annotations: { color: priorityColor(priority) as 'red' | 'orange' | 'gray' },
              },
            ],
          },
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: '対応ステータス: ' }, annotations: { bold: true } },
              {
                type: 'text',
                text: { content: status },
                annotations: { color: statusColor(status) as 'red' | 'yellow' | 'green' },
              },
            ],
          },
        },

        // ── 問い合わせ本文 ───────────────────────────────
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: '💬 お問い合わせ内容' } }],
            color: 'default',
          },
        },
        {
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: [{ type: 'text', text: { content: content } }],
            color: 'gray_background',
          },
        },

        // ── AI下書き ────────────────────────────────────
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: '🤖 AI返信下書き（要確認・編集後送信）' } }],
            color: 'default',
          },
        },
        {
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [{ type: 'text', text: { content: draft } }],
            icon: { type: 'emoji', emoji: '✏️' },
            color: 'blue_background',
          },
        },

        // ── 備考欄（空白） ───────────────────────────────
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: '📝 対応メモ' } }],
            color: 'default',
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: '（ここに対応内容・結果を記録してください）' } }],
            color: 'gray',
          },
        },
      ],
    }

    // Notion APIを呼び出してページを作成
    const res = await fetch(`${NOTION_API}/pages`, {
      method: 'POST',
      headers: notionHeaders(apiKey),
      body: JSON.stringify(pageBody),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[contacts/save] Notion APIエラー:', res.status, errBody)
      return NextResponse.json(
        { error: `Notionへの保存に失敗しました (${res.status}): ${errBody}` },
        { status: 500 },
      )
    }

    const page = await res.json()
    const pageUrl = page.url ?? `https://notion.so/${page.id?.replace(/-/g, '')}`

    return NextResponse.json({ success: true, pageUrl })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[contacts/save] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
