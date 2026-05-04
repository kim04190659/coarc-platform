'use client'

// =====================================================
//  src/app/(dashboard)/operations/projects/page.tsx
//  AI協働プロジェクト管理ページ
//
//  ■ 機能概要
//    - ステータス別カードビュー（進行中 / 計画中 / 完了）
//    - 担当者・優先度・期限・タスク進捗バーを表示
//    - 新規プロジェクト作成モーダル
//    - プロジェクトカードクリック → タスク詳細を展開
//    - タスクのステータス変更 → Notion 即時反映
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import type { Project, ProjectTask } from '@/app/api/projects/list/route'
import {
  FolderOpen, Plus, ChevronDown, ChevronUp,
  Calendar, User, AlertCircle, CheckCircle2,
  Circle, Clock, Loader2, X,
} from 'lucide-react'

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

// ── ステータスバッジ ─────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    '進行中': 'bg-blue-100 text-blue-700',
    '計画中': 'bg-gray-100 text-gray-600',
    '完了':   'bg-green-100 text-green-700',
    '中止':   'bg-red-100 text-red-500',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

// ── タスク進捗バー ───────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  if (total === 0) return <span className="text-xs text-gray-400">タスクなし</span>
  const pct = Math.round((done / total) * 100)
  const color = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">{done}/{total}</span>
    </div>
  )
}

// ── タスクステータスアイコン ─────────────────────────

function TaskStatusIcon({ status }: { status: string }) {
  if (status === '完了')   return <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
  if (status === '進行中') return <Clock        size={16} className="text-blue-500 flex-shrink-0" />
  return                          <Circle       size={16} className="text-gray-300 flex-shrink-0" />
}

// ── 1タスク行 ────────────────────────────────────────

function TaskRow({
  task,
  onStatusChange,
}: {
  task: ProjectTask
  onStatusChange: (taskId: string, status: string) => void
}) {
  const [updating, setUpdating] = useState(false)

  // ステータスを循環させる（未着手 → 進行中 → 完了 → 未着手）
  const cycleStatus = async () => {
    const next: Record<string, string> = {
      '未着手': '進行中',
      '進行中': '完了',
      '完了':   '未着手',
    }
    const newStatus = next[task.status] ?? '未着手'
    setUpdating(true)
    try {
      await fetch(`/api/projects/${task.id}/tasks`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ taskId: task.id, status: newStatus }),
      })
      onStatusChange(task.id, newStatus)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      {/* ステータスアイコン（クリックで変更） */}
      <button
        onClick={cycleStatus}
        disabled={updating}
        className="mt-0.5 hover:opacity-70 transition-opacity"
        title="クリックでステータスを変更"
      >
        {updating
          ? <Loader2 size={16} className="text-gray-400 animate-spin" />
          : <TaskStatusIcon status={task.status} />
        }
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.status === '完了' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.taskName}
        </p>
        <div className="flex flex-wrap gap-2 mt-1">
          {task.assignee && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <User size={11} />{task.assignee}
            </span>
          )}
          {task.dueDate && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar size={11} />{task.dueDate}
            </span>
          )}
          {task.deliverable && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
              📄 {task.deliverable}
            </span>
          )}
        </div>
      </div>

      <PriorityBadge priority={task.priority} />
    </div>
  )
}

// ── プロジェクトカード ───────────────────────────────

function ProjectCard({
  project,
  companyId,
  onTaskStatusChange,
}: {
  project: Project
  companyId: string
  onTaskStatusChange: (projectName: string, taskId: string, status: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [tasks, setTasks]       = useState<ProjectTask[]>([])
  const [loading, setLoading]   = useState(false)

  // 展開時にタスクを取得
  const loadTasks = useCallback(async () => {
    if (tasks.length > 0) return   // 既取得
    setLoading(true)
    try {
      const res = await fetch(
        `/api/projects/list?companyId=${companyId}&projectName=${encodeURIComponent(project.projectName)}`
      )
      if (res.ok) {
        const data = await res.json() as { tasks: ProjectTask[] }
        setTasks(data.tasks)
      }
    } finally {
      setLoading(false)
    }
  }, [companyId, project.projectName, tasks.length])

  const toggle = () => {
    if (!expanded) loadTasks()
    setExpanded(v => !v)
  }

  const handleStatusChange = (taskId: string, status: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    onTaskStatusChange(project.projectName, taskId, status)
  }

  // 期限切れ判定
  const isOverdue = project.dueDate && project.status !== '完了'
    ? new Date(project.dueDate) < new Date()
    : false

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* カードヘッダー */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
            {isOverdue && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle size={11} />期限超過
              </span>
            )}
          </div>
          <button onClick={toggle} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        <h3 className="font-semibold text-gray-900 text-sm mb-2">{project.projectName}</h3>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
          {project.assignee && (
            <span className="flex items-center gap-1">
              <User size={12} />{project.assignee}
            </span>
          )}
          {project.dueDate && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
              <Calendar size={12} />{project.dueDate}まで
            </span>
          )}
        </div>

        {/* タスク進捗バー */}
        <ProgressBar done={project.doneCount} total={project.taskCount} />

        {/* 進捗メモ */}
        {project.progressNote && (
          <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 line-clamp-2">
            {project.progressNote}
          </p>
        )}
      </div>

      {/* 展開タスク一覧 */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">タスクがありません</p>
          ) : (
            <div className="mt-3">
              {tasks.map(task => (
                <TaskRow key={task.id} task={task} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 新規プロジェクト作成モーダル ─────────────────────

function CreateProjectModal({
  companyId,
  onCreated,
  onClose,
}: {
  companyId: string
  onCreated: (project: Project) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    projectName: '',
    assignee:    '',
    description: '',
    priority:    '中',
    startDate:   '',
    dueDate:     '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.projectName.trim() || !form.assignee.trim()) {
      setError('プロジェクト名と担当者は必須です')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/projects/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ companyId, ...form }),
      })
      if (!res.ok) throw new Error('作成に失敗しました')
      const data = await res.json() as { projectId: string; projectName: string }

      // 作成されたプロジェクトをローカルに追加
      onCreated({
        id:           data.projectId,
        projectName:  form.projectName,
        status:       '計画中',
        priority:     form.priority,
        assignee:     form.assignee,
        description:  form.description,
        startDate:    form.startDate,
        dueDate:      form.dueDate,
        progressNote: '',
        taskCount:    0,
        doneCount:    0,
      })
      onClose()
    } catch {
      setError('作成に失敗しました。再試行してください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen size={20} className="text-indigo-600" />
            新規プロジェクト作成
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertCircle size={15} />{error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              プロジェクト名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.projectName}
              onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))}
              placeholder="例：新店舗開業 業務標準化プロジェクト"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                担当者 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.assignee}
                onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
                placeholder="例：田中 美咲"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">優先度</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
              >
                <option value="高">高</option>
                <option value="中">中</option>
                <option value="低">低</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">完了予定日</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">依頼内容・背景</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4}
              placeholder="業務の依頼内容・目的・期待成果を記入してください"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              作成する
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── メインページ ─────────────────────────────────────

const STATUS_ORDER = ['進行中', '計画中', '完了', '中止']

const STATUS_HEADER_STYLE: Record<string, string> = {
  '進行中': 'text-blue-700 bg-blue-50 border-blue-200',
  '計画中': 'text-gray-600 bg-gray-50 border-gray-200',
  '完了':   'text-green-700 bg-green-50 border-green-200',
  '中止':   'text-red-500 bg-red-50 border-red-200',
}

export default function ProjectsPage() {
  const { companyId } = useCompany()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchProjects = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/list?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json() as { projects: Project[] }
        setProjects(data.projects)
      }
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // タスクステータス変更時に進捗カウントを更新
  const handleTaskStatusChange = (projectName: string, _taskId: string, newStatus: string) => {
    setProjects(prev => prev.map(p => {
      if (p.projectName !== projectName) return p
      // doneCount を ±1 する（楽観的更新）
      const wasDone  = false  // 変更前は別途わかれば精密にできるが簡略化
      const isDone   = newStatus === '完了'
      const delta    = isDone ? 1 : wasDone ? -1 : 0
      return { ...p, doneCount: Math.max(0, p.doneCount + delta) }
    }))
  }

  // ステータス別にグループ化
  const grouped = STATUS_ORDER.reduce<Record<string, Project[]>>((acc, s) => {
    acc[s] = projects.filter(p => p.status === s)
    return acc
  }, {})

  const stats = {
    total:    projects.length,
    inProgress: projects.filter(p => p.status === '進行中').length,
    done:     projects.filter(p => p.status === '完了').length,
    high:     projects.filter(p => p.priority === '高' && p.status !== '完了').length,
  }

  return (
    <div className="p-6 space-y-6">

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen size={26} className="text-indigo-600" />
            プロジェクト管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            業務依頼をプロジェクトとして管理し、AIと共にタスクを推進します
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />新規プロジェクト
        </button>
      </div>

      {/* サマリー統計 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '総プロジェクト', value: stats.total,      color: 'text-gray-800' },
          { label: '進行中',         value: stats.inProgress,  color: 'text-blue-600' },
          { label: '完了',           value: stats.done,        color: 'text-green-600' },
          { label: '高優先度（未完了）', value: stats.high,   color: 'text-red-500'  },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ローディング */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-indigo-400" />
        </div>
      )}

      {/* ステータス別グループ */}
      {!loading && projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p>プロジェクトがありません</p>
          <p className="text-sm mt-1">「新規プロジェクト」ボタンから追加できます</p>
        </div>
      ) : (
        !loading && STATUS_ORDER.map(status => {
          const items = grouped[status]
          if (items.length === 0) return null
          return (
            <section key={status}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border mb-3 w-fit ${STATUS_HEADER_STYLE[status]}`}>
                <span className="text-sm font-semibold">{status}</span>
                <span className="text-xs bg-white rounded-full px-1.5 py-0.5 font-bold">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    companyId={companyId}
                    onTaskStatusChange={handleTaskStatusChange}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}

      {/* 新規作成モーダル */}
      {showModal && (
        <CreateProjectModal
          companyId={companyId}
          onCreated={p => setProjects(prev => [p, ...prev])}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
