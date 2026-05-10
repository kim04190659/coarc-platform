'use client'
// =====================================================
//  src/app/company/[companyId]/page.tsx
//  企業別ダッシュボード — Sprint #32
//
//  ■ 役割
//    メニュー設計エージェントで承認した AI 機能メニューを
//    カード形式で一覧表示する企業向けポータルトップ。
//
//  ■ 表示内容
//    - 企業名・業種・ヒアリングステータス
//    - 有効化モジュールをグループ別カードで表示
//    - 各カードは該当機能ページへのリンク
// =====================================================

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Wand2 } from 'lucide-react'
import { getCompanyById } from '@/config/companies'
import { getCompanyMenuConfig, getEnabledModules } from '@/config/company-menu-config'

// ── 業種表示名マップ ──────────────────────────────────
const INDUSTRY_LABELS: Record<string, string> = {
  hotel:   'ホテル・リゾート業',
  medical: '医療・福祉業',
  food:    '飲食業',
  retail:  '小売業',
  it:      'IT・テクノロジー業',
  other:   'その他',
}

// ── グループ定義 ─────────────────────────────────────
const GROUPS = [
  { key: 'core',           label: '必須機能',         color: 'indigo' },
  { key: 'ai-basic',       label: 'AI拡張 › 基本AIセット',  color: 'violet' },
  { key: 'ai-specialized', label: 'AI拡張 › 課題特化型AI', color: 'rose' },
  { key: 'ai-training',    label: 'AI拡張 › 研修・学習',   color: 'amber' },
] as const

// ── カラーマップ ──────────────────────────────────────
const CARD_COLORS: Record<string, string> = {
  indigo: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100',
  violet: 'bg-violet-50 border-violet-200 hover:border-violet-400 hover:bg-violet-100',
  rose:   'bg-rose-50   border-rose-200   hover:border-rose-400   hover:bg-rose-100',
  amber:  'bg-amber-50  border-amber-200  hover:border-amber-400  hover:bg-amber-100',
}
const ICON_COLORS: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-600',
  violet: 'bg-violet-100 text-violet-600',
  rose:   'bg-rose-100   text-rose-600',
  amber:  'bg-amber-100  text-amber-600',
}
const LABEL_COLORS: Record<string, string> = {
  indigo: 'text-indigo-500',
  violet: 'text-violet-500',
  rose:   'text-rose-500',
  amber:  'text-amber-500',
}

// =====================================================
//  メインコンポーネント
// =====================================================

export default function CompanyPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const company       = getCompanyById(companyId)
  const config        = getCompanyMenuConfig(companyId)
  const allEnabled    = getEnabledModules(companyId)

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── 企業ヘッダー ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          {company.industry === 'hotel'   && '🏨'}
          {company.industry === 'medical' && '🏥'}
          {company.industry === 'food'    && '🍽️'}
          {company.industry === 'retail'  && '🛒'}
          {company.name}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {INDUSTRY_LABELS[company.industry] ?? 'サービス業'}
        </p>
      </div>

      {/* ── ヒアリングステータスバナー ── */}
      {config.hearingCompletedAt ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              AI メニュー設計が完了しています
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              有効化モジュール: {allEnabled.length} / 18 件
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">
              ヒアリング未実施 — 全機能を表示しています
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              メニュー設計エージェントでヒアリングを行うと、
              最適な機能セットに絞り込めます。
            </p>
          </div>
          <Link
            href="/admin/menu-design-agent"
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0"
          >
            <Wand2 className="w-3.5 h-3.5" />
            ヒアリングを開始
          </Link>
        </div>
      )}

      {/* ── グループ別モジュールカード ── */}
      {GROUPS.map(group => {
        const modules = allEnabled.filter(m => m.group === group.key)
        if (modules.length === 0) return null

        return (
          <div key={group.key}>
            {/* グループヘッダー */}
            <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${LABEL_COLORS[group.color]}`}>
              {group.label}
            </h2>

            {/* モジュールカードグリッド */}
            <div className="grid grid-cols-2 gap-3">
              {modules.map(mod => {
                const Icon = mod.icon
                return (
                  <Link
                    key={mod.id}
                    href={mod.href}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all group ${CARD_COLORS[group.color]}`}
                  >
                    {/* アイコン */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${ICON_COLORS[group.color]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {/* ラベル */}
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 leading-tight">
                      {mod.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}

    </div>
  )
}
