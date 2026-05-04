// =====================================================
//  src/app/api/staff/dispatch/route.ts
//  AIディスパッチ — 業務内容をもとに最適な担当者をAIが推薦する
//
//  ■ POST body
//    { companyId, taskDescription }
//
//  ■ 処理フロー
//    1. 社員マスタ + 最新コンディションを取得
//    2. Claude Haiku にスキルマッチングさせて推薦Top3を生成
//    3. 推薦理由・注意事項付きで返す
//
//  ■ レスポンス
//    { recommendations: DispatchRecommendation[], reasoning: string }
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyById } from '@/config/companies'
import Anthropic from '@anthropic-ai/sdk'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type DispatchRecommendation = {
  rank:         number   // 推薦順位 1〜3
  staffName:    string   // 社員名
  role:         string   // 役職
  department:   string   // 部署
  matchReason:  string   // マッチング理由（スキル・経験ベース）
  caution:      string   // 注意事項（負荷・コンディション）
  matchScore:   number   // スコア 1〜100
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── 社員情報を文字列にまとめてAI入力用に整形 ────────────

type StaffSummary = {
  name:        string
  role:        string
  department:  string
  function_:   string
  skills:      string
  certs:       string
  condition:   string
  workload:    string
  workStyle:   string
}

function formatStaffForPrompt(staff: StaffSummary[]): string {
  return staff.map(s => [
    `【${s.name}】${s.role} / ${s.department}`,
    `  得意機能: ${s.function_}`,
    `  スキル: ${s.skills}`,
    `  資格: ${s.certs || 'なし'}`,
    `  コンディション: ${s.condition || '未記録'} / 業務負荷: ${s.workload || '不明'} / 勤務: ${s.workStyle || '不明'}`,
  ].join('\n')).join('\n\n')
}

// ── POST: AIディスパッチ ───────────────────────────────

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
    const body = await request.json() as {
      companyId:       string
      taskDescription: string
    }
    const { companyId, taskDescription } = body

    if (!companyId || !taskDescription?.trim()) {
      return NextResponse.json(
        { error: 'companyId と taskDescription は必須です' },
        { status: 400 },
      )
    }

    const company = getCompanyById(companyId)

    // ── 社員マスタ取得 ───────────────────────────
    const { SHARED_NOTION_DBS } = await import('@/config/company-db-config')

    const [profileRes, conditionRes] = await Promise.all([
      fetch(`${NOTION_API}/databases/${SHARED_NOTION_DBS.staffProfile}/query`, {
        method: 'POST',
        headers: notionHeaders(notionKey),
        body: JSON.stringify({
          filter: {
            and: [
              { property: '企業名', select: { equals: company.shortName } },
              { property: '在籍状況', select: { equals: '在籍' } },
            ],
          },
          page_size: 50,
        }),
      }),
      fetch(`${NOTION_API}/databases/${SHARED_NOTION_DBS.staffCondition}/query`, {
        method: 'POST',
        headers: notionHeaders(notionKey),
        body: JSON.stringify({
          filter: { property: '企業名', select: { equals: company.shortName } },
          sorts: [{ property: '記録日', direction: 'descending' }],
          page_size: 100,
        }),
      }),
    ])

    if (!profileRes.ok) throw new Error('社員マスタ取得エラー')

    type NotionPage = { id: string; properties: Record<string, unknown> }
    const profileData = await profileRes.json() as { results: NotionPage[] }

    // ── 社員プロパティを取り出す ─────────────────
    type PropMap = Record<string, {
      title?:     Array<{ plain_text?: string }>
      select?:    { name?: string }
      rich_text?: Array<{ plain_text?: string }>
      number?:    number
    }>
    const getText = (props: PropMap, key: string) =>
      props[key]?.title?.[0]?.plain_text ?? props[key]?.rich_text?.[0]?.plain_text ?? ''

    const profiles = profileData.results.map(p => {
      const props = p.properties as PropMap
      return {
        name:        getText(props, '社員名'),
        role:        props['役職']?.select?.name        ?? '',
        department:  getText(props, '部署'),
        function_:   props['得意機能']?.select?.name    ?? '',
        skills:      getText(props, 'スキルセット'),
        certs:       getText(props, '資格'),
        condition:   '',
        workload:    '',
        workStyle:   '',
      } as StaffSummary
    })

    // ── 最新コンディションを結合 ─────────────────
    if (conditionRes.ok) {
      const conditionData = await conditionRes.json() as { results: NotionPage[] }
      const seen = new Set<string>()
      for (const c of conditionData.results) {
        const props = c.properties as PropMap
        const name = getText(props, '社員名')
        if (!name || seen.has(name)) continue
        seen.add(name)
        const staff = profiles.find(p => p.name === name)
        if (staff) {
          staff.condition  = props['コンディション']?.select?.name ?? ''
          staff.workload   = props['業務負荷']?.select?.name        ?? ''
          staff.workStyle  = props['勤務形態']?.select?.name        ?? ''
        }
      }
    }

    // ── Claude Haiku でディスパッチ推薦を生成 ────
    const client = new Anthropic({ apiKey: anthropicKey })

    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      '{"recommendations":[',
      '  {"rank":1,"staffName":"名前","role":"役職","department":"部署","matchScore":85,"matchReason":"マッチ理由1〜2文","caution":"注意事項または「なし」"},',
      '  {"rank":2,...},',
      '  {"rank":3,...}',
      '],"reasoning":"総合判断の補足コメント1〜2文"}',
      '※ JSONのみ出力。説明文・コードブロック・マークダウン不要。簡潔さを最優先。',
    ].join('\n')

    const staffInfo = formatStaffForPrompt(profiles.slice(0, 12))  // 上位12件以内

    const res = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `あなたは${company.name}の人事担当AIアシスタントです。
以下の業務内容に最適な担当者Top3を社員情報をもとに選定してください。

【業務内容・依頼内容】
${taskDescription}

【社員情報一覧】
${staffInfo}

【選定基準】
- スキルセット・資格と業務内容の一致度を最重視
- コンディションが⭐2以下・業務負荷「高」の社員は慎重に選定（cautionに記載）
- 役職・部署の適性も考慮

${outputFormat}`,
      }],
    })

    if (res.stop_reason === 'max_tokens') {
      console.warn('[staff/dispatch] max_tokens に達しました')
    }

    const rawText = res.content[0]?.type === 'text' ? res.content[0].text.trim() : '{}'

    // ── JSON パース（壊れていたらフォールバック）──
    let parsed: { recommendations: DispatchRecommendation[]; reasoning: string }
    try {
      parsed = JSON.parse(rawText) as typeof parsed
    } catch {
      console.error('[staff/dispatch] JSONパースエラー:', rawText)
      return NextResponse.json(
        { error: 'AI推薦結果の解析に失敗しました。再試行してください。' },
        { status: 500 },
      )
    }

    return NextResponse.json(parsed)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[staff/dispatch] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
