// =====================================================
//  src/app/api/projects/plan-ai/route.ts
//  AI プロジェクト計画生成 API
//
//  ■ POST /api/projects/plan-ai
//    body: {
//      projectId:   string   — Notion プロジェクトページID
//      projectName: string
//      description: string   — 依頼内容
//      assignee:    string
//      startDate?:  string
//      dueDate?:    string
//      companyId:   string
//    }
//
//  ■ 処理フロー
//    1. Claude Haiku に依頼内容を渡してタスク一覧を生成
//    2. 生成されたタスクを Notion projectTask DB に一括保存
//    3. 保存済みタスク一覧を返す
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ProjectTask } from '@/app/api/projects/list/route'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── リクエストボディの型 ─────────────────────────────
type PlanRequest = {
  projectId:   string
  projectName: string
  description: string
  assignee:    string
  startDate?:  string
  dueDate?:    string
  companyId:   string
}

// ── Haiku が返すタスク1件の型 ───────────────────────
type AiTask = {
  taskName:    string
  assignee:    string
  priority:    string
  dueDate:     string
  deliverable: string
  memo:        string
}

export async function POST(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!notionKey)    return NextResponse.json({ error: 'Notion APIキーが未設定です' },    { status: 500 })
  if (!anthropicKey) return NextResponse.json({ error: 'Anthropic APIキーが未設定です' }, { status: 500 })

  try {
    const body = await request.json() as PlanRequest
    const { projectId, projectName, description, assignee, startDate, dueDate, companyId } = body

    if (!projectId || !projectName || !description) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 })
    }

    // ── 企業ショートネームを取得 ──────────────────────
    const { getCompanyById } = await import('@/config/companies')
    const company = getCompanyById(companyId)
    const { SHARED_NOTION_DBS } = await import('@/config/company-db-config')

    // ── Claude Haiku にタスク計画を生成させる ─────────
    const client = new Anthropic({ apiKey: anthropicKey })

    // 期間の計算（startDate〜dueDate があれば Haiku に伝える）
    const dateInfo = startDate && dueDate
      ? `プロジェクト期間: ${startDate} 〜 ${dueDate}`
      : dueDate
        ? `完了予定日: ${dueDate}`
        : '期限: 未定'

    // 【出力形式】単一行JSON（コードブロック禁止）
    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      '{"tasks":[{"taskName":"タスク名20文字以内","assignee":"担当者名","priority":"高|中|低","dueDate":"YYYY-MM-DD または 空文字","deliverable":"成果物20文字以内","memo":"補足1文以内"},{"taskName":"...","assignee":"...","priority":"...","dueDate":"...","deliverable":"...","memo":"..."}]}',
      '※ tasks は最大8件。JSONのみ出力。コードブロック・説明文・マークダウン・改行は一切不要。',
    ].join('\n')

    const prompt = `あなたはプロジェクト管理の専門家AIです。
以下の業務依頼を実行するための具体的なタスク計画を作成してください。

【プロジェクト名】${projectName}
【依頼内容】${description}
【主担当者】${assignee}
【${dateInfo}】

タスクの要件：
- 業務完了に必要な具体的なアクションを分解する（最大8件）
- 優先度は「高」「中」「低」のいずれかで設定する
- 成果物は各タスクで何が完成するかを明記する
- 担当者は「${assignee}」を基本とし、明らかに別担当が必要なタスクは「TBD」にする
- 期限は${dueDate ? `${dueDate}以前で` : ''}プロジェクト全体のスケジュールを逆算して設定する

${outputFormat}`

    const res = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    })

    // stop_reason チェック
    if (res.stop_reason === 'max_tokens') {
      console.warn('[plan-ai] max_tokens に達したため出力が途中で切れている可能性があります')
    }

    // ── JSON クリーニング → パース ────────────────────
    const rawText = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const cleanText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .replace(/^[^{]*({[\s\S]*})[^}]*$/, '$1')
      .trim()

    let aiTasks: AiTask[] = []
    try {
      const parsed = JSON.parse(cleanText) as { tasks?: AiTask[] }
      aiTasks = parsed.tasks ?? []
    } catch {
      console.error('[plan-ai] JSONパースエラー:', cleanText.slice(0, 200))
      return NextResponse.json({ error: 'AI計画の解析に失敗しました。再試行してください。' }, { status: 500 })
    }

    if (aiTasks.length === 0) {
      return NextResponse.json({ error: 'タスクが生成されませんでした。依頼内容をより詳しく入力してください。' }, { status: 400 })
    }

    // ── 生成されたタスクを Notion に一括保存 ──────────
    const savedTasks: ProjectTask[] = []

    for (const task of aiTasks) {
      // Notion ページのプロパティを組み立てる
      const properties: Record<string, unknown> = {
        'タスク名': {
          title: [{ text: { content: task.taskName } }],
        },
        'プロジェクト名': {
          rich_text: [{ text: { content: projectName } }],
        },
        '企業名': {
          select: { name: company.shortName },
        },
        '担当者': {
          rich_text: [{ text: { content: task.assignee } }],
        },
        'ステータス': {
          select: { name: '未着手' },
        },
        '優先度': {
          select: { name: task.priority },
        },
      }

      // 期限が設定されている場合のみ追加
      if (task.dueDate && task.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        properties['期限'] = { date: { start: task.dueDate } }
      }

      // 成果物が設定されている場合のみ追加
      if (task.deliverable) {
        properties['成果物'] = {
          rich_text: [{ text: { content: task.deliverable } }],
        }
      }

      // メモが設定されている場合のみ追加
      if (task.memo) {
        properties['メモ'] = {
          rich_text: [{ text: { content: task.memo } }],
        }
      }

      // Notion に1件ずつ保存
      const createRes = await fetch(`${NOTION_API}/pages`, {
        method:  'POST',
        headers: notionHeaders(notionKey),
        body:    JSON.stringify({
          parent:     { database_id: SHARED_NOTION_DBS.projectTask },
          properties,
        }),
      })

      if (createRes.ok) {
        const page = await createRes.json() as { id: string }
        savedTasks.push({
          id:          page.id,
          taskName:    task.taskName,
          projectName,
          assignee:    task.assignee,
          status:      '未着手',
          priority:    task.priority,
          dueDate:     task.dueDate,
          deliverable: task.deliverable,
          memo:        task.memo,
        })
      } else {
        console.error('[plan-ai] タスク保存エラー:', task.taskName)
      }
    }

    // プロジェクトの進捗メモに「AI計画生成済み」を記録
    await fetch(`${NOTION_API}/pages/${projectId}`, {
      method:  'PATCH',
      headers: notionHeaders(notionKey),
      body:    JSON.stringify({
        properties: {
          '進捗メモ': {
            rich_text: [{ text: { content: `AIにより${savedTasks.length}件のタスク計画を生成しました（${new Date().toLocaleDateString('ja-JP')}）` } }],
          },
        },
      }),
    })

    return NextResponse.json({ tasks: savedTasks, count: savedTasks.length })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[plan-ai] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
