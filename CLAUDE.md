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
│   ├── 💾 標準DB（10本）
│   ├── 📐 オントロジー設計
│   ├── 🛠️ 実装・システム設計書
│   └── 🔄 開発管理
│
├── 🏢 企業・組織 展開ページ    ← ★ウィザードで新規企業が追加される場所
│   ├── 📋 ヒアリング結果管理DB（全企業共通）
│   ├── 🏨 北野リゾートホテル Coarc
│   ├── 🏥 さくら医療グループ Coarc
│   ├── 🍽️ 麺屋フードチェーン Coarc
│   └── 🛒 ハナマルストア Coarc
│
└── 🎯 営業・提案活動
```

### 主要 Notion ページ ID

```
ルートページ:          355960a91e238190a2f4e719baffdfad
🔧 標準基盤:           355960a91e238191b87bd46051bbc174
  🛠️ 実装・設計書:     355960a91e238146bb4dd9d9bffc5b8e
🏢 企業展開ページ:     355960a91e2381b49cb2fa02dec4ea5a  ← NOTION_PARENT_PAGE_ID
🎯 営業・提案活動:     355960a91e2381488846e433a48bd808
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
src/config/company-db-config.ts  — 企業別 Notion DB ID マッピング
src/config/features.ts           — サイドメニュー定義
src/contexts/CompanyContext.tsx  — 選択中企業のグローバル状態
src/components/layout/Sidebar.tsx         — 左サイドバー
src/components/layout/CompanySelector.tsx — ヘッダーの企業切り替えUI
```

---

## マルチテナント設計方針

### RunWith との対応関係

| RunWith | Coarc | 説明 |
|---|---|---|
| 住民 | 顧客 | 問い合わせ・フィードバックの送り手 |
| 自治体職員 | 社員 | エクセレント対応を行う人 |
| 町長・議会 | 経営者・部門長 | AI顧問の提言を受ける人 |
| 自治体 | 企業（テナント） | マルチテナントの単位 |
| municipalityId | companyId | テナント識別子 |

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
APIルートが Notion DB を企業名でフィルタリングして返す
```

### 新しい企業を追加するときの手順

**⚠️ 必ず3ファイルすべてを更新すること**

1. `src/config/companies.ts` に企業を1件追加
2. `src/config/company-db-config.ts` に Notion DB ID マッピングを追加
3. `src/config/features.ts` の `company` グループにサイドバー表示を追加
4. Notion の「🏢 企業・組織 展開ページ」直下に企業ページを作成
5. `npx tsc --noEmit` でエラーがないことを確認してから push

---

## 開発スタイル

- コードには必ず日本語コメントを入れる
- 型チェックは `npx tsc --noEmit` で確認してから push
- git push は Yoshitaka がターミナルから手動実行
- Notionページ削除は必ず確認を取ること

---

## Claude API（Haiku）利用ルール（RunWithと同じ）

- 使用モデル: `claude-haiku-4-5-20251001`
- max_tokens: **4096固定**
- 入力データは上位12件以内に絞る
- 出力はJSONのみ・ことばを簡潔に
- stop_reason チェック必須
