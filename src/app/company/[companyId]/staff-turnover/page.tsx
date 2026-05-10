'use client'

// =====================================================
//  src/app/(dashboard)/ai-ext/staff-turnover/page.tsx
//  社員離職リスクAI — Sprint #22
//
//  ■ 画面構成
//    1. 組織全体リスクバナー（High/Medium/Low）
//    2. 統計カード（社員数・低コンディション数等）
//    3. 要注意社員リスト（リスクレベル/サイン/介入策）
//    4. 組織シグナル一覧
//    5. 推奨アクション
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { Users, AlertTriangle, CheckCircle, TrendingDown, RefreshCw, Loader2, ShieldAlert } from 'lucide-react'
import { useParams } from 'next/navigation'
import type { StaffTurnoverResult } from '@/app/api/ai-ext/staff-turnover/route'

// ── リスクレベル別スタイル ──────────────────────────

const RISK_STYLES = {
  high: {
    banner:    'bg-red-50 border-red-300',
    badge:     'bg-red-100 text-red-800 border border-red-300',
    icon:      AlertTriangle,
    iconColor: 'text-red-500',
    label:     '🔴 高リスク',
    message:   '複数の社員で離職リスクが高まっています。早急な面談・負荷軽減が必要です。',
  },
  medium: {
    banner:    'bg-yellow-50 border-yellow-300',
    badge:     'bg-yellow-100 text-yellow-800 border border-yellow-300',
    icon:      TrendingDown,
    iconColor: 'text-yellow-500',
    label:     '🟡 中リスク',
    message:   '一部の社員にリスクサインが見られます。継続的なフォローが有効です。',
  },
  low: {
    banner:    'bg-green-50 border-green-300',
    badge:     'bg-green-100 text-green-800 border border-green-300',
    icon:      CheckCircle,
    iconColor: 'text-green-500',
    label:     '🟢 低リスク',
    message:   '社員のコンディションは概ね良好です。現状の取り組みを継続しましょう。',
  },
} as const

// ── 個人リスクバッジ ────────────────────────────────

function RiskBadge({ level }: { level: '高' | '中' | '低' }) {
  const styles = {
    '高': 'bg-red-100 text-red-700 border border-red-200',
    '中': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    '低': 'bg-blue-100 text-blue-700 border border-blue-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${styles[level]}`}>
      {level}リスク
    </span>
  )
}

// ── 優先度バッジ ────────────────────────────────────

function PriorityBadge({ priority }: { priority: '高' | '中' | '低' }) {
  const styles = {
    '高': 'bg-red-100 text-red-700 border border-red-200',
    '中': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    '低': 'bg-blue-100 text-blue-700 border border-blue-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[priority]}`}>
      {priority}
    </span>
  )
}

// ── メインコンポーネント ──────────────────────────────

export default function StaffTurnoverPage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [result, setResult]   = useState<StaffTurnoverResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchTurnoverRisk = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai-ext/staff-turnover?companyId=${companyId}`)
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as StaffTurnoverResult
      setResult(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchTurnoverRisk() }, [fetchTurnoverRisk])

  if (loading && !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm">社員コンディションを分析中です（約10〜20秒）...</p>
      </div>
    )
  }

  if (error && !result) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <p className="font-semibold mb-1">分析に失敗しました</p>
        <p className="text-sm">{error}</p>
        <button onClick={fetchTurnoverRisk} className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700">
          再試行
        </button>
      </div>
    )
  }

  const style = result ? RISK_STYLES[result.overallRisk] : null
  const RiskIcon = style?.icon ?? AlertTriangle

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">

      {/* ── ページヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🔴 社員離職リスクAI</h1>
          <p className="text-sm text-gray-500 mt-1">
            コンディション履歴のトレンドを分析し、離職リスクが高い社員を早期に検知します
          </p>
        </div>
        <button
          onClick={fetchTurnoverRisk}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          再分析
        </button>
      </div>

      {result && style && (
        <>
          {/* ── 組織全体リスクバナー ── */}
          <div className={`border rounded-xl p-5 ${style.banner}`}>
            <div className="flex items-start gap-4">
              <RiskIcon className={`w-8 h-8 mt-0.5 flex-shrink-0 ${style.iconColor}`} />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${style.badge}`}>
                    {style.label}
                  </span>
                  {lastUpdated && (
                    <span className="text-xs text-gray-400">{lastUpdated.toLocaleTimeString('ja-JP')} 更新</span>
                  )}
                </div>
                <p className="text-gray-700 text-sm font-medium">{style.message}</p>
                <p className="text-gray-600 text-sm mt-1">{result.summary}</p>
              </div>
            </div>
          </div>

          {/* ── 統計カード ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '社員総数',         value: `${result.stats.totalStaff}名`,          icon: <Users className="w-4 h-4" />,       color: 'text-gray-700' },
              { label: '分析対象',         value: `${result.stats.analyzedStaff}名`,        icon: <ShieldAlert className="w-4 h-4" />, color: 'text-indigo-600' },
              { label: '低コンディション', value: `${result.stats.lowConditionCount}名`,    icon: <TrendingDown className="w-4 h-4" />, color: result.stats.lowConditionCount > 0 ? 'text-red-600' : 'text-green-600' },
              { label: '高業務負荷',       value: `${result.stats.highWorkloadCount}名`,    icon: <AlertTriangle className="w-4 h-4" />, color: result.stats.highWorkloadCount > 2 ? 'text-orange-600' : 'text-yellow-600' },
            ].map(item => (
              <div key={item.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* ── 要注意社員リスト ── */}
          {result.atRiskStaff.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-800 mb-4">
                👤 要注意社員（{result.atRiskStaff.length}名）
              </h2>
              <div className="space-y-3">
                {result.atRiskStaff.map((staff, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-lg border ${
                      staff.riskLevel === '高'
                        ? 'bg-red-50 border-red-200'
                        : staff.riskLevel === '中'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {/* 氏名・部署・リスクバッジ */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-semibold text-gray-800">{staff.name}</span>
                          <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                            {staff.department}
                          </span>
                          <RiskBadge level={staff.riskLevel} />
                        </div>

                        {/* リスクサイン */}
                        {staff.signs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {staff.signs.map((sign, j) => (
                              <span key={j} className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                ⚠ {sign}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 推奨介入策 */}
                        <p className="text-xs text-indigo-700 font-medium">
                          → 推奨対応: {staff.intervention}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* プライバシー注意書き */}
              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                この情報は業務改善目的のみに使用し、適切なアクセス管理のもとで取り扱ってください。
              </p>
            </div>
          )}

          {/* ── 組織シグナル + 推奨アクション ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* 組織シグナル */}
            {result.organizationSignals.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-bold text-orange-800 mb-3">
                  📡 組織シグナル（{result.organizationSignals.length}件）
                </h2>
                <ul className="space-y-2">
                  {result.organizationSignals.map((signal, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-orange-700">
                      <span className="mt-0.5 flex-shrink-0">•</span>
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 推奨アクション */}
            {result.recommendations.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-bold text-gray-800 mb-3">
                  💡 推奨アクション（{result.recommendations.length}件）
                </h2>
                <div className="space-y-3">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <PriorityBadge priority={rec.priority} />
                        <span className="text-sm font-semibold text-gray-800">{rec.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{rec.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* データなし */}
          {result.atRiskStaff.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
              <p>要注意社員は検出されませんでした。社員のコンディションは良好な状態です。</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
