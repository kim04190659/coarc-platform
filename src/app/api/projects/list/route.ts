// =====================================================
//  src/app/api/projects/list/route.ts
//  プロジェクト一覧 + タスク一覧取得API
//
//  ■ GET ?companyId=xxx
//    → 企業別プロジェクト一覧（ステータス・担当者・タスク件数付き）
//
//  ■ GET ?companyId=xxx&projectName=xxx
//    → 特定プロジェクトのタスク一覧
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type Project = {
  id:           string
  projectName:  string
  status:       string   // 計画中/進行中/完了/中止
  priority:     string   // 高/中/低
  assignee:     string   // 担当者名
  description:  string   // 依頼内容
  startDate:    string
  dueDate:      string
  progressNote: string   // 進捗メモ
  taskCount:    number   // タスク総数（後で合算）
  doneCount:    number   // 完了タスク数
}

export type ProjectTask = {
  id:          string
  taskName:    string
  projectName: string
  assignee:    string
  status:      string   // 未着手/進行中/完了
  priority:    string   // 高/中/低
  dueDate:     string
  deliverable: string   // 成果物
  memo:        string
}

// ── Notion API ヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

type NotionPage = { id: string; properties: Record<string, unknown> }
type PropMap = Record<string, {
  title?:     Array<{ plain_text?: string }>
  select?:    { name?: string }
  rich_text?: Array<{ plain_text?: string }>
  date?:      { start?: string }
}>

const getText = (props: PropMap, key: string) =>
  props[key]?.title?.[0]?.plain_text ?? props[key]?.rich_text?.[0]?.plain_text ?? ''

// ── GET ─────────────────────────────────────────────

export async function GET(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const companyId   = searchParams.get('companyId')   ?? ''
  const projectName = searchParams.get('projectName') ?? ''

  if (!companyId) {
    return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
  }

  // ✅ 企業別DB方式: companyId から企業専用 DB ID を取得
  const dbConfig = getCompanyDbConfig(companyId)

  try {
    // ── タスク一覧モード ─────────────────────────────
    if (projectName) {
      // ✅ 企業専用DBにクエリ（企業名フィルタなし・プロジェクト名のみでフィルタ）
      const taskRes = await fetch(`${NOTION_API}/databases/${dbConfig.projectTaskDbId}/query`, {
        method:  'POST',
        headers: notionHeaders(notionKey),
        body:    JSON.stringify({
          filter: {
            property: 'プロジェクト名',
            rich_text: { contains: projectName },
          },
          sorts: [{ property: '期限', direction: 'ascending' }],
          page_size: 50,
        }),
      })

      if (!taskRes.ok) throw new Error('タスク一覧の取得に失敗しました')
      const taskData = await taskRes.json() as { results: NotionPage[] }

      const tasks: ProjectTask[] = taskData.results.map(p => {
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
    }

    // ── プロジェクト一覧モード ───────────────────────
    // ✅ 企業専用DBにクエリ（企業名フィルタなし）
    const [projectRes, taskRes] = await Promise.all([
      fetch(`${NOTION_API}/databases/${dbConfig.projectManagementDbId}/query`, {
        method:  'POST',
        headers: notionHeaders(notionKey),
        body:    JSON.stringify({
          sorts: [{ property: '完了予定日', direction: 'ascending' }],
          page_size: 50,
        }),
      }),
      fetch(`${NOTION_API}/databases/${dbConfig.projectTaskDbId}/query`, {
        method:  'POST',
        headers: notionHeaders(notionKey),
        body:    JSON.stringify({ page_size: 100 }),
      }),
    ])

    if (!projectRes.ok) throw new Error('プロジェクト一覧の取得に失敗しました')
    const projectData = await projectRes.json() as { results: NotionPage[] }

    // タスク件数をプロジェクト名で集計
    const taskCountMap = new Map<string, { total: number; done: number }>()
    if (taskRes.ok) {
      const taskData = await taskRes.json() as { results: NotionPage[] }
      for (const t of taskData.results) {
        const props  = t.properties as PropMap
        const name   = getText(props, 'プロジェクト名')
        const status = props['ステータス']?.select?.name ?? ''
        if (!name) continue
        const cur = taskCountMap.get(name) ?? { total: 0, done: 0 }
        cur.total++
        if (status === '完了') cur.done++
        taskCountMap.set(name, cur)
      }
    }

    const projects: Project[] = projectData.results.map(p => {
      const props = p.properties as PropMap
      const name  = getText(props, 'プロジェクト名')
      const counts = taskCountMap.get(name) ?? { total: 0, done: 0 }
      return {
        id:           p.id,
        projectName:  name,
        status:       props['ステータス']?.select?.name  ?? '',
        priority:     props['優先度']?.select?.name      ?? '',
        assignee:     getText(props, '担当者'),
        description:  getText(props, '依頼内容'),
        startDate:    props['開始日']?.date?.start       ?? '',
        dueDate:      props['完了予定日']?.date?.start   ?? '',
        progressNote: getText(props, '進捗メモ'),
        taskCount:    counts.total,
        doneCount:    counts.done,
      }
    })

    return NextResponse.json({ projects })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[projects/list] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
