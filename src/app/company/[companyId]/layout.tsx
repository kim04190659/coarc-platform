'use client'
// =====================================================
//  src/app/company/[companyId]/layout.tsx
//  企業別専用レイアウト — Sprint #32
//
//  ■ このレイアウトが適用されるページ
//    /company/[companyId]/*
//
//  ■ 特徴
//    - 汎用の Sidebar の代わりに CompanySidebar を使用
//    - CompanySidebar は company-menu-config の承認済みモジュールだけを表示
//    - (dashboard) レイアウトとは独立しているためサイドバー二重化なし
//    - ルートレイアウトの CompanyProvider は引き継がれる
// =====================================================

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import CompanySidebar from '@/components/layout/CompanySidebar'
import ChatPanel from '@/components/layout/ChatPanel'
import { getCompanyById } from '@/config/companies'

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // URL パラメータから企業IDを取得
  const { companyId } = useParams<{ companyId: string }>()
  const company = getCompanyById(companyId)

  // ChatPanel の開閉状態
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── 企業専用サイドバー ── */}
      <CompanySidebar companyId={companyId} />

      {/* ── メインコンテンツ ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── ヘッダー ── */}
        <header className="bg-indigo-900 text-white px-6 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-indigo-100">🌿 Coarc</span>
            <span className="text-indigo-500 text-sm">|</span>
            {/* 業種絵文字 */}
            <span className="text-sm">
              {company.industry === 'hotel'   && '🏨'}
              {company.industry === 'medical' && '🏥'}
              {company.industry === 'food'    && '🍽️'}
              {company.industry === 'retail'  && '🛒'}
            </span>
            <span className="text-base font-semibold text-white">{company.name}</span>
          </div>
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
        </header>

        {/* ── ページコンテンツ + ChatPanel ── */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
          <ChatPanel
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
          />
        </div>

      </div>
    </div>
  )
}
