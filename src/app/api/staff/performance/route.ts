// =====================================================
//  src/app/api/staff/performance/route.ts
//  スタッフパフォーマンスサマリーAPI — Sprint #44
//
//  ■ GET ?companyId=xxx
//    ① 感動ログDB・研修ログDBをスタッフ名で集計
//    ② 感動貢献度・研修達成数・総合スコアを算出
//    ③ 上位スタッフにHaikuがAIコメントを一括生成
//    ④ パフォーマンスランク順で返却
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type PerformanceRank = 'スター' | 'エース' | '成長中' | '新人'

export type StaffPerformance = {
  staffName:        string
  // 感動ログ貢献
  delightLogCount:  number
  avgDelightScore:  number    // 1〜5
  topCategory:      string    // 最も多い感動カテゴリ
  // 研修実績
  trainingCount:    number
  avgTrainingScore: number    // 0〜100
  bestGrade:        string    // 'S'|'A'|'B'|'C'|'D'
  // 総合評価
  performanceScore: number    // 0〜100
  rank:             PerformanceRank
  aiComment:        string    // Haikuが生成した強み一言コメント
}

// ── Notion API ヘッダー ───────────────────────────────

function headers(key: string): Record<string, string> {
  return {
    'Authorization':  `Bearer ${key}`,
    'Content-Type':   'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── テキスト取得ヘルパー ──────────────────────────────

function getText(props: Record<string, unknown>, key: string): string {
  const p = props[key] as Record<string, unknown> | undefined
  if (!p) return ''
  if (p.type === 'title'     && Array.isArray(p.title))     return (p.title     as { plain_text: string }[]).map(t => t.plain_text).join('')
  if (p.type === 'rich_text' && Array.isArray(p.rich_text)) return (p.rich_text as { plain_text: string }[]).map(t => t.plain_text).join('')
  if (p.type === 'select')   return (p.select as { name?: string } | null)?.name ?? ''
  return ''
}

function getNumber(props: Record<string, unknown>, key: string): number {
  const p = props[key] as Record<string, unknown> | undefined
  if (!p || p.type !== 'number') return 0
  return (p.number as number | null) ?? 0
}

// ── ランク判定 ────────────────────────────────────────

function calcRank(score: number): PerformanceRank {
  if (score >= 75) return 'スター'
  if (score >= 50) return 'エース'
  if (score >= 25) return '成長中'
  return '新人'
}

// ── Haiku で AIコメントを一括生成 ────────────────────

async function generateComments(
  companyName: string,
  staffList: Array<{ name: string; delightCount: number; avgScore: number; trainingCount: number; topCategory: string }>,
  anthropicKey: string,
): Promise<string[]> {
  if (staffList.length === 0) return []

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const listText = staffList.slice(0, 8).map((s, i) =>
    `${i + 1}. ${s.name}（感動ログ${s.delightCount}件・平均${s.avgScore.toFixed(1)}点・研修${s.trainingCount}回・得意:${s.topCategory || '未設定'}）`
  ).join('\n')

  const prompt = `あなたは${companyName}のAI人材育成アドバイザーです。
以下のスタッフリストについて、それぞれの強みを表す一言コメントを生成してください。

【スタッフリスト】
${listText}

【生成ルール】
- 各スタッフに1つのコメント（30文字以内）
- 感動ログ数・スコア・研修実績を活かした個別性のある内容
- 前向きで励みになるトーン

【出力形式（JSON）— 必ずこの形式のみで回答すること】
{"comments":["コメント1","コメント2","コメント3",...]}
※ JSONのみ出力。説明文・コードブロック不要。リストの順番通りに出力すること。`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text    = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed  = JSON.parse(cleaned) as { comments: string[] }
  return parsed.comments ?? []
}

// ── メイン GET ハンドラー ─────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const companyId   = searchParams.get('companyId') ?? 'kitano-resort'

  const notionKey    = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''

  if (!notionKey || !anthropicKey) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
  }

  const db      = getCompanyDbConfig(companyId)
  const company = getCompanyById(companyId)

  // ── ① 感動ログを取得してスタッフ別集計 ─────────────
  // staffName → { count, scoreSum, categories }
  const delightMap = new Map<string, { count: number; scoreSum: number; categories: Record<string, number> }>()

  if (db.delightLogDbId) {
    try {
      const res = await fetch(`${NOTION_API}/databases/${db.delightLogDbId}/query`, {
        method: 'POST',
        headers: headers(notionKey),
        body: JSON.stringify({
          sorts: [{ timestamp: 'created_time', direction: 'descending' }],
          page_size: 100,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { results: Record<string, unknown>[] }
        for (const page of data.results) {
          const props    = page.properties as Record<string, unknown>
          const name     = getText(props, 'スタッフ名')
          const score    = getNumber(props, '感動スコア')
          const category = getText(props, '感動カテゴリ')
          if (!name) continue

          const entry = delightMap.get(name) ?? { count: 0, scoreSum: 0, categories: {} }
          entry.count++
          entry.scoreSum += score
          if (category) entry.categories[category] = (entry.categories[category] ?? 0) + 1
          delightMap.set(name, entry)
        }
      }
    } catch (err) {
      console.error('[staff/performance] 感動ログ取得エラー:', err)
    }
  }

  // ── ② 研修ログを取得してスタッフ別集計 ─────────────
  // staffName → { count, scoreSum, grades }
  const trainingMap = new Map<string, { count: number; scoreSum: number; grades: string[] }>()

  if (db.trainingLogDbId) {
    try {
      const res = await fetch(`${NOTION_API}/databases/${db.trainingLogDbId}/query`, {
        method: 'POST',
        headers: headers(notionKey),
        body: JSON.stringify({
          sorts: [{ property: '実施日', direction: 'descending' }],
          page_size: 100,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { results: Record<string, unknown>[] }
        for (const page of data.results) {
          const props = page.properties as Record<string, unknown>
          const name  = getText(props, '氏名')
          const score = getNumber(props, 'スコア')
          const grade = getText(props, 'グレード')
          if (!name) continue

          const entry = trainingMap.get(name) ?? { count: 0, scoreSum: 0, grades: [] }
          entry.count++
          entry.scoreSum += score
          if (grade) entry.grades.push(grade)
          trainingMap.set(name, entry)
        }
      }
    } catch (err) {
      console.error('[staff/performance] 研修ログ取得エラー:', err)
    }
  }

  // ── ③ 全スタッフ名を統合して集計 ───────────────────
  const allNames = new Set([
    ...Array.from(delightMap.keys()),
    ...Array.from(trainingMap.keys()),
  ])

  if (allNames.size === 0) {
    return NextResponse.json({ staff: [] })
  }

  const staffList: StaffPerformance[] = Array.from(allNames).map(name => {
    const d = delightMap.get(name)
    const t = trainingMap.get(name)

    const delightLogCount  = d?.count ?? 0
    const avgDelightScore  = delightLogCount > 0 ? (d!.scoreSum / delightLogCount) : 0
    const topCategory      = d
      ? Object.entries(d.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
      : ''

    const trainingCount    = t?.count ?? 0
    const avgTrainingScore = trainingCount > 0 ? (t!.scoreSum / trainingCount) : 0
    const gradeOrder       = ['S', 'A', 'B', 'C', 'D']
    const bestGrade        = t?.grades.length
      ? t.grades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))[0]
      : '—'

    // 総合スコア（0〜100）
    const delightScore   = Math.min(delightLogCount * 8, 40) + Math.min(avgDelightScore * 8, 40)
    const trainingScore  = Math.min(trainingCount * 5, 15) + (avgTrainingScore / 100) * 5
    const performanceScore = Math.min(Math.round(delightScore + trainingScore), 100)

    return {
      staffName: name,
      delightLogCount,
      avgDelightScore,
      topCategory,
      trainingCount,
      avgTrainingScore,
      bestGrade,
      performanceScore,
      rank:      calcRank(performanceScore),
      aiComment: '',    // 後で生成
    }
  })

  // 総合スコア降順でソート
  staffList.sort((a, b) => b.performanceScore - a.performanceScore)

  // ── ④ Haiku で AIコメントを一括生成（上位8名） ───────
  let comments: string[] = []
  try {
    comments = await generateComments(
      company.name,
      staffList.slice(0, 8).map(s => ({
        name:          s.staffName,
        delightCount:  s.delightLogCount,
        avgScore:      s.avgDelightScore,
        trainingCount: s.trainingCount,
        topCategory:   s.topCategory,
      })),
      anthropicKey,
    )
  } catch (err) {
    console.error('[staff/performance] Haiku生成エラー:', err)
  }

  // コメントをマージ
  const result: StaffPerformance[] = staffList.map((s, i) => ({
    ...s,
    aiComment: comments[i] ?? `${s.staffName}さんの活躍に期待しています！`,
  }))

  return NextResponse.json({ staff: result })
}
