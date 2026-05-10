'use client'

// =====================================================
//  src/app/(dashboard)/management/weekly-report/page.tsx
//  週次レポート自動生成 — Claude Haikuが生成した週次レポートを表示・Notionに保存
//
//  ■ 表示内容
//    - 週次サマリー
//    - 今週のハイライト / 懸念事項
//    - 来週の優先アクション
//    - KPI所見
//    - 生成結果のNotionリンク
// =====================================================

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { getCompanyById } from '@/config/companies'
import {
  FileText, RefreshCw, ExternalLink, CheckCircle2,
  AlertTriangle, Target, TrendingUp, Sparkles,
} from 'lucide-react'
import type { WeeklyReport } from '@/app/api/weekly-report/generate/route'

// ── サマリーセクションカード ─────────────────────────

function Section({
  title,
  icon: Icon,
  iconColor,
  bgColor,
  children,
}: {
  title:     string
  icon:      React.ElementType
  iconColor: string
  bgColor:   string
  children:  React.ReactNode
}) {
  return (
    <div className={`${bgColor} rounded-xl border p-5`}>
      <h3 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {title}
      </h3>
      {children}
    </div>
  )
}

// ── 箇条書きリスト ────────────────────────────────────

function BulletList({ items, bulletColor }: { items: string[]; bulletColor: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
          <span className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${bulletColor}`} />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ── メインページ ──────────────────────────────────────

export default function WeeklyReportPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const company = getCompanyById(companyId)

  const [report, setReport]     = useState<WeeklyReport | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [pageUrl, setPageUrl]   = useState<string | null>(null)
  const [warning, setWarning]   = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  // 週次レポートを生成する
  const generateReport = async () => {
    setLoading(true)
    setError(null)
    setWarning(null)
    setPageUrl(null)
    setGenerated(false)

    try {
      const res = await fetch('/api/weekly-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as {
        success: boolean
        report:  WeeklyReport
        pageUrl: string | null
        warning?: string
      }

      setReport(data.report)
      setPageUrl(data.pageUrl)
      setGenerated(true)
      if (data.warning) setWarning(data.warning)

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* ヘッダー */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            週次レポート自動生成 — {company.name}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            問い合わせKPI × 顧客フィードバックをもとに、AIが週次経営レポートを自動生成します
          </p>
        </div>
      </div>

      {/* 生成ボタンエリア */}
      {!report && !loading && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200
                        rounded-2xl p-10 text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white rounded-full shadow-md">
              <Sparkles className="w-10 h-10 text-indigo-500" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">週次レポートを生成する</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            問い合わせ管理DBとフィードバックDBのデータを集約し、
            Claude AIが週次経営サマリーを生成します。
            生成後はNotionに自動保存されます。
          </p>
          <button
            onClick={generateReport}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700
                       text-white font-semibold px-8 py-3 rounded-xl shadow
                       transition-colors text-sm"
          >
            <Sparkles className="w-4 h-4" />
            AIでレポートを生成する
          </button>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="flex flex-col justify-center items-center h-64 gap-3 text-gray-500">
          <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="text-sm">AIがレポートを生成中...</p>
          <p className="text-xs text-gray-400">KPIデータ × フィードバックを分析しています</p>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          ⚠️ レポート生成エラー: {error}
          <button
            onClick={generateReport}
            className="ml-3 text-red-600 underline text-xs"
          >
            再試行
          </button>
        </div>
      )}

      {/* 警告（Notion保存失敗など） */}
      {warning && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 text-sm">
          ⚠️ {warning}
        </div>
      )}

      {/* ── 生成済みレポート表示 ── */}
      {report && !loading && (
        <>
          {/* 成功バナー */}
          {generated && (
            <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl
                            flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">レポートを生成しました</p>
                  {pageUrl ? (
                    <p className="text-xs text-green-600">Notionに自動保存されました</p>
                  ) : (
                    <p className="text-xs text-green-600">レポートが生成されました</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {pageUrl && (
                  <a
                    href={pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-green-700
                               border border-green-300 rounded-lg px-3 py-1.5
                               hover:bg-green-100 transition-colors font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Notionで開く
                  </a>
                )}
                {/* 再生成ボタン */}
                <button
                  onClick={generateReport}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600
                             border border-indigo-200 rounded-lg px-3 py-1.5
                             hover:bg-indigo-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  再生成
                </button>
              </div>
            </div>
          )}

          {/* タイトル・期間 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-5">
            <h3 className="text-lg font-bold text-gray-800 mb-1">{report.title}</h3>
            <p className="text-sm text-gray-500">📅 集計期間: {report.period}</p>
          </div>

          {/* サマリー */}
          <Section
            title="📊 週次サマリー"
            icon={TrendingUp}
            iconColor="text-indigo-500"
            bgColor="bg-indigo-50 border-indigo-200"
          >
            <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
          </Section>

          {/* ハイライト / 懸念事項 2カラム */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Section
              title="✅ 今週のハイライト"
              icon={CheckCircle2}
              iconColor="text-green-500"
              bgColor="bg-green-50 border-green-200"
            >
              <BulletList items={report.highlights} bulletColor="bg-green-500" />
            </Section>

            <Section
              title="⚠️ 懸念事項"
              icon={AlertTriangle}
              iconColor="text-orange-500"
              bgColor="bg-orange-50 border-orange-200"
            >
              {report.concerns.length > 0 ? (
                <BulletList items={report.concerns} bulletColor="bg-orange-400" />
              ) : (
                <p className="text-sm text-gray-400">懸念事項なし</p>
              )}
            </Section>
          </div>

          {/* 来週のアクション */}
          <div className="mt-4">
            <Section
              title="🎯 来週の優先アクション"
              icon={Target}
              iconColor="text-purple-500"
              bgColor="bg-purple-50 border-purple-200"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {report.nextWeekActions.map((action, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg border border-purple-200 p-3 flex items-start gap-2"
                  >
                    <span className="shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white
                                     text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-700 leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* KPI所見 */}
          <div className="mt-4">
            <Section
              title="📈 KPI所見"
              icon={TrendingUp}
              iconColor="text-blue-500"
              bgColor="bg-blue-50 border-blue-200"
            >
              <p className="text-sm text-gray-700 leading-relaxed">{report.kpiComment}</p>
            </Section>
          </div>

          {/* フッター注記 */}
          <p className="text-xs text-gray-400 text-center mt-6">
            ※ このレポートはAIによる自動生成です。数値はデータベース件数に基づく概算です。最終判断は担当者が行ってください。
          </p>
        </>
      )}
    </div>
  )
}
