// =====================================================
//  src/app/api/projects/progress-ai/route.ts
//  AI 進捗アドバイス API
//
//  ■ POST /api/projects/progress-ai
//    body: {
//      projectName: string
//      description: string
//      status:      string
//      dueDate?:    string
//      tasks: Array<{
//        taskName:  string
//        status:    string
//        priority:  string
//        dueDate:   string
//        assignee:  string
//      }>
//    }
//
//  ■ 返却値
//    {
//      riskLevel:    'high' | 'medium' | 'low'
//      summary:      string    — 現状の2文以内の評価
//      nextActions:  string[]  — 今すぐやるべきこと最大3件
//      warnings:     string[]  — リスク・注意事項最大2件
//    }
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ── リクエストボディの型 ─────────────────────────────
type TaskSummary = {
  taskName:  string
  status:    string
  priority:  string
  dueDate:   string
  assignee:  string
}

type ProgressRequest = {
  projectName: string
  description: string
  status:      string
  dueDate?:    string
  tasks:       TaskSummary[]
}

// ── Haiku が返すアドバイスの型 ──────────────────────
type AiAdvice = {
  riskLevel:   'high' | 'medium' | 'low'
  summary:     string
  nextActions: string[]
  warnings:    string[]
}

export async function POST(request: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return NextResponse.json({ error: 'Anthropic APIキーが未設定です' }, { status: 500 })

  try {
    const body = await request.json() as ProgressRequest
    const { projectName, description, status, dueDate, tasks } = body

    if (!projectName || !tasks) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 })
    }

    // ── タスクの状況をテキスト化 ──────────────────────
    const today = new Date().toISOString().split('T')[0]
    const totalTasks = tasks.length
    const doneTasks  = tasks.filter(t => t.status === '完了').length
    const inProgress = tasks.filter(t => t.status === '進行中').length
    const overdue    = tasks.filter(t =>
      t.dueDate && t.dueDate < today && t.status !== '完了'
    ).length

    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

    // 期限超過のリスク判定
    const isDueDatePassed = dueDate && dueDate < today && status !== '完了'

    // 上位12件に絞ってHaikuに渡す（トークン節約）
    const topTasks = [...tasks]
      .sort((a, b) => {
        // 未着手・高優先度を優先
        const statusOrder: Record<string, number> = { '進行中': 0, '未着手': 1, '完了': 2 }
        return (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1)
      })
      .slice(0, 12)

    const taskList = topTasks.map(t =>
      `- [${t.status}] ${t.taskName}（担当:${t.assignee}、優先度:${t.priority}、期限:${t.dueDate || '未設定'}）`
    ).join('\n')

    // 【出力形式】単一行JSON（コードブロック禁止）
    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      '{"riskLevel":"high|medium|low","summary":"現状評価2文以内","nextActions":["今すぐやること1","今すぐやること2","今すぐやること3"],"warnings":["リスク1","リスク2"]}',
      '※ nextActionsは最大3件、warningsは最大2件。JSONのみ出力。コードブロック・説明文・マークダウン不要。',
    ].join('\n')

    const prompt = `あなたはプロジェクト管理の専門家AIです。
以下のプロジェクト状況を分析し、進捗アドバイスを提供してください。

【プロジェクト名】${projectName}
【依頼内容】${description}
【現在のステータス】${status}
【完了予定日】${dueDate || '未設定'}
【本日】${today}${isDueDatePassed ? '（⚠️ 期限超過中）' : ''}

【タスク進捗】
- 総タスク数: ${totalTasks}件
- 完了: ${doneTasks}件（${completionRate}%）
- 進行中: ${inProgress}件
- 期限超過タスク: ${overdue}件

【タスク一覧】
${taskList}

riskLevel の判定基準：
- high: 期限超過・完了率50%未満・高優先タスクが滞留
- medium: 完了率50〜80%・軽微な遅延リスク
- low: 完了率80%以上・順調

${outputFormat}`

    const client = new Anthropic({ apiKey: anthropicKey })

    const res = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    })

    // stop_reason チェック
    if (res.stop_reason === 'max_tokens') {
      console.warn('[progress-ai] max_tokens に達したため出力が途中で切れている可能性があります')
    }

    // ── JSON クリーニング → パース ────────────────────
    const rawText = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const cleanText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .replace(/^[^{]*({[\s\S]*})[^}]*$/, '$1')
      .trim()

    let advice: AiAdvice
    try {
      advice = JSON.parse(cleanText) as AiAdvice
    } catch {
      console.error('[progress-ai] JSONパースエラー:', cleanText.slice(0, 200))
      return NextResponse.json({ error: 'AI分析の解析に失敗しました。再試行してください。' }, { status: 500 })
    }

    return NextResponse.json(advice)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[progress-ai] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
