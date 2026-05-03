// =====================================================
//  src/config/company-db-config.ts
//  企業別 Notion DB ID マッピング
//
//  ■ このファイルの役割
//    各企業が使用する Notion データベースの ID を管理する。
//    新しい企業を追加するときは、companies.ts と合わせてここも更新すること。
//
//  ■ 未設定の場合
//    DB ID が未設定（空文字）の場合は、その機能は「準備中」扱いになる。
// =====================================================

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
    customerFeedbackDbId: '',   // TODO: 北野リゾート展開時に設定
    serviceContactDbId:   '',
    customerProfileDbId:  '',
    staffConditionDbId:   '',
    trainingLogDbId:      '',
    kpiDbId:              '',
    productQualityDbId:   '',
    knowledgeBaseDbId:    '',
    companyProfileDbId:   '',
  },
  'sakura-medical': {
    customerFeedbackDbId: '',   // TODO: さくら医療展開時に設定
    serviceContactDbId:   '',
    customerProfileDbId:  '',
    staffConditionDbId:   '',
    trainingLogDbId:      '',
    kpiDbId:              '',
    productQualityDbId:   '',
    knowledgeBaseDbId:    '',
    companyProfileDbId:   '',
  },
  'mensho-food': {
    customerFeedbackDbId: '',
    serviceContactDbId:   '',
    customerProfileDbId:  '',
    staffConditionDbId:   '',
    trainingLogDbId:      '',
    kpiDbId:              '',
    productQualityDbId:   '',
    knowledgeBaseDbId:    '',
    companyProfileDbId:   '',
  },
  'hanamaru-store': {
    customerFeedbackDbId: '',
    serviceContactDbId:   '',
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
