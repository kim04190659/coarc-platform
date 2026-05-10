'use client'

// =====================================================
//  src/app/(dashboard)/ai-ext/cs-quality/page.tsx
//  CS品質スコアAI — Sprint #21
//
//  ■ 画面構成
//    1. 総合スコア大表示（100点満点・グレードバッジ）
//    2. データ統計カード（件数・解決率）
//    3. 4次元スコアバー（応答速度/解決率/顧客満足/問題対応力）
//    4. 強みカード（最大3件）
//    5. 改善点カード（優先度付き・最大3件）
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { Star, RefreshCw, Loader2, CheckCircle2, TrendingUp, Zap, Shield, HeartHandshake } from 'lucide-react'
import { useParams } from 'next/navigation'
import type { CsQualityResult } from '@/app/api/ai-ext/cs-quality/route'

// ── スコアグレード定義 ──────────────────────────────

type Grade = { label: string; color: string; bg: string; border: string; ring: string }

function getGrade(score: number): Grade {
  if (score >= 85) return { label: 'S', color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-300', ring: 'ring-purple-400' }
  if (score >= 70) return { label: 'A', color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-300',  ring: 'ring-green-400'  }
  if (score >= 55) return { label: 'B', color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-300',   ring: 'ring-blue-400'   }
  if (score >= 40) return { label: 'C', color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-300', ring: 'ring-yellow-400' }
  return               { label: 'D', color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-300',    ring: 'ring-red-400'    }
}

// ── 4次元アイコン ───────────────────────────────────

const DIMENSION_ICONS: Record<string, React.ElementType> = {
  '応答速度':   Zap,
  '解決率':     CheckCircle2,
  '顧客満足':   HeartHandshake,
  '問題対応力': Shield,
}

const DIMENSION_COLORS: Record<string, string> = {
  '応答速度':   'bg-blue-500',
  '解決率':     'bg-green-500',
  '顧客満足':   'bg-pink-500',
  '問題対応力': 'bg-indigo-500',
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

export default function CsQualityPage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [result, setResult]   = useState<CsQualityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // ── API呼び出し ──
  const fetchCsQuality = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai-ext/cs-quality?companyId=${companyId}`)
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as CsQualityResult
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
    fetchCsQuality()
  }, [fetchCsQuality])

  // ── ローディング ──
  if (loading && !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm">CS品質を分析中です（約10〜20秒）...</p>
      </div>
    )
  }

  // ── エラー ──
  if (error && !result) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <p className="font-semibold mb-1">分析に失敗しました</p>
        <p className="text-sm">{error}</p>
        <button onClick={fetchCsQuality} className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700">
          再試行
        </button>
      </div>
    )
  }

  const grade = result ? getGrade(result.totalScore) : null

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">

      {/* ── ページヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🎯 CS品質スコアAI</h1>
          <p className="text-sm text-gray-500 mt-1">
            問い合わせ対応を4次元でスコアリング（100点満点）し、CS品質を可視化します
          </p>
        </div>
        <button
          onClick={fetchCsQuality}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          再分析
        </button>
      </div>

      {result && grade && (
        <>
          {/* ── 総合スコア + データ統計 ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* 総合スコア大表示 */}
            <div className={`md:col-span-1 rounded-xl border-2 p-6 flex flex-col items-center gap-3 shadow-sm ${grade.bg} ${grade.border}`}>
              {/* グレードバッジ */}
              <div className={`w-16 h-16 rounded-full ring-4 ${grade.ring} flex items-center justify-center bg-white shadow`}>
                <span className={`text-3xl font-black ${grade.color}`}>{grade.label}</span>
              </div>

              {/* スコア数値 */}
              <div className="text-center">
                <div className={`text-6xl font-bold tabular-nums ${grade.color}`}>
                  {result.totalScore}
                </div>
                <div className="text-sm text-gray-500 font-medium">/ 100点</div>
              </div>

              <div className="text-xs text-gray-400 text-center">
                {lastUpdated?.toLocaleTimeString('ja-JP')} 更新
              </div>

              {/* 総評 */}
              <p className="text-sm text-gray-600 text-center leading-relaxed border-t border-gray-200 pt-3 mt-1">
                {result.summary}
              </p>
            </div>

            {/* データ統計カード */}
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              {[
                { label: '総問い合わせ', value: `${result.stats.totalContacts}件`, icon: '📋', color: 'text-gray-700' },
                { label: '解決率',       value: `${result.stats.resolutionRate}%`, icon: '✅', color: 'text-green-600' },
                { label: '未解決件数',   value: `${result.stats.pendingCount}件`,  icon: '⏳', color: result.stats.pendingCount > 5 ? 'text-red-600' : 'text-yellow-600' },
                { label: '高優先度',     value: `${result.stats.highPriorityCount}件`, icon: '🔴', color: result.stats.highPriorityCount > 3 ? 'text-red-600' : 'text-orange-600' },
              ].map(item => (
                <div key={item.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 4次元スコアバー ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-800 mb-5">
              <TrendingUp className="w-4 h-4 inline mr-2 text-indigo-500" />
              4次元スコア内訳
            </h2>
            <div className="space-y-5">
              {result.dimensions.map(dim => {
                const Icon    = DIMENSION_ICONS[dim.name] ?? Star
                const barColor = DIMENSION_COLORS[dim.name] ?? 'bg-indigo-500'
                const pct     = Math.round((dim.score / dim.max) * 100)

                return (
                  <div key={dim.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-semibold text-gray-700">{dim.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">{dim.comment}</span>
                        <span className="text-sm font-bold text-gray-800 w-16 text-right">
                          {dim.score} <span className="text-gray-400 font-normal">/ {dim.max}</span>
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 強み + 改善点 ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* 強みカード */}
            {result.strengths.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-bold text-green-800 mb-3">
                  💪 強み（{result.strengths.length}件）
                </h2>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 改善点カード */}
            {result.improvements.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-bold text-gray-800 mb-3">
                  🔧 改善点（{result.improvements.length}件）
                </h2>
                <div className="space-y-3">
                  {result.improvements.map((imp, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <PriorityBadge priority={imp.priority} />
                        <span className="text-sm font-semibold text-gray-800">{imp.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-1.5">{imp.detail}</p>
                      <p className="text-xs text-indigo-600 font-medium">→ {imp.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* スコアグレード凡例 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">スコアグレード目安</p>
            <div className="flex gap-3 flex-wrap text-xs">
              {[
                { g: 'S', range: '85〜100', color: 'text-purple-700' },
                { g: 'A', range: '70〜84',  color: 'text-green-700'  },
                { g: 'B', range: '55〜69',  color: 'text-blue-700'   },
                { g: 'C', range: '40〜54',  color: 'text-yellow-700' },
                { g: 'D', range: '0〜39',   color: 'text-red-700'    },
              ].map(item => (
                <span key={item.g} className={`font-bold ${item.color}`}>
                  {item.g}ランク: {item.range}点
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
