// =====================================================
//  src/app/api/contacts/save/route.ts
//  問い合わせ対応を Notion 企業別DBに保存するAPIルート
//
//  ■ 設計
//    企業ごとに独立した「問い合わせ管理DB」を持つ方式。
//    companyId → COMPANY_DB_CONFIG[companyId].serviceContactDbId
//    で保存先DBを切り替える。
//
//  ■ 保存先
//    各社の Notion ページ配下にある 💬 問い合わせ管理DB
//    DB ID:  COMPANY_DB_CONFIG[companyId].serviceContactDbId
//
//  ■ 必要な環境変数
//    NOTION_TOKEN または NOTION_API_KEY — Notion統合トークン
//
//  ■ リクエスト（POST）
//    {
//      contactId:    string   // 問い合わせID（例: 'KR-001'）
//      companyId:    string   // 企業ID（必須 — DB切り替えに使用）
//      date:         string   // 受付日時（ISO 8601）
//      channel:      string   // チャネル
//      category:     string   // カテゴリ
//      status:       string   // 対応ステータス
//      priority:     string   // 優先度
//      customerName: string   // 顧客名
//      assignee?:    string   // 担当者
//      subject:      string   // 件名
//      content:      string   // 問い合わせ本文
//      draft:        string   // AI下書き
//    }
//
//  ■ レスポンス
//    { success: true, pageUrl: string, pageId: string }  — 成功
//    { error: string }                                    — 失敗
// =====================================================

import { NextResponse } from 'next/server'
import { COMPANY_DB_CONFIG } from '@/config/company-db-config'

// Notion API の定数
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

/** rich_text プロパティ用のヘルパー（長いテキストを2000字でトリム） */
function richText(text: string) {
  return [{ type: 'text', text: { content: text.slice(0, 2000) } }]
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
      contactId, companyId,
      date, channel, category, status, priority,
      customerName, assignee, subject, content, draft,
    } = body

    // ── companyId から企業別 DB ID を取得 ─────────────────
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId が指定されていません。' },
        { status: 400 },
      )
    }
    const dbId = COMPANY_DB_CONFIG[companyId]?.serviceContactDbId
    if (!dbId) {
      console.error(`[contacts/save] companyId "${companyId}" の serviceContactDbId が未設定です`)
      return NextResponse.json(
        { error: `企業ID "${companyId}" の問い合わせDBが未設定です。company-db-config.ts を確認してください。` },
        { status: 500 },
      )
    }

    const pageBody = {
      parent: { database_id: dbId },
      properties: {
        // TITLE プロパティ（件名）
        '件名': {
          title: richText(subject),
        },
        // SELECT プロパティ（ステータス）
        // ※ 企業別DBのため「企業名」プロパティは不要
        'ステータス': {
          select: { name: status },
        },
        // SELECT プロパティ（優先度）
        '優先度': {
          select: { name: priority },
        },
        // SELECT プロパティ（カテゴリ）
        'カテゴリ': {
          select: { name: category },
        },
        // SELECT プロパティ（チャネル）
        'チャネル': {
          select: { name: channel },
        },
        // DATE プロパティ（受付日時）
        '受付日時': {
          date: { start: date },
        },
        // RICH_TEXT プロパティ（顧客名）
        '顧客名': {
          rich_text: richText(customerName),
        },
        // RICH_TEXT プロパティ（担当者）
        '担当者': {
          rich_text: richText(assignee ?? '未割当'),
        },
        // RICH_TEXT プロパティ（問い合わせID）
        '問い合わせID': {
          rich_text: richText(contactId),
        },
        // RICH_TEXT プロパティ（問い合わせ内容）
        '問い合わせ内容': {
          rich_text: richText(content),
        },
        // RICH_TEXT プロパティ（AI下書き）
        'AI下書き': {
          rich_text: richText(draft),
        },
      },
    }

    // Notion API を呼び出してDBにレコードを追加
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

    return NextResponse.json({ success: true, pageUrl, pageId: page.id })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[contacts/save] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
