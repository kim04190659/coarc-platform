// =====================================================
//  src/app/api/customers/save/route.ts
//  顧客プロフィール登録・更新API — Sprint #41
//
//  ■ POST ?companyId=xxx
//    Body: { customerName, visitCount?, preferTags?, lastVisitDate? }
//
//    ① Haiku で AIプロファイル・推奨アクションを自動生成
//    ② Notion 顧客プロフィールDB に保存
//    ③ 保存結果を返却
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCompanyDbConfig } from '@/config/company-db-config'
import { getCompanyById } from '@/config/companies'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

// ── 型定義 ──────────────────────────────────────────

type SaveCustomerBody = {
  customerName:  string    // 顧客名（必須）
  visitCount?:   number    // 来訪回数
  preferTags?:   string[]  // 好みタグ
  lastVisitDate?: string   // 最終来訪日（YYYY-MM-DD）
}

export type SaveCustomerResult = {
  success:      boolean
  notionPageUrl: string
  aiProfile:    string    // AIが生成した顧客特徴文
  recommend:    string    // 次回推奨アクション
}

// ── Haiku で顧客プロファイルを生成 ───────────────────

async function generateCustomerProfile(
  companyName: string,
  industry: string,
  customerName: string,
  visitCount: number,
  preferTags: string[],
  anthropicKey: string,
): Promise<{ aiProfile: string; recommend: string }> {
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const outputFormat = [
    '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
    '{"aiProfile":"顧客の特徴・傾向（50文字以内）","recommend":"次回接点での推奨アクション（50文字以内）"}',
    '※ JSONのみ出力。説明文・コードブロック不要。',
  ].join('\n')

  const prompt = `あなたは${companyName}（${industry}業）のAIサービスアドバイザーです。
以下の顧客情報をもとに、この顧客の特徴と次回接点での推奨アクションを生成してください。

【顧客情報】
顧客名: ${customerName}
来訪回数: ${visitCount}回
好みタグ: ${preferTags.length > 0 ? preferTags.join('・') : '未設定'}

【生成ルール】
- aiProfile: この顧客の特徴や傾向を端的に表す一文（50文字以内）
- recommend: 次回来訪時にスタッフが行うべき具体的なアクション（50文字以内）
- 来訪回数が多い場合はリピーター・VIP感を出す
- 好みタグを活かした個別性の高い提案にする

${outputFormat}`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned) as { aiProfile: string; recommend: string }
  return {
    aiProfile: parsed.aiProfile ?? '',
    recommend: parsed.recommend ?? '',
  }
}

// ── Notion に保存 ─────────────────────────────────────

async function saveToNotion(
  dbId: string,
  notionKey: string,
  customerName: string,
  visitCount: number,
  preferTags: string[],
  lastVisitDate: string,
  aiProfile: string,
  recommend: string,
): Promise<string> {
  const body = {
    parent: { database_id: dbId },
    properties: {
      '顧客名': {
        title: [{ text: { content: customerName } }],
      },
      '来訪回数': {
        number: visitCount,
      },
      '好みタグ': {
        multi_select: preferTags.map(t => ({ name: t })),
      },
      ...(lastVisitDate ? {
        '最終来訪日': {
          date: { start: lastVisitDate },
        },
      } : {}),
      'AIプロファイル': {
        rich_text: [{ text: { content: aiProfile } }],
      },
      '推奨アクション': {
        rich_text: [{ text: { content: recommend } }],
      },
    },
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: {
      'Authorization':  `Bearer ${notionKey}`,
      'Content-Type':   'application/json',
      'Notion-Version': NOTION_VER,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Notion保存エラー: ${err}`)
  }

  const page = await res.json() as { url: string }
  return page.url
}

// ── メイン POST ハンドラー ────────────────────────────

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId') ?? 'kitano-resort'

  // 環境変数チェック
  const notionKey    = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''

  if (!notionKey || !anthropicKey) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
  }

  const db      = getCompanyDbConfig(companyId)
  const company = getCompanyById(companyId)

  if (!db.customerProfileDbId) {
    return NextResponse.json({ error: '顧客プロフィールDBが設定されていません' }, { status: 400 })
  }

  // リクエストボディ取得
  let body: SaveCustomerBody
  try {
    body = await req.json() as SaveCustomerBody
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
  }

  const {
    customerName,
    visitCount     = 1,
    preferTags     = [],
    lastVisitDate  = new Date().toISOString().split('T')[0],
  } = body

  if (!customerName) {
    return NextResponse.json({ error: 'customerName は必須です' }, { status: 400 })
  }

  // ── ① Haiku でプロファイル生成 ──────────────────────
  let aiProfile = ''
  let recommend = ''
  try {
    const result = await generateCustomerProfile(
      company.name, company.industry,
      customerName, visitCount, preferTags,
      anthropicKey,
    )
    aiProfile = result.aiProfile
    recommend = result.recommend
  } catch (err) {
    console.error('[customers/save] Haiku生成エラー:', err)
    aiProfile = `${customerName}様は${visitCount}回ご来店のお客様です。`
    recommend = '好みに合わせた個別の対応をご提案ください。'
  }

  // ── ② Notion 保存 ────────────────────────────────────
  let notionPageUrl = ''
  try {
    notionPageUrl = await saveToNotion(
      db.customerProfileDbId, notionKey,
      customerName, visitCount, preferTags, lastVisitDate,
      aiProfile, recommend,
    )
  } catch (err) {
    console.error('[customers/save] Notion保存エラー:', err)
  }

  const result: SaveCustomerResult = {
    success:      true,
    notionPageUrl,
    aiProfile,
    recommend,
  }

  return NextResponse.json(result)
}
