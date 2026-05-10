'use client'
// =====================================================
//  src/app/company/[companyId]/customer-analytics/page.tsx
//  顧客分析ダッシュボード — Sprint #43
//
//  ■ 役割
//    顧客プロフィールDBの集計データを視覚的に表示。
//    VIPランキング・来訪分布・タグ頻度・AIインサイトを一画面で確認できる。
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  BarChart3,
  RefreshCw,
  Users,
  Crown,
  Star,
  TrendingUp,
  Tag,
  Lightbulb,
  Zap,
  AlertCircle,
} from 'lucide-react'
import type { CustomerAnalytics } from '@/app/api/customers/analytics/route'

// ── 来訪バッジ ────────────────────────────────────────

function VisitBadge({ count }: { count: number }) {
  if (count >= 10) return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
      👑 {count}回
    </span>
  )
  if (count >= 5) return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
      ⭐ {count}回
    </span>
  )
  if (count >= 2) return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
      {count}回
    </span>
  )
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
      {count}回
    </span>
  )
}

// ── 棒グラフバー ──────────────────────────────────────

function BarRow({
  label, count, max, color,
}: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs text-gray-600 w-28 shrink-0 text-right">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-gray-700 w-8 text-right">{count}</span>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────

export default function CustomerAnalyticsPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [data, setData]         = useState<CustomerAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setData(null)
    try {
      const res = await fetch(`/api/customers/analytics?companyId=${companyId}`)
      const json = await res.json() as CustomerAnalytics
      setData(json)
    } catch (err) {
      console.error('顧客分析取得エラー:', err)
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  // ── タグ頻度の最大値（バー描画用） ──
  const maxTagCount = data ? Math.max(...data.tagFrequencies.map(t => t.count), 1) : 1

  // ── 来訪分布の最大値 ──
  const maxBracket = data ? Math.max(...data.visitBrackets.map(b => b.count), 1) : 1

  const bracketColors = [
    'bg-violet-400',
    'bg-indigo-400',
    'bg-blue-400',
    'bg-gray-400',
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">顧客分析ダッシュボード</h1>
            <p className="text-sm text-gray-500">顧客プロフィールDBの集計・AIインサイト</p>
          </div>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? '分析中...' : '更新'}
        </button>
      </div>

      {/* ── ローディング ── */}
      {isLoading && (
        <div className="text-center py-20 text-gray-500">
          <BarChart3 className="w-10 h-10 animate-pulse mx-auto mb-3 text-indigo-400" />
          <p className="text-sm">顧客データを分析中...</p>
          <p className="text-xs text-gray-400 mt-1">AIがインサイトを生成しています</p>
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* ── KPIサマリーカード ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center border border-gray-100">
              <Users className="w-5 h-5 text-gray-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-800">{data.totalCustomers}</p>
              <p className="text-xs text-gray-500 mt-0.5">総顧客数</p>
            </div>
            <div className="bg-violet-50 rounded-xl shadow-sm p-4 text-center border border-violet-100">
              <Crown className="w-5 h-5 text-violet-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-violet-700">{data.vipCount}</p>
              <p className="text-xs text-violet-500 mt-0.5">VIP（10回以上）</p>
            </div>
            <div className="bg-indigo-50 rounded-xl shadow-sm p-4 text-center border border-indigo-100">
              <Star className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-indigo-700">{data.repeaterCount}</p>
              <p className="text-xs text-indigo-500 mt-0.5">リピーター（5〜9回）</p>
            </div>
            <div className="bg-amber-50 rounded-xl shadow-sm p-4 text-center border border-amber-100">
              <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-700">{data.overdueCount}</p>
              <p className="text-xs text-amber-500 mt-0.5">要フォローアップ</p>
            </div>
          </div>

          {/* ── 平均来訪回数バー ── */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-700">平均来訪回数</span>
            </div>
            <div className="flex items-end gap-3">
              <p className="text-4xl font-bold text-indigo-700">{data.avgVisitCount.toFixed(1)}</p>
              <p className="text-base text-gray-500 mb-1">回 / 顧客</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

            {/* ── 来訪回数分布 ── */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold text-gray-700">来訪回数の分布</span>
              </div>
              {data.visitBrackets.map((b, i) => (
                <BarRow
                  key={b.label}
                  label={b.label}
                  count={b.count}
                  max={maxBracket}
                  color={bracketColors[i] ?? 'bg-gray-400'}
                />
              ))}
            </div>

            {/* ── タグ頻度 ── */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-gray-700">好みタグ頻度 TOP</span>
              </div>
              {data.tagFrequencies.length === 0 && (
                <p className="text-xs text-gray-400">タグデータがありません</p>
              )}
              {data.tagFrequencies.slice(0, 6).map((t) => (
                <BarRow
                  key={t.tag}
                  label={t.tag}
                  count={t.count}
                  max={maxTagCount}
                  color="bg-emerald-400"
                />
              ))}
            </div>
          </div>

          {/* ── VIPランキング ── */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-semibold text-gray-700">来訪回数ランキング TOP 5</span>
            </div>
            <div className="flex flex-col gap-2">
              {data.topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  {/* 順位 */}
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-yellow-400 text-yellow-900' :
                    i === 1 ? 'bg-gray-300 text-gray-700' :
                    i === 2 ? 'bg-amber-600 text-white' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {i + 1}
                  </span>
                  {/* 氏名 */}
                  <span className="text-sm font-medium text-gray-800 w-24 shrink-0">{c.customerName}</span>
                  {/* 来訪バッジ */}
                  <VisitBadge count={c.visitCount} />
                  {/* タグ */}
                  <div className="flex gap-1 flex-wrap ml-1">
                    {c.preferTags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {/* プロファイル（省略） */}
                  <p className="text-xs text-gray-400 ml-auto truncate max-w-40 hidden md:block">
                    {c.aiProfile}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── AIインサイト＋施策提案 ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* インサイト */}
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-700">AIインサイト</span>
              </div>
              <ul className="flex flex-col gap-2">
                {data.aiInsights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-indigo-900">
                    <span className="shrink-0 w-5 h-5 bg-indigo-200 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700">
                      {i + 1}
                    </span>
                    {ins}
                  </li>
                ))}
              </ul>
            </div>

            {/* 施策提案 */}
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">AI施策提案</span>
              </div>
              <ul className="flex flex-col gap-2">
                {data.aiRecommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-900">
                    <span className="shrink-0 w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700">
                      {i + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
