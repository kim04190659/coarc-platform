// =====================================================
//  src/app/api/menu-design/apply/route.ts
//  AI メニュー提案 承認・適用 API — Sprint #31
//
//  ■ POST { companyId, pageId, approvedModules: string[] }
//    Notion ヒアリング結果DBの該当レコードに
//    承認済みモジュール一覧を JSON テキストとして保存する。
//    ステータスを「✅ 承認済み」に更新する。
//
//  ■ 保存先
//    備考プロパティに JSON を上書きする。
//    （ヒアリング時の notes は interviewedBy と分離されているため影響なし）
// =====================================================

import { NextResponse } from 'next/server'

// ── 型定義 ──────────────────────────────────────────

export type ApplyRequest = {
  companyId:       string
  pageId:          string
  approvedModules: string[]   // enabled な module ID の配列
}

export type ApplyResponse = {
  success: boolean
  error?:  string
}

// ── Notion API ヘッダー ───────────────────────────────

function notionHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization':  `Bearer ${apiKey}`,
    'Content-Type':   'application/json',
    'Notion-Version': '2022-06-28',
  }
}

// ── POST ──────────────────────────────────────────────

export async function POST(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json<ApplyResponse>(
      { success: false, error: 'NOTION_TOKEN が未設定です' },
      { status: 500 }
    )
  }

  const body = await request.json() as ApplyRequest

  if (!body.pageId || !body.companyId) {
    return NextResponse.json<ApplyResponse>(
      { success: false, error: 'pageId と companyId が必要です' },
      { status: 400 }
    )
  }

  // ── 承認済みモジュール設定を JSON テキストに変換 ──
  const approvedJson = JSON.stringify({
    approvedModules: body.approvedModules,
    approvedAt:      new Date().toISOString(),
    companyId:       body.companyId,
  })

  try {
    // Notion ページを PATCH して承認設定を保存
    const res = await fetch(
      `https://api.notion.com/v1/pages/${body.pageId}`,
      {
        method:  'PATCH',
        headers: notionHeaders(notionKey),
        body:    JSON.stringify({
          properties: {
            // ステータスを「承認済み」に更新
            'ステータス': { select: { name: '✅ 承認済み' } },
            // 備考欄に承認済みモジュール設定を JSON として保存
            '備考':       { rich_text: [{ text: { content: approvedJson } }] },
          },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[menu-design/apply POST] Notion error:', errText.slice(0, 200))
      return NextResponse.json<ApplyResponse>(
        { success: false, error: 'Notion への保存に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json<ApplyResponse>({ success: true })

  } catch (err) {
    console.error('[menu-design/apply POST] error:', err)
    return NextResponse.json<ApplyResponse>(
      { success: false, error: 'ネットワークエラー' },
      { status: 500 }
    )
  }
}
