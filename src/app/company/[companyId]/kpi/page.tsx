'use client'

// =====================================================
//  src/app/(dashboard)/management/kpi/page.tsx
//  KPI目標管理 — 企業別KPI目標値を表示・編集する
//
//  ■ 機能
//    - KPI目標DBから企業別目標を取得して表示
//    - KPI種別バッジ（顧客満足度/売上/社員満足度/業務効率/その他）
//    - 目標値をインライン編集してNotionに即時保存
//    - 「新規KPI追加」ボタンでNotionに直接追加
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getCompanyById } from '@/config/companies'
import {
  Target, RefreshCw, Edit3, Save, X, Plus, Loader2,
} from 'lucide-react'
import type { KpiGoal } from '@/app/api/kpi/goals/route'

// ── KPI種別カラー定義（実際のNotionスキーマに合わせた選択肢）──

const KPI_TYPE_STYLE: Record<string, string> = {
  '顧客満足度': 'bg-blue-100 text-blue-700',
  '売上':       'bg-green-100 text-green-700',
  '社員満足度': 'bg-purple-100 text-purple-700',
  '業務効率':   'bg-orange-100 text-orange-700',
  'その他':     'bg-gray-100 text-gray-700',
}

const KPI_TYPE_ICON: Record<string, string> = {
  '顧客満足度': '⭐',
  '売上':       '📈',
  '社員満足度': '💚',
  '業務効率':   '⚡',
  'その他':     '📌',
}

// ── KPIカード（目標値インライン編集付き）───────────────

function KpiGoalCard({
  goal,
  onSave,
}: {
  goal:   KpiGoal
  onSave: (pageId: string, newTarget: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(goal.target)
  const [saving, setSaving]   = useState(false)

  const typeStyle = KPI_TYPE_STYLE[goal.kpiType] ?? 'bg-gray-100 text-gray-700'
  const typeIcon  = KPI_TYPE_ICON[goal.kpiType]  ?? '📌'

  const handleSave = async () => {
    if (!editVal.trim()) return
    setSaving(true)
    try {
      await onSave(goal.pageId, editVal.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditVal(goal.target)  // 元の値に戻す
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">

      {/* ヘッダー行: KPI種別バッジ + 編集ボタン */}
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeStyle}`}>
          {typeIcon} {goal.kpiType || 'その他'}
        </span>

        {!editing ? (
          <button
            onClick={() => { setEditVal(goal.target); setEditing(true) }}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="目標値を編集"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg text-green-700 transition-colors"
              title="保存"
            >
              {saving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Save className="w-3.5 h-3.5" />
              }
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
              title="キャンセル"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* KPI名 */}
      <h3 className="text-base font-semibold text-gray-800 mb-3 leading-tight">
        {goal.kpiName}
      </h3>

      {/* 目標値 */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">目標値</p>
          {editing ? (
            <input
              type="text"
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
              className="w-full border border-indigo-300 rounded-lg px-3 py-1.5 text-xl font-bold
                         text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
              placeholder="例: 90"
            />
          ) : (
            <p className="text-2xl font-bold text-gray-800">
              {goal.target || '—'}
              {goal.unit && (
                <span className="text-sm font-normal text-gray-500 ml-1">{goal.unit}</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* 期間バッジ */}
      {goal.period && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
            🗓️ {goal.period}
          </span>
        </div>
      )}
    </div>
  )
}

// ── 新規KPI追加モーダル ────────────────────────────────

function AddKpiModal({
  companyId,
  onClose,
  onAdded,
}: {
  companyId: string
  onClose:  () => void
  onAdded:  () => void
}) {
  const [form, setForm] = useState({
    kpiName: '',
    kpiType: '顧客満足度',
    target:  '',
    unit:    '',
    period:  '月次',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const handleAdd = async () => {
    if (!form.kpiName.trim() || !form.target.trim()) {
      setError('KPI名と目標値は必須です')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/kpi/goals/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, companyId }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? '追加に失敗しました')
      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-800">KPI目標を追加</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">KPI名 *</label>
            <input
              type="text"
              value={form.kpiName}
              onChange={e => setForm(p => ({ ...p, kpiName: e.target.value }))}
              placeholder="例: 顧客満足度スコア"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">KPI種別</label>
            <select
              value={form.kpiType}
              onChange={e => setForm(p => ({ ...p, kpiType: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {Object.keys(KPI_TYPE_STYLE).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 block mb-1">目標値 *</label>
              <input
                type="text"
                value={form.target}
                onChange={e => setForm(p => ({ ...p, target: e.target.value }))}
                placeholder="例: 90"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="w-24">
              <label className="text-xs font-semibold text-gray-600 block mb-1">単位</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                placeholder="%, pt"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">期間</label>
            <select
              value={form.period}
              onChange={e => setForm(p => ({ ...p, period: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {['月次', '四半期', '半期', '年次'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600">⚠️ {error}</p>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold
                       hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            追加
          </button>
        </div>
      </div>
    </div>
  )
}

// ── メインページ ──────────────────────────────────────

export default function KpiGoalsPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const company = getCompanyById(companyId)

  const [goals, setGoals]       = useState<KpiGoal[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [showAdd, setShowAdd]   = useState(false)

  // KPI目標を取得
  const fetchGoals = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/kpi/goals?companyId=${id}`)
      if (!res.ok) throw new Error(`取得エラー: HTTP ${res.status}`)
      const data = await res.json() as { goals: KpiGoal[] }
      setGoals(data.goals)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGoals(companyId)
  }, [companyId, fetchGoals])

  // 目標値保存（Notionに即時反映）
  const handleSaveGoal = async (pageId: string, newTarget: string) => {
    const res = await fetch('/api/kpi/goals', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pageId, targetValue: newTarget }),
    })
    if (!res.ok) throw new Error('保存に失敗しました')
    // ローカル state も即時更新
    setGoals(prev => prev.map(g =>
      g.pageId === pageId ? { ...g, target: newTarget } : g
    ))
  }

  // KPI種別ごとにグループ化
  const grouped = goals.reduce<Record<string, KpiGoal[]>>((acc, g) => {
    const key = g.kpiType || 'その他'
    ;(acc[key] ??= []).push(g)
    return acc
  }, {})

  const groupOrder = ['顧客満足度', '売上', '社員満足度', '業務効率', 'その他']

  return (
    <div className="max-w-4xl mx-auto">

      {/* ヘッダー */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-600" />
            KPI目標管理 — {company.name}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            KPI目標を設定・管理します。カード右上の鉛筆アイコンで目標値を編集できます。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchGoals(companyId)}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800
                       border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors
                       disabled:opacity-50 bg-white shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            更新
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700
                       rounded-lg px-3 py-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            KPI追加
          </button>
        </div>
      </div>

      {/* エラー */}
      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="flex justify-center items-center h-48 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">KPIデータを取得中...</span>
        </div>
      )}

      {/* KPIカード（種別グループ別） */}
      {!loading && goals.length > 0 && (
        <div className="space-y-6">
          {groupOrder
            .filter(type => grouped[type]?.length)
            .map(type => (
              <div key={type}>
                <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1">
                  {KPI_TYPE_ICON[type]} {type}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grouped[type].map(goal => (
                    <KpiGoalCard
                      key={goal.pageId}
                      goal={goal}
                      onSave={handleSaveGoal}
                    />
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* データなし */}
      {!loading && goals.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium mb-1">KPI目標が設定されていません</p>
          <p className="text-xs mb-4">「KPI追加」ボタンから目標を登録してください</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + 最初のKPIを追加する
          </button>
        </div>
      )}

      {/* 新規追加モーダル */}
      {showAdd && (
        <AddKpiModal
          companyId={companyId}
          onClose={() => setShowAdd(false)}
          onAdded={() => fetchGoals(companyId)}
        />
      )}
    </div>
  )
}
