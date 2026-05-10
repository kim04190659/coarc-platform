'use client'

// =====================================================
//  src/app/(dashboard)/operations/ai-logs/page.tsx
//  AIログ閲覧ページ — 全AIページの質問ログを一覧表示・分析
//
//  ■ 機能概要
//    - 企業別AIログDBから質問履歴を取得
//    - ソース（フリーチャット/AIアドバイザー/etc）でフィルタリング
//    - 応答時間・使用頻度などの簡易統計を表示
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { AiChatLog } from '@/app/api/ai/logs/route'
import { BarChart3, RefreshCw, Filter, Clock, MessageSquare, Loader2 } from 'lucide-react'

// ── ソースの色定義 ───────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  'フリーチャット':    'bg-blue-100 text-blue-700',
  'AIアドバイザー':    'bg-purple-100 text-purple-700',
  '人材育成':          'bg-green-100 text-green-700',
  'AIディスパッチ':    'bg-orange-100 text-orange-700',
  'プロジェクト計画AI':'bg-pink-100 text-pink-700',
  'KPIサマリー':       'bg-yellow-100 text-yellow-700',
}

// ── メインコンポーネント ────────────────────────────

export default function AiLogsPage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [logs, setLogs]             = useState<AiChatLog[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [filterSource, setFilter]   = useState<string>('all')
  const [expandedId, setExpanded]   = useState<string | null>(null)

  // ── ログ取得 ──────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/ai/logs?companyId=${companyId}&limit=100`)
      const data = await res.json() as { logs?: AiChatLog[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'ログ取得に失敗しました')
      setLogs(data.logs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  // ── フィルタリング ────────────────────────────────

  const filteredLogs = filterSource === 'all'
    ? logs
    : logs.filter(l => l.source === filterSource)

  // ユニークなソース一覧
  const sources = Array.from(new Set(logs.map(l => l.source).filter(Boolean)))

  // ── 統計計算 ──────────────────────────────────────

  const stats = {
    total:      logs.length,
    avgElapsed: logs.filter(l => l.elapsedMs).length > 0
      ? Math.round(logs.filter(l => l.elapsedMs).reduce((s, l) => s + (l.elapsedMs ?? 0), 0) / logs.filter(l => l.elapsedMs).length)
      : 0,
    sourceBreakdown: sources.map(s => ({
      source: s,
      count:  logs.filter(l => l.source === s).length,
    })).sort((a, b) => b.count - a.count),
  }

  // ── 日時フォーマット ──────────────────────────────

  function formatDate(isoStr: string) {
    if (!isoStr) return '—'
    const d = new Date(isoStr)
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }

  // ── レンダリング ──────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <h1 className="text-xl font-semibold text-gray-800">AIログ分析</h1>
        </div>
        <button
          onClick={() => void fetchLogs()}
          disabled={isLoading}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      <p className="text-sm text-gray-500">
        各AIページでの質問履歴を一覧・分析できます。活用状況の把握や改善に役立ててください。
      </p>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      {/* 統計カード */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <MessageSquare className="w-4 h-4" />
              総質問数
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Clock className="w-4 h-4" />
              平均応答時間
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {stats.avgElapsed > 0 ? `${(stats.avgElapsed / 1000).toFixed(1)}秒` : '—'}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Filter className="w-4 h-4" />
              利用機能数
            </div>
            <p className="text-2xl font-bold text-gray-800">{sources.length}</p>
          </div>
        </div>
      )}

      {/* ソース別利用状況 */}
      {!isLoading && stats.sourceBreakdown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">機能別 利用状況</h2>
          <div className="space-y-2">
            {stats.sourceBreakdown.map(({ source, count }) => {
              const pct = Math.round((count / stats.total) * 100)
              return (
                <div key={source} className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-32 text-center flex-shrink-0 ${SOURCE_COLORS[source] ?? 'bg-gray-100 text-gray-700'}`}>
                    {source}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">{count}件</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* フィルタータブ */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            filterSource === 'all'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'border-gray-300 text-gray-600 hover:border-indigo-400'
          }`}
        >
          すべて ({logs.length})
        </button>
        {sources.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filterSource === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-300 text-gray-600 hover:border-indigo-400'
            }`}
          >
            {s} ({logs.filter(l => l.source === s).length})
          </button>
        ))}
      </div>

      {/* ログ一覧 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">ログを読み込み中...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">ログがありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map(log => (
            <div
              key={log.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* 質問行（クリックで展開） */}
              <button
                onClick={() => setExpanded(expandedId === log.id ? null : log.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${SOURCE_COLORS[log.source] ?? 'bg-gray-100 text-gray-700'}`}>
                    {log.source || '不明'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{log.question}</p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs text-gray-400">{formatDate(log.recordedAt)}</span>
                      {log.elapsedMs && (
                        <span className="text-xs text-gray-400">{(log.elapsedMs / 1000).toFixed(1)}秒</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {expandedId === log.id ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {/* 展開: 回答を表示 */}
              {expandedId === log.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 mb-2">質問</p>
                  <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap">{log.question}</p>
                  <p className="text-xs font-semibold text-gray-500 mb-2">AIの回答</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{log.answer}</p>
                  {log.model && (
                    <p className="text-xs text-gray-400 mt-3">モデル: {log.model}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
