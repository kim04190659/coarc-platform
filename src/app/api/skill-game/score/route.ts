// =====================================================
//  src/app/api/skill-game/score/route.ts
//  スキルゲーム プレイ履歴保存API — Sprint #25
//
//  ■ POST
//    ゲームのプレイ結果を Notion の研修ログDBに保存する。
//    trainingLogDbId が未設定の場合はスキップ（エラーにしない）。
//
//  ■ 入力
//    companyId, staffName, gameId, gameTitle,
//    totalScore, grade, scenariosPlayed, playedAt（省略時は現在時刻）
//
//  ■ 出力
//    saved: boolean   — true=Notion保存成功、false=スキップ/失敗
//    message: string  — 状況説明
//
//  ■ Notion API 呼び出しは fetch を直接使用
//    （@notionhq/client は未インストールのため）
// =====================================================

import { NextResponse }       from 'next/server'
import { getCompanyDbConfig } from '@/config/company-db-config'

// ── 型定義 ──────────────────────────────────────────

export type ScoreRequest = {
  companyId:       string
  staffName:       string
  gameId:          string
  gameTitle:       string
  totalScore:      number   // 0〜100
  grade:           'S' | 'A' | 'B' | 'C' | 'D'
  scenariosPlayed: number   // 何シナリオ回答したか
  playedAt?:       string   // ISO8601（省略時はサーバー側で現在時刻）
}

export type ScoreResponse = {
  saved:   boolean
  message: string
}

// ── Notion APIヘッダー生成 ───────────────────────────

function notionHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization':  `Bearer ${apiKey}`,
    'Content-Type':   'application/json',
    'Notion-Version': '2022-06-28',
  }
}

// ── POST ─────────────────────────────────────────────

export async function POST(request: Request) {
  const notionKey = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  if (!notionKey) {
    return NextResponse.json<ScoreResponse>(
      { saved: false, message: 'NOTION_TOKEN が未設定です' },
      { status: 500 }
    )
  }

  // ── リクエストボディのパース ──
  let body: ScoreRequest
  try {
    body = await request.json() as ScoreRequest
  } catch {
    return NextResponse.json<ScoreResponse>(
      { saved: false, message: 'リクエストボディが不正です' },
      { status: 400 }
    )
  }

  const {
    companyId,
    staffName,
    gameId,
    gameTitle,
    totalScore,
    grade,
    scenariosPlayed,
    playedAt,
  } = body

  // ── 必須フィールドチェック ──
  if (!companyId || !staffName || !gameId || !gameTitle) {
    return NextResponse.json<ScoreResponse>(
      { saved: false, message: '必須フィールドが不足しています（companyId, staffName, gameId, gameTitle）' },
      { status: 400 }
    )
  }

  // ── 企業DBコンフィグから研修ログDBのIDを取得 ──
  const dbConfig        = getCompanyDbConfig(companyId)
  const trainingLogDbId = dbConfig?.trainingLogDbId ?? ''

  // trainingLogDbId が未設定の場合はスキップ（エラーにしない）
  if (!trainingLogDbId) {
    console.log(
      `[skill-game/score] trainingLogDbId 未設定のためスキップ companyId=${companyId}`
    )
    return NextResponse.json<ScoreResponse>({
      saved:   false,
      message: '研修ログDBが未設定のためNotionへの保存をスキップしました（スコアは正常に算出されています）',
    })
  }

  // ── Notion DB にページを作成（fetch APIを直接使用） ──
  const playTime = playedAt ?? new Date().toISOString()

  const notionBody = {
    parent: { database_id: trainingLogDbId },
    properties: {
      // ゲームタイトル（タイトルプロパティ）
      '研修名': {
        title: [{ text: { content: `[ゲーム] ${gameTitle}` } }],
      },
      // スタッフ名
      '氏名': {
        rich_text: [{ text: { content: staffName } }],
      },
      // スコア
      'スコア': {
        number: totalScore,
      },
      // グレード
      'グレード': {
        select: { name: grade },
      },
      // ゲームID
      'ゲームID': {
        rich_text: [{ text: { content: gameId } }],
      },
      // 回答シナリオ数
      '回答数': {
        number: scenariosPlayed,
      },
      // プレイ日時
      '実施日': {
        date: { start: playTime },
      },
    },
  }

  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method:  'POST',
      headers: notionHeaders(notionKey),
      body:    JSON.stringify(notionBody),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[skill-game/score] Notion APIエラー ${res.status}:`, errText.slice(0, 200))
      return NextResponse.json<ScoreResponse>({
        saved:   false,
        message: 'Notion保存に失敗しました（スコアは正常に算出されています）',
      })
    }

    console.log(
      `[skill-game/score] 保存成功 staffName=${staffName} gameId=${gameId} score=${totalScore} grade=${grade}`
    )

    return NextResponse.json<ScoreResponse>({
      saved:   true,
      message: 'Notionへの保存が完了しました',
    })
  } catch (err) {
    // fetch失敗はスキップとして返す（ゲーム自体は止めない）
    console.error('[skill-game/score] Notion保存エラー:', err)
    return NextResponse.json<ScoreResponse>({
      saved:   false,
      message: 'Notion保存に失敗しました（スコアは正常に算出されています）',
    })
  }
}
