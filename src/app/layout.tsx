// =====================================================
//  src/app/layout.tsx
//  アプリ全体のルートレイアウト
// =====================================================

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { CompanyProvider } from '@/contexts/CompanyContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Coarc Platform | エクセレントサービス × AI基盤',
  description: '中小規模企業向けAI基盤 — 顧客・社員のWell-Being向上とエクセレントサービス実現',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        {/* CompanyProvider でアプリ全体にマルチテナント状態を提供 */}
        <CompanyProvider>
          {children}
        </CompanyProvider>
      </body>
    </html>
  )
}
