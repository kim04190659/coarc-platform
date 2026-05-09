// =====================================================
//  src/app/api/skill-game/evaluate/route.ts
//  スキルゲーム AI採点API — Sprint #25
//
//  ■ POST
//    プレイヤーの回答をClaude Haikuが採点し、
//    具体的なフィードバックを返す。
//
//  ■ 入力
//    gameId, scenarioId, choiceId, choiceText,
//    situation, question, evalCriteria
//
//  ■ 出力
//    score:        0〜100（整数）
//    grade:        S/A/B/C/D
//    goodPoints:   良かった点（1〜2文）
//    improvements: 改善できる点（1〜2文）
//    betterApproach: より良い対応（1〜2文）
//
//  ■ 設計ポイント
//    - evalCriteria はプレイヤーに非表示・採点ガイドとしてHaikuに渡す
//    - フィードバックは否定的にならず成長を促す表現にすること
//    - Haiku max_tokens: 4096 固定
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ── 型定義 ──────────────────────────────────────────

export type EvaluateRequest = {
  gameId:       string
  scenarioId:   string
  choiceId:     'A' | 'B' | 'C' | 'D'
  choiceText:   string
  situation:    string
  question:     string
  evalCriteria: string   // 採点基準（内部利用・非表示）
}

export type EvaluateResult = {
  score:          number   // 0〜100
  grade:          'S' | 'A' | 'B' | 'C' | 'D'
  goodPoints:     string
  improvements:   string
  betterApproach: string
}

// ── スコア → グレード変換 ────────────────────────────

function toGrade(score: number): EvaluateResult['grade'] {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

// ── POST ─────────────────────────────────────────────

export async function POST(request: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'Anthropic APIキーが未設定です' }, { status: 500 })
  }

  let body: EvaluateRequest
  try {
    body = await request.json() as EvaluateRequest
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
  }

  const { choiceId, choiceText, situation, question, evalCriteria } = body

  // ── プロンプト出力制限（CLAUDE.md準拠）──
  const outputFormat = [
    '【出力形式（JSON）— 必ずこの形式のみで回答すること】',
    '{"score":85,"goodPoints":"良かった点を1〜2文で","improvements":"改善点を1〜2文で","betterApproach":"より良い対応を1〜2文で"}',
    '※ scoreは0〜100の整数。JSONのみ出力。説明文・コードブロック不要。',
    '※ フィードバックは否定的・批判的にならず、成長を促す前向きな表現にすること。',
  ].join('\n')

  const client = new Anthropic({ apiKey: anthropicKey })

  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role:    'user',
      content: `あなたはビジネススキル研修のAI採点官です。
以下のシナリオに対するプレイヤーの回答を採点し、建設的なフィードバックを返してください。

■ 状況
${situation}

■ 設問
${question}

■ プレイヤーが選んだ回答（選択肢${choiceId}）
${choiceText}

■ 採点基準（内部参考・プレイヤーには非表示）
${evalCriteria}

採点方針:
- 正解に近い回答は80〜100点、やや惜しい回答は60〜79点、改善の余地が大きいは40〜59点、不適切な回答は0〜39点
- goodPointsはどんな回答でも必ず何か良い点を見つけること（完全な不正解でも「率直さ」「シンプルさ」など）
- betterApproachは具体的かつ実践的な改善ヒントにすること
- 全体を通じてプレイヤーが学んで成長できるよう励みになる表現で

${outputFormat}`,
    }],
  })

  if (message.stop_reason === 'max_tokens') {
    console.warn('[skill-game/evaluate] max_tokens に達しました')
  }

  const rawText     = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleanedText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  let parsed: { score: number; goodPoints: string; improvements: string; betterApproach: string }
  try {
    parsed = JSON.parse(cleanedText)
  } catch {
    console.error('[skill-game/evaluate] JSONパースエラー:', cleanedText.slice(0, 200))
    // フォールバック
    parsed = {
      score:          60,
      goodPoints:     '回答を選んでいただけました。',
      improvements:   '状況に合わせた対応をさらに意識してみましょう。',
      betterApproach: 'お客様・相手の立場に立った対応が重要です。',
    }
  }

  const score = Math.min(100, Math.max(0, Math.round(parsed.score)))

  console.log(`[skill-game/evaluate] scenarioId=${body.scenarioId} choice=${choiceId} score=${score}`)

  return NextResponse.json({
    score,
    grade:          toGrade(score),
    goodPoints:     parsed.goodPoints,
    improvements:   parsed.improvements,
    betterApproach: parsed.betterApproach,
  } satisfies EvaluateResult)
}
