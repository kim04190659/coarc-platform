'use client'

// =====================================================
//  src/app/(dashboard)/operations/ai-chat/page.tsx
//  フリーチャットページ — Claude Haiku に自由質問
//
//  ■ 機能概要
//    - テキストボックスに質問を入力してAIに送信
//    - Claude Haiku から回答を取得して表示
//    - 質問・回答は企業別AIログDBに自動保存される
//    - 会話履歴はセッション内で保持（ページ離脱でリセット）
// =====================================================

import { useState, useRef, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { Send, Bot, User, Loader2, Trash2, MessageSquare } from 'lucide-react'

// ── 会話メッセージの型 ──────────────────────────────

type Message = {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  elapsedMs?: number
  timestamp: Date
}

// ── おすすめの質問例 ─────────────────────────────────

const EXAMPLE_QUESTIONS = [
  '社員のモチベーションを上げるには何が効果的ですか？',
  'DX推進を成功させるために、まず何から始めれば良いですか？',
  '顧客満足度を向上させるための施策を教えてください',
  '小規模チームでも使えるプロジェクト管理の方法は？',
  '業務の属人化を防ぐために何ができますか？',
]

// ── メインコンポーネント ────────────────────────────

export default function AiChatPage() {
  const { companyId } = useCompany()

  // 会話履歴（セッション内メモリ）
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // チャット末尾に自動スクロール
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // ── 質問送信処理 ──────────────────────────────────

  async function handleSend(question?: string) {
    const text = (question ?? input).trim()
    if (!text || isLoading) return

    setInput('')
    setError(null)

    // ユーザーメッセージをすぐに追加（楽観的UI更新）
    const userMsg: Message = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: text, companyId }),
      })

      const data = await res.json() as { answer?: string; error?: string; elapsedMs?: number }

      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'AIからの応答取得に失敗しました')
      }

      // AIの回答をメッセージに追加
      const assistantMsg: Message = {
        id:        crypto.randomUUID(),
        role:      'assistant',
        content:   data.answer ?? '',
        elapsedMs: data.elapsedMs,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      // エラー時はユーザーメッセージも削除してやり直せるようにする
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
      setInput(text)  // 入力を復元
    } finally {
      setIsLoading(false)
    }
  }

  // ── キーボードショートカット（Ctrl+Enter で送信）──

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSend()
    }
  }

  // ── 会話クリア ────────────────────────────────────

  function handleClear() {
    if (messages.length === 0) return
    if (!confirm('会話履歴をクリアしますか？')) return
    setMessages([])
    setError(null)
  }

  // ── レンダリング ──────────────────────────────────

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto p-4 gap-4">

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-800">AIフリーチャット</h1>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            会話をクリア
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500">
        業務改善・経営課題・DX推進など、何でも自由にご質問ください。
        質問内容はAIログとして自動的に記録されます。
      </p>

      {/* 会話エリア */}
      <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-4 space-y-4 min-h-[400px]">

        {/* 初期状態: 質問例を表示 */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">質問を入力してください</p>
            </div>
            <div className="w-full space-y-2">
              <p className="text-xs text-gray-400 text-center mb-3">質問例</p>
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => void handleSend(q)}
                  className="w-full text-left text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* メッセージ一覧 */}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* アバター */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-200'
            }`}>
              {msg.role === 'user'
                ? <User className="w-4 h-4 text-white" />
                : <Bot className="w-4 h-4 text-gray-600" />
              }
            </div>

            {/* メッセージ本文 */}
            <div className={`max-w-[85%] rounded-lg px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-800'
            }`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {/* AIの応答時間 */}
              {msg.role === 'assistant' && msg.elapsedMs && (
                <p className="text-xs text-gray-400 mt-2">
                  応答時間: {(msg.elapsedMs / 1000).toFixed(1)}秒
                </p>
              )}
            </div>
          </div>
        ))}

        {/* ローディング */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <Bot className="w-4 h-4 text-gray-600" />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-500">回答を生成中...</span>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-600">⚠️ {error}</p>
          </div>
        )}

        {/* 自動スクロール用アンカー */}
        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="質問を入力してください... (Ctrl+Enter で送信)"
          rows={3}
          disabled={isLoading}
          className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:bg-gray-100 disabled:text-gray-400"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 w-12 bg-blue-600 text-white rounded-lg flex items-center justify-center
                     hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Send className="w-5 h-5" />
          }
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        このチャットの内容はAIログとして保存されます
      </p>
    </div>
  )
}
