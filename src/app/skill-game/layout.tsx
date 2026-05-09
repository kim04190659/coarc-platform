// =====================================================
//  src/app/skill-game/layout.tsx
//  スキル向上ゲーム — レイアウト（Sprint #24）
//
//  ■ ダッシュボードとは独立したフルスクリーンレイアウト
//    - ゲームに集中できるようサイドバーなし
//    - ヘッダーにダッシュボードへの戻るリンクを設置
//    - 落ち着いたネイビーグラデーションでゲーム感を演出
// =====================================================

import Link from 'next/link'
import { Gamepad2, LayoutDashboard } from 'lucide-react'

export default function SkillGameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900">

      {/* ── ヘッダー ── */}
      <header className="border-b border-indigo-800/50 bg-indigo-950/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

          {/* 左：タイトル */}
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="w-5 h-5 text-indigo-300" />
            <span className="text-white font-bold text-sm tracking-wide">
              スキル向上ゲーム
            </span>
            <span className="text-indigo-400 text-xs">by Coarc</span>
          </div>

          {/* 右：ダッシュボードへ戻る */}
          <Link
            href="/management/dashboard"
            className="flex items-center gap-1.5 text-indigo-300 hover:text-white text-xs transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            ダッシュボードへ戻る
          </Link>
        </div>
      </header>

      {/* ── コンテンツ ── */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>

    </div>
  )
}
