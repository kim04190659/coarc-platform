'use client'

// =====================================================
//  src/app/(dashboard)/management/dashboard/page.tsx
//  KPI ダッシュボード — Notionの問い合わせ管理DBから実データを集計して表示
//
//  ■ データフロー
//    companyId（CompanyContext）
//      ↓
//    /api/kpi/summary?companyId=xxx
//      ↓
//    KPI集計結果をカード + バーチャートで表示
//
//  ■ 表示内容
//    - KPIカード 4枚（総件数・未対応・解決率・高優先度）
//    - ステータス分布バーチャート
//    - カテゴリ別件数ランキング
//    - AI経営顧問への導線バナー
// =====================================================

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getCompanyById } from '@/config/companies'
import {
  Phone, AlertCircle, CheckCircle2, AlertTriangle,
  RefreshCw, Brain,
} from 'lucide-react'

// ── 型定義 ──────────────────────────────────────────

type KpiSummary = {
  total:          number
  resolved:       number
  resolutionRate: number
  highPriority:   number
  unresponded:    number
  inProgress:     number
  byStatus:       Record<string, number>
  byCategory:     Record<string, number>
  byChannel:      Record<string, number>
  byPriority:     Record<string, number>
}

// ── ヘルパーコンポーネント ────────────────────────────

/** KPI カード 1枚分 */
function KpiCard({
  label, value, sub, icon: Icon, colorClass,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  colorClass: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

/** 横方向バーチャート（1行分） */
function BarRow({
  label, count, total, colorClass,
}: {
  label: string
  count: number
  total: number
  colorClass: string
}) {
  // 割合を0〜100%に正規化
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      {/* ラベル */}
      <span className="text-sm text-gray-600 w-24 shrink-0 text-right">{label}</span>
      {/* バー */}
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* 件数と割合 */}
      <span className="text-sm text-gray-700 font-medium w-16 shrink-0">
        {count}件 <span className="text-gray-400 text-xs">({pct}%)</span>
      </span>
    </div>
  )
}

// ── ステータスカラーマッピング ───────────────────────

const STATUS_COLORS: Record<string, string> = {
  '未対応': 'bg-red-400',
  '対応中': 'bg-yellow-400',
  '完了':   'bg-green-500',
}

const STATUS_DISPLAY_ORDER = ['未対応', '対応中', '完了']

// カテゴリのバーカラー（上位から）
const BAR_COLORS = [
  'bg-indigo-500', 'bg-blue-400', 'bg-teal-400',
  'bg-violet-400', 'bg-pink-400', 'bg-orange-400',
]

// ── メインページ ─────────────────────────────────────

export default function ManagementDashboardPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const company = getCompanyById(companyId)

  // KPIデータの状態管理
  const [kpi, setKpi] = useState<KpiSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // データ取得関数（companyId が変わるたびに再実行）
  const fetchKpi = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/kpi/summary?companyId=${id}`)
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as KpiSummary
      setKpi(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // companyId 変更時にデータ再取得
  useEffect(() => {
    fetchKpi(companyId)
  }, [companyId])

  // ── カテゴリを件数降順でソート ─────────────────────
  const sortedCategories = kpi
    ? Object.entries(kpi.byCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6) // 上位6カテゴリ
    : []

  // ── 画面表示 ─────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">

      {/* ヘッダー */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            📊 KPIダッシュボード — {company.name}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            問い合わせ管理DBのリアルタイム集計データ
          </p>
        </div>
        {/* 再読み込みボタン */}
        <button
          onClick={() => fetchKpi(companyId)}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800
                     border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors
                     disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          ⚠️ データ取得エラー: {error}
        </div>
      )}

      {/* ローディング */}
      {loading && !kpi && (
        <div className="flex justify-center items-center h-64 text-gray-400 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Notionからデータを取得中...
        </div>
      )}

      {/* メインコンテンツ（データあり） */}
      {kpi && (
        <>
          {/* ── KPI カード 4枚 ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label="総問い合わせ件数"
              value={`${kpi.total}件`}
              sub="問い合わせ管理DB合計"
              icon={Phone}
              colorClass="bg-indigo-50 text-indigo-600"
            />
            <KpiCard
              label="未対応件数"
              value={`${kpi.unresponded}件`}
              sub={`全体の${kpi.total > 0 ? Math.round(kpi.unresponded / kpi.total * 100) : 0}%`}
              icon={AlertCircle}
              colorClass="bg-red-50 text-red-500"
            />
            <KpiCard
              label="解決率"
              value={`${kpi.resolutionRate}%`}
              sub={`完了 ${kpi.resolved}件 / 総数 ${kpi.total}件`}
              icon={CheckCircle2}
              colorClass="bg-green-50 text-green-600"
            />
            <KpiCard
              label="高優先度件数"
              value={`${kpi.highPriority}件`}
              sub="優先度「高」のみカウント"
              icon={AlertTriangle}
              colorClass="bg-orange-50 text-orange-500"
            />
          </div>

          {/* ── 下段 2カラム ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* ステータス分布 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4 text-sm">📋 ステータス分布</h3>
              <div className="flex flex-col gap-3">
                {STATUS_DISPLAY_ORDER.map(status => (
                  <BarRow
                    key={status}
                    label={status}
                    count={kpi.byStatus[status] ?? 0}
                    total={kpi.total}
                    colorClass={STATUS_COLORS[status] ?? 'bg-gray-400'}
                  />
                ))}
              </div>

              {/* ステータス凡例 */}
              <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100">
                {STATUS_DISPLAY_ORDER.map(status => (
                  <div key={status} className="flex items-center gap-1 text-xs text-gray-500">
                    <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
                    {status}
                  </div>
                ))}
              </div>
            </div>

            {/* カテゴリ別件数 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4 text-sm">🏷️ カテゴリ別件数（上位6件）</h3>
              {sortedCategories.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {sortedCategories.map(([cat, count], idx) => (
                    <BarRow
                      key={cat}
                      label={cat}
                      count={count}
                      total={kpi.total}
                      colorClass={BAR_COLORS[idx] ?? 'bg-gray-400'}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">カテゴリデータなし</p>
              )}
            </div>
          </div>

          {/* チャネル別サマリー（コンパクトバッジ） */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">📡 チャネル別件数</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(kpi.byChannel)
                .sort(([, a], [, b]) => b - a)
                .map(([ch, count]) => (
                  <span
                    key={ch}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50
                               border border-gray-200 rounded-full text-sm text-gray-600"
                  >
                    {ch}
                    <span className="font-semibold text-indigo-600 ml-1">{count}件</span>
                  </span>
                ))}
            </div>
          </div>
        </>
      )}

      {/* AI顧問バナー */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl p-5 text-white">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-white/20 rounded-lg shrink-0">
            <Brain className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">🤖 AI経営顧問からの提言</h3>
            <p className="text-indigo-200 text-sm mb-3">
              問い合わせデータを分析し、経営改善提言を自動生成します。
              今月の優先アクションをご確認ください。
            </p>
            <a
              href={`/company/${companyId}/ai-advisor`}
              className="inline-block bg-white text-indigo-700 font-semibold
                         px-4 py-2 rounded-lg text-sm hover:bg-indigo-50 transition-colors"
            >
              AI顧問を開く →
            </a>
          </div>
        </div>
      </div>

    </div>
  )
}
