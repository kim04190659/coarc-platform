# Coarc Platform — Claude Cowork 作業ガイド

## プロジェクト概要

中小規模企業（300人規模）向けエクセレントサービス × AI基盤。
顧客問い合わせ → 社員エクセレント対応 → Notion蓄積 → AI経営提言 のサイクルを実現。

- **Webアプリ**: Next.js 16 / TypeScript / Vercel
- **ナレッジ基盤**: Notion（MCP連携済み）
- **AI**: Claude API（Anthropic / Haiku）
- **対象業種**: サービス業全般（ホテル・医療・飲食・小売）
- **担当**: Yoshitaka（NEC DX/AX推進担当）

---

## Notion ページ構成ルール（最重要）

### 3セクション構造

```
🌿 Coarc Platform（ルートページ）
│
├── 🔧 標準基盤 | Coarc Platform 設計
│   ├── 📐 オントロジー設計
│   ├── 🛠️ 実装・システム設計書
│   └── 🔄 開発管理
│        └── 🗂️ スプリント管理DB
│
├── 🏢 企業・組織 展開ページ    ← ★ウィザードで新規企業が追加される場所
│   ├── 📋 ヒアリング結果管理DB（全企業共通・唯一の例外）
│   ├── 🏨 北野リゾートホテル Coarc
│   │   ├── 👤 社員マスタDB
│   │   ├── 💚 社員コンディションDB
│   │   ├── 📈 KPI目標DB
│   │   ├── 🔍 ナレッジベースDB
│   │   ├── 📁 プロジェクト管理DB
│   │   ├── ✅ プロジェクトタスクDB
│   │   ├── 💬 顧客フィードバックDB
│   │   └── 💬 問い合わせ管理DB
│   ├── 🏥 さくら医療グループ Coarc  （同構造）
│   ├── 🍽️ 麺屋フードチェーン Coarc  （同構造）
│   └── 🛒 ハナマルストア Coarc       （同構造）
│
└── 🎯 営業・提案活動
```

### 主要 Notion ページ ID

```
ルートページ:              355960a91e238190a2f4e719baffdfad
🔧 標準基盤:               355960a91e238191b87bd46051bbc174
  🛠️ 実装・設計書:         355960a91e238146bb4dd9d9bffc5b8e
  🔄 開発管理:             355960a91e2381ae9870ec42e8fabb9e
    🗂️ スプリント管理DB:   f44343cd14214709b6f17bd910681f99
🏢 企業展開ページ:         355960a91e2381b49cb2fa02dec4ea5a  ← NOTION_PARENT_PAGE_ID
🎯 営業・提案活動:         355960a91e2381488846e433a48bd808

■ 企業ページID
北野リゾートホテル:        355960a91e23810fb38fe9221ae8ea71
さくら医療グループ:        355960a91e238115a0b4feeae1a9bc32
麺屋フードチェーン:        355960a91e2381bd8b91f3edff9c9dc5
ハナマルストア:            355960a91e2381f997f5ccd8ddd1c7db
```

---

## 環境変数（Vercel）

```
NOTION_PARENT_PAGE_ID = 355960a91e2381b49cb2fa02dec4ea5a
                        （🏢 企業・組織 展開ページ）
ANTHROPIC_API_KEY     = sk-ant-...
```

---

## コードの重要ファイル

```
src/config/companies.ts          — 展開済み企業マスタ定義
src/config/company-db-config.ts  — 企業別 Notion DB ID マッピング（最重要）
src/config/features.ts           — サイドメニュー定義
src/contexts/CompanyContext.tsx  — 選択中企業のグローバル状態
src/components/layout/Sidebar.tsx         — 左サイドバー
src/components/layout/CompanySelector.tsx — ヘッダーの企業切り替えUI
```

---

## Notion DB 設計原則（最重要・設計の根幹）

### ❌ 絶対禁止：共通DB（SHARED_NOTION_DBS）方式

```
// ❌ やってはいけない設計
SHARED_NOTION_DBS.staffProfile   // 全企業のデータが1つのDBに混在
SHARED_NOTION_DBS.projectTask    // 「企業名」で分離するだけでは不十分

// ❌ 企業名フィルタで分離するクエリも禁止
filter: { property: '企業名', select: { equals: company.shortName } }
```

**なぜ禁止か:**
- データが混在すると将来的な分離が困難
- 企業間でデータが誤って見える可能性
- Notion上で企業が自分のデータだけ管理できない
- アクセス権限の粒度がDB単位なので、企業別DBでないと権限設計ができない

### ✅ 正しい設計：全DB企業別方式

```
// ✅ 正しい設計
COMPANY_DB_CONFIG['kitano-resort'].staffProfileDbId    // 北野リゾート専用
COMPANY_DB_CONFIG['sakura-medical'].staffProfileDbId   // さくら医療専用
// 同じ機能でも企業ごとに独立したNotionデータベースを持つ
```

**メリット:**
- 企業ごとにNotionの閲覧権限を設定できる
- DBが汚染されない（他社データが混入しない）
- 企業ページ配下に全DBが集約され、Notion上で管理しやすい
- 企業の解約時にそのNotionページを削除するだけで完結

### 企業別DBの構造（全企業共通のスキーマ、データは分離）

各企業ページ（例: 🏨 北野リゾートホテル Coarc）の配下に、以下のDBを作成する:

| DB名 | `CompanyDbConfig` キー | 用途 |
|------|------------------------|------|
| 👤 社員マスタDB | `staffProfileDbId` | 社員情報・スキル |
| 💚 社員コンディションDB | `staffConditionDbId` | Well-Being記録 |
| 📈 KPI目標DB | `kpiGoalsDbId` | 目標・実績管理 |
| 🔍 ナレッジベースDB | `knowledgeBaseDbId` | 対応ナレッジ |
| 📁 プロジェクト管理DB | `projectManagementDbId` | 業務プロジェクト |
| ✅ プロジェクトタスクDB | `projectTaskDbId` | タスク・成果物 |
| 💬 顧客フィードバックDB | `customerFeedbackDbId` | CS満足度 |
| 💬 問い合わせ管理DB | `serviceContactDbId` | 顧客問い合わせ |

> **注意**: `企業名` プロパティは企業別DBには不要。DBそのものが企業を識別する。

### APIルートの実装ルール

```typescript
// ✅ 正しい実装
import { getCompanyDbConfig } from '@/config/company-db-config'
const { searchParams } = new URL(req.url)
const companyId = searchParams.get('companyId') ?? 'kitano-resort'
const dbConfig = getCompanyDbConfig(companyId)

// 企業専用DBに直接クエリ（フィルタ不要）
const res = await fetch(`${NOTION_API}/databases/${dbConfig.staffProfileDbId}/query`, {
  body: JSON.stringify({ /* 企業名フィルタなし */ }),
})

// ❌ 絶対禁止
import { SHARED_NOTION_DBS } from '@/config/company-db-config'
const res = await fetch(`${NOTION_API}/databases/${SHARED_NOTION_DBS.staffProfile}/query`, {
  body: JSON.stringify({
    filter: { property: '企業名', select: { equals: company.shortName } }, // ❌
  }),
})
```

### 唯一の例外：ヒアリング結果管理DB

ヒアリングは Coarc 側（管理者）が全企業横断で管理するため、共通DBで可。

---

## マルチテナント設計方針

### テナント識別の仕組み

```
ユーザーがヘッダーのドロップダウンで企業を選択
  ↓
CompanyContext（React Context）に companyId を保存
  ↓
各ページが useCompany() フックで取得
  ↓
APIコール時に ?companyId=kitano-resort 等をクエリパラメータで渡す
  ↓
APIルートが getCompanyDbConfig(companyId) で企業別DB IDを取得
  ↓
企業専用の Notion DB に直接クエリ（フィルタなし）
```

### 新しい企業を追加するときの手順

**⚠️ 必ず全ステップを実施すること**

1. `src/config/companies.ts` に企業を1件追加
2. `src/config/company-db-config.ts` に Notion DB ID マッピングを追加
3. `src/config/features.ts` の `company` グループにサイドバー表示を追加
4. Notion の「🏢 企業・組織 展開ページ」直下に企業ページを作成
5. 企業ページ配下に8種類のDBを作成（Notion MCP または手動）
6. 作成した DB ID を `company-db-config.ts` に登録
7. `npx tsc --noEmit` でエラーがないことを確認してから push

---

## 現在の Notion DB 登録状況（company-db-config.ts）

### 企業別DB登録済み一覧

| 機能 | キー | 北野リゾート | さくら医療 | 麺屋フード | ハナマル |
|------|------|:---:|:---:|:---:|:---:|
| 顧客フィードバック | `customerFeedbackDbId` | ✅ | ✅ | ✅ | ✅ |
| 問い合わせ管理 | `serviceContactDbId` | ✅ | ✅ | ✅ | ✅ |
| 社員マスタ | `staffProfileDbId` | ✅ | ✅ | ✅ | ✅ |
| 社員コンディション | `staffConditionDbId` | ✅ | ✅ | ✅ | ✅ |
| KPI目標 | `kpiGoalsDbId` | ✅ | ✅ | ✅ | ✅ |
| ナレッジベース | `knowledgeBaseDbId` | ✅ | ✅ | ✅ | ✅ |
| プロジェクト管理 | `projectManagementDbId` | ✅ | ✅ | ✅ | ✅ |
| プロジェクトタスク | `projectTaskDbId` | ✅ | ✅ | ✅ | ✅ |

> **注**: 上記は Sprint #15 完了後の状態。Sprint #14 時点では staffProfile 以降は未登録。

---

## 開発スタイル

- コードには必ず日本語コメントを入れる
- 型チェックは `npx tsc --noEmit` で確認してから push
- git push は Yoshitaka がターミナルから手動実行
- Notionページ・DB削除は必ず確認を取ること
- 新機能のDB追加は必ず企業別DB方式で実装する（共通DBは作らない）

---

## Claude API（Haiku）利用ルール（RunWithと同じ）

- 使用モデル: `claude-haiku-4-5-20251001`
- max_tokens: **4096固定**
- 入力データは上位12件以内に絞る
- 出力はJSONのみ・ことばを簡潔に
- stop_reason チェック必須
