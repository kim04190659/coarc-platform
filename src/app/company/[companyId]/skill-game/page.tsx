'use client'
// =====================================================
//  src/app/company/[companyId]/skill-game/page.tsx
//  スキル向上ゲーム — 企業別エントリーページ
//
//  ■ 役割
//    企業ポータル内からスキル向上ゲームへのブリッジページ。
//    companyId を保持したまま /skill-game/select に誘導する。
// =====================================================

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Gamepad2, ChevronRight, Trophy, BookOpen, Target } from 'lucide-react'

// ── ゲームカテゴリ紹介 ────────────────────────────────
const GAME_CATEGORIES = [
  {
    emoji:       '🎯',
    title:       'CS対応シミュレーション',
    description: '顧客からのクレーム・問い合わせをロールプレイで体験。最適な対応を学ぶ。',
    badge:       '全6シナリオ',
    color:       'bg-indigo-50 border-indigo-200',
    iconColor:   'bg-indigo-100 text-indigo-600',
  },
  {
    emoji:       '📋',
    title:       'マネジメントクイズ',
    description: '組織運営・人材育成・業績改善に関するシナリオ型クイズで判断力を鍛える。',
    badge:       '全6シナリオ',
    color:       'bg-violet-50 border-violet-200',
    iconColor:   'bg-violet-100 text-violet-600',
  },
]

export default function CompanySkillGamePage() {
  const { companyId } = useParams<{ companyId: string }>()

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── ヘッダー ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          🎮 スキル向上ゲーム
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          AIが採点するインタラクティブ研修。実務スキルをゲーム感覚で強化できます。
        </p>
      </div>

      {/* ── 統計バッジ ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Gamepad2, label: 'ゲーム数',     value: '12本',  color: 'text-indigo-600' },
          { icon: Trophy,   label: '最高スコア',    value: '—',     color: 'text-amber-500' },
          { icon: Target,   label: 'プレイ回数',    value: '—',     color: 'text-emerald-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
            <p className="text-lg font-bold text-gray-800">{stat.value}</p>
            <p className="text-xs text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── カテゴリ紹介 ── */}
      <div className="space-y-3">
        {GAME_CATEGORIES.map((cat, i) => (
          <div key={i} className={`rounded-xl border p-4 ${cat.color}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${cat.iconColor}`}>
                {cat.emoji}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800 text-sm">{cat.title}</h3>
                  <span className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                    {cat.badge}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{cat.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── ゲーム開始ボタン ── */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">ゲームを始める</h3>
            <p className="text-indigo-200 text-sm mt-0.5">
              AI採点で即座にフィードバックを受け取れます
            </p>
          </div>
          <Link
            href="/skill-game/select"
            className="flex items-center gap-1.5 bg-white text-indigo-700 font-semibold
                       px-4 py-2.5 rounded-lg text-sm hover:bg-indigo-50 transition-colors flex-shrink-0"
          >
            ゲーム選択へ
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── 研修ログへの導線 ── */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <BookOpen className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 text-sm text-gray-600">
          プレイ履歴は研修ログに自動記録されます。
        </div>
        <Link
          href={`/company/${companyId}/training`}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0"
        >
          研修ログを見る →
        </Link>
      </div>

    </div>
  )
}
