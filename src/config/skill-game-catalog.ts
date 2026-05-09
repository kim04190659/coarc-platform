// =====================================================
//  src/config/skill-game-catalog.ts
//  スキル向上ゲーム カタログ定義 — Sprint #24
//
//  ■ ゲーム構成
//    業種共通ゲーム（10本）: CS対応・コミュニケーション・AI活用・業務改善
//    業種別ゲーム（12本）  : ホテル・医療・飲食・小売 各3本
//
//  ■ available フラグ
//    false = 近日公開（カタログ表示のみ）
//    true  = プレイ可能（Sprint 25以降で順次解放）
//
//  ■ スキルカテゴリ（GameCategory）
//    cs            = CS・クレーム対応
//    communication = コミュニケーション・報連相
//    ai-literacy   = AI活用・DX
//    problem-solving = 業務改善・問題解決
//    management    = マネジメント・KPI
//    industry      = 業種別専用
// =====================================================

// ── 型定義 ──────────────────────────────────────────

export type GameCategory =
  | 'cs'
  | 'communication'
  | 'ai-literacy'
  | 'problem-solving'
  | 'management'
  | 'industry'

export type GameDifficulty = 1 | 2 | 3   // 1=基礎 / 2=実践 / 3=応用

export type GameIndustry = 'all' | 'hotel' | 'medical' | 'food' | 'retail'

export type GameType = 'scenario' | 'quiz' | 'ranking'

export type GameDef = {
  id:               string
  title:            string
  description:      string
  category:         GameCategory
  difficulty:       GameDifficulty
  type:             GameType
  industry:         GameIndustry
  estimatedMinutes: number   // 目安プレイ時間（分）
  skillTags:        string[] // このゲームで鍛えられるスキル
  available:        boolean  // true = プレイ可能
  sprint:           number   // どのSprintで実装されるか
}

// ── ゲームカタログ定義 ───────────────────────────────

export const GAME_CATALOG: GameDef[] = [

  // ===================================================
  //  業種共通ゲーム（全業種対象）
  //  ▸ CS・クレーム対応 — Sprint #25
  // ===================================================
  {
    id:               'cs-001',
    title:            'CS基礎：丁寧な対応を学ぶ',
    description:      '日常的な顧客からの問い合わせに正しく対応するシナリオゲーム。4択選択で場面ごとの最適解を学びます。',
    category:         'cs',
    difficulty:       1,
    type:             'scenario',
    industry:         'all',
    estimatedMinutes: 5,
    skillTags:        ['顧客対応', '傾聴', '丁寧語', '電話応対'],
    available:        true,   // Sprint #25 で公開
    sprint:           25,
  },
  {
    id:               'cs-002',
    title:            'クレーム対応シミュレーション',
    description:      '怒っている顧客への対応を選択肢で練習。AIが回答の妥当性をリアルタイムで採点・解説します。',
    category:         'cs',
    difficulty:       2,
    type:             'scenario',
    industry:         'all',
    estimatedMinutes: 8,
    skillTags:        ['クレーム対応', '共感力', '問題解決', '謝罪表現'],
    available:        true,   // Sprint #25 で公開
    sprint:           25,
  },
  {
    id:               'cs-003',
    title:            '難クレーム：上級者向け対応',
    description:      '理不尽な要求・複合クレームなど難易度の高い場面を扱う上級シナリオ。管理職・リーダー向け。',
    category:         'cs',
    difficulty:       3,
    type:             'scenario',
    industry:         'all',
    estimatedMinutes: 10,
    skillTags:        ['高度クレーム対応', '交渉力', 'エスカレーション判断', '感情コントロール'],
    available:        true,   // Sprint #25 で公開
    sprint:           25,
  },

  // ▸ コミュニケーション — Sprint #25
  {
    id:               'comm-001',
    title:            '報連相トレーニング',
    description:      '報告・連絡・相談の適切なタイミングと方法を場面選択で学びます。新人〜中堅スタッフに最適。',
    category:         'communication',
    difficulty:       1,
    type:             'scenario',
    industry:         'all',
    estimatedMinutes: 5,
    skillTags:        ['報連相', 'チームワーク', 'コミュニケーション', '情報共有'],
    available:        true,   // Sprint #25 で公開
    sprint:           25,
  },
  {
    id:               'comm-002',
    title:            '傾聴・共感ワーク',
    description:      '相手の気持ちを受け止める傾聴スキルをシナリオで練習。1on1やチームマネジメントにも役立ちます。',
    category:         'communication',
    difficulty:       2,
    type:             'scenario',
    industry:         'all',
    estimatedMinutes: 7,
    skillTags:        ['傾聴', '共感', 'コーチング', '心理的安全性'],
    available:        true,   // Sprint #25 で公開
    sprint:           25,
  },

  // ===================================================
  //  業種共通ゲーム（全業種対象）
  //  ▸ AI活用 — Sprint #26
  // ===================================================
  {
    id:               'ai-001',
    title:            'AI活用基礎クイズ',
    description:      'AIを業務で活用するための基礎知識を4択クイズで確認。DXリテラシーの底上げに最適です。',
    category:         'ai-literacy',
    difficulty:       1,
    type:             'quiz',
    industry:         'all',
    estimatedMinutes: 5,
    skillTags:        ['AI活用', 'DX基礎', 'ツール活用', 'AI倫理'],
    available:        false,
    sprint:           26,
  },
  {
    id:               'ai-002',
    title:            'プロンプト設計ゲーム',
    description:      'AIへの指示文（プロンプト）を作る力を育てます。より良い指示文を選ぶクイズ形式。',
    category:         'ai-literacy',
    difficulty:       2,
    type:             'quiz',
    industry:         'all',
    estimatedMinutes: 8,
    skillTags:        ['プロンプト設計', 'AI協働', '言語化力', '業務自動化'],
    available:        false,
    sprint:           26,
  },

  // ▸ 業務改善・問題解決 — Sprint #26
  {
    id:               'imp-001',
    title:            'PDCA判断ゲーム',
    description:      '業務改善サイクルのどのフェーズで何をすべきかを場面別に選びます。改善思考の基礎を身につけます。',
    category:         'problem-solving',
    difficulty:       1,
    type:             'quiz',
    industry:         'all',
    estimatedMinutes: 5,
    skillTags:        ['PDCA', '業務改善', '論理的思考', 'カイゼン'],
    available:        false,
    sprint:           26,
  },
  {
    id:               'imp-002',
    title:            'KPI読解クイズ',
    description:      'グラフや数値からKPIの意味を読み取り、適切なアクションを選びます。データドリブン思考を鍛えます。',
    category:         'management',
    difficulty:       2,
    type:             'quiz',
    industry:         'all',
    estimatedMinutes: 7,
    skillTags:        ['KPI管理', 'データ分析', '数値読解', '経営指標'],
    available:        false,
    sprint:           26,
  },
  {
    id:               'imp-003',
    title:            '業務改善提案ゲーム',
    description:      '実際の業務課題に対して改善アイデアを自由入力し、AIが実現性・効果・コストの観点で評価します。',
    category:         'problem-solving',
    difficulty:       3,
    type:             'scenario',
    industry:         'all',
    estimatedMinutes: 12,
    skillTags:        ['業務改善', '提案力', 'コスト意識', 'イノベーション'],
    available:        false,
    sprint:           26,
  },

  // ===================================================
  //  業種別ゲーム — Sprint #27
  //  ▸ ホテル・リゾート向け
  // ===================================================
  {
    id:               'hotel-001',
    title:            'VIP接客：最高のおもてなし',
    description:      'VIPゲストへの特別対応・サービスリカバリーをシナリオで学びます。ホテル上級スタッフ向け。',
    category:         'industry',
    difficulty:       3,
    type:             'scenario',
    industry:         'hotel',
    estimatedMinutes: 10,
    skillTags:        ['VIP接客', 'ホスピタリティ', 'おもてなし', 'サービスリカバリー'],
    available:        false,
    sprint:           27,
  },
  {
    id:               'hotel-002',
    title:            'チェックイン/アウト対応',
    description:      'ホテル受付業務でよくある場面（満室対応・早退希望・外国人ゲスト等）に正しく対応するゲーム。',
    category:         'industry',
    difficulty:       1,
    type:             'scenario',
    industry:         'hotel',
    estimatedMinutes: 6,
    skillTags:        ['フロント対応', 'チェックイン', '英語フレーズ', '客室管理'],
    available:        false,
    sprint:           27,
  },
  {
    id:               'hotel-003',
    title:            'ホテル特有クレーム処理',
    description:      '騒音クレーム・設備故障・食事に関する苦情など宿泊施設特有のクレーム対応を学ぶゲームです。',
    category:         'industry',
    difficulty:       2,
    type:             'scenario',
    industry:         'hotel',
    estimatedMinutes: 8,
    skillTags:        ['クレーム対応', 'ホテル知識', '設備トラブル', '補償交渉'],
    available:        false,
    sprint:           27,
  },

  // ▸ 医療・クリニック向け
  {
    id:               'medical-001',
    title:            '患者対応基礎',
    description:      '患者・ご家族への丁寧な説明・情報提供・不安解消のシナリオゲームです。医療スタッフ全般向け。',
    category:         'industry',
    difficulty:       1,
    type:             'scenario',
    industry:         'medical',
    estimatedMinutes: 6,
    skillTags:        ['患者対応', '医療コミュニケーション', '情報提供', '不安解消'],
    available:        false,
    sprint:           27,
  },
  {
    id:               'medical-002',
    title:            'チーム医療連携',
    description:      '医師・看護師・薬剤師など多職種との連携・情報共有の場面を選択肢で学びます。',
    category:         'industry',
    difficulty:       2,
    type:             'scenario',
    industry:         'medical',
    estimatedMinutes: 8,
    skillTags:        ['チーム医療', '多職種連携', '情報共有', 'SBAR'],
    available:        false,
    sprint:           27,
  },
  {
    id:               'medical-003',
    title:            '安全確認プロトコル',
    description:      '医療現場での指差し確認・薬剤確認・転倒リスク評価などの手順を問うクイズゲームです。',
    category:         'industry',
    difficulty:       2,
    type:             'quiz',
    industry:         'medical',
    estimatedMinutes: 7,
    skillTags:        ['医療安全', 'インシデント防止', '確認手順', 'KYT'],
    available:        false,
    sprint:           27,
  },

  // ▸ 飲食チェーン向け
  {
    id:               'food-001',
    title:            'ピーク時オペレーション',
    description:      'ランチラッシュなど繁忙時に適切な判断・役割分担をするシナリオゲームです。現場リーダー必須。',
    category:         'industry',
    difficulty:       2,
    type:             'scenario',
    industry:         'food',
    estimatedMinutes: 8,
    skillTags:        ['繁忙期対応', 'チームワーク', 'オペレーション', '優先順位付け'],
    available:        false,
    sprint:           27,
  },
  {
    id:               'food-002',
    title:            '食品安全クイズ',
    description:      '食品衛生法・アレルギー対応・温度管理・異物混入防止に関する基礎知識クイズです。',
    category:         'industry',
    difficulty:       1,
    type:             'quiz',
    industry:         'food',
    estimatedMinutes: 5,
    skillTags:        ['食品衛生', 'アレルギー対応', '温度管理', 'HACCP'],
    available:        false,
    sprint:           27,
  },
  {
    id:               'food-003',
    title:            '飲食店クレーム対応',
    description:      '料理の品質クレームや異物混入疑いなど飲食店特有のクレームシナリオ。謝罪・補償の場面を学びます。',
    category:         'industry',
    difficulty:       2,
    type:             'scenario',
    industry:         'food',
    estimatedMinutes: 8,
    skillTags:        ['クレーム対応', '飲食知識', '謝罪・補償', '再発防止'],
    available:        false,
    sprint:           27,
  },

  // ▸ 小売・スーパー向け
  {
    id:               'retail-001',
    title:            '接客シナリオ：小売編',
    description:      '売場での顧客対応・商品案内・レジ対応などの場面を選択肢で学びます。全スタッフ向け基礎ゲーム。',
    category:         'industry',
    difficulty:       1,
    type:             'scenario',
    industry:         'retail',
    estimatedMinutes: 6,
    skillTags:        ['接客', 'レジ対応', '商品案内', '丁寧語'],
    available:        false,
    sprint:           27,
  },
  {
    id:               'retail-002',
    title:            '在庫・クレーム対応',
    description:      '欠品時の対応・返品交換クレーム・価格表示ミス対応など小売業特有のシナリオゲームです。',
    category:         'industry',
    difficulty:       2,
    type:             'scenario',
    industry:         'retail',
    estimatedMinutes: 7,
    skillTags:        ['在庫管理', 'クレーム対応', '返品処理', '価格対応'],
    available:        false,
    sprint:           27,
  },
  {
    id:               'retail-003',
    title:            '万引き・トラブル対応',
    description:      '売場トラブルや万引き疑い・不審者対応の手順を学ぶ上級シナリオ。店長・リーダー向け。',
    category:         'industry',
    difficulty:       3,
    type:             'scenario',
    industry:         'retail',
    estimatedMinutes: 10,
    skillTags:        ['トラブル対応', '保安知識', 'リスク管理', '通報手順'],
    available:        false,
    sprint:           27,
  },
]

// ── ヘルパー関数 ─────────────────────────────────────

/** 業種別にゲームをフィルタリング（共通ゲーム + 業種別ゲームを返す） */
export function getGamesForIndustry(industry: GameIndustry): GameDef[] {
  return GAME_CATALOG.filter(g => g.industry === 'all' || g.industry === industry)
}

/** カテゴリでフィルタリング */
export function getGamesByCategory(category: GameCategory): GameDef[] {
  return GAME_CATALOG.filter(g => g.category === category)
}

/** 難易度でフィルタリング */
export function getGamesByDifficulty(difficulty: GameDifficulty): GameDef[] {
  return GAME_CATALOG.filter(g => g.difficulty === difficulty)
}

/** IDでゲームを取得 */
export function getGameById(id: string): GameDef | undefined {
  return GAME_CATALOG.find(g => g.id === id)
}

// ── companyId → 業種 マッピング ──────────────────────

export const COMPANY_INDUSTRY_MAP: Record<string, GameIndustry> = {
  'kitano-resort':  'hotel',
  'sakura-medical': 'medical',
  'mensho-food':    'food',
  'hanamaru-store': 'retail',
}

/** companyId から業種を取得（未登録は 'all' を返す） */
export function getIndustryByCompanyId(companyId: string): GameIndustry {
  return COMPANY_INDUSTRY_MAP[companyId] ?? 'all'
}

// ── カテゴリ表示名 ────────────────────────────────────

export const CATEGORY_LABELS: Record<GameCategory, string> = {
  'cs':               'CS・クレーム対応',
  'communication':    'コミュニケーション',
  'ai-literacy':      'AI活用・DX',
  'problem-solving':  '業務改善・問題解決',
  'management':       'マネジメント・KPI',
  'industry':         '業種別専用',
}

export const CATEGORY_COLORS: Record<GameCategory, { bg: string; text: string; border: string }> = {
  'cs':              { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  'communication':   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'   },
  'ai-literacy':     { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200'  },
  'problem-solving': { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  'management':      { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  'industry':        { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'   },
}

export const INDUSTRY_LABELS: Record<GameIndustry, string> = {
  'all':     '全業種共通',
  'hotel':   '🏨 ホテル・リゾート',
  'medical': '🏥 医療・クリニック',
  'food':    '🍜 飲食チェーン',
  'retail':  '🛒 小売・スーパー',
}

export const DIFFICULTY_LABELS: Record<GameDifficulty, { label: string; color: string }> = {
  1: { label: 'Lv.1 基礎',  color: 'text-green-600 bg-green-50 border-green-200'  },
  2: { label: 'Lv.2 実践',  color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  3: { label: 'Lv.3 応用',  color: 'text-red-600 bg-red-50 border-red-200'    },
}
