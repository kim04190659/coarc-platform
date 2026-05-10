'use client'

// =====================================================
//  src/app/(dashboard)/ai-ext/sales-forecast/page.tsx
//  売上予測AI — Sprint #23
//
//  ■ 画面構成
//    1. 予測方向バナー（上昇/横ばい/下降）+ 確信度インジケーター
//    2. データスナップショット（4指標サマリー）
//    3. ドライバー vs リスク 2カラム表示
//    4. 優先アクションリスト（時期付き）
//    5. AI免責注意書き
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Loader2, AlertCircle, Zap, ShieldAlert, Star, Users, Phone, Target } from 'lucide-react'
import { useParams } from 'next/navigation'
import type { SalesForecastResult } from '@/app/api/ai-ext/sales-forecast/route'

// ── 予測方向スタイル ────────────────────────────────

const FORECAST_STYLES = {
  '上昇': {
    banner:    'bg-green-50 border-green-300',
    badge:     'bg-green-100 text-green-800 border border-green-300',
    icon:      TrendingUp,
    iconColor: 'text-green-500',
    label:     '📈 上昇予測',
    message:   '複数の指標が好調で、今後3ヶ月の業績は上昇傾向が見込まれます。',
  },
  '横ばい': {
    banner:    'bg-blue-50 border-blue-300',
    badge:     'bg-blue-100 text-blue-800 border border-blue-300',
    icon:      Minus,
    iconColor: 'text-blue-500',
    label:     '➡️ 横ばい予測',
    message:   '現状維持が見込まれます。改善アクションで上昇に転じる可能性があります。',
  },
  '下降': {
    banner:    'bg-red-50 border-red-300',
    badge:     'bg-red-100 text-red-800 border border-red-300',
    icon:      TrendingDown,
    iconColor: 'text-red-500',
    label:     '📉 下降リスク',
    message:   '複数の指標でリスクが検出されています。早急な対策が求められます。',
  },
} as const

// ── 確信度インジケーター ────────────────────────────

const CONFIDENCE_MAP = {
  high:   { label: '高',   bars: 3, color: 'bg-green-500',  text: 'text-green-700'  },
  medium: { label: '中',   bars: 2, color: 'bg-yellow-500', text: 'text-yellow-700' },
  low:    { label: '低',   bars: 1, color: 'bg-gray-400',   text: 'text-gray-500'   },
}

function ConfidenceIndicator({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const c = CONFIDENCE_MAP[confidence]
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium ${c.text}`}>確信度 {c.label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-3 h-3 rounded-sm ${i <= c.bars ? c.color : 'bg-gray-200'}`}
          />
        ))}
      </div>
    </div>
  )
}

// ── インパクトバッジ ────────────────────────────────

function ImpactBadge({ impact }: { impact: '大' | '中' | '小' }) {
  const styles = {
    '大': 'bg-red-100 text-red-700 border border-red-200',
    '中': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    '小': 'bg-gray-100 text-gray-600 border border-gray-200',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${styles[impact]}`}>
      {impact}
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

// ── データスナップショットカード ────────────────────

function SnapshotCard({
  icon, label, value, subValue, good,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subValue?: string
  good?: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-xl font-bold ${good === true ? 'text-green-600' : good === false ? 'text-red-600' : 'text-gray-800'}`}>
        {value}
      </div>
      {subValue && <div className="text-xs text-gray-400 mt-0.5">{subValue}</div>}
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────

export default function SalesForecastPage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [result, setResult]   = useState<SalesForecastResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchForecast = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai-ext/sales-forecast?companyId=${companyId}`)
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as SalesForecastResult
      setResult(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchForecast() }, [fetchForecast])

  if (loading && !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm">4つの指標を統合分析中です（約15〜25秒）...</p>
      </div>
    )
  }

  if (error && !result) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <p className="font-semibold mb-1">分析に失敗しました</p>
        <p className="text-sm">{error}</p>
        <button onClick={fetchForecast} className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700">
          再試行
        </button>
      </div>
    )
  }

  const style = result ? FORECAST_STYLES[result.forecast] : null
  const ForecastIcon = style?.icon ?? Minus

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">

      {/* ── ページヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📊 売上予測AI</h1>
          <p className="text-sm text-gray-500 mt-1">
            KPI・フィードバック・社員・問い合わせの4指標を統合分析し、今後3ヶ月の業績方向を予測します
          </p>
        </div>
        <button
          onClick={fetchForecast}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          再分析
        </button>
      </div>

      {result && style && (
        <>
          {/* ── 予測バナー + 確信度 ── */}
          <div className={`border rounded-xl p-5 ${style.banner}`}>
            <div className="flex items-start gap-4">
              <ForecastIcon className={`w-10 h-10 mt-0.5 flex-shrink-0 ${style.iconColor}`} />
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <span className={`px-3 py-1 rounded-full text-base font-bold ${style.badge}`}>
                    {style.label}
                  </span>
                  <ConfidenceIndicator confidence={result.confidence} />
                  {lastUpdated && (
                    <span className="text-xs text-gray-400">{lastUpdated.toLocaleTimeString('ja-JP')} 更新</span>
                  )}
                </div>
                <p className="text-gray-700 text-sm font-medium">{style.message}</p>
                <p className="text-gray-600 text-sm mt-1">{result.summary}</p>
              </div>
            </div>
          </div>

          {/* ── データスナップショット（4指標） ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SnapshotCard
              icon={<Target className="w-3.5 h-3.5" />}
              label="KPI設定数"
              value={`${result.dataSnapshot.kpiCount}件`}
              good={result.dataSnapshot.kpiCount >= 3}
            />
            <SnapshotCard
              icon={<Star className="w-3.5 h-3.5" />}
              label="顧客評価 平均"
              value={`${result.dataSnapshot.feedbackAvgScore}/5.0`}
              subValue={`${result.dataSnapshot.feedbackCount}件のフィードバック`}
              good={result.dataSnapshot.feedbackAvgScore >= 3.5}
            />
            <SnapshotCard
              icon={<Users className="w-3.5 h-3.5" />}
              label="社員コンディション"
              value={`${result.dataSnapshot.conditionAvg}/5.0`}
              subValue={`${result.dataSnapshot.staffCount}名`}
              good={result.dataSnapshot.conditionAvg >= 3.5}
            />
            <SnapshotCard
              icon={<Phone className="w-3.5 h-3.5" />}
              label="未解決問い合わせ"
              value={`${result.dataSnapshot.contactPending}件`}
              subValue={`総${result.dataSnapshot.contactTotal}件`}
              good={result.dataSnapshot.contactPending <= 3}
            />
          </div>

          {/* ── ドライバー vs リスク 2カラム ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* 成長ドライバー */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-bold text-green-800 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                成長ドライバー（{result.positiveDrivers.length}件）
              </h2>
              {result.positiveDrivers.length > 0 ? (
                <div className="space-y-3">
                  {result.positiveDrivers.map((d, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-green-100">
                      <div className="flex items-center gap-2 mb-1">
                        <ImpactBadge impact={d.impact} />
                        <span className="text-sm font-semibold text-gray-800">{d.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{d.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-green-700 opacity-70">現時点で顕著なドライバーはありません</p>
              )}
            </div>

            {/* リスク要因 */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-bold text-red-800 mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                リスク要因（{result.negativeRisks.length}件）
              </h2>
              {result.negativeRisks.length > 0 ? (
                <div className="space-y-3">
                  {result.negativeRisks.map((r, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-red-100">
                      <div className="flex items-center gap-2 mb-1">
                        <ImpactBadge impact={r.impact} />
                        <span className="text-sm font-semibold text-gray-800">{r.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{r.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-red-700 opacity-70">現時点で顕著なリスクはありません</p>
              )}
            </div>
          </div>

          {/* ── 優先アクションリスト ── */}
          {result.recommendations.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-800 mb-4">
                💡 優先アクション（{result.recommendations.length}件）
              </h2>
              <div className="space-y-3">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <PriorityBadge priority={rec.priority} />
                        <span className="font-semibold text-gray-800 text-sm">{rec.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed mb-1">{rec.detail}</p>
                      <span className="text-xs text-indigo-600 font-medium">⏱ {rec.timing}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI免責注意書き ── */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">AI予測に関する注意事項</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {result.disclaimer}
                {' '}本予測は社内データのパターン分析に基づくものであり、市場環境・競合状況・外部要因は考慮されていません。
                投資・経営判断の参考情報としてご活用ください。
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
