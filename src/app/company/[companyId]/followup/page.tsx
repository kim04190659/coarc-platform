'use client'
// =====================================================
//  src/app/company/[companyId]/followup/page.tsx
//  再来店フォローアップ管理ページ — Sprint #42
//
//  ■ 役割
//    一定期間来訪していない顧客を検出し、
//    AIが生成した個別メッセージをスタッフがコピー・活用できるページ。
//
//  ■ 経過日数の色分け
//    30日以上 → 赤（至急）
//    14〜29日 → 黄（要対応）
//    7〜13日  → 青（確認）
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  HeartHandshake,
  RefreshCw,
  Copy,
  CheckCheck,
  Clock,
  User,
  Tag,
  CalendarDays,
  ChevronDown,
} from 'lucide-react'
import type { FollowUpCustomer } from '@/app/api/customers/followup/route'

// ── 経過日数のラベル・色定義 ─────────────────────────

function UrgencyBadge({ days }: { days: number }) {
  if (days >= 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
        <Clock className="w-3 h-3" />
        {days}日未来訪（至急）
      </span>
    )
  }
  if (days >= 14) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
        <Clock className="w-3 h-3" />
        {days}日未来訪
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
      <Clock className="w-3 h-3" />
      {days}日未来訪
    </span>
  )
}

// ── カードの左ボーダー色 ──────────────────────────────

function urgencyBorderColor(days: number): string {
  if (days >= 30) return 'border-l-red-400'
  if (days >= 14) return 'border-l-amber-400'
  return 'border-l-blue-400'
}

// ── 閾値の選択肢 ─────────────────────────────────────

const THRESHOLD_OPTIONS = [
  { label: '7日以上', value: 7 },
  { label: '14日以上（推奨）', value: 14 },
  { label: '30日以上', value: 30 },
]

// ── メインコンポーネント ──────────────────────────────

export default function FollowUpPage() {
  const { companyId } = useParams<{ companyId: string }>()

  const [customers, setCustomers]     = useState<FollowUpCustomer[]>([])
  const [isLoading, setIsLoading]     = useState(false)
  const [threshold, setThreshold]     = useState(14)
  const [copiedId, setCopiedId]       = useState<string | null>(null)
  const [doneIds, setDoneIds]         = useState<Set<string>>(new Set())
  const [showThresholdMenu, setShowThresholdMenu] = useState(false)

  // ── フォローアップ顧客を取得 ──────────────────────
  const fetchFollowUps = useCallback(async () => {
    setIsLoading(true)
    setCustomers([])
    try {
      const res = await fetch(
        `/api/customers/followup?companyId=${companyId}&days=${threshold}`
      )
      const data = await res.json() as { customers: FollowUpCustomer[] }
      setCustomers(data.customers ?? [])
    } catch (err) {
      console.error('フォローアップ取得エラー:', err)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, threshold])

  // 初回・companyId・閾値変更時にデータ取得
  useEffect(() => {
    fetchFollowUps()
  }, [fetchFollowUps])

  // ── メッセージコピー ──────────────────────────────
  const handleCopy = async (customer: FollowUpCustomer) => {
    await navigator.clipboard.writeText(customer.aiMessage)
    setCopiedId(customer.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── フォローアップ済みトグル ──────────────────────
  const toggleDone = (id: string) => {
    setDoneIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── 統計 ─────────────────────────────────────────
  const urgentCount = customers.filter(c => c.daysSinceVisit >= 30).length
  const totalCount  = customers.length
  const doneCount   = doneIds.size

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <HeartHandshake className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">再来店フォローアップ</h1>
            <p className="text-sm text-gray-500">来訪が途絶えた顧客へのAI個別メッセージ</p>
          </div>
        </div>

        {/* 閾値セレクター + 更新ボタン */}
        <div className="flex items-center gap-2">
          {/* 閾値ドロップダウン */}
          <div className="relative">
            <button
              onClick={() => setShowThresholdMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              {THRESHOLD_OPTIONS.find(o => o.value === threshold)?.label ?? `${threshold}日以上`}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {showThresholdMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-40">
                {THRESHOLD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setThreshold(opt.value); setShowThresholdMenu(false) }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      threshold === opt.value ? 'font-semibold text-rose-600' : 'text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 再取得ボタン */}
          <button
            onClick={fetchFollowUps}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? '取得中...' : '更新'}
          </button>
        </div>
      </div>

      {/* ── サマリーバー ── */}
      {!isLoading && (
        <div className="flex gap-4 mb-5">
          <div className="flex-1 bg-rose-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-rose-700">{totalCount}</p>
            <p className="text-xs text-rose-500 mt-0.5">要フォローアップ</p>
          </div>
          <div className="flex-1 bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{urgentCount}</p>
            <p className="text-xs text-red-500 mt-0.5">至急（30日以上）</p>
          </div>
          <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{doneCount}</p>
            <p className="text-xs text-green-500 mt-0.5">対応済み（今セッション）</p>
          </div>
        </div>
      )}

      {/* ── ローディング ── */}
      {isLoading && (
        <div className="text-center py-16 text-gray-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-rose-400" />
          <p className="text-sm">フォローアップ顧客を分析中...</p>
          <p className="text-xs text-gray-400 mt-1">AIがメッセージを生成しています</p>
        </div>
      )}

      {/* ── 対象なし ── */}
      {!isLoading && customers.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <HeartHandshake className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">フォローアップ対象の顧客はいません</p>
          <p className="text-xs mt-1">全顧客が {threshold} 日以内に来訪しています</p>
        </div>
      )}

      {/* ── 顧客カードリスト ── */}
      <div className="flex flex-col gap-3">
        {customers.map(customer => {
          const isDone   = doneIds.has(customer.id)
          const isCopied = copiedId === customer.id
          return (
            <div
              key={customer.id}
              className={`border-l-4 ${urgencyBorderColor(customer.daysSinceVisit)} bg-white rounded-lg shadow-sm p-4 transition-all ${
                isDone ? 'opacity-50' : ''
              }`}
            >
              {/* 顧客名 + 経過日数バッジ */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-bold text-gray-800">{customer.customerName}</span>
                  <span className="text-xs text-gray-500">（{customer.visitCount}回来訪）</span>
                </div>
                <UrgencyBadge days={customer.daysSinceVisit} />
              </div>

              {/* 最終来訪日 */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                <CalendarDays className="w-3.5 h-3.5" />
                最終来訪: {customer.lastVisitDate || '未記録'}
              </div>

              {/* 好みタグ */}
              {customer.preferTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                  {customer.preferTags.map(tag => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* AIメッセージ */}
              <div className="bg-rose-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-rose-500 font-semibold mb-1">✨ AI推奨フォローアップメッセージ</p>
                <p className="text-sm text-gray-800 leading-relaxed">{customer.aiMessage}</p>
              </div>

              {/* アクションボタン */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(customer)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors"
                >
                  {isCopied
                    ? <><CheckCheck className="w-3.5 h-3.5" />コピー済み</>
                    : <><Copy className="w-3.5 h-3.5" />メッセージをコピー</>
                  }
                </button>
                <button
                  onClick={() => toggleDone(customer.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    isDone
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {isDone ? '対応済み ✓' : '対応済みにする'}
                </button>
                {customer.notionUrl && (
                  <a
                    href={customer.notionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-indigo-500 hover:underline"
                  >
                    Notionで開く
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
