'use client'

// =====================================================
//  src/components/layout/Sidebar.tsx
//  左ナビゲーションサイドバー
//
//  ■ セクション構成
//    必須機能          → core グループ（常時展開）
//    AI拡張機能        → ai-basic / ai-specialized / ai-training を1つにまとめてトグル
//      └ 基本AIセット    → ai-basic
//      └ 課題特化型AI   → ai-specialized
//      └ 研修・学習     → ai-training
//    企業別            → company グループ（デフォルト閉じ）
//    管理・設定         → admin グループ（デフォルト閉じ）
// =====================================================

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getFeaturesByGroup, type Feature } from '@/config/features'

// トグル状態の型
type OpenState = {
  aiExt:   boolean
  company: boolean
  admin:   boolean
}

// ──────────────────────────────────────────────────
//  サブグループのラベルとアイテムをまとめたリスト
// ──────────────────────────────────────────────────
const AI_EXT_SECTIONS = [
  { label: '基本AIセット',  items: () => getFeaturesByGroup('ai-basic') },
  { label: '課題特化型AI', items: () => getFeaturesByGroup('ai-specialized') },
  { label: '研修・学習',    items: () => getFeaturesByGroup('ai-training') },
] as const

// ──────────────────────────────────────────────────
//  単一メニュー項目コンポーネント
// ──────────────────────────────────────────────────
function MenuItem({ feature, active }: { feature: Feature; active: boolean }) {
  const Icon = feature.icon
  return (
    <Link
      href={feature.coming ? '#' : feature.href}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? 'bg-indigo-700 text-white font-semibold'
          : feature.coming
            ? 'text-indigo-500 cursor-not-allowed'
            : 'text-indigo-200 hover:bg-indigo-800'
      }`}
      aria-disabled={feature.coming}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{feature.label}</span>
      {feature.coming && (
        <span className="ml-auto text-xs bg-indigo-800 text-indigo-400 px-1.5 py-0.5 rounded">
          準備中
        </span>
      )}
    </Link>
  )
}

// ──────────────────────────────────────────────────
//  セクションヘッダー（折りたたみボタン）
// ──────────────────────────────────────────────────
function SectionToggle({
  label,
  open,
  onToggle,
}: {
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-3 py-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider hover:text-indigo-200 transition-colors"
    >
      <span>{label}</span>
      {open
        ? <ChevronDown className="w-3 h-3" />
        : <ChevronRight className="w-3 h-3" />
      }
    </button>
  )
}

// ──────────────────────────────────────────────────
//  サブグループラベル（AI拡張機能の中の小見出し）
// ──────────────────────────────────────────────────
function SubGroupLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-2 pb-0.5 text-xs text-indigo-500 font-semibold">
      {label}
    </p>
  )
}

// ──────────────────────────────────────────────────
//  メインコンポーネント
// ──────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState<OpenState>({
    aiExt:   false,
    company: false,
    admin:   false,
  })

  const toggle = (key: keyof OpenState) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }))

  // パスが一致するか（?以降のクエリは無視）
  const isActive = (href: string) => pathname === href.split('?')[0]

  const coreItems    = getFeaturesByGroup('core')
  const companyItems = getFeaturesByGroup('company')
  const adminItems   = getFeaturesByGroup('admin')

  return (
    <nav className="w-60 min-h-screen bg-indigo-950 text-white flex flex-col py-4 px-2 gap-0.5 overflow-y-auto">

      {/* ── ロゴ ── */}
      <div className="px-3 pb-4 border-b border-indigo-800 mb-2">
        <span className="text-lg font-bold text-indigo-300">🌿 Coarc</span>
        <p className="text-xs text-indigo-500 mt-0.5">エクセレントサービス基盤</p>
      </div>

      {/* ── 必須機能 ── */}
      <p className="px-3 pt-1 pb-0.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
        必須機能
      </p>
      <div className="flex flex-col gap-0.5 mb-3">
        {coreItems.map(f => (
          <MenuItem key={f.id} feature={f} active={isActive(f.href)} />
        ))}
      </div>

      {/* ── AI拡張機能（3サブグループをまとめてトグル） ── */}
      <div className="border-t border-indigo-800 pt-2 mb-3">
        <SectionToggle
          label="AI拡張機能"
          open={open.aiExt}
          onToggle={() => toggle('aiExt')}
        />
        {open.aiExt && (
          <div className="mt-1">
            {AI_EXT_SECTIONS.map(section => {
              const items = section.items()
              if (items.length === 0) return null
              return (
                <div key={section.label} className="mb-2">
                  <SubGroupLabel label={section.label} />
                  <div className="flex flex-col gap-0.5 pl-2">
                    {items.map(f => (
                      <MenuItem key={f.id} feature={f} active={isActive(f.href)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 企業別 ── */}
      <div className="border-t border-indigo-800 pt-2 mb-3">
        <SectionToggle
          label="企業別"
          open={open.company}
          onToggle={() => toggle('company')}
        />
        {open.company && (
          <div className="flex flex-col gap-0.5 mt-1">
            {companyItems.map(f => (
              <MenuItem key={f.id} feature={f} active={isActive(f.href)} />
            ))}
          </div>
        )}
      </div>

      {/* ── 管理・設定 ── */}
      <div className="border-t border-indigo-800 pt-2">
        <SectionToggle
          label="管理・設定"
          open={open.admin}
          onToggle={() => toggle('admin')}
        />
        {open.admin && (
          <div className="flex flex-col gap-0.5 mt-1">
            {adminItems.map(f => (
              <MenuItem key={f.id} feature={f} active={isActive(f.href)} />
            ))}
          </div>
        )}
      </div>

      {/* ── バージョン ── */}
      <div className="mt-auto pt-4 px-3 border-t border-indigo-800">
        <p className="text-xs text-indigo-600">Coarc Platform v0.1.0</p>
      </div>

    </nav>
  )
}
