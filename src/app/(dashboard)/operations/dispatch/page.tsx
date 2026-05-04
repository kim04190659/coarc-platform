'use client'

// =====================================================
//  src/app/(dashboard)/operations/dispatch/page.tsx
//  AIディスパッチ + 人材育成AI
//
//  ■ 機能
//    【ディスパッチタブ】
//      - 業務内容を入力 → Claude Haikuが社員スキルを照合してTop3推薦
//      - 推薦理由・注意事項・マッチスコアをカードで表示
//
//    【育成プランタブ】
//      - 社員を選択 → Claude Haikuが個別育成プランを自動生成
//      - 強み・成長余地・具体的アクション・次回レビュー時期を表示
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { getCompanyById } from '@/config/companies'
import {
  Zap, RefreshCw, Sparkles, Users, GraduationCap,
  AlertTriangle, CheckCircle2, ChevronRight, Target,
  BookOpen, Award,
} from 'lucide-react'
import type { DispatchRecommendation } from '@/app/api/staff/dispatch/route'
import type { DevelopmentPlan, DevelopmentAction } from '@/app/api/staff/development/route'
import type { StaffWithCondition } from '@/app/api/staff/list/route'

// ── マッチスコアバー ──────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-400' : 'bg-orange-400'
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>マッチ度</span>
        <span className="font-semibold">{score}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

// ── 推薦カード ────────────────────────────────────────

function RecommendationCard({
  rec,
  onDevelop,
}: {
  rec: DispatchRecommendation
  onDevelop: (name: string) => void
}) {
  const rankColor =
    rec.rank === 1 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
    rec.rank === 2 ? 'bg-gray-100 text-gray-700 border-gray-300' :
    'bg-orange-50 text-orange-700 border-orange-300'

  const hasAlert = rec.caution && rec.caution !== 'なし'

  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm ${
      rec.rank === 1 ? 'border-yellow-300 ring-1 ring-yellow-200' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${rankColor}`}>
            {rec.rank === 1 ? '🥇 1位' : rec.rank === 2 ? '🥈 2位' : '🥉 3位'}
          </span>
          <div>
            <p className="text-sm font-bold text-gray-800">{rec.staffName}</p>
            <p className="text-xs text-gray-500">{rec.role} / {rec.department}</p>
          </div>
        </div>
      </div>

      {/* マッチスコアバー */}
      <ScoreBar score={rec.matchScore} />

      {/* マッチング理由 */}
      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">
          <CheckCircle2 className="w-3 h-3 inline mr-1 text-green-500" />
          推薦理由
        </p>
        <p className="text-xs text-gray-700 leading-relaxed">{rec.matchReason}</p>
      </div>

      {/* 注意事項 */}
      {hasAlert && (
        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-xs text-orange-700 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            {rec.caution}
          </p>
        </div>
      )}

      {/* 育成プランへのリンク */}
      <button
        onClick={() => onDevelop(rec.staffName)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs
                   text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50
                   py-1.5 rounded-lg border border-indigo-200 transition-colors"
      >
        <GraduationCap className="w-3.5 h-3.5" />
        育成プランを生成
      </button>
    </div>
  )
}

// ── 優先度バッジ ──────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const color =
    priority === '高' ? 'bg-red-100 text-red-700 border-red-300' :
    priority === '中' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
    'bg-green-100 text-green-700 border-green-300'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${color}`}>
      {priority}
    </span>
  )
}

// ── カテゴリアイコン ─────────────────────────────────

function categoryIcon(cat: string) {
  if (cat.includes('資格')) return <Award className="w-3.5 h-3.5" />
  if (cat.includes('研修')) return <BookOpen className="w-3.5 h-3.5" />
  if (cat.includes('OJT')) return <Users className="w-3.5 h-3.5" />
  if (cat.includes('メンタ')) return <Target className="w-3.5 h-3.5" />
  return <ChevronRight className="w-3.5 h-3.5" />
}

// ── 育成アクションカード ──────────────────────────────

function ActionCard({ action }: { action: DevelopmentAction }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-indigo-500">{categoryIcon(action.category)}</span>
          <p className="text-sm font-semibold text-gray-800">{action.title}</p>
        </div>
        <PriorityBadge priority={action.priority} />
      </div>
      <p className="text-xs text-gray-600 leading-relaxed mb-2">{action.description}</p>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="bg-gray-100 px-2 py-0.5 rounded-full">{action.category}</span>
        <span>⏱ {action.timeline}</span>
      </div>
    </div>
  )
}

// ── メインページ ──────────────────────────────────────

type Tab = 'dispatch' | 'development'

export default function DispatchPage() {
  const { companyId } = useCompany()
  const company = getCompanyById(companyId)

  const [activeTab, setActiveTab] = useState<Tab>('dispatch')

  // ── ディスパッチ状態 ──────────────────────────────
  const [taskDescription, setTaskDescription] = useState('')
  const [dispatching, setDispatching]         = useState(false)
  const [recommendations, setRecommendations] = useState<DispatchRecommendation[]>([])
  const [reasoning, setReasoning]             = useState('')
  const [dispatchError, setDispatchError]     = useState<string | null>(null)

  // ── 育成プラン状態 ────────────────────────────────
  const [staffList, setStaffList]         = useState<StaffWithCondition[]>([])
  const [selectedStaff, setSelectedStaff] = useState('')
  const [developing, setDeveloping]       = useState(false)
  const [devPlan, setDevPlan]             = useState<DevelopmentPlan | null>(null)
  const [devError, setDevError]           = useState<string | null>(null)

  // 社員一覧を取得（育成タブ用）
  const fetchStaffList = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/staff/list?companyId=${id}`)
      if (!res.ok) return
      const data = await res.json() as { staff: StaffWithCondition[] }
      setStaffList(data.staff)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchStaffList(companyId)
    // 企業切り替え時にリセット
    setRecommendations([])
    setReasoning('')
    setDevPlan(null)
    setTaskDescription('')
    setSelectedStaff('')
  }, [companyId, fetchStaffList])

  // ── ディスパッチ実行 ──────────────────────────────
  const handleDispatch = async () => {
    if (!taskDescription.trim()) return
    setDispatching(true)
    setDispatchError(null)
    setRecommendations([])
    setReasoning('')
    try {
      const res = await fetch('/api/staff/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, taskDescription }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? '推薦に失敗しました')
      }
      const data = await res.json() as { recommendations: DispatchRecommendation[]; reasoning: string }
      setRecommendations(data.recommendations ?? [])
      setReasoning(data.reasoning ?? '')
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : String(err))
    } finally {
      setDispatching(false)
    }
  }

  // ── 育成プラン生成 ────────────────────────────────
  const handleDevelop = async (staffName?: string) => {
    const target = staffName ?? selectedStaff
    if (!target) return
    setActiveTab('development')
    setSelectedStaff(target)
    setDeveloping(true)
    setDevError(null)
    setDevPlan(null)
    try {
      const res = await fetch('/api/staff/development', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, staffName: target }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? '育成プラン生成に失敗しました')
      }
      const data = await res.json() as { plan: DevelopmentPlan }
      setDevPlan(data.plan)
    } catch (err) {
      setDevError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeveloping(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* ヘッダー */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Zap className="w-6 h-6 text-indigo-600" />
          AIディスパッチ / 人材育成 — {company.name}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          業務内容から最適担当者を推薦、または社員個別の育成プランをAIが自動生成します。
        </p>
      </div>

      {/* タブ切り替え */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('dispatch')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'dispatch'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Zap className="w-4 h-4" />
          AIディスパッチ
        </button>
        <button
          onClick={() => setActiveTab('development')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'development'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          人材育成AI
        </button>
      </div>

      {/* ── ディスパッチタブ ── */}
      {activeTab === 'dispatch' && (
        <div>
          {/* 業務内容入力 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">業務・依頼内容を入力</p>
            <textarea
              value={taskDescription}
              onChange={e => setTaskDescription(e.target.value)}
              placeholder={`例:\n・新規顧客へのシステム提案資料を作成したい\n・クレームが入った顧客への電話対応を頼みたい\n・新メニューのレシピ開発と試作を担当してほしい`}
              rows={5}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
            <button
              onClick={handleDispatch}
              disabled={!taskDescription.trim() || dispatching}
              className="mt-3 w-full flex items-center justify-center gap-2
                         bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                         text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
              {dispatching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  AIが担当者を選定中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  最適担当者をAIが推薦
                </>
              )}
            </button>
          </div>

          {/* エラー */}
          {dispatchError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              ⚠️ {dispatchError}
            </div>
          )}

          {/* 推薦結果 */}
          {recommendations.length > 0 && (
            <>
              {/* AIの総合判断コメント */}
              {reasoning && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200
                                rounded-xl p-4 mb-4 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700 leading-relaxed">{reasoning}</p>
                </div>
              )}

              {/* 推薦カード */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {recommendations.map(rec => (
                  <RecommendationCard
                    key={rec.rank}
                    rec={rec}
                    onDevelop={handleDevelop}
                  />
                ))}
              </div>
            </>
          )}

          {/* 初期状態の案内 */}
          {!dispatching && recommendations.length === 0 && !dispatchError && (
            <div className="text-center py-16 text-gray-400">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">業務内容を入力してAIに担当者推薦を依頼してください</p>
            </div>
          )}
        </div>
      )}

      {/* ── 育成プランタブ ── */}
      {activeTab === 'development' && (
        <div>
          {/* 社員選択 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">育成プランを作成する社員を選択</p>
            <div className="flex gap-2">
              <select
                value={selectedStaff}
                onChange={e => setSelectedStaff(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">社員を選択してください</option>
                {staffList.map(s => (
                  <option key={s.pageId} value={s.name}>
                    {s.name}（{s.role} / {s.department}）
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleDevelop()}
                disabled={!selectedStaff || developing}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700
                           disabled:opacity-50 text-white font-medium px-5 py-2.5
                           rounded-xl text-sm transition-colors"
              >
                {developing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                育成プラン生成
              </button>
            </div>
          </div>

          {/* エラー */}
          {devError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              ⚠️ {devError}
            </div>
          )}

          {/* ローディング */}
          {developing && (
            <div className="flex justify-center items-center h-40 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">AIが育成プランを生成中...</span>
            </div>
          )}

          {/* 育成プラン表示 */}
          {!developing && devPlan && (
            <div>
              {/* サマリー */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200
                              rounded-xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <p className="text-sm font-semibold text-indigo-700">
                    {devPlan.staffName} さんの育成プラン
                  </p>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{devPlan.summary}</p>
                {devPlan.nextReview && (
                  <p className="text-xs text-gray-500 mt-2">
                    📅 次回レビュー推奨: {devPlan.nextReview}
                  </p>
                )}
              </div>

              {/* 強み & 成長余地 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                <div className="bg-white rounded-xl border border-green-200 p-4">
                  <p className="text-xs font-semibold text-green-700 mb-2.5">
                    ✨ 強み（伸ばすべき点）
                  </p>
                  <ul className="space-y-1.5">
                    {(devPlan.strengths ?? []).map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white rounded-xl border border-orange-200 p-4">
                  <p className="text-xs font-semibold text-orange-700 mb-2.5">
                    🎯 成長余地（強化すべき点）
                  </p>
                  <ul className="space-y-1.5">
                    {(devPlan.growthAreas ?? []).map((g, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                        <Target className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 育成アクション */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  📋 推薦育成アクション
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {(devPlan.actions ?? []).map((action, i) => (
                    <ActionCard key={i} action={action} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 初期状態の案内 */}
          {!developing && !devPlan && !devError && (
            <div className="text-center py-16 text-gray-400">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">社員を選択して育成プランを自動生成してください</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
