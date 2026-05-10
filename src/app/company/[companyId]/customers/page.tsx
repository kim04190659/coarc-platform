'use client'

// =====================================================
//  src/app/company/[companyId]/customers/page.tsx
//  顧客プロフィール管理ページ — Sprint #41
//
//  ■ 機能概要
//    顧客との長期的な関係性を記録・可視化するページ。
//    左列: 顧客一覧（来訪回数バッジ付き）
//    右列: 詳細パネル（好みタグ / AIプロファイル / 推奨アクション）
//    新規顧客追加モーダル（名前・来訪回数・好みタグ・来訪日）
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getCompanyById } from '@/config/companies'
import type { CustomerProfile } from '@/app/api/customers/list/route'
import type { SaveCustomerResult } from '@/app/api/customers/save/route'
import {
  User, UserPlus, Tag, Calendar, Repeat2,
  Sparkles, ChevronRight, ExternalLink, X, Plus,
} from 'lucide-react'

// ── 業種別の好みタグ候補 ─────────────────────────────

const PREFER_TAG_OPTIONS: Record<string, string[]> = {
  hotel:   ['窓側席', '静かな環境', '和室', '洋室', '赤ワイン', '日本酒', 'アレルギー配慮', 'ペット同伴', '記念日対応', 'VIP'],
  medical: ['個室希望', '駐車場利用', 'オンライン診察', 'お薬手帳', 'アレルギー配慮', '小児科', '定期検診', 'VIP'],
  food:    ['カウンター席', 'テーブル席', '辛さ増し', '麺固め', 'トッピング追加', 'テイクアウト', 'アレルギー配慮', 'ランチ利用', 'VIP'],
  retail:  ['まとめ買い', '特売品目当て', 'ポイント重視', '宅配希望', 'アレルギー配慮', 'オーガニック', '夕方来店', 'VIP'],
}

// ── 日付フォーマット ─────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '未来訪'
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

// ── 来訪回数バッジの色 ───────────────────────────────

function VisitBadge({ count }: { count: number }) {
  const color =
    count >= 10 ? 'bg-violet-600 text-white' :
    count >= 5  ? 'bg-indigo-500 text-white' :
    count >= 2  ? 'bg-blue-400 text-white'   :
                  'bg-gray-200 text-gray-600'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {count}回
    </span>
  )
}

// ── タグバッジ ──────────────────────────────────────

function TagBadge({ tag }: { tag: string }) {
  const isVIP = tag === 'VIP'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      isVIP ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-indigo-50 text-indigo-700'
    }`}>
      {isVIP && '★'}{tag}
    </span>
  )
}

// ── 新規顧客追加モーダル ─────────────────────────────

function AddCustomerModal({
  companyId,
  industry,
  onClose,
  onSaved,
}: {
  companyId: string
  industry: string
  onClose: () => void
  onSaved: (result: SaveCustomerResult & { customerName: string }) => void
}) {
  const [customerName, setCustomerName]   = useState('')
  const [visitCount, setVisitCount]       = useState(1)
  const [selectedTags, setSelectedTags]   = useState<string[]>([])
  const [lastVisitDate, setLastVisitDate] = useState(new Date().toISOString().split('T')[0])
  const [isSaving, setIsSaving]           = useState(false)
  const [saveResult, setSaveResult]       = useState<SaveCustomerResult | null>(null)

  const tagOptions = PREFER_TAG_OPTIONS[industry] ?? PREFER_TAG_OPTIONS['hotel']

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleSave = async () => {
    if (!customerName.trim()) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/customers/save?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, visitCount, preferTags: selectedTags, lastVisitDate }),
      })
      const data = await res.json() as SaveCustomerResult
      setSaveResult(data)
      onSaved({ ...data, customerName })
    } catch {
      setSaveResult(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-500" />
            顧客プロフィールを追加
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!saveResult ? (
          <div className="p-5 space-y-4">
            {/* 顧客名 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">顧客名 *</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="例: 田中 太郎 様"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* 来訪回数 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">来訪回数</label>
              <input
                type="number"
                value={visitCount}
                min={1}
                onChange={e => setVisitCount(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* 最終来訪日 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">最終来訪日</label>
              <input
                type="date"
                value={lastVisitDate}
                onChange={e => setLastVisitDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* 好みタグ */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                好みタグ（複数選択可）
              </label>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                      selectedTags.includes(tag)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 保存ボタン */}
            <button
              onClick={handleSave}
              disabled={isSaving || !customerName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {isSaving ? 'AIがプロファイルを生成中...' : 'AIプロファイルを生成して保存'}
            </button>
          </div>
        ) : (
          /* 保存完了表示 */
          <div className="p-5 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-700 mb-2">✅ 保存完了</p>
              <p className="text-xs text-green-600">{customerName} 様のプロファイルを作成しました。</p>
            </div>

            <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-indigo-600">💡 AIプロファイル</p>
              <p className="text-sm text-gray-800">{saveResult.aiProfile}</p>
            </div>

            <div className="bg-violet-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-violet-600">🎯 次回推奨アクション</p>
              <p className="text-sm text-gray-800">{saveResult.recommend}</p>
            </div>

            {saveResult.notionPageUrl && (
              <a
                href={saveResult.notionPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Notionで確認する
              </a>
            )}

            <button
              onClick={onClose}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────

export default function CustomersPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const company = getCompanyById(companyId)

  const [customers, setCustomers]     = useState<CustomerProfile[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [showModal, setShowModal]     = useState(false)

  // 顧客一覧を取得
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/customers/list?companyId=${companyId}&limit=50`)
      const data = await res.json() as { customers: CustomerProfile[] }
      setCustomers(data.customers ?? [])
      if (data.customers.length > 0 && !selectedId) {
        setSelectedId(data.customers[0].id)
      }
    } catch {
      setCustomers([])
    } finally {
      setIsLoading(false)
    }
  }, [companyId, selectedId])

  useEffect(() => {
    void fetchCustomers()
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = customers.find(c => c.id === selectedId) ?? null

  // 新規顧客追加完了時
  const handleSaved = useCallback(() => {
    setShowModal(false)
    void fetchCustomers()
  }, [fetchCustomers])

  // VIPと高リピーターの集計
  const vipCount     = customers.filter(c => c.preferTags.includes('VIP')).length
  const repeatCount  = customers.filter(c => c.visitCount >= 5).length

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">

      {/* ── ページヘッダー ── */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-800">👤 顧客プロフィール</h2>
          <p className="text-xs text-gray-500 mt-0.5">{company.name} — {customers.length} 名登録</p>
        </div>
        <div className="flex items-center gap-3">
          {/* サマリーバッジ */}
          {vipCount > 0 && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
              ★ VIP {vipCount}名
            </span>
          )}
          {repeatCount > 0 && (
            <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full font-medium">
              🔁 リピーター {repeatCount}名
            </span>
          )}
          {/* 追加ボタン */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            顧客を追加
          </button>
        </div>
      </div>

      {/* ── 2カラムレイアウト ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── 左列: 顧客一覧 ── */}
        <div className="w-72 flex-shrink-0 overflow-y-auto bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-400 animate-pulse">読み込み中...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <User className="w-10 h-10 text-gray-300" />
              <p className="text-sm text-gray-400">顧客プロフィールがありません</p>
              <button
                onClick={() => setShowModal(true)}
                className="text-xs text-indigo-600 hover:underline"
              >
                最初の顧客を追加する
              </button>
            </div>
          ) : customers.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${
                selectedId === c.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  {c.customerName}
                </span>
                <VisitBadge count={c.visitCount} />
              </div>
              {/* タグ（最大3件） */}
              <div className="flex flex-wrap gap-1 mt-1">
                {c.preferTags.slice(0, 3).map(tag => (
                  <TagBadge key={tag} tag={tag} />
                ))}
                {c.preferTags.length > 3 && (
                  <span className="text-xs text-gray-400">+{c.preferTags.length - 3}</span>
                )}
              </div>
              {/* 最終来訪日 */}
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                最終来訪: {formatDate(c.lastVisitDate)}
              </p>
            </button>
          ))}
        </div>

        {/* ── 右列: 顧客詳細 ── */}
        {selected ? (
          <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 p-6 space-y-5">

            {/* 顧客ヘッダー */}
            <div className="pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-400" />
                  {selected.customerName}
                </h3>
                {selected.notionUrl && (
                  <a
                    href={selected.notionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Notionで編集
                  </a>
                )}
              </div>
              {/* 来訪統計 */}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Repeat2 className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-indigo-600">{selected.visitCount}回</span> 来訪
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  最終来訪: {formatDate(selected.lastVisitDate)}
                </div>
              </div>
            </div>

            {/* 好みタグ */}
            {selected.preferTags.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> 好みタグ
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.preferTags.map(tag => (
                    <TagBadge key={tag} tag={tag} />
                  ))}
                </div>
              </div>
            )}

            {/* AIプロファイル */}
            {selected.aiProfile && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-indigo-600 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> AIプロファイル
                </p>
                <p className="text-sm text-gray-800 leading-relaxed">{selected.aiProfile}</p>
              </div>
            )}

            {/* 次回推奨アクション */}
            {selected.recommend && (
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-violet-600 mb-2">💡 次回来訪時の推奨アクション</p>
                <p className="text-sm text-gray-800 leading-relaxed">{selected.recommend}</p>
              </div>
            )}

            {/* プロファイル未生成の場合 */}
            {!selected.aiProfile && !selected.recommend && (
              <div className="bg-gray-50 rounded-xl p-5 text-center">
                <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  好みタグを追加してNotionで更新すると、<br />
                  AIがプロファイルと推奨アクションを生成します。
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-200">
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <ChevronRight className="w-4 h-4" />
              左の一覧から顧客を選択してください
            </p>
          </div>
        )}
      </div>

      {/* 新規追加モーダル */}
      {showModal && (
        <AddCustomerModal
          companyId={companyId}
          industry={company.industry}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
