// =====================================================
//  src/app/api/chat/route.ts
//  AIチャット API（ChatPanel から呼び出される）
//
//  ■ 仕様
//    - POST /api/chat
//    - リクエスト: { message: string, systemPrompt?: string }
//    - レスポンス: { reply: string }
//    - モデル: claude-haiku-4-5-20251001（max_tokens: 1024）
//    - systemPrompt が渡された場合はそれを使い、なければデフォルトを使用
// =====================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Anthropic クライアントの初期化
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// デフォルトのシステムプロンプト（PAGE_CONTEXTSにないページのフォールバック）
const DEFAULT_SYSTEM_PROMPT =
  'あなたは「Coarcアシスタント」です。Coarc Platform（中規模サービス企業向け生成AI活用基盤）の' +
  '操作方法・仕様・設計思想を専門に教えるAIアシスタントです。\n\n' +
  '【Coarc Platform の概要】\n' +
  '- 目的: 顧客・社員・経営の三軸をつなぎ、エクセレントサービスの継続的な提供を実現する\n' +
  '- 対象: 三百人規模のサービス企業（ホテル・医療・飲食・小売など）\n' +
  '- バックエンド: Notion（データ蓄積）+ Claude AI（分析・提言）\n\n' +
  '【主要機能】\n' +
  '- KPIダッシュボード（/management/dashboard）: 経営状況の可視化\n' +
  '- 顧客フィードバック（/customer/feedback）: 顧客の声をAIが分類・優先度付け\n' +
  '- 問い合わせ管理（/customer/contacts）: 問い合わせの一元管理\n' +
  '- 社員コンディション（/operations/staff）: 社員のウェルビーイング管理\n' +
  '- AI経営顧問（/ai-advisor）: データをもとにAIが経営提言\n' +
  '- スキル向上ゲーム（/skill-game/select）: ロールプレイ形式の社員研修\n\n' +
  '専門用語は避け、業務担当者が理解できる言葉で簡潔に回答してください。' +
  '操作方法はURLを含めて案内し、回答は日本語で400字以内を目安にしてください。'

export async function POST(request: Request) {
  // ANTHROPIC_API_KEY が設定されているか事前チェック
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Chat API error: ANTHROPIC_API_KEY is not set')
    return NextResponse.json(
      { error: 'サーバー設定エラー: APIキーが未設定です' },
      { status: 500 },
    )
  }

  try {
    // message に加え、systemPrompt（任意）も受け取る
    const body = await request.json()
    const message: string = body.message
    const systemPrompt: string | undefined = body.systemPrompt

    // message が空の場合はエラー
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'メッセージが空です' },
        { status: 400 },
      )
    }

    // systemPrompt が渡された場合はそれを使い、なければデフォルトを使用
    const systemContent = systemPrompt || DEFAULT_SYSTEM_PROMPT

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemContent,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const reply =
      response.content[0].type === 'text'
        ? response.content[0].text
        : 'Unable to generate response'

    return NextResponse.json({ reply })
  } catch (error) {
    // 詳細なエラー情報をサーバーログに出力する
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Chat API error:', errMsg)
    return NextResponse.json(
      { error: `AIへの問い合わせに失敗しました: ${errMsg}` },
      { status: 500 },
    )
  }
}
