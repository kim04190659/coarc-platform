// =====================================================
//  src/app/api/weekly-report/generate/route.ts
//  週次レポート自動生成 — Claude Haikuがレポートを生成してNotionに保存する
//
//  ■ 処理フロー
//    1. KPI集計（問い合わせ管理DB）
//    2. 最新フィードバック上位10件
//    3. Claude Haiku → 週次レポートJSON生成
//    4. Notion企業ページ配下にレポートページを保存
//
//  ■ リクエスト（POST）
//    { companyId: string }
//
//  ■ レスポンス（成功）
//    {
//      success:   true
//      report:    WeeklyReport   // 生成されたレポート
//      pageId:    string         // NotionページID
//      pageUrl:   string         // Notionページのアクセス用URL
//    }
// =====================================================

import { NextResponse } from 'next/server'
import { COMPANY_DB_CONFIG } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'
import Anthropic from '@anthropic-ai/sdk'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type WeeklyReport = {
  title:           string    // レポートタイトル
  period:          string    // 集計期間
  summary:         string    // 週次サマリー（3〜4文）
  highlights:      string[]  // 今週のハイライト（最大3件）
  concerns:        string[]  // 懸念事項（最大2件）
  nextWeekActions: string[]  // 来週の優先アクション（最大3件）
  kpiComment:      string    // KPI所見（1文）
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

/** テキストを2000文字以内の段落ブロック配列に分割する */
function buildParagraphBlocks(text: string): object[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + 2000))
    start += 2000
  }
  return chunks.map(chunk => ({
    object: 'block',
    type:   'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: chunk } }],
    },
  }))
}

/** 箇条書きブロックを生成する */
function buildBulletBlock(text: string): object {
  return {
    object: 'block',
    type:   'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text.slice(0, 2000) } }],
    },
  }
}

/** h2見出しブロックを生成する */
function buildHeading2Block(text: string): object {
  return {
    object: 'block',
    type:   'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  }
}

// ── KPI集計 ─────────────────────────────────────────

async function fetchKpi(apiKey: string, dbId: string) {
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ page_size: 100 }),
  })
  if (!res.ok) return null

  const data = await res.json() as { results: Record<string, unknown>[] }
  const byStatus:   Record<string, number> = {}
  const byCategory: Record<string, number> = {}

  for (const page of data.results) {
    const props = page.properties as Record<string, { select?: { name?: string } }>
    const status   = props['ステータス']?.select?.name ?? '不明'
    const category = props['カテゴリ']?.select?.name   ?? '不明'
    byStatus[status]     = (byStatus[status]     ?? 0) + 1
    byCategory[category] = (byCategory[category] ?? 0) + 1
  }

  const total       = data.results.length
  const resolved    = byStatus['完了']   ?? 0
  const unresponded = byStatus['未対応'] ?? 0

  return { total, resolved, unresponded, byCategory }
}

// ── フィードバック取得 ─────────────────────────────

async function fetchFeedbacks(apiKey: string, dbId: string) {
  if (!dbId) return []
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({
      sorts: [{ property: '受付日時', direction: 'descending' }],
      page_size: 10,
    }),
  })
  if (!res.ok) return []

  const data = await res.json() as { results: Record<string, unknown>[] }

  return data.results.map(page => {
    const props = page.properties as Record<string, {
      select?:    { name?: string }
      rich_text?: Array<{ plain_text?: string }>
    }>

    const aiRaw = props['AI感情分析']?.rich_text?.[0]?.plain_text ?? ''
    let sentiment = ''
    let summary   = ''
    try {
      if (aiRaw) {
        const parsed = JSON.parse(aiRaw) as { sentiment?: string; summary?: string }
        sentiment = parsed.sentiment ?? ''
        summary   = parsed.summary   ?? ''
      }
    } catch { /* 無視 */ }

    return { rating: props['評価']?.select?.name ?? '', sentiment, summary }
  })
}

// ── メインハンドラー ────────────────────────────────

export async function POST(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'Anthropic APIキーが未設定です' }, { status: 500 })
  }

  try {
    const body = await request.json() as { companyId?: string }
    const { companyId } = body
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }

    const company  = getCompanyById(companyId)
    const dbConfig = COMPANY_DB_CONFIG[companyId]
    if (!dbConfig?.serviceContactDbId) {
      return NextResponse.json({ error: `企業ID "${companyId}" のDBが未設定です` }, { status: 500 })
    }

    // ── データ収集（並列実行）────────────────────────
    const [kpi, feedbacks] = await Promise.all([
      fetchKpi(notionKey, dbConfig.serviceContactDbId),
      fetchFeedbacks(notionKey, dbConfig.customerFeedbackDbId ?? ''),
    ])

    if (!kpi) {
      return NextResponse.json({ error: 'KPIデータの取得に失敗しました' }, { status: 500 })
    }

    // ── 集計期間の算出（本日から1週間前まで）────────────
    const today    = new Date()
    const weekAgo  = new Date(today)
    weekAgo.setDate(today.getDate() - 7)
    const period   = `${weekAgo.toLocaleDateString('ja-JP')} 〜 ${today.toLocaleDateString('ja-JP')}`
    const todayStr = today.toLocaleDateString('ja-JP')

    // ── フィードバック傾向集計 ──────────────────────
    const posCount = feedbacks.filter(f => f.sentiment === 'ポジティブ').length
    const negCount = feedbacks.filter(f => f.sentiment === 'ネガティブ').length

    const topCategories = Object.entries(kpi.byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, count]) => `${cat}(${count}件)`)
      .join('、')

    const fbText = feedbacks
      .filter(f => f.summary)
      .slice(0, 5)
      .map(f => `[${f.sentiment || f.rating}] ${f.summary}`)
      .join('\n')

    const industry =
      company.industry === 'hotel'   ? 'ホテル・宿泊業' :
      company.industry === 'medical' ? '医療・クリニック' :
      company.industry === 'food'    ? '飲食・チェーン店' :
      '小売・ストア'

    // ── Claude Haiku でレポート生成 ──────────────────
    const client = new Anthropic({ apiKey: anthropicKey })

    // CLAUDE.md ルール: JSON出力形式を明示的に制限
    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      `{"title":"週次レポート〜${todayStr}","period":"集計期間","summary":"3〜4文の週次サマリー",`,
      '"highlights":["ハイライト1","ハイライト2","ハイライト3"],"concerns":["懸念1","懸念2"],',
      '"nextWeekActions":["アクション1","アクション2","アクション3"],"kpiComment":"KPI所見1文"}',
      '※ JSONのみ出力。説明文・コードブロック不要。簡潔さを最優先。日本語で出力。',
    ].join('\n')

    const prompt = `あなたは${industry}の経営サポートAIです。
以下のデータをもとに、${company.name}の週次経営レポートを生成してください。

【集計期間】${period}

【問い合わせKPI】
- 総件数: ${kpi.total}件
- 解決済み: ${kpi.resolved}件（解決率${kpi.total > 0 ? Math.round(kpi.resolved / kpi.total * 100) : 0}%）
- 未対応: ${kpi.unresponded}件
- 主要カテゴリ: ${topCategories || 'データなし'}

【顧客フィードバック（直近10件）】
- ポジティブ: ${posCount}件 / ネガティブ: ${negCount}件
${fbText ? `- フィードバック内容:\n${fbText}` : '- データなし'}

${outputFormat}`

    const res = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,  // CLAUDE.md ルール: 4096固定
      messages:   [{ role: 'user', content: prompt }],
    })

    // CLAUDE.md ルール: stop_reason チェック
    if (res.stop_reason === 'max_tokens') {
      console.warn('[weekly-report] max_tokens に達しました')
    }

    const text    = res.content[0]?.type === 'text' ? res.content[0].text.trim() : ''
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const report  = JSON.parse(jsonStr) as WeeklyReport

    // ── Notionに週次レポートページを保存 ────────────────
    // 企業ページの子ページとして作成する
    const notionPageTitle = `📋 週次レポート — ${todayStr}`

    const notionBlocks = [
      // サマリーセクション
      buildHeading2Block('📊 週次サマリー'),
      ...buildParagraphBlocks(report.summary),

      // ハイライトセクション
      buildHeading2Block('✅ 今週のハイライト'),
      ...report.highlights.map(h => buildBulletBlock(h)),

      // 懸念事項セクション
      buildHeading2Block('⚠️ 懸念事項'),
      ...report.concerns.map(c => buildBulletBlock(c)),

      // 来週のアクション
      buildHeading2Block('🎯 来週の優先アクション'),
      ...report.nextWeekActions.map(a => buildBulletBlock(a)),

      // KPI所見
      buildHeading2Block('📈 KPI所見'),
      ...buildParagraphBlocks(report.kpiComment),

      // フッター
      buildHeading2Block('ℹ️ 生成情報'),
      ...buildParagraphBlocks(
        `生成日時: ${new Date().toLocaleString('ja-JP')}\n集計期間: ${period}\n` +
        `問い合わせ件数: ${kpi.total}件 / 解決率: ${kpi.total > 0 ? Math.round(kpi.resolved / kpi.total * 100) : 0}%\n` +
        `フィードバック: ポジティブ${posCount}件・ネガティブ${negCount}件\n` +
        '※ このレポートはAIによる自動生成です。数値は概算です。'
      ),
    ]

    const pageRes = await fetch(`${NOTION_API}/pages`, {
      method: 'POST',
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        parent:   { page_id: company.notionPageId },
        properties: {
          title: {
            title: [{ type: 'text', text: { content: notionPageTitle } }],
          },
        },
        children: notionBlocks,
      }),
    })

    if (!pageRes.ok) {
      const errBody = await pageRes.text()
      console.error('[weekly-report] Notion保存エラー:', pageRes.status, errBody)
      // Notion保存が失敗してもレポート内容は返す（graceful degradation）
      return NextResponse.json({
        success: true,
        report,
        pageId:  null,
        pageUrl: null,
        warning: `Notionへの保存に失敗しました (${pageRes.status})`,
      })
    }

    const page = await pageRes.json() as { id: string; url?: string }

    return NextResponse.json({
      success: true,
      report,
      pageId:  page.id,
      pageUrl: page.url ?? `https://notion.so/${page.id.replace(/-/g, '')}`,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[weekly-report/generate] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
