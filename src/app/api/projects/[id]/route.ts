// =====================================================
//  src/app/api/projects/[id]/route.ts
//  プロジェクト単件取得 + 進捗メモ更新API
//
//  ■ GET  /api/projects/[id]?companyId=xxx
//    → Notion ページID でプロジェクト1件と紐づくタスクを返す
//
//  ■ PATCH /api/projects/[id]
//    body: { progressNote?, status? }
//    → 進捗メモ・ステータスを Notion に即時反映
// =====================================================

import { NextResponse } from 'next/server'
import type { Project, ProjectTask } from '@/app/api/projects/list/route'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

type RouteContext = { params: Promise<{ id: string }> }

type NotionPage = { id: string; properties: Record<string, unknown> }
type PropMap = Record<string, {
  title?:     Array<{ plain_text?: string }>
  select?:    { name?: string }
  rich_text?: Array<{ plain_text?: string }>
  date?:      { start?: string }
}>
const getText = (props: PropMap, key: string) =>
  props[key]?.title?.[0]?.plain_text ?? props[key]?.rich_text?.[0]?.plain_text ?? ''

// ── GET: プロジェクト単件 + タスク一覧取得 ──────────

export async function GET(request: Request, context: RouteContext) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  const { id } = await context.params
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId') ?? ''

  if (!id) {
    return NextResponse.json({ error: 'プロジェクトIDが未指定です' }, { status: 400 })
  }

  try {
    // ✅ 企業別DB方式: companyId から企業専用 タスクDB IDを取得
    const { getCompanyDbConfig } = await import('@/config/company-db-config')
    const dbConfig = getCompanyDbConfig(companyId)

    // ── プロジェクト1件を Notion ページIDで取得 ──
    const pageRes = await fetch(`${NOTION_API}/pages/${id}`, {
      headers: notionHeaders(notionKey),
    })

    if (!pageRes.ok) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const page = await pageRes.json() as NotionPage
    const props = page.properties as PropMap
    const projectName = getText(props, 'プロジェクト名')

    // ── 紐づくタスクを企業別DBから取得 ──────────
    // ✅ 企業専用DBにクエリ（企業名フィルタなし・プロジェクト名のみでフィルタ）
    const taskRes = await fetch(`${NOTION_API}/databases/${dbConfig.projectTaskDbId}/query`, {
      method:  'POST',
      headers: notionHeaders(notionKey),
      body:    JSON.stringify({
        filter: { property: 'プロジェクト名', rich_text: { contains: projectName } },
        sorts:  [
          { property: '優先度', direction: 'descending' },
          { property: '期限',   direction: 'ascending'  },
        ],
        page_size: 50,
      }),
    })

    const taskData = taskRes.ok
      ? await taskRes.json() as { results: NotionPage[] }
      : { results: [] }

    const tasks: ProjectTask[] = taskData.results.map(t => {
      const tp = t.properties as PropMap
      return {
        id:          t.id,
        taskName:    getText(tp, 'タスク名'),
        projectName: getText(tp, 'プロジェクト名'),
        assignee:    getText(tp, '担当者'),
        status:      tp['ステータス']?.select?.name ?? '',
        priority:    tp['優先度']?.select?.name     ?? '',
        dueDate:     tp['期限']?.date?.start        ?? '',
        deliverable: getText(tp, '成果物'),
        memo:        getText(tp, 'メモ'),
      }
    })

    const doneCount = tasks.filter(t => t.status === '完了').length

    const project: Project = {
      id:           page.id,
      projectName,
      status:       props['ステータス']?.select?.name  ?? '',
      priority:     props['優先度']?.select?.name      ?? '',
      assignee:     getText(props, '担当者'),
      description:  getText(props, '依頼内容'),
      startDate:    props['開始日']?.date?.start       ?? '',
      dueDate:      props['完了予定日']?.date?.start   ?? '',
      progressNote: getText(props, '進捗メモ'),
      taskCount:    tasks.length,
      doneCount,
    }

    return NextResponse.json({ project, tasks })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[projects/[id]] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── PATCH: 進捗メモ・ステータス更新 ─────────────────

export async function PATCH(request: Request, context: RouteContext) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  const { id } = await context.params

  try {
    const body = await request.json() as {
      progressNote?: string
      status?:       string
    }

    const properties: Record<string, unknown> = {}

    if (body.progressNote !== undefined) {
      properties['進捗メモ'] = {
        rich_text: [{ text: { content: body.progressNote } }],
      }
    }

    if (body.status) {
      const allowed = ['計画中', '進行中', '完了', '中止']
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ error: '無効なステータスです' }, { status: 400 })
      }
      properties['ステータス'] = { select: { name: body.status } }
    }

    const patchRes = await fetch(`${NOTION_API}/pages/${id}`, {
      method:  'PATCH',
      headers: notionHeaders(notionKey),
      body:    JSON.stringify({ properties }),
    })

    if (!patchRes.ok) throw new Error('更新エラー')

    return NextResponse.json({ success: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
