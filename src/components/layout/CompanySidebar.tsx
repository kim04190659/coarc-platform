'use client'
// =====================================================
//  src/components/layout/CompanySidebar.tsx
//  企業別専用サイドバー — Sprint #32
//
//  ■ 役割
//    メニュー設計エージェントで承認したモジュール構成を反映した
//    企業専用のナビゲーションサイドバー。
//    ヒアリング未実施の企業は全モジュールを表示（デフォルト動作）。
//
//  ■ 使用箇所
//    src/app/company/[companyId]/layout.tsx
//
//  ■ データソース
//    src/config/company-menu-config.ts の getCompanyMenuConfig()
// =====================================================

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, ChevronRight, ArrowLeft, BarChart2 } from 'lucide-react'
import {
  getCompanyMenuConfig,
  type CompanyMenuModule,
} from '@/config/company-menu-config'
import { getCompanyById } from '@/config/companies'

// ── グループラベル ─────────────────────────────────────
const GROUP_LABELS: Record<string, string> = {
  'core':           '必須機能',
  'ai-basic':       '基本AIセット',
  'ai-specialized': '課題特化型AI',
  'ai-training':    '研修・学習',
}

// ── 単一モジュールリンク ───────────────────────────────
function ModuleLink({ module, active }: { module: CompanyMenuModule; active: boolean }) {
  const Icon = module.icon
  return (
    <Link
      href={module.href}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? 'bg-indigo-700 text-white font-semibold'
          : 'text-indigo-200 hover:bg-indigo-800'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{module.label}</span>
    </Link>
  )
}

// ── メインコンポーネント ──────────────────────────────
export default function CompanySidebar({ companyId }: { companyId: string }) {
  const pathname = usePathname()
  const config   = getCompanyMenuConfig(companyId)
  const company  = getCompanyById(companyId)

  // AI拡張機能セクションのトグル状態
  const [aiOpen, setAiOpen] = useState(false)

  // パスが一致するか（クエリは無視）
  const isActive = (href: string) => pathname === href.split('?')[0]

  // 有効モジュールをグループ別に分類
  const coreModules    = config.modules.filter(m => m.enabled && m.group === 'core')
  const aiBasicMods    = config.modules.filter(m => m.enabled && m.group === 'ai-basic')
  const aiSpecMods     = config.modules.filter(m => m.enabled && m.group === 'ai-specialized')
  const aiTrainMods    = config.modules.filter(m => m.enabled && m.group === 'ai-training')

  // AI拡張機能セクション全体が空かどうか
  const hasAiExt = aiBasicMods.length > 0 || aiSpecMods.length > 0 || aiTrainMods.length > 0

  // 有効モジュール合計数
  const totalEnabled = coreModules.length + aiBasicMods.length + aiSpecMods.length + aiTrainMods.length

  return (
    <nav className="w-60 min-h-screen bg-indigo-950 text-white flex flex-col py-4 px-2 gap-0.5 overflow-y-auto">

      {/* ── ロゴ + 企業名 ── */}
      <div className="px-3 pb-4 border-b border-indigo-800 mb-2">
        {/* 管理画面に戻るリンク */}
        <Link
          href="/management/dashboard"
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-200 mb-3 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          管理画面に戻る
        </Link>
        <span className="text-sm font-bold text-indigo-300">🌿 Coarc</span>
        <p className="text-sm font-bold text-white mt-0.5">{company.name}</p>
        <p className="text-xs text-indigo-500 mt-0.5">
          {config.hearingCompletedAt
            ? `AI承認済み · ${totalEnabled}機能有効`
            : `全機能表示中（ヒアリング未実施）`}
        </p>
      </div>

      {/* ── 企業ダッシュボード + 業種別KPI（固定リンク） ── */}
      <div className="mb-1 flex flex-col gap-0.5">
        {/* 企業ダッシュボード */}
        <Link
          href={`/company/${companyId}`}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname === `/company/${companyId}`
              ? 'bg-indigo-700 text-white font-semibold'
              : 'text-indigo-200 hover:bg-indigo-800'
          }`}
        >
          🏠 企業ダッシュボード
        </Link>

        {/* 業種別KPI — Sprint #33〜#36 で追加（全企業共通の固定リンク） */}
        <Link
          href={`/company/${companyId}/industry-kpi`}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname === `/company/${companyId}/industry-kpi`
              ? 'bg-indigo-700 text-white font-semibold'
              : 'text-indigo-200 hover:bg-indigo-800'
          }`}
        >
          <BarChart2 className="w-4 h-4 shrink-0" />
          業種別KPI
        </Link>
      </div>

      {/* ── 必須機能 ── */}
      {coreModules.length > 0 && (
        <>
          <p className="px-3 pt-2 pb-0.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
            {GROUP_LABELS['core']}
          </p>
          <div className="flex flex-col gap-0.5 mb-3">
            {coreModules.map(m => (
              <ModuleLink key={m.id} module={m} active={isActive(m.href)} />
            ))}
          </div>
        </>
      )}

      {/* ── AI拡張機能（トグル） ── */}
      {hasAiExt && (
        <div className="border-t border-indigo-800 pt-2 mb-3">
          <button
            onClick={() => setAiOpen(v => !v)}
            className="flex items-center justify-between w-full px-3 py-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider hover:text-indigo-200 transition-colors"
          >
            <span>AI拡張機能</span>
            {aiOpen
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />
            }
          </button>

          {aiOpen && (
            <div className="mt-1">
              {/* 基本AIセット */}
              {aiBasicMods.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 pt-2 pb-0.5 text-xs text-indigo-500 font-semibold">
                    {GROUP_LABELS['ai-basic']}
                  </p>
                  <div className="flex flex-col gap-0.5 pl-2">
                    {aiBasicMods.map(m => (
                      <ModuleLink key={m.id} module={m} active={isActive(m.href)} />
                    ))}
                  </div>
                </div>
              )}
              {/* 課題特化型AI */}
              {aiSpecMods.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 pt-2 pb-0.5 text-xs text-indigo-500 font-semibold">
                    {GROUP_LABELS['ai-specialized']}
                  </p>
                  <div className="flex flex-col gap-0.5 pl-2">
                    {aiSpecMods.map(m => (
                      <ModuleLink key={m.id} module={m} active={isActive(m.href)} />
                    ))}
                  </div>
                </div>
              )}
              {/* 研修・学習 */}
              {aiTrainMods.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 pt-2 pb-0.5 text-xs text-indigo-500 font-semibold">
                    {GROUP_LABELS['ai-training']}
                  </p>
                  <div className="flex flex-col gap-0.5 pl-2">
                    {aiTrainMods.map(m => (
                      <ModuleLink key={m.id} module={m} active={isActive(m.href)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── フッター ── */}
      <div className="mt-auto pt-4 px-3 border-t border-indigo-800">
        <p className="text-xs text-indigo-600">Coarc Platform v0.1.0</p>
      </div>
    </nav>
  )
}
