'use client'

// =====================================================
//  src/app/(dashboard)/operations/staff/page.tsx
//  社員管理 — 社員一覧・スキル確認・コンディション記録
//
//  ■ 機能
//    - 社員マスタ一覧（役職・得意機能・スキルセット表示）
//    - 直近コンディションバッジで健康状態を一覧把握
//    - コンディション記録ボタン → 入力フォーム → AI生成コメント付きでNotionに保存
//    - AIディスパッチ向け：スキルセット・資格をカード上に可視化
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getCompanyById } from '@/config/companies'
import {
  Users, RefreshCw, AlertTriangle, ChevronDown,
  ChevronUp, ClipboardList, Sparkles, X, CheckCircle2,
  Briefcase, Award,
} from 'lucide-react'
import type { StaffWithCondition } from '@/app/api/staff/list/route'

// ── コンディションカラー ─────────────────────────────

function conditionStyle(condition: string | undefined): {
  bg: string; text: string; border: string
} {
  if (!condition) return { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' }
  if (condition.includes('5')) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' }
  if (condition.includes('4')) return { bg: 'bg-blue-100',  text: 'text-blue-700',  border: 'border-blue-300'  }
  if (condition.includes('3')) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' }
  if (condition.includes('2')) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' }
  return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' }
}

// ── 得意機能バッジカラー ──────────────────────────────

function functionColor(fn: string): string {
  const map: Record<string, string> = {
    '接客・フロント': 'bg-indigo-50 text-indigo-700',
    '調理・製造':    'bg-orange-50 text-orange-700',
    '受付・事務':    'bg-purple-50 text-purple-700',
    '医療・看護':    'bg-pink-50 text-pink-700',
    '営業・提案':    'bg-green-50 text-green-700',
    '管理・経営':    'bg-blue-50 text-blue-700',
    'IT・システム':  'bg-cyan-50 text-cyan-700',
    '清掃・設備':    'bg-gray-50 text-gray-600',
  }
  return map[fn] ?? 'bg-gray-50 text-gray-600'
}

// ── 役職バッジカラー ──────────────────────────────────

function roleColor(role: string): string {
  if (role === 'オーナー')       return 'bg-yellow-100 text-yellow-800'
  if (role === '部長・院長')     return 'bg-purple-100 text-purple-800'
  if (role === 'マネージャー')   return 'bg-blue-100 text-blue-800'
  if (role === 'リーダー')       return 'bg-green-100 text-green-800'
  return 'bg-gray-100 text-gray-600'
}

// ── コンディション記録フォーム ────────────────────────

const CONDITIONS = [
  '⭐5 絶好調', '⭐4 好調', '⭐3 普通', '⭐2 やや不調', '⭐1 不調',
] as const

const WORKLOADS  = ['高', '中', '低'] as const
const WORKSTYLES = ['出勤', 'テレワーク', '休暇', '病欠'] as const

type RecordFormProps = {
  staffName: string
  companyId: string
  onClose:   () => void
  onSaved:   (aiComment: string) => void
}

function ConditionRecordForm({ staffName, companyId, onClose, onSaved }: RecordFormProps) {
  const [condition, setCondition] = useState<string>(CONDITIONS[2])
  const [workload,  setWorkload]  = useState<string>('中')
  const [workStyle, setWorkStyle] = useState<string>('出勤')
  const [memo,      setMemo]      = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/staff/condition/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, staffName, condition, workload, workStyle, memo }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? '保存に失敗しました')
      }
      const data = await res.json() as { aiComment: string }
      onSaved(data.aiComment)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        {/* ヘッダー */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-gray-800">コンディション記録</h3>
            <p className="text-sm text-indigo-600 mt-0.5">{staffName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* コンディション選択 */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">コンディション</p>
          <div className="grid grid-cols-5 gap-1">
            {CONDITIONS.map(c => {
              const s = conditionStyle(c)
              return (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                    condition === c
                      ? `${s.bg} ${s.text} ${s.border} shadow-sm ring-2 ring-indigo-400`
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {c.split(' ')[0]}<br />
                  <span className="text-[10px]">{c.split(' ')[1]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 業務負荷 */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">業務負荷</p>
          <div className="flex gap-2">
            {WORKLOADS.map(w => (
              <button
                key={w}
                onClick={() => setWorkload(w)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  workload === w
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* 勤務形態 */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">勤務形態</p>
          <div className="flex gap-2 flex-wrap">
            {WORKSTYLES.map(s => (
              <button
                key={s}
                onClick={() => setWorkStyle(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  workStyle === s
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* メモ */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 mb-2">メモ（任意）</p>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="気になった様子・申し送り事項など"
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        {/* エラー */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            ⚠️ {error}
          </div>
        )}

        {/* 保存ボタン */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600
                       hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                       text-white font-medium text-sm rounded-xl transition-colors
                       flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                AI生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                保存してAIコメント生成
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AI コメント表示モーダル ───────────────────────────

function AiCommentModal({ comment, onClose }: { comment: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <h3 className="text-base font-bold text-gray-800">保存完了</h3>
        </div>
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200
                        rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-semibold text-indigo-700">AIコメント</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{comment}</p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl
                     hover:bg-indigo-700 transition-colors"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}

// ── 社員カード ────────────────────────────────────────

function StaffCard({
  staff,
  onRecord,
}: {
  staff: StaffWithCondition
  onRecord: (name: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cs = conditionStyle(staff.latestCondition?.condition)
  const skills = staff.skillSet
    ? staff.skillSet.split(',').map(s => s.trim()).filter(Boolean)
    : []

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* カードヘッダー */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-gray-800">{staff.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(staff.role)}`}>
                {staff.role}
              </span>
            </div>
            <p className="text-xs text-gray-500">{staff.department}</p>
          </div>
          {/* コンディションバッジ */}
          {staff.latestCondition ? (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${cs.bg} ${cs.text} ${cs.border} shrink-0`}>
              {staff.latestCondition.condition}
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium border
                             bg-gray-100 text-gray-400 border-gray-200 shrink-0">
              未記録
            </span>
          )}
        </div>

        {/* 得意機能 */}
        <div className="flex items-center gap-1.5 mt-2">
          <Briefcase className="w-3 h-3 text-gray-400 shrink-0" />
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${functionColor(staff.primaryFunction)}`}>
            {staff.primaryFunction}
          </span>
          <span className="text-xs text-gray-400">入社{staff.joinYear}年</span>
        </div>

        {/* コンディション詳細（AIコメント） */}
        {staff.latestCondition?.aiComment && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
            💬 {staff.latestCondition.aiComment}
          </p>
        )}
      </div>

      {/* スキル詳細（展開式） */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {/* スキルセット */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">スキルセット</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s, i) => (
                <span
                  key={i}
                  className="text-xs bg-white border border-gray-200 text-gray-600
                             px-2 py-0.5 rounded-full"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* 資格 */}
          {staff.certifications && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">
                <Award className="w-3 h-3 inline mr-1" />資格
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">{staff.certifications}</p>
            </div>
          )}

          {/* 直近コンディション詳細 */}
          {staff.latestCondition && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">直近コンディション</p>
              <div className="flex gap-2 text-xs text-gray-500 flex-wrap">
                <span>📅 {staff.latestCondition.recordedAt}</span>
                <span>📊 負荷: {staff.latestCondition.workload}</span>
                <span>🏢 {staff.latestCondition.workStyle}</span>
              </div>
              {staff.latestCondition.memo && (
                <p className="text-xs text-gray-500 mt-1.5 bg-white rounded-lg p-2 border border-gray-200">
                  {staff.latestCondition.memo}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* フッター操作ボタン */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600
                     transition-colors py-1"
        >
          {expanded
            ? <><ChevronUp className="w-3.5 h-3.5" />閉じる</>
            : <><ChevronDown className="w-3.5 h-3.5" />スキル詳細</>
          }
        </button>
        <button
          onClick={() => onRecord(staff.name)}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800
                     hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors border
                     border-indigo-200"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          記録する
        </button>
      </div>
    </div>
  )
}

// ── メインページ ──────────────────────────────────────

export default function StaffPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const company = getCompanyById(companyId)

  const [staff, setStaff]         = useState<StaffWithCondition[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // フォーム表示管理
  const [recordTarget, setRecordTarget] = useState<string | null>(null)
  const [aiResult, setAiResult]         = useState<string | null>(null)

  // フィルタ
  const [filterFunction, setFilterFunction] = useState('すべて')

  // ── データ取得 ────────────────────────────────────
  const fetchStaff = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/staff/list?companyId=${id}`)
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { staff: StaffWithCondition[] }
      setStaff(data.staff)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStaff(companyId)
  }, [companyId, fetchStaff])

  // ── 保存完了ハンドラー ────────────────────────────
  const handleSaved = (aiComment: string) => {
    setRecordTarget(null)
    setAiResult(aiComment)
    fetchStaff(companyId)  // 最新コンディションを再取得
  }

  // ── 得意機能一覧（タブフィルタ用）────────────────
  const functions = ['すべて', ...Array.from(new Set(staff.map(s => s.primaryFunction).filter(Boolean)))]

  // ── アラート社員（コンディション2以下）────────────
  const alertStaff = staff.filter(s =>
    s.latestCondition?.condition.includes('2') ||
    s.latestCondition?.condition.includes('1')
  )

  // ── 表示社員（フィルタ適用）──────────────────────
  const displayStaff = filterFunction === 'すべて'
    ? staff
    : staff.filter(s => s.primaryFunction === filterFunction)

  return (
    <div className="max-w-5xl mx-auto">

      {/* ヘッダー */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            社員管理 — {company.name}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            社員のスキル・コンディションを把握し、AIディスパッチ・人材育成に活用します。
          </p>
        </div>
        <button
          onClick={() => fetchStaff(companyId)}
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
          <span className="text-sm">社員データを取得中...</span>
        </div>
      )}

      {/* メインコンテンツ */}
      {!loading && staff.length > 0 && (
        <>
          {/* アラートバナー（注意・不調の社員がいる場合） */}
          {alertStaff.length > 0 && (
            <div className="mb-5 p-4 bg-orange-50 border border-orange-200 rounded-xl
                            flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-700">
                  コンディション要注意 {alertStaff.length}名
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {alertStaff.map(s => s.name).join('、')} — フォローを検討してください
                </p>
              </div>
            </div>
          )}

          {/* サマリー */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{staff.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">在籍社員数</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {staff.filter(s =>
                  s.latestCondition?.condition.includes('4') ||
                  s.latestCondition?.condition.includes('5')
                ).length}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">好調以上</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-2xl font-bold text-orange-500">{alertStaff.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">要注意</p>
            </div>
          </div>

          {/* 得意機能フィルタ */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {functions.map(fn => (
              <button
                key={fn}
                onClick={() => setFilterFunction(fn)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterFunction === fn
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {fn}
                {fn !== 'すべて' && (
                  <span className="ml-1 opacity-70">
                    ({staff.filter(s => s.primaryFunction === fn).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 社員カードグリッド */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayStaff.map(s => (
              <StaffCard
                key={s.pageId}
                staff={s}
                onRecord={name => setRecordTarget(name)}
              />
            ))}
          </div>
        </>
      )}

      {/* 空状態 */}
      {!loading && staff.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">社員データが見つかりません</p>
        </div>
      )}

      {/* コンディション記録フォーム */}
      {recordTarget && (
        <ConditionRecordForm
          staffName={recordTarget}
          companyId={companyId}
          onClose={() => setRecordTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {/* AIコメント結果モーダル */}
      {aiResult !== null && (
        <AiCommentModal
          comment={aiResult}
          onClose={() => setAiResult(null)}
        />
      )}
    </div>
  )
}
