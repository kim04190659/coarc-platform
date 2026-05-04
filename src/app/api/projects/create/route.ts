// =====================================================
//  src/app/api/projects/create/route.ts
//  プロジェクト新規作成API
//
//  ■ POST body
//    { companyId, projectName, assignee, description,
//      priority?, startDate?, dueDate? }
//
//  ■ 処理フロー
//    1. バリデーション
//    2. Notion プロジェクト管理DB にレコード作成
//    3. 作成したページの id を返す
//
//  ■ レスポンス
//    { projectId: string, projectName: string }
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyById } from '@/config/companies'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

export async function POST(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  try {
    const body = await request.json() as {
      companyId:    string
      projectName:  string
      assignee:     string
      description:  string
      priority?:    string
      startDate?:   string
      dueDate?:     string
    }

    const { companyId, projectName, assignee, description, priority, startDate, dueDate } = body

    if (!companyId || !projectName?.trim() || !assignee?.trim()) {
      return NextResponse.json(
        { error: 'companyId・projectName・assignee は必須です' },
        { status: 400 },
      )
    }

    const company = getCompanyById(companyId)
    const { SHARED_NOTION_DBS } = await import('@/config/company-db-config')

    // ── Notion にプロジェクトページを作成 ──────────
    const properties: Record<string, unknown> = {
      'プロジェクト名': {
        title: [{ text: { content: projectName } }],
      },
      '企業名': {
        select: { name: company.shortName },
      },
      'ステータス': {
        select: { name: '計画中' },
      },
      '優先度': {
        select: { name: priority ?? '中' },
      },
      '担当者': {
        rich_text: [{ text: { content: assignee } }],
      },
      '依頼内容': {
        rich_text: [{ text: { content: description ?? '' } }],
      },
    }

    // 日付は値がある場合のみ追加（空文字はNotionエラーになるため）
    if (startDate) {
      properties['開始日'] = { date: { start: startDate } }
    }
    if (dueDate) {
      properties['完了予定日'] = { date: { start: dueDate } }
    }

    const createRes = await fetch(`${NOTION_API}/pages`, {
      method:  'POST',
      headers: notionHeaders(notionKey),
      body:    JSON.stringify({
        parent:     { database_id: SHARED_NOTION_DBS.projectManagement },
        properties,
      }),
    })

    if (!createRes.ok) {
      const errText = await createRes.text()
      console.error('[projects/create] Notion エラー:', errText)
      throw new Error('プロジェクトの作成に失敗しました')
    }

    const created = await createRes.json() as { id: string }

    return NextResponse.json({
      projectId:   created.id,
      projectName,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[projects/create] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
