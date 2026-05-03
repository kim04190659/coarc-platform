'use client'

// =====================================================
//  src/app/(dashboard)/layout.tsx
//  ダッシュボード共通レイアウト（サイドバー + ヘッダー）
//
//  ■ このレイアウトが適用されるページ
//    /management/*, /customer/*, /operations/*, /ai-advisor, /settings/*, /admin/*
// =====================================================

import Sidebar from '@/components/layout/Sidebar'
import CompanySelector from '@/components/layout/CompanySelector'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 左サイドバー */}
      <Sidebar />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col">
        {/* ヘッダー */}
        <header className="bg-indigo-900 text-white px-6 py-3 flex items-center justify-between shadow-md">
          <h1 className="text-base font-semibold text-indigo-100">
            🌿 Coarc Platform
          </h1>
          {/* 企業切り替えセレクター */}
          <CompanySelector />
        </header>

        {/* ページコンテンツ */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
