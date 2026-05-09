'use client'
// =====================================================
//  src/app/skill-game/play/[gameId]/page.tsx
//  スキル向上ゲーム — プレイ画面 — Sprint #25/#26
//
//  ■ ゲームタイプによる分岐
//    scenario : シナリオ選択 → Claude Haiku AI採点
//    quiz     : 4択クイズ → 正解/不正解を即表示（AI不要）
//
//  ■ ステートマシン（共通）
//    loading    → データ取得中
//    idle       → 問題表示・選択肢を選ぶ
//    evaluating → AI採点中（scenarioのみ）
//    feedback   → 結果表示（次へ進む）
//    complete   → 全問終了・合計スコア・Notion保存
//
//  ■ URLパラメータ
//    gameId    : パスパラメータ
//    staffName : クエリパラメータ（プレイヤー名）
//    companyId : クエリパラメータ（企業ID）
// =====================================================

import { useEffect, useState, use }   from 'react'
import { useRouter, useSearchParams }  from 'next/navigation'
import {
  ChevronRight, Star, Trophy, RotateCcw,
  CheckCircle2, XCircle, AlertCircle, Lightbulb, Loader2, BookOpen,
} from 'lucide-react'

import { getGameById }              from '@/config/skill-game-catalog'
import { getScenariosForGame }      from '@/config/skill-game-scenarios'
import { getQuestionsForGame }      from '@/config/skill-game-quizzes'
import type { GameDef }             from '@/config/skill-game-catalog'
import type { Scenario, Choice }    from '@/config/skill-game-scenarios'
import type { QuizQuestion, QuizChoice } from '@/config/skill-game-quizzes'
import type { EvaluateResult }      from '@/app/api/skill-game/evaluate/route'

// ── ステート型 ───────────────────────────────────────

type GamePhase = 'loading' | 'idle' | 'evaluating' | 'feedback' | 'complete'

// ── グレード変換 ─────────────────────────────────────

function calcGrade(score: number): EvaluateResult['grade'] {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

function gradeStyle(grade: EvaluateResult['grade']): { bg: string; text: string; ring: string } {
  switch (grade) {
    case 'S': return { bg: 'bg-yellow-400',  text: 'text-yellow-900', ring: 'ring-yellow-300' }
    case 'A': return { bg: 'bg-green-400',   text: 'text-green-900',  ring: 'ring-green-300'  }
    case 'B': return { bg: 'bg-blue-400',    text: 'text-blue-900',   ring: 'ring-blue-300'   }
    case 'C': return { bg: 'bg-orange-400',  text: 'text-orange-900', ring: 'ring-orange-300' }
    case 'D': return { bg: 'bg-red-500',     text: 'text-white',      ring: 'ring-red-300'    }
  }
}

// =====================================================
//  メインコンポーネント
// =====================================================

export default function SkillGamePlayPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId }    = use(params)
  const searchParams  = useSearchParams()
  const router        = useRouter()

  const staffName = searchParams.get('staffName') ?? ''
  const companyId = searchParams.get('companyId') ?? ''

  // ── 共通ゲーム状態 ──
  const [phase,       setPhase]       = useState<GamePhase>('loading')
  const [game,        setGame]        = useState<GameDef | null>(null)
  const [currentIdx,  setCurrentIdx]  = useState(0)
  const [scores,      setScores]      = useState<number[]>([])
  const [notionSaved, setNotionSaved] = useState<boolean | null>(null)

  // ── scenario タイプの状態 ──
  const [scenarios,       setScenarios]       = useState<Scenario[]>([])
  const [selectedChoice,  setSelectedChoice]  = useState<Choice | null>(null)
  const [evalResult,      setEvalResult]      = useState<EvaluateResult | null>(null)

  // ── quiz タイプの状態 ──
  const [questions,        setQuestions]        = useState<QuizQuestion[]>([])
  const [selectedQuizChoice, setSelectedQuizChoice] = useState<QuizChoice | null>(null)
  const [quizAnswered,     setQuizAnswered]     = useState(false)  // 回答したか

  // ── 初期化 ──
  useEffect(() => {
    const gameDef = getGameById(gameId)
    if (!gameDef || !gameDef.available) {
      router.replace('/skill-game/select')
      return
    }
    setGame(gameDef)

    if (gameDef.type === 'scenario') {
      const sc = getScenariosForGame(gameId)
      if (sc.length === 0) { router.replace('/skill-game/select'); return }
      setScenarios(sc)
    } else if (gameDef.type === 'quiz') {
      const qs = getQuestionsForGame(gameId)
      if (qs.length === 0) { router.replace('/skill-game/select'); return }
      setQuestions(qs)
    }

    setPhase('idle')
  }, [gameId, router])

  // ── 合計問題数（scenario / quiz 共通） ──
  const totalItems = game?.type === 'quiz' ? questions.length : scenarios.length

  // ── 平均スコア・グレード（complete画面用） ──
  const totalScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0
  const finalGrade = calcGrade(totalScore)

  // ── Notion保存 ──
  async function saveToNotion(finalScores: number[]) {
    if (!game) return
    const avg   = Math.round(finalScores.reduce((a, b) => a + b, 0) / finalScores.length)
    const grade = calcGrade(avg)
    try {
      const res  = await fetch('/api/skill-game/score', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          companyId, staffName, gameId,
          gameTitle:       game.title,
          totalScore:      avg,
          grade,
          scenariosPlayed: finalScores.length,
          playedAt:        new Date().toISOString(),
        }),
      })
      const json = await res.json()
      setNotionSaved(json.saved === true)
    } catch {
      setNotionSaved(false)
    }
  }

  // ── 次の問題へ進む（scenario / quiz 共通） ──
  function goNext(newScores: number[]) {
    if (currentIdx + 1 < totalItems) {
      setCurrentIdx(prev => prev + 1)
      setSelectedChoice(null)
      setEvalResult(null)
      setSelectedQuizChoice(null)
      setQuizAnswered(false)
      setPhase('idle')
    } else {
      setPhase('complete')
      saveToNotion(newScores)
    }
  }

  // =====================================================
  //  SCENARIO タイプのハンドラー
  // =====================================================

  function handleScenarioChoice(choice: Choice) {
    if (phase !== 'idle') return
    setSelectedChoice(choice)
  }

  async function handleScenarioEvaluate() {
    const scenario = scenarios[currentIdx]
    if (!selectedChoice || !scenario || phase !== 'idle') return
    setPhase('evaluating')

    try {
      const res = await fetch('/api/skill-game/evaluate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          gameId,
          scenarioId:   scenario.id,
          choiceId:     selectedChoice.id,
          choiceText:   selectedChoice.text,
          situation:    scenario.situation,
          question:     scenario.question,
          evalCriteria: scenario.evalCriteria,
        }),
      })
      if (!res.ok) throw new Error('API error')
      const result = await res.json() as EvaluateResult
      setEvalResult(result)
      const newScores = [...scores, result.score]
      setScores(newScores)
      setPhase('feedback')
    } catch {
      const fallback: EvaluateResult = {
        score: 60, grade: 'B',
        goodPoints:     '選択肢を選んでいただけました。',
        improvements:   '状況に合わせた対応をさらに意識してみましょう。',
        betterApproach: 'お客様・相手の立場に立った対応が重要です。',
      }
      setEvalResult(fallback)
      const newScores = [...scores, fallback.score]
      setScores(newScores)
      setPhase('feedback')
    }
  }

  // =====================================================
  //  QUIZ タイプのハンドラー
  // =====================================================

  function handleQuizChoice(choice: QuizChoice) {
    if (quizAnswered || phase !== 'idle') return
    setSelectedQuizChoice(choice)
  }

  function handleQuizAnswer() {
    const question = questions[currentIdx]
    if (!selectedQuizChoice || !question || quizAnswered) return

    const isCorrect = selectedQuizChoice.id === question.correctId
    const score     = isCorrect ? 100 : 0
    setQuizAnswered(true)
    const newScores = [...scores, score]
    setScores(newScores)
    setPhase('feedback')
  }

  function handleQuizNext() {
    const newScores = scores  // 既に追加済み
    goNext(newScores)
  }

  // =====================================================
  //  ローディング画面
  // =====================================================
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-indigo-300">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
          <p>ゲームをロード中...</p>
        </div>
      </div>
    )
  }

  // =====================================================
  //  完了画面（scenario / quiz 共通）
  // =====================================================
  if (phase === 'complete') {
    const gs = gradeStyle(finalGrade)
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <div>
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">ゲーム完了！</h1>
          <p className="text-indigo-300">{game?.title}</p>
        </div>

        <div className="bg-indigo-900/60 backdrop-blur-sm border border-indigo-700/50 rounded-2xl p-8">
          <p className="text-indigo-300 text-sm mb-2">総合スコア</p>
          <div className="text-6xl font-bold text-white mb-3">{totalScore}</div>
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ring-4 ${gs.bg} ${gs.text} ${gs.ring}`}>
            {finalGrade}
          </div>

          {/* 問題別スコア */}
          <div className="mt-6 space-y-2">
            <p className="text-indigo-300 text-sm text-left mb-3">
              {game?.type === 'quiz' ? '問題別結果' : 'シナリオ別スコア'}
            </p>
            {scores.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-indigo-400 text-sm w-20 text-left">
                  {game?.type === 'quiz' ? `問題 ${i + 1}` : `シナリオ ${i + 1}`}
                </span>
                {game?.type === 'quiz' ? (
                  // クイズは正解/不正解で表示
                  <div className="flex-1 flex items-center gap-2">
                    {s === 100
                      ? <><CheckCircle2 className="w-4 h-4 text-green-400" /><span className="text-green-400 text-sm">正解</span></>
                      : <><XCircle className="w-4 h-4 text-red-400" /><span className="text-red-400 text-sm">不正解</span></>
                    }
                  </div>
                ) : (
                  // シナリオはスコアバーで表示
                  <>
                    <div className="flex-1 bg-indigo-800/60 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${
                          s >= 75 ? 'bg-green-400' : s >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${s}%` }}
                      />
                    </div>
                    <span className="text-white text-sm font-bold w-10 text-right">{s}点</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notion保存ステータス */}
        <div className="text-sm">
          {notionSaved === null && (
            <p className="text-indigo-400"><Loader2 className="w-4 h-4 inline animate-spin mr-1" />研修ログを保存中...</p>
          )}
          {notionSaved === true && (
            <p className="text-green-400"><CheckCircle2 className="w-4 h-4 inline mr-1" />研修ログをNotionに保存しました</p>
          )}
          {notionSaved === false && (
            <p className="text-indigo-400">研修ログの保存はスキップされました</p>
          )}
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push('/skill-game/select')}
            className="px-6 py-3 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-medium transition-colors"
          >
            ゲーム選択に戻る
          </button>
          <button
            onClick={() => {
              setCurrentIdx(0); setScores([])
              setSelectedChoice(null); setEvalResult(null)
              setSelectedQuizChoice(null); setQuizAnswered(false)
              setNotionSaved(null); setPhase('idle')
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            もう一度挑戦
          </button>
        </div>
      </div>
    )
  }

  // =====================================================
  //  プレイ画面 — QUIZ タイプ
  // =====================================================
  if (game?.type === 'quiz') {
    const question = questions[currentIdx]
    if (!question) return null
    const isAnswered = quizAnswered
    const isCorrect  = isAnswered && selectedQuizChoice?.id === question.correctId

    return (
      <div className="max-w-3xl mx-auto space-y-6">

        {/* 進捗バー */}
        <div className="flex items-center gap-4">
          <span className="text-indigo-300 text-sm">{currentIdx + 1} / {questions.length} 問</span>
          <div className="flex-1 bg-indigo-800/50 rounded-full h-2">
            <div
              className="bg-indigo-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(currentIdx / questions.length) * 100}%` }}
            />
          </div>
          {scores.length > 0 && (
            <span className="text-indigo-300 text-sm">
              {scores.filter(s => s === 100).length}/{scores.length} 正解
            </span>
          )}
        </div>

        {/* 問題カード */}
        <div className="bg-indigo-900/60 backdrop-blur-sm border border-indigo-700/50 rounded-2xl overflow-hidden">
          <div className="px-6 py-3 border-b border-indigo-700/40 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-300" />
            <span className="text-indigo-200 text-sm font-medium">{game.title}</span>
            {staffName && <span className="ml-auto text-indigo-400 text-xs">{staffName}</span>}
          </div>

          <div className="p-6 space-y-6">
            {/* 問題文 */}
            <p className="text-white font-bold text-base leading-relaxed">{question.question}</p>

            {/* 選択肢 */}
            <div className="space-y-3">
              {question.choices.map((choice) => {
                const isSelected  = selectedQuizChoice?.id === choice.id
                const isCorrectChoice = choice.id === question.correctId

                let choiceStyle = 'border-indigo-700/40 bg-indigo-950/30 text-indigo-200 hover:border-indigo-500 hover:bg-indigo-800/40'
                if (isAnswered) {
                  if (isCorrectChoice) {
                    choiceStyle = 'border-green-400 bg-green-900/30 text-green-100'  // 正解を緑で表示
                  } else if (isSelected && !isCorrectChoice) {
                    choiceStyle = 'border-red-400 bg-red-900/30 text-red-100'        // 間違いを赤で表示
                  } else {
                    choiceStyle = 'border-indigo-700/30 bg-indigo-950/30 text-indigo-400 opacity-50'
                  }
                } else if (isSelected) {
                  choiceStyle = 'border-indigo-400 bg-indigo-700/50 text-white shadow-lg shadow-indigo-500/20'
                }

                return (
                  <button
                    key={choice.id}
                    onClick={() => handleQuizChoice(choice)}
                    disabled={isAnswered}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-200 ${choiceStyle}`}
                  >
                    <span className="font-bold mr-3 text-sm">{choice.id}.</span>
                    <span className="text-sm leading-relaxed">{choice.text}</span>
                    {isAnswered && isCorrectChoice && (
                      <CheckCircle2 className="w-4 h-4 text-green-400 inline ml-2" />
                    )}
                    {isAnswered && isSelected && !isCorrectChoice && (
                      <XCircle className="w-4 h-4 text-red-400 inline ml-2" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* 回答ボタン（未回答時） */}
            {!isAnswered && (
              <button
                onClick={handleQuizAnswer}
                disabled={!selectedQuizChoice}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                  selectedQuizChoice
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-500/30'
                    : 'bg-indigo-800/40 text-indigo-500 cursor-not-allowed'
                }`}
              >
                {selectedQuizChoice ? '回答する →' : '選択肢を選んでください'}
              </button>
            )}
          </div>
        </div>

        {/* 正誤フィードバックカード（回答後） */}
        {isAnswered && (
          <div className="bg-indigo-900/60 backdrop-blur-sm border border-indigo-700/50 rounded-2xl p-6 space-y-4 animate-in fade-in duration-300">

            {/* 正解/不正解バナー */}
            <div className={`flex items-center gap-3 p-3 rounded-xl ${isCorrect ? 'bg-green-900/40 border border-green-700/50' : 'bg-red-900/40 border border-red-700/50'}`}>
              {isCorrect
                ? <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                : <XCircle     className="w-6 h-6 text-red-400 flex-shrink-0"   />
              }
              <span className={`font-bold ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
                {isCorrect ? '正解！' : `不正解。正解は「${question.correctId}」でした。`}
              </span>
            </div>

            {/* キーワード */}
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 text-xs font-bold">覚えてほしいキーワード：</span>
              <span className="text-yellow-200 text-sm font-semibold">{question.keyword}</span>
            </div>

            {/* 解説 */}
            <div className="flex gap-3">
              <Lightbulb className="w-5 h-5 text-indigo-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-indigo-300 text-xs font-bold mb-1">解説</p>
                <p className="text-indigo-100 text-sm leading-relaxed">{question.explanation}</p>
              </div>
            </div>

            {/* 次へボタン */}
            <button
              onClick={handleQuizNext}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {currentIdx + 1 < questions.length
                ? <>次の問題へ <ChevronRight className="w-4 h-4" /></>
                : <>結果を見る <Trophy className="w-4 h-4" /></>
              }
            </button>
          </div>
        )}
      </div>
    )
  }

  // =====================================================
  //  プレイ画面 — SCENARIO タイプ
  // =====================================================
  const scenario      = scenarios[currentIdx]
  const isEvaluating  = phase === 'evaluating'
  const isFeedback    = phase === 'feedback'

  if (!scenario || !game) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* 進捗バー */}
      <div className="flex items-center gap-4">
        <span className="text-indigo-300 text-sm">{currentIdx + 1} / {scenarios.length} シナリオ</span>
        <div className="flex-1 bg-indigo-800/50 rounded-full h-2">
          <div
            className="bg-indigo-400 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(currentIdx / scenarios.length) * 100}%` }}
          />
        </div>
        {scores.length > 0 && (
          <span className="text-indigo-300 text-sm">
            平均 {Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}点
          </span>
        )}
      </div>

      {/* シナリオカード */}
      <div className="bg-indigo-900/60 backdrop-blur-sm border border-indigo-700/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-3 border-b border-indigo-700/40 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          <span className="text-indigo-200 text-sm font-medium">{game.title}</span>
          {staffName && <span className="ml-auto text-indigo-400 text-xs">{staffName}</span>}
        </div>

        <div className="p-6 space-y-6">
          {/* 状況説明 */}
          <div className="bg-indigo-950/50 rounded-xl p-4 border border-indigo-700/30">
            <p className="text-xs text-indigo-400 font-semibold uppercase mb-2">■ 状況</p>
            <p className="text-indigo-100 text-sm leading-relaxed">{scenario.situation}</p>
          </div>

          {/* 設問 */}
          <p className="text-white font-bold text-base leading-relaxed">{scenario.question}</p>

          {/* 選択肢 */}
          <div className="space-y-3">
            {scenario.choices.map((choice) => {
              const isSelected = selectedChoice?.id === choice.id
              const feedbackStyle = isFeedback
                ? isSelected
                  ? evalResult && evalResult.score >= 75
                    ? 'border-green-400 bg-green-900/30 text-green-100'
                    : 'border-orange-400 bg-orange-900/30 text-orange-100'
                  : 'border-indigo-700/30 bg-indigo-950/30 text-indigo-400 opacity-50'
                : isSelected
                  ? 'border-indigo-400 bg-indigo-700/50 text-white shadow-lg shadow-indigo-500/20'
                  : 'border-indigo-700/40 bg-indigo-950/30 text-indigo-200 hover:border-indigo-500 hover:bg-indigo-800/40'

              return (
                <button
                  key={choice.id}
                  onClick={() => handleScenarioChoice(choice)}
                  disabled={isFeedback || isEvaluating}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-200 ${feedbackStyle}`}
                >
                  <span className="font-bold mr-3 text-sm">{choice.id}.</span>
                  <span className="text-sm leading-relaxed">{choice.text}</span>
                </button>
              )
            })}
          </div>

          {/* 採点ボタン（idle時） */}
          {phase === 'idle' && (
            <button
              onClick={handleScenarioEvaluate}
              disabled={!selectedChoice}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                selectedChoice
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-500/30'
                  : 'bg-indigo-800/40 text-indigo-500 cursor-not-allowed'
              }`}
            >
              {selectedChoice ? '採点する →' : '選択肢を選んでください'}
            </button>
          )}

          {/* 採点中 */}
          {isEvaluating && (
            <div className="w-full py-3.5 rounded-xl bg-indigo-800/40 text-indigo-300 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              AIが採点中です...
            </div>
          )}
        </div>
      </div>

      {/* フィードバックカード（scenario feedback） */}
      {isFeedback && evalResult && (
        <div className="bg-indigo-900/60 backdrop-blur-sm border border-indigo-700/50 rounded-2xl p-6 space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ring-4 ${gradeStyle(evalResult.grade).bg} ${gradeStyle(evalResult.grade).text} ${gradeStyle(evalResult.grade).ring}`}>
              {evalResult.grade}
            </div>
            <div>
              <div className="text-3xl font-bold text-white">{evalResult.score}点</div>
              <div className="text-indigo-400 text-sm">このシナリオのスコア</div>
            </div>
          </div>

          <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-300 text-xs font-bold mb-1">良かった点</p>
              <p className="text-indigo-100 text-sm leading-relaxed">{evalResult.goodPoints}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-300 text-xs font-bold mb-1">改善できる点</p>
              <p className="text-indigo-100 text-sm leading-relaxed">{evalResult.improvements}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Lightbulb className="w-5 h-5 text-indigo-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-indigo-300 text-xs font-bold mb-1">より良い対応</p>
              <p className="text-indigo-100 text-sm leading-relaxed">{evalResult.betterApproach}</p>
            </div>
          </div>

          <button
            onClick={() => goNext(scores)}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {currentIdx + 1 < scenarios.length
              ? <>次のシナリオへ <ChevronRight className="w-4 h-4" /></>
              : <>結果を見る <Trophy className="w-4 h-4" /></>
            }
          </button>
        </div>
      )}
    </div>
  )
}
