// =====================================================
//  src/app/api/menu-design/propose/route.ts
//  AI メニュー提案エンジン — Sprint #31
//
//  ■ GET ?companyId=xxx
//    1. Notion ヒアリング結果DBから該当企業のレコードを取得
//    2. Claude Haiku でヒアリング内容を分析
//    3. 有効化すべきモジュール一覧と推奨理由を返す
//
//  ■ 出力形式
//    { success, summary, modules: { id, enabled, reason }[] }
// =====================================================

import { NextResponse } from 'next/server'

// ── Notion DB ID ──────────────────────────────────────
const HEARING_DB_ID = '6744026a60764853a3d9c7ff26d630ad'

// ── Haiku プロンプト用：モジュール一覧 ────────────────
const MODULE_LIST = `
[coreグループ（必須・常時有効）]
dashboard: KPIダッシュボード
customer-feedback: 顧客フィードバック分析
customer-contacts: 問い合わせ管理
staff: 社員コンディション管理
projects: プロジェクト管理
ai-chat: AIフリーチャット

[ai-basicグループ（選択）]
dispatch: AIディスパッチ・育成提案
ai-advisor: AI経営顧問
knowledge: AIナレッジ検索
weekly-report: 週次レポート自動生成
kpi: KPI目標管理
ai-logs: AIログ分析

[ai-specializedグループ（選択）]
churn-risk: 顧客離反リスクAI
cs-quality: CS品質スコアAI
staff-turnover: 社員離職リスクAI
sales-forecast: 売上予測AI

[ai-trainingグループ（選択）]
skill-game: スキル向上ゲーム
training-log: 研修ログ管理`

// ── 型定義 ──────────────────────────────────────────

export type ProposedModule = {
  id:      string
  enabled: boolean
  reason:  string
}

export type ProposeResponse = {
  success:  boolean
  summary?: string
  modules?: ProposedModule[]
  error?:   string
}

// ── Notion API ヘッダー ───────────────────────────────

function notionHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization':  `Bearer ${apiKey}`,
    'Content-Type':   'application/json',
    'Notion-Version': '2022-06-28',
  }
}

// ── Notion プロパティ値取得ヘルパー ──────────────────

type NotionProp = {
  title?:        Array<{ plain_text: string }>
  rich_text?:    Array<{ plain_text: string }>
  select?:       { name: string } | null
  multi_select?: Array<{ name: string }>
}

function getTitle(p?: NotionProp):       string   { return p?.title?.[0]?.plain_text   ?? '' }
function getText(p?: NotionProp):        string   { return p?.rich_text?.[0]?.plain_text ?? '' }
function getSelect(p?: NotionProp):      string   { return p?.select?.name              ?? '' }
function getMulti(p?: NotionProp):       string[] { return p?.multi_select?.map(v => v.name) ?? [] }

// ── GET ───────────────────────────────────────────────

export async function GET(request: Request) {
  const notionKey    = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!notionKey) {
    return NextResponse.json<ProposeResponse>(
      { success: false, error: 'NOTION_TOKEN が未設定です' },
      { status: 500 }
    )
  }
  if (!anthropicKey) {
    return NextResponse.json<ProposeResponse>(
      { success: false, error: 'ANTHROPIC_API_KEY が未設定です' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId') ?? ''

  if (!companyId) {
    return NextResponse.json<ProposeResponse>(
      { success: false, error: 'companyId が必要です' },
      { status: 400 }
    )
  }

  try {
    // ── Step 1: Notion からヒアリングデータを取得 ──
    const notionRes = await fetch(
      `https://api.notion.com/v1/databases/${HEARING_DB_ID}/query`,
      {
        method:  'POST',
        headers: notionHeaders(notionKey),
        body:    JSON.stringify({
          filter:    { property: '企業名', title: { equals: companyId } },
          page_size: 1,
        }),
      }
    )

    if (!notionRes.ok) {
      const errText = await notionRes.text()
      console.error('[menu-design/propose GET] Notion error:', errText.slice(0, 200))
      return NextResponse.json<ProposeResponse>(
        { success: false, error: 'Notion からのデータ取得に失敗しました' },
        { status: 500 }
      )
    }

    const notionData = await notionRes.json() as {
      results: Array<{ properties: Record<string, NotionProp> }>
    }

    if (notionData.results.length === 0) {
      return NextResponse.json<ProposeResponse>(
        { success: false, error: 'ヒアリングデータが見つかりません。先にヒアリングを保存してください。' },
        { status: 404 }
      )
    }

    // ── プロパティをヒアリングデータに変換 ──
    const p = notionData.results[0].properties
    const hearing = {
      companyName:      getText(p['企業表示名']),
      staffSize:        getSelect(p['スタッフ規模']),
      mainCustomers:    getText(p['主な顧客層']),
      serviceRating:    getSelect(p['サービス品質自己評価']),
      challenges:       getMulti(p['改善したい課題']).join('、'),
      goalIn6Months:    getText(p['6ヶ月後の目標']),
      biggestPain:      getText(p['今最も困っていること']),
      aiExperience:     getSelect(p['AI活用経験']),
      dataCollection:   getMulti(p['データ収集状況']).join('、'),
      priorityFeatures: getMulti(p['重視するAI機能']).join('、'),
    }

    // ── Step 2: Haiku でメニュー提案を生成 ──
    const prompt = `あなたはエクセレントサービス支援AIです。以下のヒアリング結果を分析し、
この企業に最適なAI機能メニューを選定してください。

【ヒアリング結果】
企業名: ${hearing.companyName}
スタッフ規模: ${hearing.staffSize}
主な顧客層: ${hearing.mainCustomers}
サービス品質自己評価: ${hearing.serviceRating}
改善したい課題: ${hearing.challenges}
6ヶ月後の目標: ${hearing.goalIn6Months}
今最も困っていること: ${hearing.biggestPain}
AI活用経験: ${hearing.aiExperience}
データ収集状況: ${hearing.dataCollection}
重視するAI機能: ${hearing.priorityFeatures}

【選定対象モジュール一覧】
${MODULE_LIST}

【出力形式（JSONのみ）】
{"summary":"30文字以内の提案コンセプト","modules":[{"id":"モジュールID","enabled":true,"reason":"20文字以内の理由"},...]}

【制約】
- coreグループ（dashboard/customer-feedback/customer-contacts/staff/projects/ai-chat）は必ずenabled:trueにすること
- AI活用経験が「未経験」の場合はai-specializedとai-basicを絞り込んで段階的導入を推奨すること
- 全18モジュールのエントリを必ず出力すること
- JSONのみ出力。説明文・コードブロック不要。簡潔さを最優先。`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('[menu-design/propose GET] Claude API error:', errText.slice(0, 200))
      return NextResponse.json<ProposeResponse>(
        { success: false, error: 'AI 分析に失敗しました' },
        { status: 500 }
      )
    }

    const claudeData = await claudeRes.json() as {
      content:     Array<{ text: string }>
      stop_reason: string
    }

    // stop_reason チェック（CLAUDE.md ルール）
    if (claudeData.stop_reason === 'max_tokens') {
      console.warn('[menu-design/propose] max_tokens に達しました。出力が途中で切れている可能性があります。')
    }

    const rawText = claudeData.content?.[0]?.text ?? ''

    // ── JSON 抽出（コードブロックが含まれる場合に対応）──
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[menu-design/propose] JSON が見つかりません:', rawText.slice(0, 300))
      return NextResponse.json<ProposeResponse>(
        { success: false, error: 'AI の回答を解析できませんでした' },
        { status: 500 }
      )
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      summary: string
      modules: Array<{ id: string; enabled: boolean; reason: string }>
    }

    return NextResponse.json<ProposeResponse>({
      success: true,
      summary: parsed.summary,
      modules: parsed.modules,
    })

  } catch (err) {
    console.error('[menu-design/propose GET] error:', err)
    return NextResponse.json<ProposeResponse>(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
