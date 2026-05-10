'use client'

// =====================================================
//  src/app/(dashboard)/customer/feedback/page.tsx
//  顧客フィードバック管理ページ
//
//  ■ 機能
//    - NotionフィードバックDBからデータを取得・表示
//    - 評価別フィルタリング
//    - AI感情分析結果の表示（sentiment・keywords・summary）
//    - 新規フィードバック登録フォーム（Notion保存 + AI分析）
//
//  ■ データフロー
//    /api/feedback/list  → 一覧取得
//    /api/feedback/save  → 新規保存（AI分析含む）
// =====================================================

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getCompanyById } from '@/config/companies'
import {
  Star, RefreshCw, PlusCircle, X, Brain,
  MessageSquare, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import type { FeedbackRecord } from '@/app/api/feedback/list/route'

// ── 型定義 ──────────────────────────────────────────

type AiAnalysis = {
  sentiment:  'ポジティブ' | 'ネガティブ' | 'ニュートラル'
  score:      number
  keywords:   string[]
  summary:    string
  actionHint: string
}

// ── 評価オプション ────────────────────────────────────

const RATINGS = [
  '⭐5 大変満足',
  '⭐4 満足',
  '⭐3 普通',
  '⭐2 不満',
  '⭐1 大変不満',
]

// ── 感情アイコン・カラー ─────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: string }) {
  if (sentiment === 'ポジティブ') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
        <TrendingUp className="w-3 h-3" /> ポジティブ
      </span>
    )
  }
  if (sentiment === 'ネガティブ') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-medium">
        <TrendingDown className="w-3 h-3" /> ネガティブ
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
      <Minus className="w-3 h-3" /> ニュートラル
    </span>
  )
}

// ── 評価カラー ───────────────────────────────────────

function ratingColor(rating: string): string {
  if (rating.startsWith('⭐5') || rating.startsWith('⭐4')) return 'text-green-600'
  if (rating.startsWith('⭐3')) return 'text-yellow-600'
  return 'text-red-500'
}

// ── AI分析結果パネル ─────────────────────────────────

function AiPanel({ json }: { json: string }) {
  if (!json) {
    return (
      <p className="text-xs text-gray-400 italic">AI分析データなし</p>
    )
  }
  try {
    const ai: AiAnalysis = JSON.parse(json)
    return (
      <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-700">AI感情分析</span>
          <SentimentBadge sentiment={ai.sentiment} />
        </div>
        <p className="text-xs text-gray-700 mb-1.5">{ai.summary}</p>
        {ai.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {ai.keywords.map(kw => (
              <span key={kw} className="px-1.5 py-0.5 bg-white border border-indigo-200 text-indigo-600 text-xs rounded">
                {kw}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500">💡 {ai.actionHint}</p>
      </div>
    )
  } catch {
    return <p className="text-xs text-gray-400 italic">AI分析データの形式が不正です</p>
  }
}

// ── メインページ ─────────────────────────────────────

export default function CustomerFeedbackPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const company = getCompanyById(companyId)

  // 一覧データ
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 選択中フィードバック
  const [selected, setSelected] = useState<FeedbackRecord | null>(null)

  // 評価フィルター
  const [ratingFilter, setRatingFilter] = useState<string>('すべて')

  // 新規登録フォームの表示
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    rating: '⭐5 大変満足',
    category: '',
    channel: '来店アンケート',
    customerName: '',
    content: '',
  })

  // ── データ取得 ──────────────────────────────────────
  const fetchFeedbacks = async (id: string) => {
    setLoading(true)
    setError(null)
    setSelected(null)
    try {
      const res = await fetch(`/api/feedback/list?companyId=${id}`)
      const data = await res.json() as { feedbacks?: FeedbackRecord[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setFeedbacks(data.feedbacks ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFeedbacks(companyId) }, [companyId])

  // ── フィルタリング済み一覧 ──────────────────────────
  const filtered = ratingFilter === 'すべて'
    ? feedbacks
    : feedbacks.filter(f => f.rating === ratingFilter)

  // ── 新規保存 ────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formData.content.trim()) return
    setSubmitting(true)
    try {
      // フィードバックIDの採番（既存件数+1）
      const prefix = company.id.split('-').map(s => s[0].toUpperCase()).join('')
      const feedbackId = `${prefix}-FB-${String(feedbacks.length + 1).padStart(3, '0')}`

      const res = await fetch('/api/feedback/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          feedbackId,
          rating:       formData.rating,
          category:     formData.category,
          channel:      formData.channel,
          date:         new Date().toISOString(),
          customerName: formData.customerName || '匿名',
          content:      formData.content,
        }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? '保存に失敗しました')
      }
      // フォームリセット
      setFormData({ rating: '⭐5 大変満足', category: '', channel: '来店アンケート', customerName: '', content: '' })
      setShowForm(false)
      // 一覧を再取得
      await fetchFeedbacks(companyId)
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  // ── 評価分布の集計 ───────────────────────────────────
  const ratingCounts = RATINGS.reduce<Record<string, number>>((acc, r) => {
    acc[r] = feedbacks.filter(f => f.rating === r).length
    return acc
  }, {})

  // ── 平均スコア ───────────────────────────────────────
  const avgScore = feedbacks.length > 0
    ? (feedbacks.reduce((sum, f) => {
        const n = Number(f.rating?.charAt(1)) || 0
        return sum + n
      }, 0) / feedbacks.length).toFixed(1)
    : '—'

  // ── カテゴリ選択肢（企業ごとに問い合わせ管理に合わせる） ──
  const categories = company.industry === 'medical'
    ? ['接客・おもてなし', '設備・施設', '診療・治療', 'サービス全般', '待ち時間', '清潔さ', 'その他']
    : company.industry === 'retail'
    ? ['接客・おもてなし', '設備・施設', '商品・品揃え', 'サービス全般', '価格・コスパ', '清潔さ', 'その他']
    : ['接客・おもてなし', '設備・施設', '料理・食事', 'サービス全般', '価格・コスパ', '清潔さ', 'その他']

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">

      {/* ── 左ペイン：一覧 ── */}
      <div className="w-72 shrink-0 flex flex-col gap-3">

        {/* ヘッダー + 新規ボタン */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-800">⭐ フィードバック</h2>
            <p className="text-xs text-gray-400">{company.name} — 平均 {avgScore}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => fetchFeedbacks(companyId)} disabled={loading}
              className="p-1.5 text-gray-400 hover:text-indigo-600 rounded">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowForm(true)}
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded">
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 評価フィルター */}
        <div className="flex flex-wrap gap-1">
          {['すべて', ...RATINGS].map(r => (
            <button key={r}
              onClick={() => setRatingFilter(r)}
              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                ratingFilter === r
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'text-gray-500 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {r === 'すべて' ? `すべて(${feedbacks.length})` : `${r.slice(0, 2)}(${ratingCounts[r] ?? 0})`}
            </button>
          ))}
        </div>

        {/* エラー */}
        {error && <p className="text-xs text-red-500 p-2 bg-red-50 rounded">{error}</p>}

        {/* フィードバック一覧 */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {loading && <p className="text-xs text-gray-400 text-center pt-4">読み込み中...</p>}
          {!loading && filtered.length === 0 && (
            <div className="text-center pt-8">
              <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">フィードバックデータがありません</p>
              <button onClick={() => setShowForm(true)}
                className="mt-2 text-xs text-indigo-500 hover:underline">
                最初の1件を登録する
              </button>
            </div>
          )}
          {filtered.map(fb => (
            <button key={fb.pageId}
              onClick={() => setSelected(fb)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selected?.pageId === fb.pageId
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-200'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className={`text-xs font-medium ${ratingColor(fb.rating)}`}>
                  {fb.rating || '評価なし'}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {fb.date ? fb.date.slice(0, 10) : '—'}
                </span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{fb.content}</p>
              {fb.category && (
                <span className="mt-1 inline-block text-xs text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                  {fb.category}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 右ペイン：詳細 or 空状態 ── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-300">
            <Star className="w-12 h-12 mb-3" />
            <p className="text-sm">左のリストから選択してください</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            {/* ヘッダー */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className={`text-lg font-bold ${ratingColor(selected.rating)}`}>
                  {selected.rating}
                </span>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span>{selected.feedbackId}</span>
                  <span>·</span>
                  <span>{selected.date ? selected.date.slice(0, 10) : '—'}</span>
                  <span>·</span>
                  <span>{selected.channel}</span>
                </div>
              </div>
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                {selected.status}
              </span>
            </div>

            {/* 基本情報 */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">顧客名</p>
                <p className="text-gray-700">{selected.customerName || '匿名'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">カテゴリ</p>
                <p className="text-gray-700">{selected.category || '—'}</p>
              </div>
            </div>

            {/* フィードバック内容 */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">フィードバック内容</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                {selected.content}
              </p>
            </div>

            {/* AI感情分析 */}
            <AiPanel json={selected.aiAnalysis} />
          </div>
        )}
      </div>

      {/* ── 新規登録モーダル ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">新規フィードバック登録</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* 評価 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">評価 *</label>
                <select
                  value={formData.rating}
                  onChange={e => setFormData(p => ({ ...p, rating: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {RATINGS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>

              {/* カテゴリ */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">カテゴリ</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— 選択 —</option>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* チャネル */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">チャネル</label>
                <select
                  value={formData.channel}
                  onChange={e => setFormData(p => ({ ...p, channel: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {['来店アンケート', 'Webレビュー', 'SNS', 'LINE', '電話', 'その他'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* 顧客名 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">顧客名（任意）</label>
                <input
                  type="text"
                  placeholder="例：田中様（空欄で匿名）"
                  value={formData.customerName}
                  onChange={e => setFormData(p => ({ ...p, customerName: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* 内容 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">フィードバック内容 *</label>
                <textarea
                  rows={4}
                  placeholder="顧客からのフィードバックを入力..."
                  value={formData.content}
                  onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* AI分析の説明 */}
              <p className="text-xs text-indigo-500 flex items-center gap-1">
                <Brain className="w-3 h-3" />
                保存時にClaude HaikuがAI感情分析を自動実行します
              </p>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formData.content.trim()}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-semibold
                           hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> AI分析中...</>
                ) : (
                  <>保存する</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
