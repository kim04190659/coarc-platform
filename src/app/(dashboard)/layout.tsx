'use client'

// =====================================================
//  src/app/(dashboard)/layout.tsx
//  ダッシュボード共通レイアウト（サイドバー + ヘッダー + ChatPanel）
//
//  ■ このレイアウトが適用されるページ
//    /management/*, /customer/*, /operations/*, /ai-advisor, /settings/*, /admin/*
//
//  ■ ChatPanel
//    ヘッダー右上の「AIに質問」ボタンで開閉
//    開いているときは右列にパネルが展開される
// =====================================================

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import CompanySelector from '@/components/layout/CompanySelector'
import ChatPanel from '@/components/layout/ChatPanel'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ChatPanelの開閉状態
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── 左サイドバー ── */}
      <Sidebar />

      {/* ── メインコンテンツ + ChatPanel ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── ヘッダー ── */}
        <header className="bg-indigo-900 text-white px-6 py-3 flex items-center justify-between shadow-md">
          <h1 className="text-base font-semibold text-indigo-100">
            🌿 Coarc Platform
          </h1>
          <div className="flex items-center gap-3">
            {/* 企業切り替えセレクター */}
            <CompanySelector />
            {/* AIアシスタントボタン */}
            <button
              onClick={() => setChatOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                chatOpen
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-800 hover:bg-indigo-700 text-indigo-200'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              AIに質問
            </button>
          </div>
        </header>

        {/* ── ページコンテンツ + ChatPanelの横並び ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ページコンテンツ */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>

          {/* ChatPanel（開いているときのみ表示） */}
          <ChatPanel
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
          />
        </div>

      </div>
    </div>
  )
}
