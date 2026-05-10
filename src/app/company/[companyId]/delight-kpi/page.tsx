'use client'
// =====================================================
//  src/app/company/[companyId]/delight-kpi/page.tsx
//  感動KPIダッシュボード — Sprint 45
//
//  ■ 役割
//    感動ログDBを集計し、感動スコア・カテゴリ分布・
//    タグ頻度・スタッフ貢献度・AIインサイトを可視化する。
//
//  ■ ランク定義（avgScore）
//    ★4.5以上 → ゴールド（卓越した感動）
//    ★3.5以上 → シルバー（良好）
//    ★3.0以上 → ブロンズ（標準）
//    それ以下  → グレー（要改善）
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Zap,
  RefreshCw,
  Sparkles,
  Users,
  TrendingUp,
  Star,
  Lightbulb,
  Target,
} from 'lucide-react'
import type { DelightKpiSummary } from '@/app/api/delight-score/summary/route'

// ── スコア別カラー（1〜5） ────────────────────────────

const SCORE_COLORS = [
  'bg-red-400',    // 1点
  'bg-orange-400', // 2点
  'bg-yellow-400', // 3点
  'bg-lime-400',   // 4点
  'bg-green-500',  // 5点
]

// ── カテゴリバー行 ────────────────────────────────────

function CategoryBar({
  category, count, avgScore, max,
}: {
  category: string; count: number; avgScore: number; max: number
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-20 shrink-0 truncate">{category}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</span>
      <span className="text-xs text-gray-400 w-12 text-right">★{avgScore.toFixed(1)}</span>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────

export default function DelightKpiPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [summary, setSummary]     = useState<DelightKpiSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchSummary = useCallback(async () => {
    setIsLoading(true)
    setSummary(null)
    try {
      const res  = await fetch(`/api/delight-score/summary?companyId=${companyId}`)
      const data = await res.json() as { summary: DelightKpiSummary | null }
      setSummary(data.summary)
    } catch (err) {
      console.error('感動KPI取得エラー:', err)
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  // ── avgScore に応じたラベル ────────────────────────
  const scoreLabel = (score: number) => {
    if (score >= 4.5) return { label: '卓越した感動', color: 'text-yellow-600' }
    if (score >= 3.5) return { label: '良好な感動品質', color: 'text-green-600' }
    if (score >= 3.0) return { label: '標準レベル', color: 'text-blue-600' }
    return { label: '改善の余地あり', color: 'text-gray-500' }
  }
  const scoreStatus = summary ? scoreLabel(summary.avgScore) : null

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Zap className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">感動KPI（Delight Score）</h1>
            <p className="text-sm text-gray-500">感動件数 × スコア × カテゴリで「感動の質」を可視化</p>
          </div>
        </div>
        <button
          onClick={fetchSummary}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? '分析中...' : '更新'}
        </button>
      </div>

      {/* ── ローディング ── */}
      {isLoading && (
        <div className="text-center py-20 text-gray-500">
          <Zap className="w-10 h-10 animate-pulse mx-auto mb-3 text-amber-400" />
          <p className="text-sm">感動ログを集計中...</p>
          <p className="text-xs text-gray-400 mt-1">AIがインサイトを生成しています</p>
        </div>
      )}

      {/* ── データなし ── */}
      {!isLoading && !summary && (
        <div className="text-center py-16 text-gray-400">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">感動ログが記録されていません</p>
          <p className="text-xs mt-1">「サービス感動ログ」からスタッフが記録すると表示されます</p>
        </div>
      )}

      {!isLoading && summary && (
        <>
          {/* ── KPIサマリーカード ── */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {/* 総感動件数 */}
            <div className="bg-white rounded-xl shadow-sm p-4 text-center border border-gray-100">
              <Sparkles className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-3xl font-black text-amber-600">{summary.totalCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">総感動件数</p>
            </div>
            {/* 平均感動スコア */}
            <div className="bg-amber-50 rounded-xl shadow-sm p-4 text-center border border-amber-100">
              <Star className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-3xl font-black text-amber-700">{summary.avgScore.toFixed(2)}</p>
              <p className="text-xs text-amber-500 mt-0.5">平均感動スコア（/ 5.00）</p>
              {scoreStatus && (
                <p className={`text-xs font-semibold mt-1 ${scoreStatus.color}`}>
                  {scoreStatus.label}
                </p>
              )}
            </div>
            {/* 最多カテゴリ */}
            <div className="bg-white rounded-xl shadow-sm p-4 text-center border border-gray-100">
              <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-sm font-bold text-green-700 mt-1 leading-tight">{summary.topCategory}</p>
              <p className="text-xs text-gray-500 mt-0.5">最多感動カテゴリ</p>
            </div>
          </div>

          {/* ── スコア分布バーチャート ── */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 mb-4">
            <h2 className="text-sm font-bold text-gray-700 mb-4">感動スコア分布</h2>
            <div className="flex items-end gap-2 h-24">
              {summary.scoreDistribution.map(bar => (
                <div key={bar.score} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{bar.count}</span>
                  <div
                    className={`w-full rounded-t-md ${SCORE_COLORS[bar.score - 1]}`}
                    style={{ height: `${Math.max(bar.pct, 4)}%` }}
                  />
                  <span className="text-xs font-semibold text-gray-600">★{bar.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── カテゴリ別 × スタッフ貢献 2カラム ── */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* カテゴリ別 */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <h2 className="text-sm font-bold text-gray-700 mb-3">カテゴリ別件数</h2>
              <div className="flex flex-col gap-2.5">
                {summary.categoryBreakdown.slice(0, 6).map(cat => (
                  <CategoryBar
                    key={cat.category}
                    category={cat.category}
                    count={cat.count}
                    avgScore={cat.avgScore}
                    max={summary.categoryBreakdown[0]?.count ?? 1}
                  />
                ))}
              </div>
            </div>

            {/* スタッフ貢献 TOP5 */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center gap-1.5 mb-3">
                <Users className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-bold text-gray-700">感動貢献スタッフ TOP5</h2>
              </div>
              <div className="flex flex-col gap-2.5">
                {summary.topContributors.map((s, i) => (
                  <div key={s.staffName} className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? 'bg-yellow-400 text-yellow-900' :
                      i === 1 ? 'bg-gray-300 text-gray-700' :
                      i === 2 ? 'bg-amber-600 text-white' :
                      'bg-gray-100 text-gray-500'
                    }`}>{i + 1}</span>
                    <span className="text-xs font-medium text-gray-700 flex-1 truncate">{s.staffName}</span>
                    <span className="text-xs text-amber-600 font-semibold">{s.count}件</span>
                    <span className="text-xs text-gray-400">★{s.avgScore.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 頻出タグ ── */}
          {summary.tagFrequency.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 mb-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">頻出AIタグ TOP6</h2>
              <div className="flex flex-wrap gap-2">
                {summary.tagFrequency.map((t, i) => (
                  <span
                    key={t.tag}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      i === 0 ? 'bg-amber-400 text-amber-900' :
                      i === 1 ? 'bg-amber-200 text-amber-800' :
                      'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {t.tag} <span className="opacity-70">×{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── AIインサイト + AI施策提案 ── */}
          {(summary.aiInsights.length > 0 || summary.aiRecommendations.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {/* インサイト */}
              {summary.aiInsights.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-bold text-amber-800">AIインサイト</h2>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {summary.aiInsights.map((insight, i) => (
                      <li key={i} className="text-xs text-amber-900 leading-relaxed flex gap-1.5">
                        <span className="text-amber-500 shrink-0">✦</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* 施策提案 */}
              {summary.aiRecommendations.length > 0 && (
                <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Target className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-sm font-bold text-indigo-800">AI施策提案</h2>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {summary.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-xs text-indigo-900 leading-relaxed flex gap-1.5">
                        <span className="text-indigo-400 shrink-0">→</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

    </div>
  )
}
