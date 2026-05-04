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

    // ── 社員マスタ取得（企業別DB方式）──────────────
    const { getCompanyDbConfig } = await import('@/config/company-db-config')
    const dbConfig = getCompanyDbConfig(companyId)

    // ✅ 企業専用DBにクエリ（企業名フィルタなし）
    const [profileRes, conditionRes] = await Promise.all([
      fetch(`${NOTION_API}/databases/${dbConfig.staffProfileDbId}/query`, {
        method: 'POST',
        headers: notionHeaders(notionKey),
        body: JSON.stringify({ page_size: 50 }),
      }),
      fetch(`${NOTION_API}/databases/${dbConfig.staffConditionDbId}/query`, {
        method: 'POST',
        headers: notionHeaders(notionKey),
        body: JSON.stringify({
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
      // 企業別DB方式のプロパティ名（氏名→name, スキル→skillSet等）
      const skillsArr = (props['スキル'] as { multi_select?: Array<{ name?: string }> } | undefined)?.multi_select ?? []
      return {
        name:        getText(props, '氏名') || getText(props, '社員名'),
        role:        getText(props, '役職') || (props['役職']?.select?.name ?? ''),
        department:  props['部署']?.select?.name ?? getText(props, '部署'),
        function_:   props['得意機能']?.select?.name ?? '',
        skills:      skillsArr.map(s => s.name ?? '').join(', ') || getText(props, 'スキルセット'),
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
          // 企業別DB方式: 体調→condition, コメント→memo
          staff.condition  = props['体調']?.select?.name ?? props['コンディション']?.select?.name ?? ''
          staff.workload   = props['業務負荷']?.select?.name ?? ''
          staff.workStyle  = props['勤務形態']?.select?.name ?? ''
        }
      }
    }

    // ── Claude Haiku でディスパッチ推薦を生成 ────
    const client = new Anthropic({ apiKey: anthropicKey })

    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      '{"recommendations":[{"rank":1,"staffName":"名前","role":"役職","department":"部署","matchScore":85,"matchReason":"マッチ理由1〜2文","caution":"注意事項または なし"},{"rank":2,"staffName":"名前","role":"役職","department":"部署","matchScore":75,"matchReason":"マッチ理由1〜2文","caution":"注意事項または なし"},{"rank":3,"staffName":"名前","role":"役職","department":"部署","matchScore":65,"matchReason":"マッチ理由1〜2文","caution":"注意事項または なし"}],"reasoning":"総合判断の補足コメント1〜2文"}',
      '※ 上記JSONをそのまま出力。コードブロック（```）・説明文・マークダウン・改行は一切不要。',
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

    // ── コードブロック・前後の余分なテキストを除去 ──
    // ```json ... ``` や ``` ... ``` が混入することがあるため取り除く
    const cleanText = rawText
      .replace(/^```(?:json)?\s*/i, '')   // 先頭の ```json または ``` を除去
      .replace(/\s*```\s*$/i, '')          // 末尾の ``` を除去
      .replace(/^[^{]*({[\s\S]*})[^}]*$/, '$1')  // { } の外側を除去
      .trim()

    // ── JSON パース（壊れていたらフォールバック）──
    let parsed: { recommendations: DispatchRecommendation[]; reasoning: string }
    try {
      parsed = JSON.parse(cleanText) as typeof parsed
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
