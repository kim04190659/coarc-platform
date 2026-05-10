'use client'
// =====================================================
//  src/app/company/[companyId]/morning-brief/page.tsx
//  AIモーニングブリーフィング — Sprint #38
//
//  ■ 役割
//    毎朝AIが生成する「今日のブリーフィング」を表示する。
//    未対応問い合わせ・スタッフコンディション・フィードバックを
//    統合分析し、今日の注意点・チャンスをわかりやすく提示する。
// =====================================================

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RefreshCw, Sun, AlertTriangle, Sparkles, Heart, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { MorningBriefResult } from '@/app/api/morning-brief/generate/route'

// ── コンディション表示ヘルパー ─────────────────────────

function conditionLabel(score: number): { text: string; color: string } {
  if (score >= 4.0) return { text: '良好',   color: 'text-emerald-600' }
  if (score >= 3.0) return { text: '普通',   color: 'text-amber-500'  }
  return              { text: '要注意', color: 'text-red-500'     }
}

// ── メインコンポーネント ──────────────────────────────

export default function MorningBriefPage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [brief, setBrief]     = useState<MorningBriefResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // 今日の日付文字列
  const todayStr = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  const fetchBrief = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/morning-brief/generate?companyId=${companyId}`)
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as MorningBriefResult
      setBrief(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBrief() }, [companyId])

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── ヘッダー ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Sun className="w-6 h-6 text-amber-500" />
            今日のAIブリーフィング
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{todayStr}</p>
        </div>
        <button
          onClick={fetchBrief}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800
                     border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          再生成
        </button>
      </div>

      {/* ── エラー ── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* ── ローディング ── */}
      {loading && !brief && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <p className="text-sm">AIがデータを分析してブリーフィングを生成中...</p>
        </div>
      )}

      {/* ── ブリーフィング本文 ── */}
      {brief && (
        <>
          {/* 挨拶カード */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white">
            <p className="text-lg font-semibold leading-relaxed">{brief.greeting}</p>
            <p className="text-indigo-200 text-sm mt-3 leading-relaxed">{brief.todayFocus}</p>
          </div>

          {/* データサマリーバッジ */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${brief.dataPoints.unresolvedContacts > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {brief.dataPoints.unresolvedContacts}件
              </p>
              <p className="text-xs text-gray-400 mt-1">未対応問い合わせ</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${conditionLabel(brief.dataPoints.avgCondition).color}`}>
                {brief.dataPoints.avgCondition.toFixed(1)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                平均コンディション
                <span className={`block text-xs font-medium ${conditionLabel(brief.dataPoints.avgCondition).color}`}>
                  {conditionLabel(brief.dataPoints.avgCondition).text}
                </span>
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600">
                {brief.dataPoints.recentFeedback}件
              </p>
              <p className="text-xs text-gray-400 mt-1">最新フィードバック</p>
            </div>
          </div>

          {/* 要注意事項 */}
          {brief.urgentItems.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h2 className="flex items-center gap-2 font-semibold text-red-700 text-sm mb-3">
                <AlertTriangle className="w-4 h-4" />
                今日の要注意事項
              </h2>
              <ul className="space-y-2">
                {brief.urgentItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                    <span className="text-red-400 font-bold flex-shrink-0">・</span>
                    {item}
                  </li>
                ))}
              </ul>
              {/* 問い合わせ管理へのリンク */}
              {brief.dataPoints.unresolvedContacts > 0 && (
                <Link
                  href={`/company/${companyId}/contacts`}
                  className="mt-3 flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  問い合わせ管理を開く
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}

          {/* 今日のチャンス */}
          {brief.opportunities.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <h2 className="flex items-center gap-2 font-semibold text-emerald-700 text-sm mb-3">
                <Sparkles className="w-4 h-4" />
                今日のチャンス・好機
              </h2>
              <ul className="space-y-2">
                {brief.opportunities.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                    <span className="text-emerald-400 font-bold flex-shrink-0">✦</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* チームへのエール */}
          <div className="flex items-start gap-3 p-5 bg-violet-50 border border-violet-200 rounded-xl">
            <Heart className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-violet-800 leading-relaxed font-medium">
              {brief.staffMessage}
            </p>
          </div>

          {/* コンディション低下スタッフ警告 */}
          {brief.dataPoints.lowConditionCount > 0 && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800 flex-1">
                コンディションが低下しているスタッフが
                <span className="font-bold"> {brief.dataPoints.lowConditionCount}名 </span>
                います。声がけをお忘れなく。
              </p>
              <Link
                href={`/company/${companyId}/staff`}
                className="text-xs text-amber-700 hover:text-amber-900 font-medium flex-shrink-0"
              >
                社員を確認 →
              </Link>
            </div>
          )}

          {/* 生成時刻 */}
          <p className="text-xs text-gray-400 text-right">
            AI生成: {new Date(brief.generatedAt).toLocaleTimeString('ja-JP')}
          </p>
        </>
      )}
    </div>
  )
}
