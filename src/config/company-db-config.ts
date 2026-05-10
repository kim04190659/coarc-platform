// =====================================================
//  src/config/company-db-config.ts
//  企業別 Notion DB ID マッピング
//
//  ■ 設計原則（最重要）
//    全DBは企業別。共通DB（SHARED_NOTION_DBS）方式は廃止。
//    企業ごとに独立した Notion DB を持つことで、
//    データ分離・アクセス権限管理・将来の解約処理を実現する。
//
//  ■ SHARED_NOTION_DBS について
//    過去に共通DB方式で作成した DB ID の残骸。
//    現在は全機能を企業別DBに移行済み（Sprint #17 完了）。
//    SHARED_NOTION_DBS は参照禁止。将来削除予定。
//
//  ■ 新機能のDB追加手順
//    1. CompanyDbConfig 型に新しいフィールドを追加
//    2. Notion の各企業ページ配下に DB を作成
//    3. COMPANY_DB_CONFIG の各企業エントリにDB IDを追記
//    4. CLAUDE.md の「DB登録状況」テーブルを更新
//    5. npx tsc --noEmit で確認 → push
// =====================================================

// ──────────────────────────────────────────────────
//  ⚠️ 旧方式（廃止）— 参照禁止
//  以下の定数は Sprint #15 以前の共通DB方式の名残。
//  APIルートから参照してはいけない。将来削除予定。
// ──────────────────────────────────────────────────
/** @deprecated 企業別DB方式に移行済み。参照禁止。 */
export const SHARED_NOTION_DBS = {
  /** @deprecated → 各社 serviceContactDbId を使用 */
  contacts:          'a54a964325924e8a8282201799f64092',
  /** @deprecated → 各社 knowledgeBaseDbId を使用 */
  knowledgeBase:     'bc52a28d7bbc48d986283146dd7adc97',
  /** @deprecated → 各社 kpiGoalsDbId を使用 */
  kpiGoals:          '99fc69ac37064ecebec8e14579bda417',
  /** @deprecated → 各社 staffProfileDbId を使用 */
  staffProfile:      '7a9d0e9e2d1b4d6ab8caef909abb8b1b',
  /** @deprecated → 各社 staffConditionDbId を使用 */
  staffCondition:    '9016c6d2857b4afcb55122d53671445d',
  /** @deprecated → 各社 projectManagementDbId を使用 */
  projectManagement: '74ec2a90d96b4f48966b17ad9b426532',
  /** @deprecated → 各社 projectTaskDbId を使用 */
  projectTask:       '24e522198f9c47c5860707f800d27e60',
} as const

// ──────────────────────────────────────────────────
//  企業別 DB 設定の型定義
//  全フィールド必須。未設定の場合は '' を入れること。
// ──────────────────────────────────────────────────
export type CompanyDbConfig = {
  // ── 顧客管理 ──────────────────────────────────────
  /** 💬 顧客フィードバックDB */
  customerFeedbackDbId: string
  /** 💬 問い合わせ管理DB */
  serviceContactDbId: string
  /** 👤 顧客プロファイルDB（未実装） */
  customerProfileDbId: string

  // ── 社員管理 ──────────────────────────────────────
  /** 👤 社員マスタDB（プロフィール・スキル） */
  staffProfileDbId: string
  /** 💚 社員コンディションDB（Well-Being記録） */
  staffConditionDbId: string
  /** 📚 研修ログDB（未実装） */
  trainingLogDbId: string

  // ── 経営・KPI ─────────────────────────────────────
  /** 📈 KPI目標DB */
  kpiGoalsDbId: string
  /** 🏆 製品・サービス品質DB（未実装） */
  productQualityDbId: string

  // ── ナレッジ ──────────────────────────────────────
  /** 🔍 ナレッジベースDB */
  knowledgeBaseDbId: string

  // ── プロジェクト管理 ──────────────────────────────
  /** 📁 プロジェクト管理DB */
  projectManagementDbId: string
  /** ✅ プロジェクトタスクDB */
  projectTaskDbId: string

  // ── 企業プロファイル ──────────────────────────────
  /** 🏢 企業プロファイルDB（AI顧問カスタマイズ用・未実装） */
  companyProfileDbId: string

  // ── AI ログ ───────────────────────────────────────
  /** 🤖 AI質問ログDB（フリーチャット・各AIページの質問履歴）Sprint #18 登録済み */
  aiChatLogDbId: string

  // ── 感動ログ ──────────────────────────────────────
  /** 💫 感動ログDB（スタッフが顧客との感動の瞬間を記録）Sprint #39 登録済み */
  delightLogDbId: string
}

// ──────────────────────────────────────────────────
//  企業ID → 企業別 Notion DB ID マッピング
//  Sprint #15 で Notion の各企業ページ配下に DB を作成し、
//  ここに ID を登録した。
// ──────────────────────────────────────────────────
export const COMPANY_DB_CONFIG: Record<string, CompanyDbConfig> = {

  // ══════════════════════════════════════════════════
  //  🏨 北野リゾートホテル
  //  Notion: 🏢 企業展開 > 🏨 北野リゾートホテル Coarc
  //  企業ページID: 355960a91e23810fb38fe9221ae8ea71
  // ══════════════════════════════════════════════════
  'kitano-resort': {
    // ── 顧客管理 ──────────────────────────────────────
    customerFeedbackDbId: 'f267462f4b104a0690e2d310353b30d8',
    serviceContactDbId:   'f049100f0ef842be818fdb28cdc6bf68',
    customerProfileDbId:  '',

    // ── 社員管理 ──────────────────────────────────────
    staffProfileDbId:   'fac9284b779942888e892ca49d6b1e42',  // Sprint #15 登録済み
    staffConditionDbId: '999ee8aad7f542fd8cc67cf479430af6',  // Sprint #15 登録済み
    trainingLogDbId:    '1e34a589945a42819bdda1a6f362454c',  // Sprint #28 登録済み

    // ── 経営・KPI ─────────────────────────────────────
    kpiGoalsDbId:       '5651cb54fb6e44a6b3f3fd868a230819',  // Sprint #15 登録済み
    productQualityDbId: '',

    // ── ナレッジ ──────────────────────────────────────
    knowledgeBaseDbId:  'dd02d05800fb4f2782935cfbdeb4df5e',  // Sprint #15 登録済み

    // ── プロジェクト管理 ──────────────────────────────
    projectManagementDbId: 'b5f5a9b8ef7e47c79495e461cac01505',  // Sprint #15 登録済み
    projectTaskDbId:       '34582fe39bce4c8687f88360b328877f',  // Sprint #15 登録済み

    // ── 企業プロファイル ──────────────────────────────
    companyProfileDbId: '',

    // ── AI ログ ───────────────────────────────────────
    aiChatLogDbId: '0506209381de48e897c8963deda23057',  // Sprint #18 登録済み

    // ── 感動ログ ──────────────────────────────────────
    delightLogDbId: 'f58e85598148494ab06fb4658b0a6e62',  // Sprint #39 登録済み
  },

  // ══════════════════════════════════════════════════
  //  🏥 さくら医療グループ
  //  Notion: 🏢 企業展開 > 🏥 さくら医療グループ Coarc
  //  企業ページID: 355960a91e238115a0b4feeae1a9bc32
  // ══════════════════════════════════════════════════
  'sakura-medical': {
    customerFeedbackDbId: '7a4444ffa8c34e3f866aedecfcb2c95a',
    serviceContactDbId:   'd4507f62e1b4477a9b22fc8e48d50d48',
    customerProfileDbId:  '',

    staffProfileDbId:   '06729c0a6ac141b2a3ef91b298750047',  // Sprint #15 登録済み
    staffConditionDbId: '9856119a99014c4a9f7b6cff35ebee0a',  // Sprint #15 登録済み
    trainingLogDbId:    'dca69498fd824ed086a7505ffeb08502',  // Sprint #28 登録済み

    kpiGoalsDbId:       '0da44ddd32184b5b88dee18b65bf0965',  // Sprint #15 登録済み
    productQualityDbId: '',

    knowledgeBaseDbId:  '213d110d1ed24b5786fdab9be5c4173e',  // Sprint #15 登録済み

    projectManagementDbId: 'ed6c6272f2d14f6db747e704f25f12a8',  // Sprint #15 登録済み
    projectTaskDbId:       'c617ae3e8d6048f68a4564c2f2923a6f',  // Sprint #15 登録済み

    companyProfileDbId: '',

    // ── AI ログ ───────────────────────────────────────
    aiChatLogDbId: 'aa764bf1ccfa4936bc38d383b1e5288f',  // Sprint #18 登録済み

    // ── 感動ログ ──────────────────────────────────────
    delightLogDbId: '1044e126f01d40858540235d3b7f4a56',  // Sprint #39 登録済み
  },

  // ══════════════════════════════════════════════════
  //  🍽️ 麺屋フードチェーン
  //  Notion: 🏢 企業展開 > 🍽️ 麺屋フードチェーン Coarc
  //  企業ページID: 355960a91e2381bd8b91f3edff9c9dc5
  // ══════════════════════════════════════════════════
  'mensho-food': {
    customerFeedbackDbId: '30b8a58e10d34cfbb33cd3cabb3f953b',
    serviceContactDbId:   '04c998d12c774d9a810d8ea18f9e1816',
    customerProfileDbId:  '',

    staffProfileDbId:   '1b04bdf965be4996b346f6b296d588dc',  // Sprint #15 登録済み
    staffConditionDbId: '33b4dd61bf344d5e8e892d9eb7174348',  // Sprint #15 登録済み
    trainingLogDbId:    '49e4cc0ac6244e6fbcabc90f5fb72e7f',  // Sprint #28 登録済み

    kpiGoalsDbId:       '9555f4dd8eaf4e429b583af44277311b',  // Sprint #15 登録済み
    productQualityDbId: '',

    knowledgeBaseDbId:  '381713c9eb874b418fb7e890e67a25d0',  // Sprint #15 登録済み

    projectManagementDbId: 'fa78ee68e1c24bda94ebbcc75bf54400',  // Sprint #15 登録済み
    projectTaskDbId:       '25895e4aec4042dd8215cc51613a4bd2',  // Sprint #15 登録済み

    companyProfileDbId: '',

    // ── AI ログ ───────────────────────────────────────
    aiChatLogDbId: 'f82fa296c28f421cbb9f09669ff081ec',  // Sprint #18 登録済み

    // ── 感動ログ ──────────────────────────────────────
    delightLogDbId: '8eb5b43218344ba9be659a28cecc6884',  // Sprint #39 登録済み
  },

  // ══════════════════════════════════════════════════
  //  🛒 ハナマルストア
  //  Notion: 🏢 企業展開 > 🛒 ハナマルストア Coarc
  //  企業ページID: 355960a91e2381f997f5ccd8ddd1c7db
  // ══════════════════════════════════════════════════
  'hanamaru-store': {
    customerFeedbackDbId: 'eb5db63ce8784d71b33888a244fd86b7',
    serviceContactDbId:   'fd2bd7550a95416fa4f2d609333ebea2',
    customerProfileDbId:  '',

    staffProfileDbId:   '096c8ce43a7f45089dd8613f9a5d9ab5',  // Sprint #15 登録済み
    staffConditionDbId: '11b071a51eff4976ac65f4658cbb4249',  // Sprint #15 登録済み
    trainingLogDbId:    'ba56c678c2ff4d9d8295a5b93e95b14c',  // Sprint #28 登録済み

    kpiGoalsDbId:       'c6853094299840c59d493bd5084dbab8',  // Sprint #15 登録済み
    productQualityDbId: '',

    knowledgeBaseDbId:  'e48d008010bd403b88a8fdfc7a10afab',  // Sprint #15 登録済み

    projectManagementDbId: 'da7ffd9b835149fd93342842e075c8c4',  // Sprint #15 登録済み
    projectTaskDbId:       '5825c3d5f370441f802cee2b1f21221c',  // Sprint #15 登録済み

    companyProfileDbId: '',

    // ── AI ログ ───────────────────────────────────────
    aiChatLogDbId: 'd689c7a5dff14460a47bda3818aa6f97',  // Sprint #18 登録済み

    // ── 感動ログ ──────────────────────────────────────
    delightLogDbId: '18aa2b1cd3cc485f812c6fd648da5b79',  // Sprint #39 登録済み
  },
}

/**
 * 企業ID に対応する DB 設定を取得する。
 * 未登録の場合はすべて空文字の設定を返す。
 */
export function getCompanyDbConfig(companyId: string): CompanyDbConfig {
  return COMPANY_DB_CONFIG[companyId] ?? {
    customerFeedbackDbId:  '',
    serviceContactDbId:    '',
    customerProfileDbId:   '',
    staffProfileDbId:      '',
    staffConditionDbId:    '',
    trainingLogDbId:       '',
    kpiGoalsDbId:          '',
    productQualityDbId:    '',
    knowledgeBaseDbId:     '',
    projectManagementDbId: '',
    projectTaskDbId:       '',
    companyProfileDbId:    '',
    aiChatLogDbId:         '',
    delightLogDbId:        '',
  }
}
