'use client'

// =====================================================
//  src/components/layout/ChatPanel.tsx
//  右側AIアシスタントパネル
//
//  ■ 動作概要
//    - usePathname() で現在のURLを自動検出
//    - PAGE_CONTEXTS[cleanPath] から該当ページのコンテキストを取得
//    - /api/chat に POST して Claude Haiku の回答を表示
//    - 各ページに適した systemPrompt とサジェスチョンボタンを表示
//
//  ■ 新ページ追加時
//    PAGE_CONTEXTS にエントリを追加するだけで自動対応
// =====================================================

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { X, Send, MessageCircle } from 'lucide-react'

// ──────────────────────────────────────────────────
//  各ページのコンテキスト定義
// ──────────────────────────────────────────────────
type PageContext = {
  pageTitle: string
  description: string
  systemPrompt: string
  suggestions: string[]
}

const PAGE_CONTEXTS: Record<string, PageContext> = {

  // ── トップページ ──
  '/': {
    pageTitle: 'ホーム',
    description: 'Coarc Platformの概要と主要機能を確認できます。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「ホーム」です。
このページではCoarc Platformの概要と主要機能へのクイックリンクが確認できます。
各機能の説明・使い方・開始手順を400字以内で案内してください。`,
    suggestions: [
      'Coarcとはどんなサービスですか？',
      'まず何から始めればいいですか？',
      '企業の切り替え方を教えてください',
    ],
  },

  // ── KPIダッシュボード ──
  '/management/dashboard': {
    pageTitle: 'KPIダッシュボード',
    description: '経営KPIをリアルタイムで確認できます。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「KPIダッシュボード」です。
このページでは顧客満足スコア・社員コンディション・売上KPIなどの経営指標をグラフで確認できます。
- 各KPI指標の見方・計算方法を説明できます
- 数値が低下しているときの対処法を提案できます
- データの更新頻度や連携先（Notion）についても案内できます
回答は400字以内。専門用語は避けて業務担当者向けに説明してください。`,
    suggestions: [
      'KPIスコアの見方を教えてください',
      '数値が下がっている場合どうすれば？',
      'データはいつ更新されますか？',
    ],
  },

  // ── 顧客フィードバック ──
  '/customer/feedback': {
    pageTitle: '顧客フィードバック',
    description: '顧客の声をAIが自動分類・分析します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「顧客フィードバック」です。
このページでは顧客からのフィードバック（口コミ・アンケート・問い合わせ内容）をAIが自動で分類・優先度付けします。
- フィードバックの入力方法・インポート方法を案内できます
- AIによる分類ラベルの意味を説明できます
- 優先対応が必要な案件の見分け方を教えられます
回答は400字以内。`,
    suggestions: [
      'フィードバックの入力方法は？',
      'AIの分類結果はどう活用しますか？',
      '緊急対応が必要な件をすぐ確認したい',
    ],
  },

  // ── 問い合わせ管理 ──
  '/customer/contacts': {
    pageTitle: '問い合わせ管理',
    description: '顧客からの問い合わせを一元管理します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「問い合わせ管理」です。
このページでは電話・メール・チャットからの問い合わせを一元管理し、対応状況を可視化します。
- 問い合わせの新規登録・ステータス更新の方法を案内できます
- 未対応件数の確認方法・担当者割り当て方法を説明できます
- 対応履歴の検索・エクスポート方法も教えられます
回答は400字以内。`,
    suggestions: [
      '新しい問い合わせを登録するには？',
      '対応済みにするにはどうしますか？',
      '未対応の件数を絞り込みたい',
    ],
  },

  // ── 社員コンディション ──
  '/operations/staff': {
    pageTitle: '社員コンディション',
    description: '社員のウェルビーイングを記録・管理します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「社員コンディション」です。
このページでは社員の体調・業務負荷・チームウェルビーイングを定期的に記録し、離職リスクを早期に検知します。
- コンディション入力の頻度・方法を案内できます
- スコアが低い社員への対応例を提案できます
- 部署別・期間別の集計方法を説明できます
回答は400字以内。プライバシーに配慮した表現を使ってください。`,
    suggestions: [
      'コンディションの入力方法は？',
      'スコアが低い場合どう対応しますか？',
      '部署全体の傾向を確認したい',
    ],
  },

  // ── AI経営顧問 ──
  '/ai-advisor': {
    pageTitle: 'AI経営顧問',
    description: 'AIがデータをもとに経営提言を行います。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「AI経営顧問」です。
このページではCoarcに蓄積された顧客・社員・売上データをAIが分析し、経営改善の提言を自動生成します。
- AIへの質問の仕方・効果的なプロンプト例を教えられます
- 提言内容の読み方・優先度の判断基準を説明できます
- どのデータが分析に使われているかも案内できます
回答は400字以内。`,
    suggestions: [
      'AIにどんな質問ができますか？',
      '提言の優先度はどう決まりますか？',
      'どのデータが分析に使われていますか？',
    ],
  },

  // ── AIナレッジ検索 ──
  '/operations/knowledge': {
    pageTitle: 'AIナレッジ検索',
    description: 'Notionの社内ナレッジをAIが検索します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「AIナレッジ検索」です。
このページでは社内マニュアル・FAQ・過去の対応事例をAIが横断検索します。
- 検索キーワードの入れ方・絞り込み方を案内できます
- Notionへのナレッジ登録方法を説明できます
- 検索結果の活用方法・共有方法も教えられます
回答は400字以内。`,
    suggestions: [
      '検索のコツを教えてください',
      'ナレッジを新規登録するには？',
      '検索結果を共有したい',
    ],
  },

  // ── 週次レポート ──
  '/management/weekly-report': {
    pageTitle: '週次レポート自動生成',
    description: '週次の経営レポートをAIが自動作成します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「週次レポート自動生成」です。
このページでは前週のKPI・フィードバック・社員コンディションをまとめた週次レポートをAIが自動生成します。
- レポートの生成手順・出力形式を案内できます
- Notionへの保存・メール配信の設定方法を説明できます
- レポート内容のカスタマイズ方法も教えられます
回答は400字以内。`,
    suggestions: [
      'レポートを生成するには？',
      'Notionに自動保存できますか？',
      'レポートの内容を変えたい',
    ],
  },

  // ── KPI目標管理 ──
  '/management/kpi': {
    pageTitle: 'KPI目標管理',
    description: 'KPI目標の設定と進捗を管理します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「KPI目標管理」です。
このページでは四半期・月次のKPI目標を設定し、実績との乖離をトラッキングします。
- 目標値の設定方法・変更方法を案内できます
- 目標未達の場合のAIアドバイス機能を説明できます
- 部署別KPIの設定方法も教えられます
回答は400字以内。`,
    suggestions: [
      'KPI目標の設定方法は？',
      '目標を下回ったときのAI提言は？',
      '部署ごとに目標を設定できますか？',
    ],
  },

  // ── スキル向上ゲーム ──
  '/skill-game/select': {
    pageTitle: 'スキル向上ゲーム',
    description: 'ロールプレイ形式で社員スキルを向上します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「スキル向上ゲーム」です。
このページでは顧客対応・クレーム処理・商品説明などをロールプレイ形式で練習できます。AIが顧客役を演じます。
- シナリオの選び方・難易度設定を案内できます
- スコアの見方・弱点の改善方法を説明できます
- 新しいシナリオの追加方法も教えられます
回答は400字以内。`,
    suggestions: [
      'どんなシナリオがありますか？',
      'スコアアップのコツを教えて',
      '新しいシナリオを追加したい',
    ],
  },

  // ── 研修ログ管理 ──
  '/operations/training': {
    pageTitle: '研修ログ管理',
    description: '社員の研修履歴を記録・管理します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「研修ログ管理」です。
このページでは社員ごとの研修受講履歴・スキルゲームの成績・資格取得状況を管理します。
- 研修記録の入力方法・一括インポート方法を案内できます
- 未受講者の抽出・リマインド送信の方法を説明できます
- 研修効果の分析方法も教えられます
回答は400字以内。`,
    suggestions: [
      '研修記録を入力するには？',
      '未受講者を抽出したい',
      '研修の効果を確認するには？',
    ],
  },

  // ── 企業プロファイル設定 ──
  '/settings/company': {
    pageTitle: '企業プロファイル設定',
    description: '企業情報・AI設定をカスタマイズします。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「企業プロファイル設定」です。
このページでは企業名・業種・社員数などの基本情報と、AIが分析に使う重点KPIを設定します。
- 基本情報の更新方法を案内できます
- AI分析の重点項目のカスタマイズ方法を説明できます
- NotionページIDの設定方法も教えられます
回答は400字以内。`,
    suggestions: [
      '企業情報を更新するには？',
      'AIの重点分析項目を変えたい',
      'Notionとの連携設定は？',
    ],
  },

  // ── プロジェクト管理 ──
  '/operations/projects': {
    pageTitle: 'プロジェクト管理',
    description: '業務依頼をプロジェクトとして登録・進捗管理します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「プロジェクト管理」です。
このページでは業務依頼をプロジェクトとして登録し、タスクの進捗をチームで管理できます。
- 「新規プロジェクト」ボタンからプロジェクトを作成できます
- カードをクリックするとタスク一覧が展開されます
- タスクのアイコンをクリックすると「未着手→進行中→完了」と状態が変わり、Notionに即時保存されます
- AIディスパッチで推薦された担当者をそのまま登録できます
- Sprint 13 完了後はAIがタスクを自動生成する機能も追加されます
回答は400字以内。`,
    suggestions: [
      'プロジェクトを新規作成するには？',
      'タスクのステータスを変更したい',
      'ディスパッチ結果をプロジェクトに登録するには？',
    ],
  },

  // ── AIディスパッチ / 人材育成AI ──
  '/operations/dispatch': {
    pageTitle: 'AIディスパッチ / 人材育成AI',
    description: '業務に最適な担当者をAIが推薦し、個別育成プランを生成します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「AIディスパッチ / 人材育成AI」です。
このページには2つのタブがあります。
①AIディスパッチ: 業務内容を入力するとスキル・コンディションをもとにAIが担当者Top3を推薦します。
②人材育成AI: 社員を選択するとAIが個別の育成プランを自動生成します。
- 推薦結果の「マッチスコア」は100点満点でスキル適合度を示します
- 注意事項欄にはコンディション・業務負荷の懸念が表示されます
- 育成プランの「育成プランを生成」ボタンでディスパッチから直接プラン作成もできます
回答は400字以内。`,
    suggestions: [
      'ディスパッチの業務説明はどう書けばよいですか？',
      'マッチスコアの計算基準を教えてください',
      '育成プランの優先度「高」はどう判断されますか？',
    ],
  },

  // ── AIフリーチャット ──
  '/operations/ai-chat': {
    pageTitle: 'AIフリーチャット',
    description: 'Claude Haikuに業務・経営・DXに関する質問を自由にできます。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「AIフリーチャット」です。
このページでは業務改善・経営課題・DX推進などについてAIに自由に質問できます。
- テキストエリアに質問を入力して送信ボタン（またはCtrl+Enter）で送信します
- 質問内容はAIログとして自動保存され、後から「AIログ分析」ページで確認できます
- 「会話をクリア」ボタンで履歴を初期化できます（ログDBには残ります）
- 画面下の質問例をクリックすると、そのまま質問として送信されます
回答は400字以内。`,
    suggestions: [
      'どんな質問ができますか？',
      '業務効率化のアイデアを教えてください',
      'AIログはどこで確認できますか？',
    ],
  },

  // ── AIログ分析 ──
  '/operations/ai-logs': {
    pageTitle: 'AIログ分析',
    description: '各AIページでの質問履歴を一覧・分析できます。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「AIログ分析」です。
このページではフリーチャット・AI顧問・AIディスパッチ等の質問履歴を確認・分析できます。
- 上部のタブでソース（機能）ごとにフィルタリングできます
- 各ログ行をクリックすると質問・回答の全文が展開されます
- 統計カードで総質問数・平均応答時間・利用機能数が確認できます
- 「機能別 利用状況」グラフで社内のAI活用傾向がわかります
回答は400字以内。`,
    suggestions: [
      'ログはどれくらいの期間保存されますか？',
      '特定の機能のログだけ見たい',
      '応答時間が遅い場合の原因は？',
    ],
  },

  // ── 社員離職リスクAI ── Sprint #22
  '/ai-ext/staff-turnover': {
    pageTitle: '社員離職リスクAI',
    description: 'コンディション履歴から離職リスクを早期検知します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「社員離職リスクAI」です。
このページでは社員のコンディション履歴（最新3件）をAIが分析し、離職リスクの高い社員と組織シグナルを提示します。
- 「要注意社員」リストはリスクレベルが高い順に表示されます（最大6名）
- 「推奨対応」欄には具体的な介入アクションが示されています（面談・負荷軽減等）
- 「組織シグナル」は部署横断で見られる傾向・パターンを示します
- コンディション記録が少ない場合は精度が下がります。週次記録の定着をお勧めします
- この情報は業務改善目的のみに使用し、適切な管理のもとで取り扱ってください
回答は400字以内。`,
    suggestions: [
      'リスクの高い社員にどう対応すればよいですか？',
      'コンディションの記録頻度はどのくらいが適切ですか？',
      '組織シグナルとは何を意味しますか？',
    ],
  },

  // ── 売上予測AI ── Sprint #23
  '/ai-ext/sales-forecast': {
    pageTitle: '売上予測AI',
    description: 'KPI・フィードバック・社員・問い合わせの4指標を統合し、今後3ヶ月の業績方向を予測します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「売上予測AI」です。
このページではKPI目標・顧客フィードバック・社員コンディション・問い合わせの4つのデータベースを統合分析し、今後3ヶ月の業績方向（上昇/横ばい/下降）を予測します。
- 予測結果は「上昇・横ばい・下降」と「確信度（高/中/低）」で表示されます
- 「成長ドライバー」は業績向上の要因、「リスク要因」は注意すべき問題点です
- 「優先アクション」には実施時期（今週中・今月末・来月以降）付きで具体策が示されます
- 「再分析」ボタンで最新データを取得して再計算できます（約15〜25秒かかります）
- AIによる予測は参考情報です。外部環境・競合状況は考慮されていないため、最終判断は経営者が行ってください
回答は400字以内。`,
    suggestions: [
      '予測の確信度が低いのはなぜですか？',
      '成長ドライバーを強化するには？',
      '下降予測が出たときの対策は？',
    ],
  },

  // ── CS品質スコアAI ── Sprint #21
  '/ai-ext/cs-quality': {
    pageTitle: 'CS品質スコアAI',
    description: '問い合わせ対応を4次元でスコアリング（100点満点）します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「CS品質スコアAI」です。
このページでは問い合わせ対応データをAIが分析し、CS品質を100点満点でスコアリングします。
- 総合スコアはS〜Dのグレードで評価されます（S=85点以上・A=70点以上・B=55点以上）
- 4次元（応答速度・解決率・顧客満足・問題対応力）それぞれに25点が割り当てられます
- 「再分析」ボタンで最新データを反映した再計算ができます
- 改善点カードには優先度と具体的なアクションが示されています
- スコアを上げるには未対応件数の削減・高優先度案件の早期対応が効果的です
回答は400字以内。`,
    suggestions: [
      'スコアを上げるには何をすればいいですか？',
      '4次元スコアの計算基準は？',
      '解決率が低い原因として何が考えられますか？',
    ],
  },

  // ── 顧客離反リスクAI ── Sprint #20
  '/ai-ext/churn-risk': {
    pageTitle: '顧客離反リスクAI',
    description: 'フィードバック＋問い合わせを横断分析し、離反リスクを検知します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「顧客離反リスクAI」です。
このページでは顧客フィードバックと問い合わせデータをAIが横断分析し、リスクスコア（0〜100）と改善アクションを提示します。
- スコアが高いほど顧客が離反しやすい状態を示します（目安: 70以上=高リスク・30以下=低リスク）
- 「再分析」ボタンで最新データで再計算できます
- リスク要因カードには具体的な問題点が、改善アクションには優先度・期限・コスト試算が示されます
- データが少ない場合は精度が下がるため、フィードバックや問い合わせを蓄積してください
回答は400字以内。`,
    suggestions: [
      'リスクスコアの計算方法は？',
      '高リスクのとき何をすればいいですか？',
      'データが少ないときの精度は？',
    ],
  },

  // ── システムヘルス ──
  '/admin/system-health': {
    pageTitle: 'システムヘルス監視',
    description: 'システムの稼働状況を監視します。',
    systemPrompt: `あなたはCoarc Platformの操作サポートAIです。現在のページは「システムヘルス監視」です。
このページではAPI接続状況・Notionデータ同期・バックアップ状態を監視します。
- エラーアイコンの意味・対処法を案内できます
- 手動バックアップの実行方法を説明できます
- 障害発生時の連絡先・エスカレーション手順も教えられます
回答は400字以内。`,
    suggestions: [
      'エラーが出ているときどうすれば？',
      '手動バックアップを実行したい',
      'Notionの同期が止まっています',
    ],
  },
}

// ──────────────────────────────────────────────────
//  チャットメッセージの型定義
// ──────────────────────────────────────────────────
type Message = {
  role: 'user' | 'assistant'
  content: string
}

// ──────────────────────────────────────────────────
//  マークダウンを簡易レンダリングするヘルパー
//  （太字・インラインコード・改行のみ対応）
// ──────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="bg-indigo-100 text-indigo-800 px-1 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 箇条書き
    if (/^[-*] /.test(line)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(<li key={i}>{renderInline(lines[i].replace(/^[-*] /, ''))}</li>)
        i++
      }
      nodes.push(<ul key={`ul-${i}`} className="list-disc pl-4 space-y-0.5 my-1">{items}</ul>)
      continue
    }

    // 番号付きリスト
    if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i}>{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>)
        i++
      }
      nodes.push(<ol key={`ol-${i}`} className="list-decimal pl-4 space-y-0.5 my-1">{items}</ol>)
      continue
    }

    // 空行
    if (line.trim() === '') {
      i++
      continue
    }

    // 通常テキスト
    nodes.push(<p key={i} className="my-0.5">{renderInline(line)}</p>)
    i++
  }

  return <div className="space-y-1">{nodes}</div>
}

// ──────────────────────────────────────────────────
//  メインコンポーネント
// ──────────────────────────────────────────────────
type ChatPanelProps = {
  isOpen: boolean
  onClose: () => void
}

export default function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const pathname = usePathname()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isComposing, setIsComposing] = useState(false) // IME入力中フラグ
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // クエリパラメータを除いたパスを取得
  const cleanPath = pathname.split('?')[0]

  // 現在のページコンテキストを取得（なければデフォルト）
  const ctx: PageContext = PAGE_CONTEXTS[cleanPath] ?? {
    pageTitle: 'Coarc Platform',
    description: 'このページの使い方を質問できます。',
    systemPrompt: '',
    suggestions: ['このページの使い方を教えてください', 'よくある操作を教えてください'],
  }

  // パネルが開いたとき・ページが変わったときにメッセージをリセット
  useEffect(() => {
    if (isOpen) {
      setMessages([])
      setInput('')
    }
  }, [isOpen, cleanPath])

  // 新着メッセージにスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // メッセージ送信処理
  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg: Message = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          systemPrompt: ctx.systemPrompt || undefined,
        }),
      })
      const data = await res.json()
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply ?? data.error ?? 'エラーが発生しました',
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '通信エラーが発生しました。もう一度お試しください。' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // パネルが閉じているときは何もレンダリングしない
  if (!isOpen) return null

  return (
    <div className="w-80 flex flex-col bg-white border-l border-indigo-200 shadow-xl">

      {/* ── ヘッダー ── */}
      <div className="bg-indigo-900 text-white px-4 py-3 flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">🌿 Coarcアシスタント</p>
          <p className="text-indigo-300 text-xs mt-0.5">{ctx.pageTitle}</p>
        </div>
        <button
          onClick={onClose}
          className="text-indigo-300 hover:text-white transition-colors mt-0.5"
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── メッセージエリア ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">

        {/* 初期状態：説明 + サジェスチョン */}
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-gray-500 text-xs">{ctx.description}</p>
            <p className="text-xs font-semibold text-indigo-700">よくある質問：</p>
            {ctx.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="w-full text-left text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-800 px-3 py-2 rounded-lg transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* メッセージ一覧 */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
              }`}
            >
              {msg.role === 'assistant'
                ? renderMarkdown(msg.content)
                : msg.content
              }
            </div>
          </div>
        ))}

        {/* ローディングインジケーター */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-xl rounded-bl-none text-xs">
              <span className="animate-pulse">考え中...</span>
            </div>
          </div>
        )}

        {/* スクロール位置の目印 */}
        <div ref={messagesEndRef} />
      </div>

      {/* ── 入力エリア ── */}
      <div className="border-t border-indigo-100 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={e => {
            // IME確定中はEnterキーを無視（日本語入力対応）
            if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
              e.preventDefault()
              sendMessage(input)
            }
          }}
          placeholder="このページの使い方を質問する..."
          className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
          disabled={isLoading}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white p-2 rounded-lg transition-colors"
          aria-label="送信"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  )
}
