'use client'

// =====================================================
//  src/app/(dashboard)/management/kpi/page.tsx
//  KPI目標管理 — 企業別KPI目標値を表示・編集し、実績と比較する
//
//  ■ 機能
//    - KPIダッシュボードから実績値を取得
//    - KPI目標DBから目標値を取得
//    - 実績 vs 目標を達成率バーで可視化
//    - 目標値をインライン編集してNotionに即時保存
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { getCompanyById } from '@/config/companies'
import {
  Target, RefreshCw, CheckCircle2, AlertTriangle,
  Edit3, Save, X,
} from 'lucide-react'
import type { KpiGoal } from '@/app/api/kpi/goals/route'

// ── KPI実績の型 ───────────────────────────────────────

type KpiActual = {
  resolutionRate: number  // 解決率 (%)
  unresponded:    number  // 未対応件数
  highPriority:   number  // 高優先度件数
  total:          number  // 総件数
}

// ── KPI種別ごとの実績を取り出す ──────────────────────

function getActualValue(kpiType: string, actual: KpiActual | null): number | null {
  if (!actual) return null
  switch (kpiType) {
    case '解決率':        return actual.resolutionRate
    case '未対応件数':    return actual.unresponded
    case '高優先度比率':
      return actual.total > 0
        ? Math.round((actual.highPriority / actual.total) * 100)
        : 0
    default:             return null  // フィードバックスコアは別DBのため対応外
  }
}

// ── 達成判定（目標クリアしているか）───────────────────

function isAchieved(kpiType: string, actualVal: number, targetVal: number): boolean {
  // 「未対応件数」「高優先度比率」は低い方が良い
  if (kpiType === '未対応件数' || kpiType === '高優先度比率') {
    return actualVal <= targetVal
  }
  return actualVal >= targetVal
}

// ── 達成率バー ────────────────────────────────────────

function AchievementBar({
  kpiType, actual, target, unit,
}: {
  kpiType: string
  actual: number
  target: number
  unit: string
}) {
  // 達成率を 0〜100% で算出（逆転KPIは反転）
  const isLowerBetter = kpiType === '未対応件数' || kpiType === '高優先度比率'
  const pct = isLowerBetter
    ? target > 0 ? Math.min(100, Math.round((target / Math.max(actual, 0.1)) * 100)) : 0
    : target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0

  const achieved = isAchieved(kpiType, actual, target)

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>達成率 {pct}%</span>
        <span className={achieved ? 'text-green-600 font-semibold' : 'text-orange-500'}>
          {achieved ? '✅ 達成' : '⚠️ 未達'}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${
            achieved ? 'bg-green-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-red-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── KPIカード（目標値インライン編集付き）───────────────

function KpiGoalCard({
  goal,
  actual,
  onSave,
}: {
  goal: KpiGoal
  actual: KpiActual | null
  onSave: (pageId: string, newTarget: number) => Promise<void>
}) {
  const [editing, setEditing]   = useState(false)
  const [editVal, setEditVal]   = useState(String(goal.target))
  const [saving, setSaving]     = useState(false)

  const actualVal = getActualValue(goal.kpiType, actual)

  // 保存ハンドラー
  const handleSave = async () => {
    const newVal = parseFloat(editVal)
    if (isNaN(newVal)) return
    setSaving(true)
    try {
      await onSave(goal.pageId, newVal)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  // KPI種別カラー
  const typeColor =
    goal.kpiType === '解決率'          ? 'text-green-600 bg-green-50' :
    goal.kpiType === '未対応件数'      ? 'text-red-600 bg-red-50' :
    goal.kpiType === '高優先度比率'    ? 'text-orange-600 bg-orange-50' :
    goal.kpiType === 'フィードバックスコア' ? 'text-blue-600 bg-blue-50' :
    'text-gray-600 bg-gray-50'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      {/* KPI種別バッジ */}
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
          {goal.kpiType}
        </span>
        {/* 編集ボタン */}
        {!editing ? (
          <button
            onClick={() => { setEditVal(String(goal.target)); setEditing(true) }}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg transition-colors text-green-700"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 目標値表示 / 編集 */}
      <div className="flex items-end gap-2 mb-1">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">目標値</p>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                className="w-20 border border-indigo-300 rounded-lg px-2 py-1 text-lg font-bold
                           text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoFocus
              />
              <span className="text-sm text-gray-500">{goal.unit}</span>
            </div>
          ) : (
            <p className="text-2xl font-bold text-gray-800">
              {goal.target}<span className="text-sm font-normal text-gray-500 ml-1">{goal.unit}</span>
            </p>
          )}
        </div>

        {/* 実績値 */}
        {actualVal !== null && (
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500 mb-0.5">実績</p>
            <p className={`text-xl font-bold ${
              isAchieved(goal.kpiType, actualVal, goal.target)
                ? 'text-green-600' : 'text-orange-500'
            }`}>
              {actualVal}<span className="text-sm font-normal ml-0.5">{goal.unit}</span>
            </p>
          </div>
        )}
      </div>

      {/* 達成率バー */}
      {actualVal !== null && (
        <AchievementBar
          kpiType={goal.kpiType}
          actual={actualVal}
          target={editing ? (parseFloat(editVal) || goal.target) : goal.target}
          unit={goal.unit}
        />
      )}

      {actualVal === null && (
        <p className="text-xs text-gray-400 mt-2">実績データは別DBから取得（近日対応予定）</p>
      )}

      {/* 期間バッジ */}
      <p className="text-xs text-gray-400 mt-3">{goal.period} 目標</p>
    </div>
  )
}

// ── メインページ ──────────────────────────────────────

export default function KpiGoalsPage() {
  const { companyId } = useCompany()
  const company = getCompanyById(companyId)

  const [goals, setGoals]     = useState<KpiGoal[]>([])
  const [actual, setActual]   = useState<KpiActual | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // KPI目標 + 実績を並列取得
  const fetchData = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const [goalsRes, actualRes] = await Promise.all([
        fetch(`/api/kpi/goals?companyId=${id}`),
        fetch(`/api/kpi/summary?companyId=${id}`),
      ])

      if (!goalsRes.ok) throw new Error(`KPI目標取得エラー: HTTP ${goalsRes.status}`)
      const goalsData = await goalsRes.json() as { goals: KpiGoal[] }
      setGoals(goalsData.goals)

      if (actualRes.ok) {
        const actualData = await actualRes.json() as KpiActual
        setActual(actualData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(companyId)
  }, [companyId, fetchData])

  // 目標値保存ハンドラー
  const handleSaveGoal = async (pageId: string, newTarget: number) => {
    const res = await fetch('/api/kpi/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, targetValue: newTarget }),
    })
    if (!res.ok) throw new Error('保存に失敗しました')

    // ローカル state も即時更新（再フェッチなし）
    setGoals(prev => prev.map(g =>
      g.pageId === pageId ? { ...g, target: newTarget } : g
    ))
  }

  // 達成サマリー
  const achievedCount = goals.filter(g => {
    const av = getActualValue(g.kpiType, actual)
    return av !== null && isAchieved(g.kpiType, av, g.target)
  }).length

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
            月次KPI目標を設定し、Notionから取得した実績データと比較します。
          </p>
        </div>
        <button
          onClick={() => fetchData(companyId)}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800
                     border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors
                     disabled:opacity-50 bg-white shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </button>
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
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">KPIデータを取得中...</span>
        </div>
      )}

      {/* メインコンテンツ */}
      {!loading && goals.length > 0 && (
        <>
          {/* 達成サマリーバナー */}
          <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
            achievedCount === goals.length
              ? 'bg-green-50 border border-green-200'
              : 'bg-orange-50 border border-orange-200'
          }`}>
            {achievedCount === goals.length ? (
              <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-semibold ${
                achievedCount === goals.length ? 'text-green-700' : 'text-orange-700'
              }`}>
                {achievedCount}/{goals.length} 項目で目標達成
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                ✏️ カード右上の鉛筆アイコンで目標値を編集・Notionに保存できます
              </p>
            </div>
          </div>

          {/* KPIカードグリッド */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {goals.map(goal => (
              <KpiGoalCard
                key={goal.pageId}
                goal={goal}
                actual={actual}
                onSave={handleSaveGoal}
              />
            ))}
          </div>
        </>
      )}

      {!loading && goals.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">KPI目標が設定されていません</p>
        </div>
      )}
    </div>
  )
}
