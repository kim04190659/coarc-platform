// =====================================================
//  src/app/api/contacts/update-status/route.ts
//  問い合わせのステータスを Notion DBで更新するAPIルート
//
//  ■ 設計
//    フロントエンドでステータスを変更したとき、
//    対応する Notion DB レコードのステータスを即時更新する。
//    問い合わせID（例: KR-001）でレコードを検索し、
//    見つかったページの「ステータス」SELECTプロパティを更新する。
//
//  ■ 処理フロー
//    1. companyId → COMPANY_DB_CONFIG から DB ID を取得
//    2. Notion DB を「問い合わせID = contactId」でクエリ
//    3. 見つかったページの ステータス を PATCH で更新
//
//  ■ リクエスト（POST）
//    {
//      companyId:  string   // 企業ID（例: 'kitano-resort'）
//      contactId:  string   // 問い合わせID（例: 'KR-001'）
//      status:     string   // 新しいステータス（'未対応'|'対応中'|'完了'）
//    }
//
//  ■ レスポンス
//    { success: true, pageId: string }  — 成功
//    { error: string }                  — 失敗
// =====================================================

import { NextResponse } from 'next/server'
import { COMPANY_DB_CONFIG } from '@/config/company-db-config'

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

export async function POST(request: Request) {
  // 環境変数チェック
  const apiKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Notion APIキーが設定されていません。' },
      { status: 500 },
    )
  }

  try {
    const body = await request.json()
    const { companyId, contactId, status } = body

    if (!companyId || !contactId || !status) {
      return NextResponse.json(
        { error: 'companyId / contactId / status は必須です。' },
        { status: 400 },
      )
    }

    // ── 企業別 DB ID を取得 ────────────────────────────
    const dbId = COMPANY_DB_CONFIG[companyId]?.serviceContactDbId
    if (!dbId) {
      return NextResponse.json(
        { error: `企業ID "${companyId}" の問い合わせDBが未設定です。` },
        { status: 500 },
      )
    }

    // ── Notion DB を「問い合わせID = contactId」でクエリ ──
    const queryRes = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(apiKey),
      body: JSON.stringify({
        filter: {
          property: '問い合わせID',
          rich_text: { equals: contactId },
        },
        page_size: 1,
      }),
    })

    if (!queryRes.ok) {
      const errBody = await queryRes.text()
      console.error('[update-status] Notion query エラー:', queryRes.status, errBody)
      return NextResponse.json(
        { error: `Notion検索に失敗しました (${queryRes.status}): ${errBody}` },
        { status: 500 },
      )
    }

    const queryData = await queryRes.json()
    const page = queryData.results?.[0]

    if (!page) {
      // レコードが見つからない場合（まだ保存されていない等）はスキップ
      console.warn(`[update-status] contactId "${contactId}" のレコードが見つかりません（DB: ${dbId}）`)
      return NextResponse.json(
        { success: true, pageId: null, message: 'Notionに該当レコードなし（ローカル変更のみ）' },
      )
    }

    // ── 見つかったページのステータスを更新 ────────────
    const pageId = page.id
    const patchRes = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: 'PATCH',
      headers: notionHeaders(apiKey),
      body: JSON.stringify({
        properties: {
          'ステータス': {
            select: { name: status },
          },
        },
      }),
    })

    if (!patchRes.ok) {
      const errBody = await patchRes.text()
      console.error('[update-status] Notion PATCH エラー:', patchRes.status, errBody)
      return NextResponse.json(
        { error: `Notionの更新に失敗しました (${patchRes.status}): ${errBody}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, pageId })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[update-status] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
