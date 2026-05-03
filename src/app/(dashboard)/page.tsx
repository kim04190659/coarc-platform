// =====================================================
//  src/app/(dashboard)/page.tsx
//  Coarc Platform トップページ（ウェルカム & サービス説明）
//
//  ■ 概要
//    - 特定企業に依存しない静的なCoarc説明ページ
//    - Coarcとは何か・何ができるかを説明する
//    - サイドバーの各機能へのクイックアクセスも提供
// =====================================================

import Link from 'next/link'

// ──────────────────────────────────────────────────
//  特徴カードのデータ定義
// ──────────────────────────────────────────────────
const FEATURES = [
  {
    emoji: '📊',
    title: 'KPIダッシュボード',
    desc: '顧客満足・社員コンディション・売上を一画面で把握。経営状況をリアルタイムに可視化します。',
    href: '/management/dashboard',
  },
  {
    emoji: '⭐',
    title: '顧客フィードバック管理',
    desc: '顧客の声をAIが自動分類・優先度付け。改善すべき課題を素早く特定できます。',
    href: '/customer/feedback',
  },
  {
    emoji: '📞',
    title: '問い合わせ管理',
    desc: '電話・メール・チャットの問い合わせを一元管理。対応状況の見える化で顧客満足度が向上します。',
    href: '/customer/contacts',
  },
  {
    emoji: '💚',
    title: '社員コンディション',
    desc: '社員のウェルビーイングを定期チェック。早期に課題を発見し、離職リスクを低減します。',
    href: '/operations/staff',
  },
  {
    emoji: '🤖',
    title: 'AI経営顧問',
    desc: 'あなたの会社のデータを学習したAIがいつでも経営相談に応答。意思決定をサポートします。',
    href: '/ai-advisor',
  },
  {
    emoji: '🎮',
    title: 'スキル向上ゲーム',
    desc: 'ゲーム感覚で社員スキルを向上。ロールプレイ形式でCS対応力・業務知識を楽しく鍛えます。',
    href: '/skill-game/select',
  },
]

// ──────────────────────────────────────────────────
//  活用ステップのデータ定義
// ──────────────────────────────────────────────────
const STEPS = [
  {
    step: '01',
    title: 'データを蓄積する',
    desc: '顧客フィードバック・問い合わせ・社員コンディションを日々記録。AIの精度は蓄積量に比例します。',
  },
  {
    step: '02',
    title: 'AIが分析・提言する',
    desc: 'AI経営顧問が蓄積データを解析し、改善提案・リスク警告・売上予測を自動生成します。',
  },
  {
    step: '03',
    title: '現場が行動する',
    desc: '提言をもとに優先度の高いアクションを実行。スキル向上ゲームで社員が自律的に成長します。',
  },
  {
    step: '04',
    title: 'サービスが進化する',
    desc: '顧客・社員・経営のデータが循環し、エクセレントサービスの提供が継続的に実現されます。',
  },
]

// ──────────────────────────────────────────────────
//  メインコンポーネント
// ──────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">

      {/* ── ヒーローセクション ── */}
      <section className="bg-gradient-to-br from-indigo-900 to-indigo-700 text-white rounded-2xl p-8 shadow-lg">
        <div className="flex items-start gap-4">
          <span className="text-5xl">🌿</span>
          <div>
            <h1 className="text-2xl font-bold mb-2">Coarc Platform へようこそ</h1>
            <p className="text-indigo-200 text-base leading-relaxed">
              Coarc（コアーク）は、三百人規模のサービス企業向けに設計された
              <strong className="text-white">生成AI活用基盤</strong>です。
              顧客・社員・経営の三軸をつなぎ、
              <strong className="text-white">エクセレントサービス</strong>の継続的な提供を実現します。
            </p>
          </div>
        </div>
      </section>

      {/* ── Coarcとは ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          🌱 Coarcとは
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>
            Coarc は <strong>「顧客満足」「社員幸福」「経営効率」</strong> の三つを同時に高めることを目指した、
            中規模サービス企業向けの統合AI基盤です。
          </p>
          <p>
            ホテル・医療・飲食・小売など、日常的に多くのお客様と接するサービス業では、
            現場の「声」が膨大に発生します。しかし、その声を収集・分析して経営判断につなげるには
            多大なコストがかかっていました。
          </p>
          <p>
            Coarc は <strong>生成AIの力</strong> でこのプロセスを自動化し、中小規模の企業でも
            大企業と同等の「データドリブン経営」を実現できるようにします。
          </p>
          <div className="bg-indigo-50 rounded-lg p-4 border-l-4 border-indigo-400">
            <p className="font-semibold text-indigo-800 mb-1">Coarcの名前の由来</p>
            <p className="text-indigo-700">
              「Co（協働）」＋「Arc（弧・つながり）」。
              顧客・社員・経営が一つの弧でつながり、互いに高め合う関係を表しています。
            </p>
          </div>
        </div>
      </section>

      {/* ── 主要機能 ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          🚀 主要機能
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <Link
              key={f.href}
              href={f.href}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-300 transition-all group"
            >
              <div className="text-2xl mb-2">{f.emoji}</div>
              <h3 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-indigo-700">
                {f.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 活用ステップ ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          🔄 Coarcの活用サイクル
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map(s => (
            <div key={s.step} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-3xl font-black text-indigo-200 mb-2">{s.step}</div>
              <h3 className="font-semibold text-gray-800 text-sm mb-2">{s.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── フッターメモ ── */}
      <section className="text-center pb-4">
        <p className="text-xs text-gray-400">
          左メニューから各機能にアクセスできます。右上の「AIに質問」ボタンでいつでも使い方を確認できます。
        </p>
      </section>

    </div>
  )
}
