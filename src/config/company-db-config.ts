// =====================================================
//  src/config/company-db-config.ts
//  Notion DB ID マッピング（共通DB・企業別DB）
//
//  ■ 2種類のDB設計
//
//  【共通DB（SHARED_NOTION_DBS）】
//    全企業が同一のNotionDBを使用する。
//    「企業名」プロパティで各社のデータを分離するマルチテナント方式。
//    RunWithの「NOTION_HEARING_DB_ID」と同じ設計。
//    → 新機能を追加したら、まずここにDBを作成してIDを登録する。
//
//  【企業別DB（COMPANY_DB_CONFIG）】
//    企業ごとに専用DBを持つ場合のマッピング。
//    企業固有の業種特化機能（ホテルの客室管理、医療の予約管理など）で使用。
//    現時点ではすべて空（未設定）。
//
//  ■ DB追加手順（共通DB）
//    1. Notionの「🔧 標準基盤 > 💾 標準DB」配下にDBを作成
//    2. SHARED_NOTION_DBS にDBのIDを追記
//    3. 対応するAPIルートで SHARED_NOTION_DBS[xxx] を参照
//    4. CLAUDE.md の「Notion共通DB一覧」テーブルも更新する
// =====================================================

// ──────────────────────────────────────────────────
//  全企業共通 Notion DB ID
//  （企業名プロパティでフィルタリングして使用する）
// ──────────────────────────────────────────────────
export const SHARED_NOTION_DBS = {
  /**
   * 💬 問い合わせ管理DB（ServiceContact）
   * Notion: 🔧 標準基盤 > 💬 問い合わせ管理DB | ServiceContact
   * URL: https://www.notion.so/a54a964325924e8a8282201799f64092
   *
   * プロパティ: 件名/企業名/ステータス/優先度/カテゴリ/チャネル/
   *             受付日時/顧客名/担当者/問い合わせID/問い合わせ内容/AI下書き/対応メモ
   */
  contacts: 'a54a964325924e8a8282201799f64092',

  // 今後追加予定
  // customerFeedback: '',  // 顧客フィードバックDB
  // staffCondition:   '',  // 社員コンディションDB
  // kpi:              '',  // KPI DB
  // knowledgeBase:    '',  // ナレッジベースDB
  // trainingLog:      '',  // 研修ログDB
} as const

export type CompanyDbConfig = {
  /** 顧客フィードバック DB */
  customerFeedbackDbId: string
  /** 顧客接点（問い合わせ）DB */
  serviceContactDbId: string
  /** 顧客プロファイル DB */
  customerProfileDbId: string
  /** 社員コンディション DB */
  staffConditionDbId: string
  /** 研修ログ DB */
  trainingLogDbId: string
  /** KPI DB */
  kpiDbId: string
  /** 製品・サービス品質 DB */
  productQualityDbId: string
  /** ナレッジベース DB */
  knowledgeBaseDbId: string
  /** 企業プロファイル DB（AI顧問カスタマイズ用） */
  companyProfileDbId: string
}

/**
 * 企業ID → Notion DB ID マッピング
 * 実際の Notion DB ID は企業展開後にここへ登録する。
 */
export const COMPANY_DB_CONFIG: Record<string, CompanyDbConfig> = {
  'kitano-resort': {
    // 💬 顧客フィードバックDB — 北野リゾートホテル専用
    // Notion: 🏨 北野リゾートホテル Coarc > 💬 顧客フィードバックDB
    customerFeedbackDbId: 'f267462f4b104a0690e2d310353b30d8',
    // 💬 問い合わせ管理DB — 北野リゾートホテル専用
    // Notion: 🏨 北野リゾートホテル Coarc > 💬 問い合わせ管理DB
    serviceContactDbId:   'f049100f0ef842be818fdb28cdc6bf68',
    customerProfileDbId:  '',
    staffConditionDbId:   '',
    trainingLogDbId:      '',
    kpiDbId:              '',
    productQualityDbId:   '',
    knowledgeBaseDbId:    '',
    companyProfileDbId:   '',
  },
  'sakura-medical': {
    // 💬 顧客フィードバックDB — さくら医療グループ専用
    // Notion: 🏥 さくら医療グループ Coarc > 💬 顧客フィードバックDB
    customerFeedbackDbId: '7a4444ffa8c34e3f866aedecfcb2c95a',
    // 💬 問い合わせ管理DB — さくら医療グループ専用
    // Notion: 🏥 さくら医療グループ Coarc > 💬 問い合わせ管理DB
    serviceContactDbId:   'd4507f62e1b4477a9b22fc8e48d50d48',
    customerProfileDbId:  '',
    staffConditionDbId:   '',
    trainingLogDbId:      '',
    kpiDbId:              '',
    productQualityDbId:   '',
    knowledgeBaseDbId:    '',
    companyProfileDbId:   '',
  },
  'mensho-food': {
    // 💬 顧客フィードバックDB — 麺屋フードチェーン専用
    // Notion: 🍽️ 麺屋フードチェーン Coarc > 💬 顧客フィードバックDB
    customerFeedbackDbId: '30b8a58e10d34cfbb33cd3cabb3f953b',
    // 💬 問い合わせ管理DB — 麺屋フードチェーン専用
    // Notion: 🍽️ 麺屋フードチェーン Coarc > 💬 問い合わせ管理DB
    serviceContactDbId:   '04c998d12c774d9a810d8ea18f9e1816',
    customerProfileDbId:  '',
    staffConditionDbId:   '',
    trainingLogDbId:      '',
    kpiDbId:              '',
    productQualityDbId:   '',
    knowledgeBaseDbId:    '',
    companyProfileDbId:   '',
  },
  'hanamaru-store': {
    // 💬 顧客フィードバックDB — ハナマルストア専用
    // Notion: 🛒 ハナマルストア Coarc > 💬 顧客フィードバックDB
    customerFeedbackDbId: 'eb5db63ce8784d71b33888a244fd86b7',
    // 💬 問い合わせ管理DB — ハナマルストア専用
    // Notion: 🛒 ハナマルストア Coarc > 💬 問い合わせ管理DB
    serviceContactDbId:   'fd2bd7550a95416fa4f2d609333ebea2',
    customerProfileDbId:  '',
    staffConditionDbId:   '',
    trainingLogDbId:      '',
    kpiDbId:              '',
    productQualityDbId:   '',
    knowledgeBaseDbId:    '',
    companyProfileDbId:   '',
  },
}

/**
 * 企業ID に対応する DB 設定を取得する。
 * 未設定の場合はすべて空文字の設定を返す。
 */
export function getCompanyDbConfig(companyId: string): CompanyDbConfig {
  return COMPANY_DB_CONFIG[companyId] ?? {
    customerFeedbackDbId: '',
    serviceContactDbId:   '',
    customerProfileDbId:  '',
    staffConditionDbId:   '',
    trainingLogDbId:      '',
    kpiDbId:              '',
    productQualityDbId:   '',
    knowledgeBaseDbId:    '',
    companyProfileDbId:   '',
  }
}
