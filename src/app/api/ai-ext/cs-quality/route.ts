// =====================================================
//  src/app/api/ai-ext/cs-quality/route.ts
//  CS品質スコアAI — Sprint #21
//
//  ■ GET ?companyId=xxx
//    問い合わせ管理DBを集計し、Claude Haiku で
//    CS品質を4次元（応答速度/解決率/顧客満足/問題対応力）
//    にスコアリング（各25点満点・合計100点）して返す。
//
//  ■ 設計ポイント
//    - 1DBのみ参照（churn-risk より構造がシンプル）
//    - ステータス/優先度/カテゴリの分布を統計化してから送信
//    - Haiku max_tokens: 4096 固定
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type CsQualityResult = {
  totalScore:   number          // 0〜100 合計スコア
  dimensions:   CsDimension[]  // 4次元スコア（各25点満点）
  strengths:    string[]        // 強み（最大3件・1文以内）
  improvements: CsImprovement[] // 改善点（最大3件）
  summary:      string          // 2文以内の総評
  stats: {
    totalContacts:    number
    resolvedCount:    number
    pendingCount:     number
    highPriorityCount: number
    resolutionRate:   number    // % (0〜100)
  }
}

type CsDimension = {
  name:  string   // 次元名（応答速度 / 解決率 / 顧客満足 / 問題対応力）
  score: number   // 0〜25
  max:   25
  comment: string // 1文の評価コメント
}

type CsImprovement = {
  priority: '高' | '中' | '低'
  title:    string   // 20文字以内
  detail:   string   // 1〜2文
  action:   string   // 具体的アクション（1文）
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── 問い合わせ統計を計算 ────────────────────────────
// Haikuに送る前に集計値に変換する（JSON節約 + 精度向上）

type ContactStats = {
  total:          number
  byStatus:       Record<string, number>  // ステータス別件数
  byPriority:     Record<string, number>  // 優先度別件数
  byCategory:     Record<string, number>  // カテゴリ別件数
  highPriorityPending: number             // 高優先度×未対応/対応中
  recentContents: string[]                // 最新問い合わせ内容（最大8件）
}

async function fetchContactStats(dbId: string, notionKey: string): Promise<ContactStats | null> {
  if (!dbId) return null

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 50,  // CS品質分析は多めに取得して統計精度を上げる
    }),
  })
  if (!res.ok) return null

  const data = await res.json() as { results: Record<string, unknown>[] }
  const records = data.results

  const stats: ContactStats = {
    total:               records.length,
    byStatus:            {},
    byPriority:          {},
    byCategory:          {},
    highPriorityPending: 0,
    recentContents:      [],
  }

  for (const page of records) {
    const props = page.properties as Record<string, {
      title?:     Array<{ plain_text?: string }>
      rich_text?: Array<{ plain_text?: string }>
      select?:    { name?: string }
    }>

    const getText = (p: typeof props[string] | undefined) =>
      p?.title?.[0]?.plain_text ?? p?.rich_text?.[0]?.plain_text ?? ''

    // ステータス集計
    const status = props['ステータス']?.select?.name ?? '不明'
    stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1

    // 優先度集計
    const priority = props['優先度']?.select?.name ?? '不明'
    stats.byPriority[priority] = (stats.byPriority[priority] ?? 0) + 1

    // カテゴリ集計
    const category = props['カテゴリ']?.select?.name ?? '不明'
    stats.byCategory[category] = (stats.byCategory[category] ?? 0) + 1

    // 高優先度×未解決カウント
    const isPending = ['未対応', '対応中'].includes(status)
    if (priority === '高' && isPending) {
      stats.highPriorityPending++
    }

    // 問い合わせ内容を最大8件収集（Haikuへの定性情報）
    if (stats.recentContents.length < 8) {
      const content = getText(props['件名'])
      if (content) stats.recentContents.push(content)
    }
  }

  return stats
}

// ── GET ─────────────────────────────────────────────

export async function GET(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'Anthropic APIキーが未設定です' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId') ?? 'kitano-resort'

  const dbConfig = getCompanyDbConfig(companyId)

  try {
    // ① 問い合わせDBを集計
    const stats = await fetchContactStats(dbConfig.serviceContactDbId, notionKey)

    if (!stats || stats.total === 0) {
      // データなし時のデフォルト値
      return NextResponse.json({
        totalScore: 50,
        dimensions: [
          { name: '応答速度',   score: 13, max: 25, comment: 'データ不足のため評価できません' },
          { name: '解決率',     score: 13, max: 25, comment: 'データ不足のため評価できません' },
          { name: '顧客満足',   score: 12, max: 25, comment: 'データ不足のため評価できません' },
          { name: '問題対応力', score: 12, max: 25, comment: 'データ不足のため評価できません' },
        ],
        strengths:    [],
        improvements: [],
        summary: '問い合わせデータが不足しています。データを蓄積することで精度が上がります。',
        stats: { totalContacts: 0, resolvedCount: 0, pendingCount: 0, highPriorityCount: 0, resolutionRate: 0 },
      } satisfies CsQualityResult)
    }

    // ② 統計サマリーテキストを生成（Haikuへ送信）
    const resolvedCount = (stats.byStatus['解決済み'] ?? 0) + (stats.byStatus['クローズ'] ?? 0)
    const pendingCount  = (stats.byStatus['未対応'] ?? 0) + (stats.byStatus['対応中'] ?? 0)
    const resolutionRate = stats.total > 0
      ? Math.round((resolvedCount / stats.total) * 100)
      : 0

    const statusText    = Object.entries(stats.byStatus)
      .map(([k, v]) => `${k}:${v}件`).join(' / ')
    const priorityText  = Object.entries(stats.byPriority)
      .map(([k, v]) => `${k}:${v}件`).join(' / ')
    const categoryText  = Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k}:${v}件`).join(' / ')
    const recentText    = stats.recentContents.slice(0, 8).join(' / ')

    // ── プロンプト出力制限（CLAUDE.md準拠）──
    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      '{"totalScore":0〜100の整数,',
      '"dimensions":[必ず4件 {"name":"応答速度|解決率|顧客満足|問題対応力","score":0〜25の整数,"max":25,"comment":"1文のコメント"}],',
      '"strengths":["最大3件・1文以内"],',
      '"improvements":[最大3件 {"priority":"高|中|低","title":"20文字以内","detail":"1〜2文","action":"具体的アクション1文"}],',
      '"summary":"2文以内の総評"}',
      '※ totalScore は dimensions の score 合計と一致させること。',
      '※ JSONのみ出力。説明文・コードブロック不要。簡潔さを最優先。',
    ].join('\n')

    const client = new Anthropic({ apiKey: anthropicKey })

    const startTime = Date.now()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `以下は顧客対応（CS）の統計データです。CS品質を4次元でスコアリングしてください。

■ 基本統計
・総件数: ${stats.total}件
・解決済み: ${resolvedCount}件（解決率 ${resolutionRate}%）
・未解決: ${pendingCount}件
・高優先度×未解決: ${stats.highPriorityPending}件

■ ステータス分布: ${statusText}
■ 優先度分布: ${priorityText}
■ カテゴリ上位5位: ${categoryText}

■ 最近の問い合わせ件名（最大8件）: ${recentText}

スコアリング基準:
- 応答速度（25点満点）: 未対応件数の少なさ・迅速処理
- 解決率（25点満点）: 解決済み割合・高優先度対応
- 顧客満足（25点満点）: 問い合わせ種別・カテゴリ傾向から推定
- 問題対応力（25点満点）: 高優先度案件の対応状況・カテゴリ対応幅

${outputFormat}`,
      }],
    })

    const elapsed = Date.now() - startTime

    // stop_reason チェック（CLAUDE.md準拠）
    if (message.stop_reason === 'max_tokens') {
      console.warn('[cs-quality] max_tokens に達したため出力が切れている可能性があります')
    }

    // ③ JSONパース
    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleanedText = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    let result: Omit<CsQualityResult, 'stats'>
    try {
      result = JSON.parse(cleanedText)
    } catch {
      console.error('[cs-quality] JSONパースエラー:', cleanedText.slice(0, 200))
      throw new Error('AI分析結果のJSONパースに失敗しました')
    }

    console.log(`[cs-quality] 分析完了 companyId=${companyId} score=${result.totalScore} elapsed=${elapsed}ms`)

    return NextResponse.json({
      ...result,
      stats: {
        totalContacts:     stats.total,
        resolvedCount,
        pendingCount,
        highPriorityCount: stats.byPriority['高'] ?? 0,
        resolutionRate,
      },
    } satisfies CsQualityResult)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cs-quality] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
