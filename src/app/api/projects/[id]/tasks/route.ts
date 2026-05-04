// =====================================================
//  src/app/api/projects/[id]/tasks/route.ts
//  プロジェクト別タスク管理API
//
//  ■ GET  /api/projects/[id]/tasks?companyId=xxx&projectName=xxx
//    → タスク一覧を返す
//
//  ■ POST /api/projects/[id]/tasks
//    body: { companyId, projectName, taskName, assignee,
//            priority?, dueDate?, deliverable? }
//    → タスクを新規作成して返す
//
//  ■ PATCH /api/projects/[id]/tasks
//    body: { taskId, status }
//    → タスクのステータスを更新（Notion即時反映）
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'
// ✅ getCompanyById は企業別DB方式では不要（DBIDで企業を識別）

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

// ── GET: タスク一覧取得 ──────────────────────────────

export async function GET(request: Request, context: RouteContext) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const companyId   = searchParams.get('companyId')   ?? ''
  const projectName = searchParams.get('projectName') ?? ''

  if (!companyId || !projectName) {
    return NextResponse.json({ error: 'companyId・projectName は必須です' }, { status: 400 })
  }

  // ✅ 企業別DB方式: companyId から企業専用 タスクDB IDを取得
  const dbConfig = getCompanyDbConfig(companyId)

  // [id] は将来的にプロジェクトIDで直接引くために使用（現在はprojectName検索）
  void (await context.params).id

  try {
    // ✅ 企業専用DBにクエリ（企業名フィルタなし・プロジェクト名のみでフィルタ）
    const res = await fetch(`${NOTION_API}/databases/${dbConfig.projectTaskDbId}/query`, {
      method:  'POST',
      headers: notionHeaders(notionKey),
      body:    JSON.stringify({
        filter: {
          property: 'プロジェクト名',
          rich_text: { contains: projectName },
        },
        sorts: [
          { property: '優先度', direction: 'descending' },
          { property: '期限',   direction: 'ascending'  },
        ],
        page_size: 50,
      }),
    })

    if (!res.ok) throw new Error('タスク取得エラー')

    type NotionPage = { id: string; properties: Record<string, unknown> }
    const data = await res.json() as { results: NotionPage[] }
    type PropMap = Record<string, {
      title?:     Array<{ plain_text?: string }>
      select?:    { name?: string }
      rich_text?: Array<{ plain_text?: string }>
      date?:      { start?: string }
    }>
    const getText = (props: PropMap, key: string) =>
      props[key]?.title?.[0]?.plain_text ?? props[key]?.rich_text?.[0]?.plain_text ?? ''

    const tasks = data.results.map(p => {
      const props = p.properties as PropMap
      return {
        id:          p.id,
        taskName:    getText(props, 'タスク名'),
        projectName: getText(props, 'プロジェクト名'),
        assignee:    getText(props, '担当者'),
        status:      props['ステータス']?.select?.name ?? '',
        priority:    props['優先度']?.select?.name     ?? '',
        dueDate:     props['期限']?.date?.start        ?? '',
        deliverable: getText(props, '成果物'),
        memo:        getText(props, 'メモ'),
      }
    })

    return NextResponse.json({ tasks })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST: タスク新規作成 ─────────────────────────────

export async function POST(request: Request, context: RouteContext) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  void (await context.params).id

  try {
    const body = await request.json() as {
      companyId:    string
      projectName:  string
      taskName:     string
      assignee:     string
      priority?:    string
      dueDate?:     string
      deliverable?: string
      memo?:        string
    }

    const { companyId, projectName, taskName, assignee, priority, dueDate, deliverable, memo } = body

    if (!companyId || !projectName?.trim() || !taskName?.trim()) {
      return NextResponse.json(
        { error: 'companyId・projectName・taskName は必須です' },
        { status: 400 },
      )
    }

    // ✅ 企業別DB方式: companyId から企業専用 タスクDB IDを取得
    const dbConfig = getCompanyDbConfig(companyId)

    const properties: Record<string, unknown> = {
      'タスク名': {
        title: [{ text: { content: taskName } }],
      },
      // ✅ 企業名プロパティ不要（企業別DBは DB 自体で企業を識別）
      'プロジェクト名': {
        rich_text: [{ text: { content: projectName } }],
      },
      '担当者': {
        rich_text: [{ text: { content: assignee ?? '' } }],
      },
      'ステータス': {
        select: { name: '未着手' },
      },
      '優先度': {
        select: { name: priority ?? '中' },
      },
    }

    if (dueDate) {
      properties['期限'] = { date: { start: dueDate } }
    }
    if (deliverable) {
      properties['成果物'] = { rich_text: [{ text: { content: deliverable } }] }
    }
    if (memo) {
      properties['メモ'] = { rich_text: [{ text: { content: memo } }] }
    }

    const createRes = await fetch(`${NOTION_API}/pages`, {
      method:  'POST',
      headers: notionHeaders(notionKey),
      body:    JSON.stringify({
        // ✅ 企業専用タスクDBにページを作成
        parent:     { database_id: dbConfig.projectTaskDbId },
        properties,
      }),
    })

    if (!createRes.ok) throw new Error('タスク作成エラー')
    const created = await createRes.json() as { id: string }

    return NextResponse.json({ taskId: created.id, taskName })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── PATCH: タスクステータス更新 ─────────────────────

export async function PATCH(request: Request, context: RouteContext) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  void (await context.params).id

  try {
    const body = await request.json() as {
      taskId: string
      status: string   // 未着手/進行中/完了
    }

    const { taskId, status } = body
    if (!taskId || !status) {
      return NextResponse.json({ error: 'taskId・status は必須です' }, { status: 400 })
    }

    // 許可されたステータス値のみ受け付ける
    const allowedStatuses = ['未着手', '進行中', '完了']
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status は ${allowedStatuses.join('/')} のいずれかを指定してください` },
        { status: 400 },
      )
    }

    const patchRes = await fetch(`${NOTION_API}/pages/${taskId}`, {
      method:  'PATCH',
      headers: notionHeaders(notionKey),
      body:    JSON.stringify({
        properties: {
          'ステータス': { select: { name: status } },
        },
      }),
    })

    if (!patchRes.ok) throw new Error('タスクステータス更新エラー')

    return NextResponse.json({ success: true, taskId, status })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
