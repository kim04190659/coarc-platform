// =====================================================
//  src/config/companies.ts
//  展開済み企業マスタ定義
//
//  ■ このファイルの役割
//    Coarc Platform に展開済み（または準備中）の企業を一元管理する。
//    新しい企業を追加するときは、このファイルに1件追加するだけでよい。
//
//  ■ 企業を追加するときの手順
//    1. ここに Company 型のオブジェクトを追加する
//    2. src/config/company-db-config.ts に企業の Notion DB ID マッピングを追加
//    3. src/config/features.ts に company グループのモジュールを追加
//    4. Notion の「🏢 企業・組織 展開ページ」直下に企業ページを作成
//    5. 共通DBに「企業名」プロパティが設定されていることを確認
//    6. npx tsc --noEmit でエラーがないことを確認してから push
//
//  ■ status の意味
//    'active'  → 本番運用中（セレクターで選択可能）
//    'coming'  → 準備中（グレーアウト表示）
//    'demo'    → デモ専用（選択可能だがデモデータのみ）
//
//  ■ RunWith との対応
//    municipalities.ts → companies.ts
//    Municipality型    → Company型
//    municipalityId    → companyId
// =====================================================

/** 実装済み機能フラグ（セレクターやダッシュボードに表示） */
export type ImplementedFeature = {
  /** 絵文字アイコン */
  emoji: string
  /** 短い機能名（10文字以内推奨） */
  label: string
}

/** 展開済み企業の型定義 */
export type Company = {
  /** 英字ID（クエリパラメータ等に使用。例: 'kitano-resort'） */
  id: string
  /** 表示名（例: '北野リゾートホテル'） */
  name: string
  /** 短縮名（Notion DB フィルタリングに使用。例: '北野リゾート'） */
  shortName: string
  /** 業種フラグ */
  industry: 'hotel' | 'medical' | 'food' | 'retail' | 'it' | 'other'
  /** Notion 上の企業ページID */
  notionPageId: string
  /** テーマカラー（Tailwind クラス名） */
  color: string
  /** 運用状況 */
  status: 'active' | 'coming' | 'demo'
  /** 実装済み機能フラグ（オプション） */
  implementedFeatures?: ImplementedFeature[]
}

/**
 * 展開済み企業の一覧
 * 先頭の企業がデフォルト選択になる。
 */
export const COMPANIES: Company[] = [
  {
    id:           'kitano-resort',
    name:         '北野リゾートホテル',
    shortName:    '北野リゾート',
    industry:     'hotel',
    notionPageId: '355960a91e23810fb38fe9221ae8ea71',  // Notion Coarcページ
    color:        'indigo',
    status:       'demo',
    implementedFeatures: [
      { emoji: '⭐', label: '顧客満足AI' },
      { emoji: '👥', label: 'スタッフ管理' },
      { emoji: '📊', label: 'KPIダッシュボード' },
      { emoji: '🤖', label: 'AI経営顧問' },
    ],
  },
  {
    id:           'sakura-medical',
    name:         'さくら医療グループ',
    shortName:    'さくら医療',
    industry:     'medical',
    notionPageId: '355960a91e238115a0b4feeae1a9bc32',
    color:        'rose',
    status:       'demo',
    implementedFeatures: [
      { emoji: '📊', label: '患者満足度AI' },
      { emoji: '📅', label: '予約最適化AI' },
      { emoji: '👥', label: 'スタッフWell-Being' },
      { emoji: '🤖', label: 'AI経営顧問' },
    ],
  },
  {
    id:           'mensho-food',
    name:         '麺屋フードチェーン',
    shortName:    '麺屋フード',
    industry:     'food',
    notionPageId: '355960a91e2381bd8b91f3edff9c9dc5',
    color:        'amber',
    status:       'demo',
    implementedFeatures: [
      { emoji: '🍽️', label: '顧客フィードバックAI' },
      { emoji: '🏢', label: '店舗品質標準化' },
      { emoji: '👥', label: 'シフト最適化' },
    ],
  },
  {
    id:           'hanamaru-store',
    name:         'ハナマルストア',
    shortName:    'ハナマル',
    industry:     'retail',
    notionPageId: '355960a91e2381f997f5ccd8ddd1c7db',
    color:        'green',
    status:       'demo',
    implementedFeatures: [
      { emoji: '🛒', label: '購買予測AI' },
      { emoji: '💬', label: 'CS対応改善' },
      { emoji: '📚', label: 'ナレッジ統一' },
    ],
  },
]

/** デフォルト企業（一覧の先頭） */
export const DEFAULT_COMPANY = COMPANIES[0]

/**
 * ID で企業を検索する。見つからない場合はデフォルト企業を返す。
 * @param id 英字ID（例: 'kitano-resort'）
 */
export function getCompanyById(id: string): Company {
  return COMPANIES.find(c => c.id === id) ?? DEFAULT_COMPANY
}

/**
 * shortName（Notion の「企業名」プロパティ値）で企業を検索する。
 * @param shortName 短縮名（例: '北野リゾート'）
 */
export function getCompanyByShortName(shortName: string): Company | undefined {
  return COMPANIES.find(c => c.shortName === shortName)
}
