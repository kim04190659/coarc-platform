'use client'

// =====================================================
//  src/app/(dashboard)/operations/projects/[id]/page.tsx
//  プロジェクト詳細ページ（Sprint 13 対応）
//
//  ■ 機能概要
//    - プロジェクト情報パネル（依頼内容・担当者・期日・優先度）
//    - タスク一覧（優先度バッジ・期限・成果物・ステータス変更）
//    - 進捗バー（タスク完了率）
//    - 進捗メモ編集 → Notion 即時保存
//    - ステータス変更 → Notion 即時反映
//    - 「AIで計画を生成」→ Haiku がタスク一括生成 → Notion 保存（Sprint 13）
//    - AI 進捗アドバイスパネル（Sprint 13）
// =====================================================

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useCompany } from '@/contexts/CompanyContext'
import type { Project, ProjectTask } from '@/app/api/projects/list/route'
import {
  ArrowLeft, FolderOpen, User, Calendar, AlertCircle,
  CheckCircle2, Circle, Clock, Loader2, Save,
  ChevronDown, Sparkles, FileText, Package,
  AlertTriangle, Lightbulb, RefreshCw, Shield,
} from 'lucide-react'

// ── AI 進捗アドバイスの型 ───────────────────────────
type AiAdvice = {
  riskLevel:   'high' | 'medium' | 'low'
  summary:     string
  nextActions: string[]
  warnings:    string[]
}

// ── 優先度バッジ ─────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    '高': 'bg-red-100 text-red-700 border border-red-200',
    '中': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    '低': 'bg-gray-100 text-gray-500 border border-gray-200',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[priority] ?? styles['低']}`}>
      {priority}
    </span>
  )
}

// ── タスク進捗バー ───────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100)
  const color = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>タスク進捗</span>
        <span className="font-medium">{done}/{total} 完了（{pct}%）</span>
      </div>
      <div className="bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── タスクステータスアイコン ─────────────────────────

function TaskStatusIcon({ status }: { status: string }) {
  if (status === '完了')   return <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
  if (status === '進行中') return <Clock        size={18} className="text-blue-500 flex-shrink-0" />
  return                          <Circle       size={18} className="text-gray-300 flex-shrink-0" />
}

// ── タスク行 ─────────────────────────────────────────

function TaskRow({
  task,
  projectId,
  onStatusChange,
}: {
  task: ProjectTask
  projectId: string
  onStatusChange: (taskId: string, newStatus: string) => void
}) {
  const [updating, setUpdating] = useState(false)

  const cycleStatus = async () => {
    const next: Record<string, string> = {
      '未着手': '進行中',
      '進行中': '完了',
      '完了':   '未着手',
    }
    const newStatus = next[task.status] ?? '未着手'
    setUpdating(true)
    try {
      await fetch(`/api/projects/${projectId}/tasks`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ taskId: task.id, status: newStatus }),
      })
      onStatusChange(task.id, newStatus)
    } finally {
      setUpdating(false)
    }
  }

  const isOverdue = task.dueDate && task.status !== '完了'
    ? new Date(task.dueDate) < new Date()
    : false

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
      task.status === '完了' ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200 hover:border-indigo-200'
    }`}>
      {/* ステータスアイコン */}
      <button
        onClick={cycleStatus}
        disabled={updating}
        title="クリックでステータスを変更"
        className="mt-0.5 hover:opacity-70 transition-opacity flex-shrink-0"
      >
        {updating
          ? <Loader2 size={18} className="text-gray-400 animate-spin" />
          : <TaskStatusIcon status={task.status} />
        }
      </button>

      {/* タスク本体 */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === '完了' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.taskName}
        </p>

        <div className="flex flex-wrap gap-3 mt-1.5">
          {task.assignee && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <User size={11} />{task.assignee}
            </span>
          )}
          {task.dueDate && (
            <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
              <Calendar size={11} />
              {task.dueDate}{isOverdue ? '（期限超過）' : ''}
            </span>
          )}
        </div>

        {/* 成果物 */}
        {task.deliverable && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Package size={12} className="text-indigo-400 flex-shrink-0" />
            <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              {task.deliverable}
            </span>
          </div>
        )}

        {/* メモ */}
        {task.memo && (
          <p className="mt-1.5 text-xs text-gray-400 italic">{task.memo}</p>
        )}
      </div>

      {/* 右端：優先度 */}
      <PriorityBadge priority={task.priority} />
    </div>
  )
}

// ── AI 進捗アドバイスパネル ──────────────────────────

function AdvicePanel({
  advice,
  onRefresh,
  refreshing,
}: {
  advice: AiAdvice
  onRefresh: () => void
  refreshing: boolean
}) {
  // リスクレベルの色設定
  const riskConfig = {
    high:   { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',   badge: 'bg-red-100 text-red-700',   label: '⚠️ 高リスク',   icon: AlertTriangle },
    medium: { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', label: '⚡ 要注意',    icon: AlertCircle   },
    low:    { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700', label: '✅ 順調',       icon: Shield        },
  }
  const cfg = riskConfig[advice.riskLevel] ?? riskConfig.medium
  const Icon = cfg.icon

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-4 space-y-3`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className={cfg.text} />
          <span className={`text-sm font-bold ${cfg.text}`}>AI 進捗アドバイス</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="アドバイスを更新"
          className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* サマリー */}
      <p className={`text-sm ${cfg.text}`}>{advice.summary}</p>

      {/* 次のアクション */}
      {advice.nextActions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1.5">
            <Lightbulb size={12} />今すぐやること
          </p>
          <ul className="space-y-1">
            {advice.nextActions.map((action, i) => (
              <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white border border-current flex items-center justify-center text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 警告 */}
      {advice.warnings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1.5">
            <AlertTriangle size={12} />リスク・注意
          </p>
          <ul className="space-y-1">
            {advice.warnings.map((w, i) => (
              <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                <span className="flex-shrink-0">•</span>{w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── メインページ ─────────────────────────────────────

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { companyId } = useCompany()

  const [project,      setProject]      = useState<Project | null>(null)
  const [tasks,        setTasks]        = useState<ProjectTask[]>([])
  const [loading,      setLoading]      = useState(true)
  const [noteEdit,     setNoteEdit]     = useState(false)
  const [noteText,     setNoteText]     = useState('')
  const [noteSaving,   setNoteSaving]   = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [showDesc,     setShowDesc]     = useState(false)

  // ── Sprint 13: AI 計画生成 ──────────────────────────
  const [planGenerating, setPlanGenerating] = useState(false)
  const [planMessage,    setPlanMessage]    = useState('')

  // ── Sprint 13: AI 進捗アドバイス ────────────────────
  const [advice,          setAdvice]          = useState<AiAdvice | null>(null)
  const [adviceLoading,   setAdviceLoading]   = useState(false)
  const [adviceError,     setAdviceError]     = useState('')

  // ── データ取得 ──────────────────────────────────────
  const fetchProject = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${id}?companyId=${companyId}`)
      if (!res.ok) throw new Error('取得失敗')
      const data = await res.json() as { project: Project; tasks: ProjectTask[] }
      setProject(data.project)
      setTasks(data.tasks)
      setNoteText(data.project.progressNote)
    } finally {
      setLoading(false)
    }
  }, [id, companyId])

  useEffect(() => { fetchProject() }, [fetchProject])

  // ── タスクステータス変更 ─────────────────────────────
  const handleTaskStatusChange = (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    setProject(prev => {
      if (!prev) return prev
      const done = tasks.filter(t =>
        t.id === taskId ? newStatus === '完了' : t.status === '完了'
      ).length
      return { ...prev, doneCount: done }
    })
  }

  // ── 進捗メモ保存 ─────────────────────────────────────
  const saveNote = async () => {
    setNoteSaving(true)
    try {
      await fetch(`/api/projects/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ progressNote: noteText }),
      })
      setProject(prev => prev ? { ...prev, progressNote: noteText } : prev)
      setNoteEdit(false)
    } finally {
      setNoteSaving(false)
    }
  }

  // ── ステータス変更 ───────────────────────────────────
  const changeStatus = async (newStatus: string) => {
    setStatusSaving(true)
    try {
      await fetch(`/api/projects/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      })
      setProject(prev => prev ? { ...prev, status: newStatus } : prev)
    } finally {
      setStatusSaving(false)
    }
  }

  // ── Sprint 13: AI 計画生成 ──────────────────────────
  const generatePlan = async () => {
    if (!project) return
    if (!window.confirm('AIにタスク計画を自動生成させますか？\n現在のタスクに追加する形で生成されます。')) return

    setPlanGenerating(true)
    setPlanMessage('')
    try {
      const res = await fetch('/api/projects/plan-ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          projectId:   id,
          projectName: project.projectName,
          description: project.description,
          assignee:    project.assignee,
          startDate:   project.startDate,
          dueDate:     project.dueDate,
          companyId,
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'AI計画生成に失敗しました')
      }
      const data = await res.json() as { count: number }
      setPlanMessage(`✅ ${data.count}件のタスクをAIが生成しました！`)
      // タスク一覧を再取得
      await fetchProject()
    } catch (e) {
      setPlanMessage(`❌ ${e instanceof Error ? e.message : '生成に失敗しました。再試行してください。'}`)
    } finally {
      setPlanGenerating(false)
    }
  }

  // ── Sprint 13: AI 進捗アドバイス取得 ────────────────
  const fetchAdvice = useCallback(async () => {
    if (!project) return
    setAdviceLoading(true)
    setAdviceError('')
    try {
      const res = await fetch('/api/projects/progress-ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          projectName: project.projectName,
          description: project.description,
          status:      project.status,
          dueDate:     project.dueDate,
          tasks: tasks.map(t => ({
            taskName:  t.taskName,
            status:    t.status,
            priority:  t.priority,
            dueDate:   t.dueDate,
            assignee:  t.assignee,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'アドバイス取得失敗')
      }
      const data = await res.json() as AiAdvice
      setAdvice(data)
    } catch (e) {
      setAdviceError(e instanceof Error ? e.message : 'AI分析に失敗しました')
    } finally {
      setAdviceLoading(false)
    }
  }, [project, tasks])

  // タスクが1件以上あればページ読み込み時に自動で進捗アドバイスを取得
  useEffect(() => {
    if (tasks.length > 0 && !advice && !adviceLoading) {
      fetchAdvice()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length])

  // ── ローディング ─────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6 text-center text-gray-400">
        プロジェクトが見つかりません
      </div>
    )
  }

  const doneCount = tasks.filter(t => t.status === '完了').length
  const isOverdue = project.dueDate && project.status !== '完了'
    ? new Date(project.dueDate) < new Date()
    : false

  const statusOptions = ['計画中', '進行中', '完了', '中止']
  const statusColors: Record<string, string> = {
    '進行中': 'bg-blue-100 text-blue-700',
    '計画中': 'bg-gray-100 text-gray-600',
    '完了':   'bg-green-100 text-green-700',
    '中止':   'bg-red-100 text-red-500',
  }

  // ステータス別タスク分類
  const inProgressTasks = tasks.filter(t => t.status === '進行中')
  const pendingTasks    = tasks.filter(t => t.status === '未着手')
  const doneTasks       = tasks.filter(t => t.status === '完了')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* 戻るボタン */}
      <button
        onClick={() => router.push('/operations/projects')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft size={16} />プロジェクト一覧に戻る
      </button>

      {/* プロジェクトヘッダー */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <FolderOpen size={20} className="text-indigo-600 flex-shrink-0" />
              <h1 className="text-xl font-bold text-gray-900">{project.projectName}</h1>
            </div>

            {/* メタ情報 */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
              {project.assignee && (
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-gray-400" />
                  {project.assignee}
                </span>
              )}
              {project.startDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400" />
                  {project.startDate} 〜
                  <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                    {project.dueDate || '未定'}
                    {isOverdue && '（期限超過）'}
                  </span>
                </span>
              )}
              {isOverdue && (
                <span className="flex items-center gap-1 text-red-500 text-xs">
                  <AlertCircle size={13} />期限を過ぎています
                </span>
              )}
            </div>

            {/* 進捗バー */}
            <ProgressBar done={doneCount} total={tasks.length} />
          </div>

          {/* 右側：ステータス + 優先度 */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <PriorityBadge priority={project.priority} />

            {/* ステータスドロップダウン */}
            <div className="relative group">
              <button className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium ${statusColors[project.status] ?? 'bg-gray-100 text-gray-600'} ${statusSaving ? 'opacity-50' : ''}`}>
                {statusSaving ? <Loader2 size={11} className="animate-spin" /> : null}
                {project.status}
                <ChevronDown size={12} />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10 w-24">
                {statusOptions.map(s => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${s === project.status ? 'font-bold' : ''}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 依頼内容（折りたたみ） */}
        {project.description && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              onClick={() => setShowDesc(v => !v)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <FileText size={14} />
              依頼内容・背景
              <ChevronDown size={14} className={`transition-transform ${showDesc ? 'rotate-180' : ''}`} />
            </button>
            {showDesc && (
              <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                {project.description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── AI 計画生成パネル ─────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
              <Sparkles size={15} />AIでプロジェクト計画を自動生成
            </p>
            <p className="text-xs text-indigo-600 mt-0.5">
              依頼内容をもとにタスク・期限・成果物をAIが一括作成します
            </p>
          </div>
          <button
            onClick={generatePlan}
            disabled={planGenerating || !project.description}
            className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            title={!project.description ? '依頼内容が未記入です' : 'AIがタスクを自動生成します'}
          >
            {planGenerating
              ? <><Loader2 size={14} className="animate-spin" />生成中...</>
              : <><Sparkles size={14} />計画を生成</>
            }
          </button>
        </div>

        {/* 生成結果メッセージ */}
        {planMessage && (
          <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${planMessage.startsWith('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {planMessage}
          </p>
        )}
      </div>

      {/* ── AI 進捗アドバイスパネル ───────────────────── */}
      {tasks.length > 0 && (
        <div>
          {adviceLoading && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              AIが進捗を分析中...
            </div>
          )}
          {!adviceLoading && adviceError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-red-600">{adviceError}</p>
              <button
                onClick={fetchAdvice}
                className="text-xs text-red-600 hover:underline flex items-center gap-1"
              >
                <RefreshCw size={12} />再試行
              </button>
            </div>
          )}
          {!adviceLoading && advice && (
            <AdvicePanel advice={advice} onRefresh={fetchAdvice} refreshing={adviceLoading} />
          )}
        </div>
      )}

      {/* ── タスク一覧 ──────────────────────────────── */}
      <div className="space-y-4">

        {/* 進行中タスク */}
        {inProgressTasks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg inline-flex items-center gap-1.5 mb-3">
              <Clock size={13} />進行中 ({inProgressTasks.length})
            </h2>
            <div className="space-y-2">
              {inProgressTasks.map(task => (
                <TaskRow key={task.id} task={task} projectId={id} onStatusChange={handleTaskStatusChange} />
              ))}
            </div>
          </section>
        )}

        {/* 未着手タスク */}
        {pendingTasks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1 rounded-lg inline-flex items-center gap-1.5 mb-3">
              <Circle size={13} />未着手 ({pendingTasks.length})
            </h2>
            <div className="space-y-2">
              {pendingTasks.map(task => (
                <TaskRow key={task.id} task={task} projectId={id} onStatusChange={handleTaskStatusChange} />
              ))}
            </div>
          </section>
        )}

        {/* 完了タスク */}
        {doneTasks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-lg inline-flex items-center gap-1.5 mb-3">
              <CheckCircle2 size={13} />完了 ({doneTasks.length})
            </h2>
            <div className="space-y-2 opacity-70">
              {doneTasks.map(task => (
                <TaskRow key={task.id} task={task} projectId={id} onStatusChange={handleTaskStatusChange} />
              ))}
            </div>
          </section>
        )}

        {/* タスクが0件のとき */}
        {tasks.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            <Sparkles size={40} className="mx-auto mb-3 opacity-20 text-indigo-400" />
            <p className="text-sm font-medium">タスクがまだありません</p>
            <p className="text-xs mt-1">上の「計画を生成」ボタンでAIがタスクを自動作成します</p>
          </div>
        )}
      </div>

      {/* ── 進捗メモ ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <FileText size={15} className="text-gray-400" />進捗メモ
          </h2>
          {!noteEdit ? (
            <button
              onClick={() => setNoteEdit(true)}
              className="text-xs text-indigo-600 hover:underline"
            >
              編集
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setNoteEdit(false); setNoteText(project.progressNote) }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={saveNote}
                disabled={noteSaving}
                className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
              >
                {noteSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                保存
              </button>
            </div>
          )}
        </div>

        {noteEdit ? (
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={5}
            placeholder="進捗の状況・懸念事項・次のアクションを記録してください"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none resize-none"
          />
        ) : (
          <p className={`text-sm whitespace-pre-wrap ${project.progressNote ? 'text-gray-700' : 'text-gray-300 italic'}`}>
            {project.progressNote || 'まだメモがありません。「編集」から追記できます。'}
          </p>
        )}
      </div>
    </div>
  )
}
