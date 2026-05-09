// =====================================================
//  src/app/api/skill-game/recommend/route.ts
//  スキルゲーム推薦API — Sprint #24
//
//  ■ GET ?companyId=xxx&staffName=yyy
//    staffDBから社員プロフィールを読み取り、
//    Claude Haiku がスキルギャップを分析して
//    最適なゲームを3件推薦する。
//
//  ■ 出力
//    - recommendations: GameRecommendation[] （最大3件）
//    - staffProfile:    対象社員の情報サマリー
//    - skillLevel:      総合スキルレベル（1〜5）
//    - industry:        業種
//
//  ■ 設計ポイント
//    - staffName 未指定時はランダム推薦（業種・難易度Lv.1優先）
//    - スキルレベルは役職 + 勤続年数から算出（追加DB不要）
//    - Haiku max_tokens: 4096 固定
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'
import {
  GAME_CATALOG,
  getIndustryByCompanyId,
  CATEGORY_LABELS,
  INDUSTRY_LABELS,
  type GameIndustry,
} from '@/config/skill-game-catalog'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type GameRecommendation = {
  gameId:   string
  title:    string
  reason:   string   // 推薦理由（1〜2文）
  priority: 1 | 2 | 3
}

export type RecommendResult = {
  recommendations: GameRecommendation[]
  staffProfile: {
    name:       string
    role:       string
    department: string
    skillSet:   string[]
    skillLevel: number   // 1〜5
  } | null
  industry:   GameIndustry
  totalGames: number
}

// ── スキルレベル算出 ────────────────────────────────
// 追加DBなしで役職・勤続年数から推定する

function calcSkillLevel(role: string, joinYear: number): number {
  // 役職ベースの推定（上位役職ほど高スコア）
  const roleKeywords: [string, number][] = [
    ['代表', 5], ['社長', 5], ['取締役', 5],
    ['部長', 4], ['マネージャー', 4], ['本部長', 4],
    ['リーダー', 3], ['主任', 3], ['係長', 3],
    ['チーフ', 2], ['一般', 2], ['スタッフ', 2],
  ]
  const byRole = roleKeywords.find(([k]) => role.includes(k))?.[1] ?? 2

  // 勤続年数ベースの推定
  const yearsWorked = new Date().getFullYear() - (joinYear || new Date().getFullYear() - 1)
  const byYears =
    yearsWorked >= 10 ? 5 :
    yearsWorked >= 7  ? 4 :
    yearsWorked >= 4  ? 3 :
    yearsWorked >= 2  ? 2 : 1

  // 平均を丸める（1〜5 にクランプ）
  return Math.min(5, Math.max(1, Math.round((byRole + byYears) / 2)))
}

// ── 社員プロフィール取得 ────────────────────────────

async function fetchStaffProfile(
  notionKey: string,
  staffProfileDbId: string,
  staffName: string,
) {
  if (!staffProfileDbId) return null

  const res = await fetch(`${NOTION_API}/databases/${staffProfileDbId}/query`, {
    method: 'POST',
    headers: {
      'Authorization':  `Bearer ${notionKey}`,
      'Content-Type':   'application/json',
      'Notion-Version': NOTION_VER,
    },
    body: JSON.stringify({
      filter: {
        or: [
          { property: '社員名', title: { equals: staffName } },
          { property: '氏名',   title: { equals: staffName } },
        ],
      },
      page_size: 1,
    }),
  })

  if (!res.ok) return null

  const data = await res.json() as { results: Record<string, unknown>[] }
  if (data.results.length === 0) return null

  const page  = data.results[0]
  const props = page.properties as Record<string, {
    title?:     Array<{ plain_text?: string }>
    rich_text?: Array<{ plain_text?: string }>
    select?:    { name?: string }
  }>

  const getText = (p: typeof props[string] | undefined) =>
    p?.title?.[0]?.plain_text ?? p?.rich_text?.[0]?.plain_text ?? ''

  const role     = getText(props['役職'])
  const joinText = getText(props['入社年'])
  const joinYear = parseInt(joinText) || 0
  const skillSet = getText(props['スキルセット'])
    .split(/[,、，]/)
    .map(s => s.trim())
    .filter(Boolean)

  return {
    name:       getText(props['社員名']) || getText(props['氏名']),
    role,
    department: props['部署']?.select?.name ?? '',
    skillSet,
    skillLevel: calcSkillLevel(role, joinYear),
    primaryFunction: getText(props['得意機能']),
  }
}

// ── GET ─────────────────────────────────────────────

export async function GET(request: Request) {
  const notionKey    = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!notionKey)    return NextResponse.json({ error: 'Notion APIキーが未設定です' },    { status: 500 })
  if (!anthropicKey) return NextResponse.json({ error: 'Anthropic APIキーが未設定です' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const companyId  = searchParams.get('companyId')  ?? 'kitano-resort'
  const staffName  = searchParams.get('staffName')  ?? ''

  const industry = getIndustryByCompanyId(companyId)
  const dbConfig = getCompanyDbConfig(companyId)

  // ① 社員プロフィール取得（staffName 指定時のみ）
  const staffProfile = staffName
    ? await fetchStaffProfile(notionKey, dbConfig.staffProfileDbId, staffName)
    : null

  // ② 対象ゲームリスト（業種共通 + 業種別）
  const targetGames = GAME_CATALOG.filter(
    g => g.industry === 'all' || g.industry === industry
  )

  // ③ Haiku へ送るゲームリスト（id・タイトル・難易度・スキルタグのみ）
  const gamesSummary = targetGames.map(g => ({
    id:         g.id,
    title:      g.title,
    category:   CATEGORY_LABELS[g.category],
    difficulty: g.difficulty,
    skillTags:  g.skillTags.join('・'),
    industry:   INDUSTRY_LABELS[g.industry],
  }))

  // ④ プロンプト生成
  const staffContext = staffProfile
    ? [
        `■ 社員情報`,
        `  - 氏名: ${staffProfile.name}`,
        `  - 役職: ${staffProfile.role}`,
        `  - 部署: ${staffProfile.department}`,
        `  - スキルセット: ${staffProfile.skillSet.join('・') || '未登録'}`,
        `  - 得意機能: ${staffProfile.primaryFunction || '未登録'}`,
        `  - 推定スキルレベル: Lv.${staffProfile.skillLevel}/5`,
      ].join('\n')
    : `■ 社員情報\n  - 未指定（業種・難易度Lv.1優先で推薦してください）`

  const outputFormat = [
    '【出力形式（JSON配列のみ）】',
    '[{"gameId":"id文字列","reason":"推薦理由1〜2文","priority":1},{"gameId":"...","reason":"...","priority":2},{"gameId":"...","reason":"...","priority":3}]',
    '※ JSONのみ出力。説明文・コードブロック不要。priority は 1〜3 の整数。',
  ].join('\n')

  const client = new Anthropic({ apiKey: anthropicKey })

  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role:    'user',
      content: `以下の社員情報と業種に基づき、最も効果的な研修ゲームを3件推薦してください。

${staffContext}

■ 業種: ${INDUSTRY_LABELS[industry]}

■ 利用可能なゲーム一覧（${gamesSummary.length}件）:
${gamesSummary.map(g => `  [${g.id}] ${g.title}（${g.category} / Lv.${g.difficulty} / ${g.skillTags}）`).join('\n')}

推薦の観点:
- スキルレベルが低い（Lv.1〜2）場合は難易度1のゲームを優先
- スキルセットに含まれない領域のゲームを優先（スキルギャップ補完）
- 業種別ゲームは業種共通ゲームと組み合わせて推薦する
- 推薦理由は具体的で励みになる表現にすること

${outputFormat}`,
    }],
  })

  if (message.stop_reason === 'max_tokens') {
    console.warn('[skill-game/recommend] max_tokens に達しました')
  }

  // ⑤ JSONパース
  const rawText     = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleanedText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  let haikuRecs: Array<{ gameId: string; reason: string; priority: number }> = []
  try {
    haikuRecs = JSON.parse(cleanedText)
  } catch {
    console.error('[skill-game/recommend] JSONパースエラー:', cleanedText.slice(0, 200))
    // パース失敗時はフォールバック推薦（難易度1のゲームを3件）
    haikuRecs = targetGames
      .filter(g => g.difficulty === 1)
      .slice(0, 3)
      .map((g, i) => ({ gameId: g.id, reason: 'スキル基礎固めとして最適なゲームです。', priority: i + 1 }))
  }

  // ⑥ ゲーム情報をマージ
  const recommendations: GameRecommendation[] = haikuRecs
    .filter(r => targetGames.some(g => g.id === r.gameId))
    .slice(0, 3)
    .map(r => ({
      gameId:   r.gameId,
      title:    targetGames.find(g => g.id === r.gameId)?.title ?? r.gameId,
      reason:   r.reason,
      priority: r.priority as 1 | 2 | 3,
    }))

  console.log(`[skill-game/recommend] companyId=${companyId} staffName="${staffName}" industry=${industry} recs=${recommendations.length}件`)

  return NextResponse.json({
    recommendations,
    staffProfile: staffProfile ? {
      name:       staffProfile.name,
      role:       staffProfile.role,
      department: staffProfile.department,
      skillSet:   staffProfile.skillSet,
      skillLevel: staffProfile.skillLevel,
    } : null,
    industry,
    totalGames: targetGames.length,
  } satisfies RecommendResult)
}
