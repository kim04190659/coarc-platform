// =====================================================
//  src/app/api/kpi/goals/create/route.ts
//  KPI目標新規作成 API
//
//  ■ POST { companyId, kpiName, kpiType, target, unit, period }
//    → 企業専用KPI目標DBにページを新規作成して返す
// =====================================================

import { NextResponse } from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VER = '2022-06-28'

function notionHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VER,
  }
}

export async function POST(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json({ error: 'Notion APIキーが未設定です' }, { status: 500 })
  }

  try {
    const body = await request.json() as {
      companyId: string
      kpiName:   string
      kpiType:   string
      target:    string
      unit:      string
      period:    string
    }
    const { companyId, kpiName, kpiType, target, unit, period } = body

    if (!companyId || !kpiName?.trim() || !target?.trim()) {
      return NextResponse.json(
        { error: 'companyId・kpiName・target は必須です' },
        { status: 400 },
      )
    }

    // ✅ 企業別DB方式: companyId から KPI目標DB ID を取得
    const dbConfig = getCompanyDbConfig(companyId)
    if (!dbConfig.kpiGoalsDbId) {
      return NextResponse.json({ error: 'KPI目標DBが未設定です' }, { status: 400 })
    }

    // Notionページを新規作成
    const res = await fetch(`${NOTION_API}/pages`, {
      method:  'POST',
      headers: notionHeaders(notionKey),
      body:    JSON.stringify({
        parent: { database_id: dbConfig.kpiGoalsDbId },
        properties: {
          'KPI名': {
            title: [{ text: { content: kpiName.trim() } }],
          },
          'KPI種別': {
            select: { name: kpiType || 'その他' },
          },
          '目標値': {
            rich_text: [{ text: { content: target.trim() } }],
          },
          '単位': {
            rich_text: [{ text: { content: unit?.trim() ?? '' } }],
          },
          '期間': {
            rich_text: [{ text: { content: period?.trim() ?? '月次' } }],
          },
          '更新日': {
            date: { start: new Date().toISOString().split('T')[0] },
          },
        },
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`Notion作成エラー (${res.status}): ${errBody}`)
    }

    const page = await res.json() as { id: string }
    return NextResponse.json({ success: true, pageId: page.id })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[kpi/goals/create] エラー:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
