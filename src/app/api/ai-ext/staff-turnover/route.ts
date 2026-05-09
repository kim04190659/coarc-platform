// =====================================================
//  src/app/api/ai-ext/staff-turnover/route.ts
//  社員離職リスクAI — Sprint #22
//
//  ■ GET ?companyId=xxx
//    社員コンディションDB（最新3件/人）+ 社員マスタDBを
//    並列取得し、Claude Haiku で離職リスクを分析する。
//
//  ■ 出力
//    - 組織全体のリスクレベル（high/medium/low）
//    - 要注意社員リスト（最大6名・リスク/サイン/介入策）
//    - 組織シグナル一覧（最大3件）
//    - 推奨アクション（最大3件）
//
//  ■ 設計ポイント
//    - 社員別に最新3件のコンディション履歴を集計（トレンド把握）
//    - 低スコア・高負荷・悪化傾向の社員を優先選出
//    - 上位12名に絞ってHaikuに送信（JSON切れ防止）
//    - 個人情報への配慮：AIコメントは業務改善視点のみ
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type StaffTurnoverResult = {
  overallRisk:       'high' | 'medium' | 'low'
  summary:           string           // 2文以内の組織全体評価
  atRiskStaff:       AtRiskStaff[]    // 要注意社員（最大6名）
  organizationSignals: string[]       // 組織全体シグナル（最大3件）
  recommendations:   TurnoverAction[] // 推奨アクション（最大3件）
  stats: {
    totalStaff:       number
    analyzedStaff:    number
    lowConditionCount: number   // ⭐2以下の社員数
    highWorkloadCount: number   // 業務負荷「高」の社員数
  }
}

type AtRiskStaff = {
  name:         string           // 社員名
  department:   string           // 部署
  riskLevel:    '高' | '中' | '低'
  signs:        string[]         // リスクサイン（最大2件・1文以内）
  intervention: string           // 推奨介入策（1文）
}

type TurnoverAction = {
  priority: '高' | '中' | '低'
  title:    string   // 20文字以内
  detail:   string   // 1〜2文
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── コンディションスコア（select値 → 数値）─────────────

function parseConditionScore(selectName: string): number {
  const match = selectName.match(/[1-5]/)
  return match ? parseInt(match[0], 10) : 3
}

// ── 社員マスタ取得（部署・役職情報のみ）────────────────

type StaffInfo = { name: string; department: string; joinYear: string }

async function fetchStaffInfo(dbId: string, notionKey: string): Promise<Map<string, StaffInfo>> {
  if (!dbId) return new Map()

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({ page_size: 50 }),
  })
  if (!res.ok) return new Map()

  const data = await res.json() as { results: Record<string, unknown>[] }
  const map = new Map<string, StaffInfo>()

  for (const page of data.results) {
    const props = page.properties as Record<string, {
      title?:     Array<{ plain_text?: string }>
      rich_text?: Array<{ plain_text?: string }>
      select?:    { name?: string }
    }>
    const getText = (p: typeof props[string] | undefined) =>
      p?.title?.[0]?.plain_text ?? p?.rich_text?.[0]?.plain_text ?? ''

    const name = getText(props['社員名']) || getText(props['氏名'])
    if (!name) continue

    map.set(name, {
      name,
      department: props['部署']?.select?.name ?? '不明',
      joinYear:   getText(props['入社年']) || '不明',
    })
  }

  return map
}

// ── コンディション履歴取得（社員別 最大3件）────────────

type ConditionRecord = {
  score:      number    // 1〜5
  label:      string    // "⭐2 不調" 等の元テキスト
  workload:   string    // 高/中/低
  workStyle:  string    // 出勤/テレワーク/休暇
  recordedAt: string
  memo:       string
}

async function fetchConditionHistory(
  dbId: string,
  notionKey: string,
): Promise<Map<string, ConditionRecord[]>> {
  if (!dbId) return new Map()

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      sorts: [{ property: '記録日', direction: 'descending' }],
      page_size: 100,
    }),
  })
  if (!res.ok) return new Map()

  const data = await res.json() as { results: Record<string, unknown>[] }
  const historyMap = new Map<string, ConditionRecord[]>()

  for (const page of data.results) {
    const props = page.properties as Record<string, {
      title?:     Array<{ plain_text?: string }>
      rich_text?: Array<{ plain_text?: string }>
      select?:    { name?: string }
      date?:      { start?: string }
    }>
    const getText = (p: typeof props[string] | undefined) =>
      p?.title?.[0]?.plain_text ?? p?.rich_text?.[0]?.plain_text ?? ''

    const staffName = getText(props['社員名'])
    if (!staffName) continue

    // 1人あたり最大3件まで記録
    const existing = historyMap.get(staffName) ?? []
    if (existing.length >= 3) continue

    const condLabel = props['体調']?.select?.name ?? props['コンディション']?.select?.name ?? ''

    existing.push({
      score:      parseConditionScore(condLabel),
      label:      condLabel,
      workload:   props['業務負荷']?.select?.name ?? '不明',
      workStyle:  props['勤務形態']?.select?.name ?? '不明',
      recordedAt: props['記録日']?.date?.start ?? '',
      memo:       getText(props['コメント']) || getText(props['メモ']),
    })
    historyMap.set(staffName, existing)
  }

  return historyMap
}

// ── リスクスコア計算（優先順位付けに使う）──────────────

function calcRiskScore(records: ConditionRecord[]): number {
  if (records.length === 0) return 0
  // 最新スコアを重く（新しいほど高ウェイト）
  const weights = [3, 2, 1]
  let totalWeight = 0, weightedScore = 0
  for (let i = 0; i < records.length; i++) {
    const w = weights[i] ?? 1
    weightedScore += (6 - records[i].score) * w  // スコアが低いほど高リスク
    totalWeight   += w
    // 業務負荷「高」はリスク加算
    if (records[i].workload === '高') weightedScore += w * 0.5
  }
  return totalWeight > 0 ? weightedScore / totalWeight : 0
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
    // ① 社員マスタ + コンディション履歴を並列取得
    const [staffInfoMap, historyMap] = await Promise.all([
      fetchStaffInfo(dbConfig.staffProfileDbId, notionKey),
      fetchConditionHistory(dbConfig.staffConditionDbId, notionKey),
    ])

    // ② リスクスコアで降順ソート → 上位12名に絞る
    const allStaff = Array.from(historyMap.entries())
      .map(([name, records]) => ({
        name,
        records,
        riskScore: calcRiskScore(records),
        info: staffInfoMap.get(name) ?? { name, department: '不明', joinYear: '不明' },
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 12)

    // ③ 統計値計算
    const totalStaff       = staffInfoMap.size || historyMap.size
    const lowConditionCount = Array.from(historyMap.values())
      .filter(records => records[0]?.score <= 2).length
    const highWorkloadCount = Array.from(historyMap.values())
      .filter(records => records[0]?.workload === '高').length

    if (allStaff.length === 0) {
      return NextResponse.json({
        overallRisk: 'low',
        summary: 'コンディションデータが不足しています。社員のコンディション記録を蓄積してください。',
        atRiskStaff: [],
        organizationSignals: [],
        recommendations: [],
        stats: { totalStaff, analyzedStaff: 0, lowConditionCount: 0, highWorkloadCount: 0 },
      } satisfies StaffTurnoverResult)
    }

    // ④ Haiku送信用テキスト生成
    const staffDataText = allStaff.map((s, i) => {
      const dept    = s.info.department
      const records = s.records
      const trend   = records.length >= 2
        ? (records[0].score < records[records.length - 1].score ? '悪化' : records[0].score > records[records.length - 1].score ? '改善' : '横ばい')
        : 'データ少'
      const recentScores = records.map(r => `${r.label}(負荷:${r.workload})`).join('→')
      return `[社員${i + 1}] ${s.name}（${dept}） スコア推移:${recentScores} トレンド:${trend}`
    }).join('\n')

    // ── プロンプト出力制限（CLAUDE.md準拠）──
    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      '{"overallRisk":"high|medium|low",',
      '"summary":"2文以内の組織全体評価",',
      '"atRiskStaff":[最大6名 {"name":"社員名","department":"部署","riskLevel":"高|中|低","signs":["最大2件・1文以内"],"intervention":"推奨介入策1文"}],',
      '"organizationSignals":["最大3件・1文以内"],',
      '"recommendations":[最大3件 {"priority":"高|中|低","title":"20文字以内","detail":"1〜2文"}]}',
      '※ JSONのみ出力。説明文・コードブロック不要。個人情報配慮で具体的な病名・個人属性は含めないこと。',
    ].join('\n')

    const client = new Anthropic({ apiKey: anthropicKey })

    const startTime = Date.now()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `以下は社員のコンディション履歴データです。離職リスクを分析し、組織として対応が必要な社員と組織シグナルを特定してください。

■ 組織全体統計
・社員総数: ${totalStaff}名
・低コンディション社員（⭐2以下）: ${lowConditionCount}名
・高業務負荷社員: ${highWorkloadCount}名
・分析対象（リスク上位）: ${allStaff.length}名

■ 社員別コンディション履歴（スコア推移 高いほど良好）
${staffDataText}

分析の観点:
- 継続的な低スコア（⭐1〜2）は要注意
- 業務負荷「高」が続く場合はバーンアウトリスク
- スコアが短期間で急落した場合は特に注意
- 複数の部署で同時低下は組織的問題の可能性

${outputFormat}`,
      }],
    })

    const elapsed = Date.now() - startTime

    if (message.stop_reason === 'max_tokens') {
      console.warn('[staff-turnover] max_tokens に達したため出力が切れている可能性があります')
    }

    // ⑤ JSONパース
    const rawText     = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleanedText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

    let result: Omit<StaffTurnoverResult, 'stats'>
    try {
      result = JSON.parse(cleanedText)
    } catch {
      console.error('[staff-turnover] JSONパースエラー:', cleanedText.slice(0, 200))
      throw new Error('AI分析結果のJSONパースに失敗しました')
    }

    console.log(`[staff-turnover] 完了 companyId=${companyId} risk=${result.overallRisk} elapsed=${elapsed}ms`)

    return NextResponse.json({
      ...result,
      stats: {
        totalStaff,
        analyzedStaff:    allStaff.length,
        lowConditionCount,
        highWorkloadCount,
      },
    } satisfies StaffTurnoverResult)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[staff-turnover] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
