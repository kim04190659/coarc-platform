// =====================================================
//  src/app/api/staff/development/route.ts
//  人材育成AI — 社員のスキル・資格・コンディション履歴をもとに
//              AIが個別の育成プランを提案する
//
//  ■ POST body
//    { companyId, staffName }
//
//  ■ 処理フロー
//    1. 社員マスタから対象社員を取得
//    2. コンディション履歴（直近3件）を取得
//    3. Claude Haiku に育成プランを生成させる
//
//  ■ レスポンス
//    { plan: DevelopmentPlan }
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyById } from '@/config/companies'
import Anthropic from '@anthropic-ai/sdk'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

export type DevelopmentAction = {
  category:    string   // 研修/資格取得/OJT/メンタリング/異動・ローテーション
  title:       string   // アクション名
  description: string   // 具体的な内容（1〜2文）
  timeline:    string   // 実施時期
  priority:    string   // 高/中/低
}

export type DevelopmentPlan = {
  staffName:    string
  summary:      string                // 現状評価サマリー
  strengths:    string[]              // 強み（最大3件）
  growthAreas:  string[]              // 成長余地（最大3件）
  actions:      DevelopmentAction[]  // 育成アクション（最大4件）
  nextReview:   string               // 次回レビュー推奨時期
}

// ── Notion APIヘルパー ──────────────────────────────

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

// ── POST: 人材育成プラン生成 ──────────────────────────

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
      companyId: string
      staffName: string
    }
    const { companyId, staffName } = body

    if (!companyId || !staffName?.trim()) {
      return NextResponse.json(
        { error: 'companyId と staffName は必須です' },
        { status: 400 },
      )
    }

    const company = getCompanyById(companyId)
    const { SHARED_NOTION_DBS } = await import('@/config/company-db-config')

    type NotionPage = { id: string; properties: Record<string, unknown> }
    type PropMap = Record<string, {
      title?:     Array<{ plain_text?: string }>
      select?:    { name?: string }
      rich_text?: Array<{ plain_text?: string }>
      number?:    number
      date?:      { start?: string }
    }>
    const getText = (props: PropMap, key: string) =>
      props[key]?.title?.[0]?.plain_text ?? props[key]?.rich_text?.[0]?.plain_text ?? ''

    // ── 社員マスタから対象社員を検索 ─────────────
    const profileRes = await fetch(`${NOTION_API}/databases/${SHARED_NOTION_DBS.staffProfile}/query`, {
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
    })

    if (!profileRes.ok) throw new Error('社員マスタ取得エラー')
    const profileData = await profileRes.json() as { results: NotionPage[] }

    const staffPage = profileData.results.find(p => {
      const props = p.properties as PropMap
      return getText(props, '社員名').includes(staffName.replace(/\s/g, '').slice(0, 2))
        || getText(props, '社員名') === staffName
    })

    if (!staffPage) {
      return NextResponse.json({ error: `社員「${staffName}」が見つかりません` }, { status: 404 })
    }

    const sp = staffPage.properties as PropMap
    const staffInfo = {
      name:       getText(sp, '社員名'),
      role:       sp['役職']?.select?.name     ?? '',
      department: getText(sp, '部署'),
      function_:  sp['得意機能']?.select?.name  ?? '',
      skills:     getText(sp, 'スキルセット'),
      certs:      getText(sp, '資格'),
      joinYear:   sp['入社年']?.number           ?? 0,
    }

    // ── コンディション履歴（直近3件）を取得 ─────
    const condRes = await fetch(`${NOTION_API}/databases/${SHARED_NOTION_DBS.staffCondition}/query`, {
      method: 'POST',
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        filter: {
          and: [
            { property: '企業名', select: { equals: company.shortName } },
            {
              property: '社員名',
              rich_text: { contains: staffInfo.name.split(' ')[0] },  // 姓でフィルタ
            },
          ],
        },
        sorts: [{ property: '記録日', direction: 'descending' }],
        page_size: 3,
      }),
    })

    let conditionHistory = '記録なし'
    if (condRes.ok) {
      const condData = await condRes.json() as { results: NotionPage[] }
      if (condData.results.length > 0) {
        conditionHistory = condData.results.map(c => {
          const props = c.properties as PropMap
          return [
            `${props['記録日']?.date?.start ?? '日付不明'}: ${props['コンディション']?.select?.name ?? '?'}`,
            `  負荷: ${props['業務負荷']?.select?.name ?? '?'} / ${props['勤務形態']?.select?.name ?? '?'}`,
            `  AIコメント: ${getText(props, 'AIコメント') || 'なし'}`,
          ].join('\n')
        }).join('\n')
      }
    }

    // ── Claude Haiku で育成プランを生成 ──────────
    const client = new Anthropic({ apiKey: anthropicKey })
    const currentYear = new Date().getFullYear()
    const yearsOfService = currentYear - staffInfo.joinYear

    const outputFormat = [
      '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
      '{',
      '  "staffName":"名前",',
      '  "summary":"現状評価2文以内",',
      '  "strengths":["強み1","強み2","強み3（最大3件）"],',
      '  "growthAreas":["成長余地1","成長余地2","成長余地3（最大3件）"],',
      '  "actions":[',
      '    {"category":"研修|資格取得|OJT|メンタリング|異動・ローテーション","title":"20字以内","description":"1〜2文","timeline":"時期","priority":"高|中|低"},',
      '    ... 最大4件',
      '  ],',
      '  "nextReview":"推奨レビュー時期（例: 3ヶ月後、半年後）"',
      '}',
      '※ JSONのみ出力。説明文・コードブロック不要。',
    ].join('\n')

    const res = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `あなたは${company.name}の人事育成担当AIアシスタントです。
以下の社員情報をもとに、個別の人材育成プランを作成してください。

【社員情報】
氏名: ${staffInfo.name}
役職: ${staffInfo.role} / 部署: ${staffInfo.department}
得意機能: ${staffInfo.function_}
スキルセット: ${staffInfo.skills}
資格: ${staffInfo.certs || 'なし'}
勤続年数: ${yearsOfService}年（入社${staffInfo.joinYear}年）

【コンディション履歴（直近3件）】
${conditionHistory}

【育成プラン作成のポイント】
- 現在のスキルをベースに次のステップを提案する
- コンディション履歴から業務負荷・健康状態を考慮する
- 勤続年数に応じた適切な成長ステップを提案する
- 会社の業種（${company.name}）に合った資格・研修を優先する

${outputFormat}`,
      }],
    })

    if (res.stop_reason === 'max_tokens') {
      console.warn('[staff/development] max_tokens に達しました')
    }

    const rawText = res.content[0]?.type === 'text' ? res.content[0].text.trim() : '{}'

    let plan: DevelopmentPlan
    try {
      plan = JSON.parse(rawText) as DevelopmentPlan
    } catch {
      console.error('[staff/development] JSONパースエラー:', rawText)
      return NextResponse.json(
        { error: 'AI育成プランの解析に失敗しました。再試行してください。' },
        { status: 500 },
      )
    }

    return NextResponse.json({ plan })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[staff/development] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
