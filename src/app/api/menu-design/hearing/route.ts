// =====================================================
//  src/app/api/menu-design/hearing/route.ts
//  メニュー設計ヒアリング結果 API — Sprint #30
//
//  ■ GET  ?companyId=xxx
//    Notion ヒアリング結果DBから該当企業のレコードを取得する。
//    レコードがない場合は null を返す（hasRecord: false）。
//
//  ■ POST { companyId, ...hearingData }
//    ヒアリング結果を Notion に保存する。
//    既存レコードがあれば上書き更新（PATCH）、なければ新規作成（POST）。
// =====================================================

import { NextResponse } from 'next/server'

// ── Notion の DB ID ────────────────────────────────
const HEARING_DB_ID = '6744026a60764853a3d9c7ff26d630ad'

// ── 型定義 ──────────────────────────────────────────

export type HearingData = {
  companyId:         string
  companyName:       string
  staffSize:         string   // 〜10名 | 11〜30名 | 31〜100名 | 101〜300名 | 300名超
  mainCustomers:     string   // 主な顧客層（自由記述）
  serviceRating:     string   // サービス品質自己評価（1〜5）
  challenges:        string[] // 改善したい課題（複数選択）
  goalIn6Months:     string   // 6ヶ月後の目標（自由記述）
  biggestPain:       string   // 今最も困っていること（自由記述）
  aiExperience:      string   // AI活用経験
  dataCollection:    string[] // データ収集状況（複数選択）
  priorityFeatures:  string[] // 重視するAI機能（複数選択）
  interviewedBy:     string   // ヒアリング実施者
  notes:             string   // 備考
}

export type HearingResponse = {
  success:    boolean
  hasRecord:  boolean
  pageId?:    string
  data?:      HearingData
  error?:     string
}

// ── Notion API ヘッダー ───────────────────────────────

function notionHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization':  `Bearer ${apiKey}`,
    'Content-Type':   'application/json',
    'Notion-Version': '2022-06-28',
  }
}

// ── Notion プロパティ → HearingData 変換 ─────────────

function parseNotionPage(page: {
  id: string
  properties: Record<string, {
    title?:        Array<{ plain_text: string }>
    rich_text?:    Array<{ plain_text: string }>
    select?:       { name: string } | null
    multi_select?: Array<{ name: string }>
    date?:         { start: string } | null
  }>
}): HearingData & { pageId: string } {
  const p = page.properties
  return {
    pageId:           page.id,
    companyId:        p['企業名']?.title?.[0]?.plain_text           ?? '',
    companyName:      p['企業表示名']?.rich_text?.[0]?.plain_text    ?? '',
    staffSize:        p['スタッフ規模']?.select?.name               ?? '',
    mainCustomers:    p['主な顧客層']?.rich_text?.[0]?.plain_text   ?? '',
    serviceRating:    p['サービス品質自己評価']?.select?.name        ?? '',
    challenges:       p['改善したい課題']?.multi_select?.map(v => v.name) ?? [],
    goalIn6Months:    p['6ヶ月後の目標']?.rich_text?.[0]?.plain_text ?? '',
    biggestPain:      p['今最も困っていること']?.rich_text?.[0]?.plain_text ?? '',
    aiExperience:     p['AI活用経験']?.select?.name                 ?? '',
    dataCollection:   p['データ収集状況']?.multi_select?.map(v => v.name) ?? [],
    priorityFeatures: p['重視するAI機能']?.multi_select?.map(v => v.name) ?? [],
    interviewedBy:    p['ヒアリング実施者']?.rich_text?.[0]?.plain_text ?? '',
    notes:            p['備考']?.rich_text?.[0]?.plain_text          ?? '',
  }
}

// ── GET ───────────────────────────────────────────────

export async function GET(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json<HearingResponse>(
      { success: false, hasRecord: false, error: 'NOTION_TOKEN が未設定です' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId') ?? ''

  if (!companyId) {
    return NextResponse.json<HearingResponse>(
      { success: false, hasRecord: false, error: 'companyId が必要です' },
      { status: 400 }
    )
  }

  try {
    // 企業IDで Notion DB を検索
    const res = await fetch(
      `https://api.notion.com/v1/databases/${HEARING_DB_ID}/query`,
      {
        method:  'POST',
        headers: notionHeaders(notionKey),
        body:    JSON.stringify({
          filter: {
            property: '企業名',
            title:    { equals: companyId },
          },
          page_size: 1,
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[menu-design/hearing GET] Notion error:', errText.slice(0, 200))
      return NextResponse.json<HearingResponse>(
        { success: false, hasRecord: false, error: 'Notion API エラー' },
        { status: 500 }
      )
    }

    const data = await res.json() as {
      results: Array<{
        id: string
        properties: Record<string, {
          title?:        Array<{ plain_text: string }>
          rich_text?:    Array<{ plain_text: string }>
          select?:       { name: string } | null
          multi_select?: Array<{ name: string }>
          date?:         { start: string } | null
        }>
      }>
    }

    if (data.results.length === 0) {
      return NextResponse.json<HearingResponse>({ success: true, hasRecord: false })
    }

    const parsed = parseNotionPage(data.results[0])
    return NextResponse.json<HearingResponse>({
      success:   true,
      hasRecord: true,
      pageId:    parsed.pageId,
      data:      parsed,
    })
  } catch (err) {
    console.error('[menu-design/hearing GET] fetch error:', err)
    return NextResponse.json<HearingResponse>(
      { success: false, hasRecord: false, error: 'ネットワークエラー' },
      { status: 500 }
    )
  }
}

// ── POST ──────────────────────────────────────────────

export async function POST(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json<HearingResponse>(
      { success: false, hasRecord: false, error: 'NOTION_TOKEN が未設定です' },
      { status: 500 }
    )
  }

  const body = await request.json() as HearingData & { pageId?: string }

  // ── Notion プロパティを構築 ──
  const properties: Record<string, unknown> = {
    '企業名':             { title: [{ text: { content: body.companyId } }] },
    '企業表示名':         { rich_text: [{ text: { content: body.companyName } }] },
    'ステータス':         { select: { name: '📝 ヒアリング中' } },
    'スタッフ規模':       body.staffSize ? { select: { name: body.staffSize } } : undefined,
    '主な顧客層':         { rich_text: [{ text: { content: body.mainCustomers } }] },
    'サービス品質自己評価': body.serviceRating ? { select: { name: body.serviceRating } } : undefined,
    '改善したい課題':     { multi_select: body.challenges.map(name => ({ name })) },
    '6ヶ月後の目標':      { rich_text: [{ text: { content: body.goalIn6Months } }] },
    '今最も困っていること': { rich_text: [{ text: { content: body.biggestPain } }] },
    'AI活用経験':         body.aiExperience ? { select: { name: body.aiExperience } } : undefined,
    'データ収集状況':     { multi_select: body.dataCollection.map(name => ({ name })) },
    '重視するAI機能':     { multi_select: body.priorityFeatures.map(name => ({ name })) },
    'ヒアリング実施者':   { rich_text: [{ text: { content: body.interviewedBy } }] },
    '備考':               { rich_text: [{ text: { content: body.notes } }] },
  }

  // undefined を除去
  const cleanProps = Object.fromEntries(
    Object.entries(properties).filter(([, v]) => v !== undefined)
  )

  try {
    let pageId = body.pageId

    if (pageId) {
      // ── 既存レコードを上書き更新 ──
      const res = await fetch(
        `https://api.notion.com/v1/pages/${pageId}`,
        {
          method:  'PATCH',
          headers: notionHeaders(notionKey),
          body:    JSON.stringify({ properties: cleanProps }),
        }
      )
      if (!res.ok) {
        const errText = await res.text()
        console.error('[menu-design/hearing POST PATCH] Notion error:', errText.slice(0, 200))
        return NextResponse.json<HearingResponse>(
          { success: false, hasRecord: true, error: 'Notion 更新エラー' },
          { status: 500 }
        )
      }
    } else {
      // ── 新規作成 ──
      const res = await fetch(
        'https://api.notion.com/v1/pages',
        {
          method:  'POST',
          headers: notionHeaders(notionKey),
          body:    JSON.stringify({
            parent:     { database_id: HEARING_DB_ID },
            properties: cleanProps,
          }),
        }
      )
      if (!res.ok) {
        const errText = await res.text()
        console.error('[menu-design/hearing POST CREATE] Notion error:', errText.slice(0, 200))
        return NextResponse.json<HearingResponse>(
          { success: false, hasRecord: false, error: 'Notion 作成エラー' },
          { status: 500 }
        )
      }
      const created = await res.json() as { id: string }
      pageId = created.id
    }

    return NextResponse.json<HearingResponse>({
      success:   true,
      hasRecord: true,
      pageId,
    })
  } catch (err) {
    console.error('[menu-design/hearing POST] fetch error:', err)
    return NextResponse.json<HearingResponse>(
      { success: false, hasRecord: false, error: 'ネットワークエラー' },
      { status: 500 }
    )
  }
}
