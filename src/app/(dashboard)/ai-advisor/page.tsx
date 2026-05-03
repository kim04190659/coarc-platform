'use client'

// =====================================================
//  src/app/(dashboard)/ai-advisor/page.tsx
//  AI経営顧問 — Claude Haikuが生成した経営提言を表示する
//
//  ■ 表示内容
//    - 経営状況サマリー（上部バナー）
//    - 緊急課題リスト（赤ラベル）
//    - 経営提言4件（優先度別カラー + コスト試算）
//    - リスク一覧
//    - 再分析ボタン
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { getCompanyById } from '@/config/companies'
import {
  Brain, RefreshCw, AlertTriangle, TrendingUp,
  Clock, DollarSign, ShieldAlert, Lightbulb,
} from 'lucide-react'
import type { AdvisorResult, Recommendation } from '@/app/api/ai-advisor/route'

// ── 優先度バッジ ──────────────────────────────────────

function PriorityBadge({ priority }: { priority: Recommendation['priority'] }) {
  const styles: Record<string, string> = {
    '高': 'bg-red-100 text-red-700 border-red-200',
    '中': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    '低': 'bg-green-100 text-green-700 border-green-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[priority] ?? 'bg-gray-100 text-gray-700'}`}>
      優先度: {priority}
    </span>
  )
}

// ── 提言カード ────────────────────────────────────────

function RecommendationCard({
  rec,
  index,
}: {
  rec: Recommendation
  index: number
}) {
  // 優先度に応じた左ボーダーカラー
  const borderColor =
    rec.priority === '高' ? 'border-red-400'
    : rec.priority === '中' ? 'border-yellow-400'
    : 'border-green-400'

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 border-l-4 ${borderColor}`}>
      {/* ヘッダー行 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {/* 番号バッジ */}
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <h3 className="text-base font-bold text-gray-800">{rec.title}</h3>
        </div>
        <PriorityBadge priority={rec.priority} />
      </div>

      {/* 詳細説明 */}
      <p className="text-sm text-gray-600 mb-4 leading-relaxed">{rec.detail}</p>

      {/* 実施時期 + コスト効果 */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>{rec.timing}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
          <DollarSign className="w-3.5 h-3.5 text-green-500" />
          <span>{rec.costEffect}</span>
        </div>
      </div>
    </div>
  )
}

// ── メインページ ──────────────────────────────────────

export default function AiAdvisorPage() {
  const { companyId } = useCompany()
  const company = getCompanyById(companyId)

  const [result, setResult]   = useState<AdvisorResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // AI経営顧問データを取得する関数
  const fetchAdvisor = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai-advisor?companyId=${id}`)
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as AdvisorResult
      setResult(data)
      // 最終更新時刻を記録
      setLastUpdated(new Date().toLocaleTimeString('ja-JP'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // companyId 変更時に自動取得
  useEffect(() => {
    fetchAdvisor(companyId)
  }, [companyId, fetchAdvisor])

  return (
    <div className="max-w-4xl mx-auto">

      {/* ヘッダー */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-600" />
            AI経営顧問 — {company.name}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            問い合わせKPI × 顧客フィードバックをAIが総合分析し、経営改善提言を生成します
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">最終分析: {lastUpdated}</p>
          )}
        </div>

        {/* 再分析ボタン */}
        <button
          onClick={() => fetchAdvisor(companyId)}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800
                     border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors
                     disabled:opacity-50 bg-white shadow-sm whitespace-nowrap"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          再分析
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          ⚠️ AI分析エラー: {error}
        </div>
      )}

      {/* ローディング */}
      {loading && !result && (
        <div className="flex flex-col justify-center items-center h-64 gap-3 text-gray-500">
          <Brain className="w-10 h-10 text-indigo-400 animate-pulse" />
          <p className="text-sm">AIが経営データを分析中...</p>
          <p className="text-xs text-gray-400">問い合わせKPI × フィードバックを集約しています</p>
        </div>
      )}

      {/* メインコンテンツ */}
      {result && (
        <>
          {/* ── 経営状況サマリーバナー ── */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl p-5 text-white mb-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-lg shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-indigo-200 mb-1 font-medium uppercase tracking-wide">
                  経営状況サマリー
                </p>
                <p className="text-sm leading-relaxed">{result.summary}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

            {/* ── 緊急課題 ── */}
            {result.urgentItems.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-semibold text-red-700 text-sm mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  緊急対応が必要な課題
                </h3>
                <ul className="space-y-2">
                  {result.urgentItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-red-200 text-red-700 text-xs flex items-center justify-center font-bold">
                        !
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── コスト試算合計 ── */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="font-semibold text-green-700 text-sm mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                提言実施による期待効果
              </h3>
              <p className="text-2xl font-bold text-green-700">{result.totalCostEffect}</p>
              <p className="text-xs text-green-600 mt-1">全提言を実施した場合の概算</p>
            </div>

            {/* ── リスク ── */}
            {result.risks.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <h3 className="font-semibold text-orange-700 text-sm mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  注視すべきリスク
                </h3>
                <ul className="space-y-2">
                  {result.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-orange-700">
                      <span className="shrink-0 mt-0.5">▲</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── 経営提言 4件 ── */}
          <div className="mb-2">
            <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              AI経営提言（優先度順）
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {result.recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} index={i} />
              ))}
            </div>
          </div>

          {/* フッター注記 */}
          <p className="text-xs text-gray-400 text-center mt-6">
            ※ この提言はAIによる自動生成です。最終判断は経営者・担当者が行ってください。
          </p>
        </>
      )}
    </div>
  )
}
