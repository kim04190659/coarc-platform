'use client'
// =====================================================
//  src/app/company/[companyId]/industry-kpi/page.tsx
//  業種別KPIダッシュボード — Sprint #33〜#36
//
//  ■ 対応企業・業種
//    kitano-resort  → ホテル・リゾート業
//    sakura-medical → 医療・福祉業
//    mensho-food    → 飲食業
//    hanamaru-store → 小売業
//
//  ■ データについて
//    現在はデモ用モックデータを使用。
//    将来的には Notion DB や外部データソースから取得する予定。
//
//  ■ companyId は layout.tsx の useParams から受け取るため
//    この page.tsx は useParams を直接呼ぶ。
// =====================================================

import { useParams } from 'next/navigation'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'

// ── KPI 1件の型定義 ──────────────────────────────────
type KpiItem = {
  /** 指標名 */
  label: string
  /** 現在値（表示文字列） */
  value: string
  /** 前月比テキスト（例: '+2.1%'、'-4分'） */
  change: string
  /** 変化の方向（up=改善 / down=悪化 / neutral=変化なし） */
  trend: 'up' | 'down' | 'neutral'
  /** KPIの説明 */
  description: string
  /** 絵文字アイコン */
  emoji: string
}

// ── アラート・インサイトの型定義 ───────────────────────
type Insight = {
  level: 'good' | 'warning' | 'info'
  text: string
}

// ── 業種別KPIデータ定義 ──────────────────────────────
// =====================================================
//  Sprint #33: 北野リゾートホテル（ホテル・リゾート業）
// =====================================================
const KITANO_KPI: KpiItem[] = [
  {
    label:       '客室稼働率',
    value:       '87.3%',
    change:      '+2.1%',
    trend:       'up',
    description: '全客室に対する稼働割合。目標は85%以上。',
    emoji:       '🏨',
  },
  {
    label:       'RevPAR',
    value:       '¥18,450',
    change:      '+3.8%',
    trend:       'up',
    description: '利用可能客室1室あたりの収益（Revenue Per Available Room）。',
    emoji:       '💰',
  },
  {
    label:       '平均宿泊単価 (ADR)',
    value:       '¥21,120',
    change:      '+1.5%',
    trend:       'up',
    description: '実際に販売された客室の平均単価（Average Daily Rate）。',
    emoji:       '🏷️',
  },
  {
    label:       'NPS（顧客推奨度）',
    value:       '72',
    change:      '+4pt',
    trend:       'up',
    description: '「このホテルを友人に勧めますか？」10段階評価から算出。',
    emoji:       '⭐',
  },
  {
    label:       '今月のゲスト数',
    value:       '3,240 名',
    change:      '+8.2%',
    trend:       'up',
    description: 'チェックイン数の合計（連泊はグループ単位でカウント）。',
    emoji:       '👥',
  },
  {
    label:       'レストラン売上',
    value:       '¥8.2M',
    change:      '+5.4%',
    trend:       'up',
    description: '館内レストラン・ルームサービス合計の月間売上。',
    emoji:       '🍽️',
  },
]
const KITANO_INSIGHTS: Insight[] = [
  { level: 'good',    text: '客室稼働率が目標（85%）を2.3pt上回っています。繁忙期に向けて料金最適化のタイミングです。' },
  { level: 'good',    text: 'NPS 72 は業界平均（約55）を大幅に上回っており、口コミ効果が期待できます。' },
  { level: 'warning', text: 'ビジネス客の平日稼働率が77.1%と伸び悩んでいます。法人プランの見直しを検討してください。' },
  { level: 'info',    text: 'GW期間の予約はすでに93%埋まっています。早期割引の終了を検討しましょう。' },
]

// =====================================================
//  Sprint #34: さくら医療グループ（医療・福祉業）
// =====================================================
const SAKURA_KPI: KpiItem[] = [
  {
    label:       '月間患者数',
    value:       '12,480 名',
    change:      '+3.2%',
    trend:       'up',
    description: '外来・入院合計の月間患者数。',
    emoji:       '🏥',
  },
  {
    label:       '病床稼働率',
    value:       '91.4%',
    change:      '+0.8%',
    trend:       'up',
    description: '全病床に対する平均稼働割合。目標は90%以上。',
    emoji:       '🛏️',
  },
  {
    label:       '患者満足度',
    value:       '4.6 / 5.0',
    change:      '+0.2',
    trend:       'up',
    description: '退院時アンケートによる総合満足度スコア。',
    emoji:       '😊',
  },
  {
    label:       'スタッフ満足度',
    value:       '78%',
    change:      '+5%',
    trend:       'up',
    description: '月次スタッフサーベイの「この職場に満足している」割合。',
    emoji:       '💚',
  },
  {
    label:       '平均待ち時間',
    value:       '18 分',
    change:      '-4分',
    trend:       'up',
    description: '外来受付から診察開始までの平均待機時間。',
    emoji:       '⏱️',
  },
  {
    label:       '外来収益',
    value:       '¥42.3M',
    change:      '+2.1%',
    trend:       'up',
    description: '外来診療・検査・処置の月間合計収益。',
    emoji:       '📊',
  },
]
const SAKURA_INSIGHTS: Insight[] = [
  { level: 'good',    text: '病床稼働率91.4%は目標（90%）を達成。手術室の利用効率改善が貢献しています。' },
  { level: 'good',    text: '待ち時間が先月比4分短縮。予約システムのAI最適化が効果を発揮しています。' },
  { level: 'warning', text: 'スタッフの夜勤負担が高止まりしています。シフト設計の見直しを推奨します。' },
  { level: 'info',    text: '地域連携パス（退院後フォロー）の活用率が62%。目標の75%に向け改善が必要です。' },
]

// =====================================================
//  Sprint #35: 麺屋フードチェーン（飲食業）
// =====================================================
const MENSHO_KPI: KpiItem[] = [
  {
    label:       '全店売上',
    value:       '¥38.7M',
    change:      '+5.6%',
    trend:       'up',
    description: '全12店舗の月間合計売上。',
    emoji:       '🍜',
  },
  {
    label:       '客単価',
    value:       '¥1,240',
    change:      '+80円',
    trend:       'up',
    description: '1名あたりの平均消費金額。サイドメニュー追加が貢献。',
    emoji:       '🏷️',
  },
  {
    label:       '月間来客数',
    value:       '31,210 名',
    change:      '+4.1%',
    trend:       'up',
    description: '全店舗合計の月間来客数。',
    emoji:       '👥',
  },
  {
    label:       'フードロス率',
    value:       '3.2%',
    change:      '-0.8%',
    trend:       'up',
    description: '仕込み食材に対する廃棄割合。目標は3%以下。',
    emoji:       '♻️',
  },
  {
    label:       'リピート率',
    value:       '64.5%',
    change:      '+2.3%',
    trend:       'up',
    description: '同月内に2回以上来店した顧客の割合（LINE会員データ）。',
    emoji:       '🔄',
  },
  {
    label:       '最高売上店舗',
    value:       '渋谷本店',
    change:      '¥5.1M',
    trend:       'neutral',
    description: '今月の売上トップ店舗と売上金額。',
    emoji:       '🏆',
  },
]
const MENSHO_INSIGHTS: Insight[] = [
  { level: 'good',    text: '客単価が前月比+80円。新メニュー「特製つけ麺セット」の注文率が38%と好調です。' },
  { level: 'warning', text: 'フードロス率3.2%は目標（3.0%）をわずかに超過。土日の仕込み量最適化が課題です。' },
  { level: 'good',    text: 'リピート率64.5%はチェーン飲食業の業界平均（約45%）を大きく上回っています。' },
  { level: 'info',    text: '池袋西口店の評価が全店で最低（3.8/5.0）。スタッフ研修とオペレーション見直しを推奨します。' },
]

// =====================================================
//  Sprint #36: ハナマルストア（小売業）
// =====================================================
const HANAMARU_KPI: KpiItem[] = [
  {
    label:       '月間売上高',
    value:       '¥124.5M',
    change:      '+2.8%',
    trend:       'up',
    description: '全店舗合計の月間売上高。',
    emoji:       '🛒',
  },
  {
    label:       '来客数',
    value:       '89,320 名',
    change:      '+1.6%',
    trend:       'up',
    description: '全店舗合計の月間来客数（入店カウント）。',
    emoji:       '👥',
  },
  {
    label:       '客単価',
    value:       '¥1,394',
    change:      '+42円',
    trend:       'up',
    description: '1名あたりの平均購入金額。',
    emoji:       '🏷️',
  },
  {
    label:       '在庫回転率',
    value:       '12.4 回/月',
    change:      '+0.3',
    trend:       'up',
    description: '月間の在庫回転数。高いほど売れ行きが良い。',
    emoji:       '📦',
  },
  {
    label:       'NPS（顧客推奨度）',
    value:       '68',
    change:      '+2pt',
    trend:       'up',
    description: '定期アンケートによる顧客推奨度スコア。',
    emoji:       '⭐',
  },
  {
    label:       '会員カード利用率',
    value:       '73.2%',
    change:      '+1.8%',
    trend:       'up',
    description: '全レジ通過に対するハナマルカード提示の割合。',
    emoji:       '💳',
  },
]
const HANAMARU_INSIGHTS: Insight[] = [
  { level: 'good',    text: '売上高・来客数ともに前月比プラス。季節品コーナーの改装効果が出ています。' },
  { level: 'good',    text: '在庫回転率12.4は目標（12.0）を達成。発注サイクルの短縮化が奏功しています。' },
  { level: 'warning', text: '生鮮食品の廃棄金額が先月比+8%。需要予測モデルの精度向上が必要です。' },
  { level: 'info',    text: '会員限定セールの参加率が58%止まり。プッシュ通知の配信タイミングを最適化しましょう。' },
]

// ── 企業別データマップ ───────────────────────────────
type CompanyKpiData = {
  title:       string
  subtitle:    string
  emoji:       string
  kpis:        KpiItem[]
  insights:    Insight[]
  accentColor: string  // Tailwind カラー名（bg-xxx用）
  period:      string
}

const COMPANY_DATA: Record<string, CompanyKpiData> = {
  'kitano-resort': {
    title:       '北野リゾートホテル',
    subtitle:    'ホテル・リゾート業 KPI',
    emoji:       '🏨',
    kpis:        KITANO_KPI,
    insights:    KITANO_INSIGHTS,
    accentColor: 'indigo',
    period:      '2026年4月度',
  },
  'sakura-medical': {
    title:       'さくら医療グループ',
    subtitle:    '医療・福祉業 KPI',
    emoji:       '🏥',
    kpis:        SAKURA_KPI,
    insights:    SAKURA_INSIGHTS,
    accentColor: 'rose',
    period:      '2026年4月度',
  },
  'mensho-food': {
    title:       '麺屋フードチェーン',
    subtitle:    '飲食業 KPI',
    emoji:       '🍜',
    kpis:        MENSHO_KPI,
    insights:    MENSHO_INSIGHTS,
    accentColor: 'amber',
    period:      '2026年4月度',
  },
  'hanamaru-store': {
    title:       'ハナマルストア',
    subtitle:    '小売業 KPI',
    emoji:       '🛒',
    kpis:        HANAMARU_KPI,
    insights:    HANAMARU_INSIGHTS,
    accentColor: 'green',
    period:      '2026年4月度',
  },
}

// ── カラーマップ ──────────────────────────────────────
const CARD_BG: Record<string, string> = {
  indigo: 'bg-indigo-50 border-indigo-200',
  rose:   'bg-rose-50   border-rose-200',
  amber:  'bg-amber-50  border-amber-200',
  green:  'bg-green-50  border-green-200',
}
const VALUE_COLOR: Record<string, string> = {
  indigo: 'text-indigo-700',
  rose:   'text-rose-700',
  amber:  'text-amber-700',
  green:  'text-green-700',
}
const EMOJI_BG: Record<string, string> = {
  indigo: 'bg-indigo-100',
  rose:   'bg-rose-100',
  amber:  'bg-amber-100',
  green:  'bg-green-100',
}

// ── トレンドアイコン ──────────────────────────────────
function TrendIcon({ trend }: { trend: KpiItem['trend'] }) {
  if (trend === 'up')      return <TrendingUp   className="w-4 h-4 text-emerald-500" />
  if (trend === 'down')    return <TrendingDown  className="w-4 h-4 text-red-400" />
  return                          <Minus         className="w-4 h-4 text-gray-400" />
}

// ── インサイトカラー ──────────────────────────────────
const INSIGHT_STYLE: Record<Insight['level'], string> = {
  good:    'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50   border-amber-200   text-amber-800',
  info:    'bg-blue-50    border-blue-200    text-blue-800',
}
const INSIGHT_ICON: Record<Insight['level'], string> = {
  good:    '✅',
  warning: '⚠️',
  info:    'ℹ️',
}

// =====================================================
//  メインコンポーネント
// =====================================================
export default function IndustryKpiPage() {
  const { companyId } = useParams<{ companyId: string }>()

  // companyId に対応するデータを取得（なければ北野リゾートをデフォルト）
  const data = COMPANY_DATA[companyId] ?? COMPANY_DATA['kitano-resort']
  const color = data.accentColor

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── ページヘッダー ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          {data.emoji} 業種別 KPI ダッシュボード
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {data.subtitle} · {data.period}
          <span className="ml-2 text-xs text-gray-400">（デモデータ）</span>
        </p>
      </div>

      {/* ── KPI カードグリッド ── */}
      <div className="grid grid-cols-2 gap-4">
        {data.kpis.map((kpi, i) => (
          <div
            key={i}
            className={`rounded-xl border p-4 space-y-2 ${CARD_BG[color]}`}
          >
            {/* 絵文字 + ラベル */}
            <div className="flex items-center gap-2">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${EMOJI_BG[color]}`}>
                {kpi.emoji}
              </span>
              <span className="text-xs font-medium text-gray-500">{kpi.label}</span>
            </div>

            {/* 値 */}
            <p className={`text-2xl font-bold ${VALUE_COLOR[color]}`}>
              {kpi.value}
            </p>

            {/* 前月比 + トレンドアイコン */}
            <div className="flex items-center gap-1.5">
              <TrendIcon trend={kpi.trend} />
              <span className="text-xs text-gray-500">
                前月比 <span className="font-semibold">{kpi.change}</span>
              </span>
            </div>

            {/* 説明 */}
            <p className="text-xs text-gray-400 leading-relaxed">
              {kpi.description}
            </p>
          </div>
        ))}
      </div>

      {/* ── AIインサイト ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          📋 AIインサイト · 今月のポイント
        </h2>
        <div className="space-y-2">
          {data.insights.map((ins, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm ${INSIGHT_STYLE[ins.level]}`}
            >
              <span className="text-base flex-shrink-0 mt-0.5">{INSIGHT_ICON[ins.level]}</span>
              <span className="leading-relaxed">{ins.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 注記 ── */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
        <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">
          このページのデータはデモ用のモックデータです。
          実際の運用時は Notion DB または外部データソースと連携します。
        </p>
      </div>

    </div>
  )
}
