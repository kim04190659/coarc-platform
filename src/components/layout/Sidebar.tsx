'use client'

// =====================================================
//  src/components/layout/Sidebar.tsx
//  左ナビゲーションサイドバー
//
//  ■ グループ構成
//    core    → 常時展開
//    company → デフォルト閉じ
//    admin   → デフォルト閉じ
// =====================================================

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getFeaturesByGroup } from '@/config/features'

type GroupState = { company: boolean; admin: boolean }

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState<GroupState>({ company: false, admin: false })

  const coreItems    = getFeaturesByGroup('core')
  const companyItems = getFeaturesByGroup('company')
  const adminItems   = getFeaturesByGroup('admin')

  const toggle = (key: keyof GroupState) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }))

  const isActive = (href: string) => pathname === href.split('?')[0]

  return (
    <nav className="w-56 min-h-screen bg-indigo-950 text-white flex flex-col py-4 px-2 gap-1">
      {/* ロゴ */}
      <div className="px-3 pb-4 border-b border-indigo-800">
        <span className="text-lg font-bold text-indigo-300">🌿 Coarc</span>
        <p className="text-xs text-indigo-500 mt-0.5">エクセレントサービス基盤</p>
      </div>

      {/* core グループ */}
      <div className="mt-3 flex flex-col gap-0.5">
        {coreItems.map(f => {
          const Icon = f.icon
          return (
            <Link
              key={f.id}
              href={f.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(f.href)
                  ? 'bg-indigo-700 text-white font-semibold'
                  : 'text-indigo-200 hover:bg-indigo-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {f.label}
            </Link>
          )
        })}
      </div>

      {/* company グループ */}
      <div className="mt-4">
        <button
          onClick={() => toggle('company')}
          className="flex items-center justify-between w-full px-3 py-1.5 text-xs text-indigo-400 font-semibold uppercase tracking-wider hover:text-indigo-200"
        >
          <span>企業別</span>
          {open.company ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {open.company && (
          <div className="flex flex-col gap-0.5 mt-1">
            {companyItems.map(f => {
              const Icon = f.icon
              return (
                <Link
                  key={f.id}
                  href={f.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-indigo-300 hover:bg-indigo-800 transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {f.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* admin グループ */}
      <div className="mt-2">
        <button
          onClick={() => toggle('admin')}
          className="flex items-center justify-between w-full px-3 py-1.5 text-xs text-indigo-400 font-semibold uppercase tracking-wider hover:text-indigo-200"
        >
          <span>管理</span>
          {open.admin ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {open.admin && (
          <div className="flex flex-col gap-0.5 mt-1">
            {adminItems.map(f => {
              const Icon = f.icon
              return (
                <Link
                  key={f.id}
                  href={f.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-indigo-300 hover:bg-indigo-800 transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {f.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* バージョン */}
      <div className="mt-auto px-3 pt-4 border-t border-indigo-800">
        <p className="text-xs text-indigo-600">Coarc Platform v0.1.0</p>
      </div>
    </nav>
  )
}
