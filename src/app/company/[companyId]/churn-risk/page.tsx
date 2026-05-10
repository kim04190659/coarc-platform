'use client'

// =====================================================
//  src/app/(dashboard)/ai-ext/churn-risk/page.tsx
//  顧客離反リスクAI — Sprint #20
//
//  ■ 画面構成
//    1. リスクバナー（High/Medium/Low 色分け）
//    2. スコアゲージ（0〜100 大型表示）
//    3. データポイント（分析件数）
//    4. リスク要因カード（最大3件）
//    5. 改善アクション一覧（優先度付き・最大4件）
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, TrendingDown, CheckCircle, RefreshCw, Loader2, Info } from 'lucide-react'
import { useParams } from 'next/navigation'
import type { ChurnRiskResult } from '@/app/api/ai-ext/churn-risk/route'

// ── リスクレベル別スタイル定義 ──────────────────────

const RISK_STYLES = {
  high: {
    banner: 'bg-red-50 border-red-300',
    badge:  'bg-red-100 text-red-800 border border-red-300',
    gauge:  'text-red-600',
    gaugeBg: 'bg-red-500',
    icon:   AlertTriangle,
    iconColor: 'text-red-500',
    label:  '⚠️ 高リスク',
    message: '顧客離反リスクが高い状態です。早急な対応が必要です。',
  },
  medium: {
    banner: 'bg-yellow-50 border-yellow-300',
    badge:  'bg-yellow-100 text-yellow-800 border border-yellow-300',
    gauge:  'text-yellow-600',
    gaugeBg: 'bg-yellow-500',
    icon:   TrendingDown,
    iconColor: 'text-yellow-500',
    label:  '🔶 中リスク',
    message: '一部に離反リスク要因があります。改善アクションを検討してください。',
  },
  low: {
    banner: 'bg-green-50 border-green-300',
    badge:  'bg-green-100 text-green-800 border border-green-300',
    gauge:  'text-green-600',
    gaugeBg: 'bg-green-500',
    icon:   CheckCircle,
    iconColor: 'text-green-500',
    label:  '✅ 低リスク',
    message: '顧客との関係は良好です。現在の取り組みを継続しましょう。',
  },
} as const

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

// ── スコアゲージ ────────────────────────────────────

function ScoreGauge({ score, riskLevel }: { score: number; riskLevel: 'high' | 'medium' | 'low' }) {
  const style = RISK_STYLES[riskLevel]
  const clampedScore = Math.max(0, Math.min(100, score))

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 数値表示 */}
      <div className={`text-7xl font-bold tabular-nums ${style.gauge}`}>
        {clampedScore}
      </div>
      <div className="text-sm text-gray-500 font-medium">/ 100点（リスクスコア）</div>

      {/* バー */}
      <div className="w-full max-w-xs bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${style.gaugeBg}`}
          style={{ width: `${clampedScore}%` }}
        />
      </div>

      {/* スケール凡例 */}
      <div className="w-full max-w-xs flex justify-between text-xs text-gray-400">
        <span>0 低リスク</span>
        <span>50</span>
        <span>高リスク 100</span>
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────

export default function ChurnRiskPage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [result, setResult]   = useState<ChurnRiskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // ── API呼び出し ──
  const fetchChurnRisk = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/ai-ext/churn-risk?companyId=${companyId}`)
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as ChurnRiskResult
      setResult(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  // ── 企業切り替え時に自動再取得 ──
  useEffect(() => {
    fetchChurnRisk()
  }, [fetchChurnRisk])

  const style = result ? RISK_STYLES[result.riskLevel] : null
  const RiskIcon = style?.icon ?? AlertTriangle

  // ── ローディング ──
  if (loading && !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm">顧客データを分析中です（約10〜20秒）...</p>
      </div>
    )
  }

  // ── エラー ──
  if (error && !result) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <p className="font-semibold mb-1">分析に失敗しました</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchChurnRisk}
          className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          再試行
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">

      {/* ── ページヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⚠️ 顧客離反リスクAI</h1>
          <p className="text-sm text-gray-500 mt-1">
            フィードバック + 問い合わせデータを横断分析し、顧客離反リスクを検知します
          </p>
        </div>
        <button
          onClick={fetchChurnRisk}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />
          }
          再分析
        </button>
      </div>

      {result && style && (
        <>
          {/* ── リスクバナー ── */}
          <div className={`border rounded-xl p-5 ${style.banner}`}>
            <div className="flex items-start gap-4">
              <RiskIcon className={`w-8 h-8 mt-0.5 flex-shrink-0 ${style.iconColor}`} />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${style.badge}`}>
                    {style.label}
                  </span>
                  {lastUpdated && (
                    <span className="text-xs text-gray-400">
                      {lastUpdated.toLocaleTimeString('ja-JP')} 更新
                    </span>
                  )}
                </div>
                <p className="text-gray-700 text-sm font-medium">{style.message}</p>
                <p className="text-gray-600 text-sm mt-1">{result.summary}</p>
              </div>
            </div>
          </div>

          {/* ── スコアゲージ ＋ データポイント ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* スコアゲージ */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-600 self-start">リスクスコア</h2>
              <ScoreGauge score={result.riskScore} riskLevel={result.riskLevel} />
            </div>

            {/* データポイント */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-600 mb-4">分析データ</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">💬 フィードバック件数</span>
                  <span className="font-bold text-gray-800">{result.dataPoints.feedbackCount} 件</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">📞 問い合わせ件数</span>
                  <span className="font-bold text-gray-800">{result.dataPoints.contactCount} 件</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">🔍 AI分析対象</span>
                  <span className="font-bold text-indigo-700">{result.dataPoints.analyzedCount} 件</span>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-500">
                  ネガティブフィードバックと未解決問い合わせを優先して分析しています。
                </p>
              </div>
            </div>
          </div>

          {/* ── リスク要因カード ── */}
          {result.riskFactors.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-800 mb-4">
                🔴 リスク要因（{result.riskFactors.length}件）
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.riskFactors.map((factor, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-4 border ${
                      factor.severity === '高'
                        ? 'bg-red-50 border-red-200'
                        : factor.severity === '中'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <PriorityBadge priority={factor.severity} />
                    </div>
                    <p className="font-semibold text-gray-800 text-sm mb-1">{factor.title}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{factor.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 改善アクション一覧 ── */}
          {result.recommendations.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-800 mb-4">
                💡 改善アクション（{result.recommendations.length}件）
              </h2>
              <div className="space-y-3">
                {result.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    {/* 番号 */}
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <PriorityBadge priority={rec.priority} />
                        <span className="font-semibold text-gray-800 text-sm">{rec.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed mb-2">{rec.detail}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>⏱ {rec.timing}</span>
                        {rec.costEffect && (
                          <span className="text-green-600">💰 {rec.costEffect}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* データなし時 */}
          {result.riskFactors.length === 0 && result.recommendations.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <p>分析データが不足しています。顧客フィードバックや問い合わせデータを追加してください。</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
