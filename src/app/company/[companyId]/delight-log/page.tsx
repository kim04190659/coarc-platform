'use client'
// =====================================================
//  src/app/company/[companyId]/delight-log/page.tsx
//  サービス感動ログ — Sprint #39
//
//  ■ 役割
//    スタッフが顧客との「感動の瞬間」を30秒で記録するページ。
//    AIが感動カテゴリ・タグ・スコアを自動分類し、
//    感動の法則をNotionに蓄積する。
// =====================================================

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sparkles, Plus, RefreshCw, Star, Tag, MessageCircle, X } from 'lucide-react'
import type { DelightLogItem } from '@/app/api/delight-log/list/route'
import type { SaveDelightLogResult } from '@/app/api/delight-log/save/route'

// ── 感動カテゴリバッジのカラー ────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  '共感':      'bg-blue-100 text-blue-700 border-blue-200',
  '先読み':    'bg-green-100 text-green-700 border-green-200',
  '超期待':    'bg-violet-100 text-violet-700 border-violet-200',
  '問題解決':  'bg-orange-100 text-orange-700 border-orange-200',
  '記念日対応': 'bg-pink-100 text-pink-700 border-pink-200',
}

// ── スコア表示 ────────────────────────────────────────

function ScoreStars({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= score ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`}
        />
      ))}
    </div>
  )
}

// ── 記録フォームモーダル ──────────────────────────────

type RecordFormProps = {
  onClose:   () => void
  onSaved:   (result: SaveDelightLogResult) => void
  companyId: string
}

function RecordForm({ onClose, onSaved, companyId }: RecordFormProps) {
  const [staffName, setStaffName]             = useState('')
  const [action, setAction]                   = useState('')
  const [customerReaction, setCustomerReaction] = useState('')
  const [saving, setSaving]                   = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!staffName.trim() || !action.trim() || !customerReaction.trim()) {
      setError('すべての項目を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/delight-log/save?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffName, action, customerReaction }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const result = await res.json() as SaveDelightLogResult
      onSaved(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            感動の瞬間を記録する
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              あなたの名前 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={staffName}
              onChange={e => setStaffName(e.target.value)}
              placeholder="例: 山田 花子"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              顧客への対応内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={action}
              onChange={e => setAction(e.target.value)}
              placeholder="例: お客様が「迷っている」とおっしゃっていたので、過去のご利用履歴から好みに合うメニューを先回りしてご提案しました"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              顧客の反応 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={customerReaction}
              onChange={e => setCustomerReaction(e.target.value)}
              placeholder="例: 「なんでわかったの！まさにそれが食べたかった！」と笑顔で喜んでいただき、帰り際に「また来ます」とおっしゃっていました"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠️ {error}
            </p>
          )}
        </div>

        {/* フッター */}
        <div className="flex gap-2 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm rounded-lg py-2.5 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-violet-600 text-white text-sm font-semibold rounded-lg py-2.5
                       hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                AI分析中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                記録する
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AI分析結果カード ──────────────────────────────────

function AnalysisResultCard({ result, onClose }: { result: SaveDelightLogResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 text-center">
          {/* スコア表示 */}
          <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✨</span>
          </div>
          <h2 className="font-bold text-gray-800 text-lg mb-1">感動ログを記録しました！</h2>
          <p className="text-sm text-gray-500 mb-4">{result.logTitle}</p>

          {/* カテゴリ */}
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border mb-4 ${CATEGORY_COLORS[result.category] ?? 'bg-gray-100 text-gray-600'}`}>
            {result.category}
          </span>

          {/* スコア */}
          <div className="flex justify-center mb-4">
            <ScoreStars score={result.score} />
          </div>

          {/* AIコメント */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-violet-800 text-left mb-4">
            <p className="font-semibold text-xs text-violet-500 mb-1 flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> AIからのフィードバック
            </p>
            {result.aiComment}
          </div>

          {/* タグ */}
          <div className="flex flex-wrap gap-1.5 justify-center mb-5">
            {result.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-full bg-violet-600 text-white font-semibold rounded-lg py-2.5 hover:bg-violet-700 transition-colors text-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────

export default function DelightLogPage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [logs, setLogs]           = useState<DelightLogItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [savedResult, setSavedResult] = useState<SaveDelightLogResult | null>(null)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/delight-log/list?companyId=${companyId}&limit=20`)
      const data = await res.json() as { logs: DelightLogItem[] }
      setLogs(data.logs ?? [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [companyId])

  const handleSaved = (result: SaveDelightLogResult) => {
    setShowForm(false)
    setSavedResult(result)
    fetchLogs()
  }

  // 感動カテゴリ別集計
  const categoryCount = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.category] = (acc[log.category] ?? 0) + 1
    return acc
  }, {})
  const avgScore = logs.length > 0
    ? Math.round(logs.reduce((a, b) => a + b.score, 0) / logs.length * 10) / 10
    : 0

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── ヘッダー ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-500" />
            サービス感動ログ
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            顧客との感動の瞬間を記録し、感動の法則を蓄積する
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-violet-600 text-white text-sm font-semibold
                     px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          記録する
        </button>
      </div>

      {/* ── サマリーカード ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-violet-600">{logs.length}</p>
          <p className="text-xs text-gray-400 mt-1">感動ログ総数</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="flex justify-center mb-1">
            <ScoreStars score={Math.round(avgScore)} />
          </div>
          <p className="text-xs text-gray-400">平均感動スコア {avgScore > 0 ? avgScore.toFixed(1) : '—'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">
            {Object.keys(categoryCount).length}
          </p>
          <p className="text-xs text-gray-400 mt-1">感動カテゴリ数</p>
        </div>
      </div>

      {/* ── カテゴリ分布 ── */}
      {Object.keys(categoryCount).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">感動カテゴリ分布</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryCount)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => (
                <span
                  key={cat}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${CATEGORY_COLORS[cat] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {cat}
                  <span className="font-bold">{count}件</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* ── 感動ログ一覧 ── */}
      {loading ? (
        <div className="flex justify-center items-center h-40 text-gray-400 text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          読み込み中...
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">まだ感動ログがありません</p>
          <p className="text-xs mt-1">「記録する」ボタンから最初の感動を記録しましょう</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-violet-200 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{log.logTitle}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{log.staffName} · {log.recordedAt}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${CATEGORY_COLORS[log.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {log.category}
                  </span>
                  <ScoreStars score={log.score} />
                </div>
              </div>

              {/* 対応内容 */}
              <p className="text-xs text-gray-600 mb-1.5 line-clamp-2">
                <span className="font-medium text-gray-500">対応: </span>{log.action}
              </p>
              <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                <span className="font-medium text-gray-500">反応: </span>{log.customerReaction}
              </p>

              {/* AIコメント */}
              {log.aiComment && (
                <div className="bg-violet-50 rounded-lg px-3 py-2 text-xs text-violet-700 mb-2">
                  ✨ {log.aiComment}
                </div>
              )}

              {/* タグ */}
              {log.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {log.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── モーダル類 ── */}
      {showForm && (
        <RecordForm
          companyId={companyId}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
      {savedResult && (
        <AnalysisResultCard
          result={savedResult}
          onClose={() => setSavedResult(null)}
        />
      )}
    </div>
  )
}
