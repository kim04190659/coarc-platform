'use client'

// =====================================================
//  src/app/(dashboard)/operations/knowledge/page.tsx
//  AIナレッジ検索 — ナレッジベースDBをキーワード検索し、AI類似回答をサジェスト
//
//  ■ 機能
//    - キーワード入力で即時フィルタリング（件名・対応内容・キーワード）
//    - カテゴリタブで絞り込み
//    - 検索時にClaude Haikuがナレッジをもとに推奨回答を生成
//    - ナレッジ詳細モーダル（対応内容全文）
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { getCompanyById } from '@/config/companies'
import {
  Search, BookOpen, Sparkles, RefreshCw,
  Tag, ChevronRight, X,
} from 'lucide-react'
import type { KnowledgeItem } from '@/app/api/knowledge/search/route'

// ── AIサジェストパネル ────────────────────────────────

function AiSuggestionPanel({ text, loading }: { text: string; loading: boolean }) {
  if (!text && !loading) return null
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200
                    rounded-xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-indigo-700">AI推奨回答</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          AIが推奨回答を生成中...
        </div>
      ) : (
        <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
      )}
    </div>
  )
}

// ── ナレッジカード ────────────────────────────────────

function KnowledgeCard({
  item,
  onClick,
}: {
  item: KnowledgeItem
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-4
                 hover:border-indigo-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 mb-1 truncate">{item.title}</p>
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{item.content}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
      </div>
      {item.category && (
        <div className="mt-2 flex items-center gap-1">
          <Tag className="w-3 h-3 text-indigo-400" />
          <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
            {item.category}
          </span>
        </div>
      )}
    </button>
  )
}

// ── 詳細モーダル ──────────────────────────────────────

function DetailModal({
  item,
  onClose,
}: {
  item: KnowledgeItem
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-800">{item.title}</h3>
            {item.category && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-600
                               bg-indigo-50 px-2 py-0.5 rounded-full">
                <Tag className="w-3 h-3" />
                {item.category}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 対応内容 */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">推奨対応内容</p>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {item.content}
          </p>
        </div>

        {/* キーワード */}
        {item.keywords && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">キーワード</p>
            <div className="flex flex-wrap gap-1.5">
              {item.keywords.split(',').map((kw, i) => (
                <span
                  key={i}
                  className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full"
                >
                  {kw.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg
                       hover:bg-indigo-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// ── メインページ ──────────────────────────────────────

export default function KnowledgePage() {
  const { companyId } = useCompany()
  const company = getCompanyById(companyId)

  // 全ナレッジ一覧（Notionから取得）
  const [allItems, setAllItems]       = useState<KnowledgeItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // 検索状態
  const [query, setQuery]             = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiLoading, setAiLoading]     = useState(false)

  // カテゴリフィルタ
  const [activeCategory, setActiveCategory] = useState('すべて')

  // モーダル
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)

  // ── ナレッジ全件取得（ページロード時・企業切り替え時）─────
  const fetchAll = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setQuery('')
    setAiSuggestion('')
    setSearchedQuery('')
    try {
      const res = await fetch(`/api/knowledge/search?companyId=${id}`)
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { items: KnowledgeItem[] }
      setAllItems(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll(companyId)
  }, [companyId, fetchAll])

  // ── 検索実行（AIサジェスト付き）────────────────────
  const handleSearch = async () => {
    if (!query.trim()) return
    setSearchedQuery(query.trim())
    setAiLoading(true)
    setAiSuggestion('')
    try {
      const res = await fetch(
        `/api/knowledge/search?companyId=${companyId}&query=${encodeURIComponent(query)}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { items: KnowledgeItem[]; aiSuggestion: string }
      setAllItems(data.items)
      setAiSuggestion(data.aiSuggestion)
    } catch (err) {
      console.error('[knowledge] 検索エラー:', err)
    } finally {
      setAiLoading(false)
    }
  }

  // ── カテゴリ一覧を抽出 ────────────────────────────
  const categories = ['すべて', ...Array.from(new Set(allItems.map(i => i.category).filter(Boolean)))]

  // ── 表示するナレッジ（カテゴリフィルタ適用）─────────
  const displayItems = activeCategory === 'すべて'
    ? allItems
    : allItems.filter(i => i.category === activeCategory)

  return (
    <div className="max-w-4xl mx-auto">

      {/* ヘッダー */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          AIナレッジ検索 — {company.name}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          過去の対応ノウハウをキーワード検索。AIが類似ナレッジをもとに推奨回答をサジェストします。
        </p>
      </div>

      {/* 検索バー */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
            placeholder="キーワードを入力（例: チェックアウト、クレーム、返品）"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!query.trim() || aiLoading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                     text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          AI検索
        </button>
        {query && (
          <button
            onClick={() => { setQuery(''); fetchAll(companyId) }}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600
                       hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* AI推奨回答 */}
      <AiSuggestionPanel text={aiSuggestion} loading={aiLoading} />

      {/* エラー */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="flex justify-center items-center h-48 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">ナレッジを取得中...</span>
        </div>
      )}

      {/* コンテンツ */}
      {!loading && (
        <>
          {/* カテゴリタブ */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
                {cat !== 'すべて' && (
                  <span className="ml-1 opacity-70">
                    ({allItems.filter(i => i.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ナレッジ件数 */}
          <p className="text-xs text-gray-500 mb-3">
            {searchedQuery
              ? `「${searchedQuery}」の検索結果: ${displayItems.length}件`
              : `${displayItems.length}件のナレッジ`}
          </p>

          {/* ナレッジ一覧 */}
          {displayItems.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {displayItems.map(item => (
                <KnowledgeCard
                  key={item.pageId}
                  item={item}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">ナレッジが見つかりません</p>
              {searchedQuery && (
                <button
                  onClick={() => { setQuery(''); fetchAll(companyId) }}
                  className="mt-2 text-indigo-500 text-sm underline"
                >
                  検索をクリア
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* 詳細モーダル */}
      {selectedItem && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
