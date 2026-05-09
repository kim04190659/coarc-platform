'use client'
// =====================================================
//  src/app/skill-game/play/[gameId]/page.tsx
//  スキル向上ゲーム — プレイ画面 — Sprint #25
//
//  ■ ゲームの流れ（ステートマシン）
//    loading    → データ取得中
//    idle       → シナリオ表示・選択肢を選ぶ
//    evaluating → Claude Haikuが採点中（ローディング表示）
//    feedback   → スコア・フィードバック表示（次へ進む）
//    complete   → 全シナリオ終了・合計スコア・Notion保存
//
//  ■ URLパラメータ
//    gameId    : パスパラメータ（ゲームID）
//    staffName : クエリパラメータ（プレイヤー名）
//    companyId : クエリパラメータ（企業ID）
// =====================================================

import { useEffect, useState, use }  from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronRight, Star, Trophy, RotateCcw,
  CheckCircle2, AlertCircle, Lightbulb, Loader2,
} from 'lucide-react'

import { getGameById }           from '@/config/skill-game-catalog'
import { getScenariosForGame }   from '@/config/skill-game-scenarios'
import type { GameDef }          from '@/config/skill-game-catalog'
import type { Scenario, Choice } from '@/config/skill-game-scenarios'
import type { EvaluateResult }   from '@/app/api/skill-game/evaluate/route'

// ── ゲームのステート型 ───────────────────────────────

type GamePhase = 'loading' | 'idle' | 'evaluating' | 'feedback' | 'complete'

// ── グレードの色設定 ─────────────────────────────────

function gradeStyle(grade: EvaluateResult['grade']): { bg: string; text: string; ring: string } {
  switch (grade) {
    case 'S': return { bg: 'bg-yellow-400',  text: 'text-yellow-900', ring: 'ring-yellow-300' }
    case 'A': return { bg: 'bg-green-400',   text: 'text-green-900',  ring: 'ring-green-300'  }
    case 'B': return { bg: 'bg-blue-400',    text: 'text-blue-900',   ring: 'ring-blue-300'   }
    case 'C': return { bg: 'bg-orange-400',  text: 'text-orange-900', ring: 'ring-orange-300' }
    case 'D': return { bg: 'bg-red-500',     text: 'text-white',      ring: 'ring-red-300'    }
  }
}

// ── スコアからグレードを計算（フロント側でも使う） ──

function calcGrade(score: number): EvaluateResult['grade'] {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

// =====================================================
//  メインコンポーネント
// =====================================================

export default function SkillGamePlayPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId }     = use(params)
  const searchParams   = useSearchParams()
  const router         = useRouter()

  // クエリパラメータからプレイヤー情報を取得
  const staffName  = searchParams.get('staffName')  ?? ''
  const companyId  = searchParams.get('companyId')  ?? ''

  // ── ゲーム全体の状態 ──
  const [phase,        setPhase]        = useState<GamePhase>('loading')
  const [game,         setGame]         = useState<GameDef | null>(null)
  const [scenarios,    setScenarios]    = useState<Scenario[]>([])
  const [scIdx,        setScIdx]        = useState(0)           // 現在のシナリオ番号
  const [scores,       setScores]       = useState<number[]>([]) // 各シナリオのスコア

  // ── 1シナリオあたりの状態 ──
  const [selected,     setSelected]     = useState<Choice | null>(null)
  const [result,       setResult]       = useState<EvaluateResult | null>(null)

  // ── 完了画面の状態 ──
  const [notionSaved,  setNotionSaved]  = useState<boolean | null>(null) // null=未保存,true=保存済,false=失敗

  // ── 初期化：ゲームとシナリオのロード ──
  useEffect(() => {
    const gameDef = getGameById(gameId)
    if (!gameDef || !gameDef.available) {
      // ゲームが存在しない・未公開はセレクト画面に戻す
      router.replace('/skill-game/select')
      return
    }
    const sc = getScenariosForGame(gameId)
    if (sc.length === 0) {
      router.replace('/skill-game/select')
      return
    }
    setGame(gameDef)
    setScenarios(sc)
    setPhase('idle')
  }, [gameId, router])

  // ── 現在のシナリオ ──
  const scenario = scenarios[scIdx] ?? null

  // ── 選択肢クリック（idle時のみ有効） ──
  function handleChoiceClick(choice: Choice) {
    if (phase !== 'idle') return
    setSelected(choice)
  }

  // ── 「採点する」ボタン ──
  async function handleEvaluate() {
    if (!selected || !scenario || !game || phase !== 'idle') return
    setPhase('evaluating')

    try {
      const res = await fetch('/api/skill-game/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          scenarioId:   scenario.id,
          choiceId:     selected.id,
          choiceText:   selected.text,
          situation:    scenario.situation,
          question:     scenario.question,
          evalCriteria: scenario.evalCriteria,
        }),
      })

      if (!res.ok) throw new Error('APIエラー')
      const evalResult = await res.json() as EvaluateResult
      setResult(evalResult)
      setScores(prev => [...prev, evalResult.score])
      setPhase('feedback')
    } catch {
      // API失敗時はフォールバックスコア60点で継続
      const fallback: EvaluateResult = {
        score:          60,
        grade:          'B',
        goodPoints:     '選択肢を選んでいただけました。',
        improvements:   '状況に合わせた対応をさらに意識してみましょう。',
        betterApproach: 'お客様・相手の立場に立った対応が重要です。',
      }
      setResult(fallback)
      setScores(prev => [...prev, fallback.score])
      setPhase('feedback')
    }
  }

  // ── 「次のシナリオへ」ボタン ──
  function handleNext() {
    if (scIdx + 1 < scenarios.length) {
      // 次のシナリオへ
      setScIdx(prev => prev + 1)
      setSelected(null)
      setResult(null)
      setPhase('idle')
    } else {
      // 全シナリオ完了
      setPhase('complete')
      handleSaveToNotion()
    }
  }

  // ── Notion保存（完了時に自動実行） ──
  async function handleSaveToNotion() {
    if (!game) return

    // 平均スコアを計算（小数点以下四捨五入）
    const allScores   = [...scores]
    const totalScore  = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    const finalGrade  = calcGrade(totalScore)

    try {
      const res = await fetch('/api/skill-game/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          staffName,
          gameId,
          gameTitle:       game.title,
          totalScore,
          grade:           finalGrade,
          scenariosPlayed: scenarios.length,
          playedAt:        new Date().toISOString(),
        }),
      })
      const json = await res.json()
      setNotionSaved(json.saved === true)
    } catch {
      setNotionSaved(false)
    }
  }

  // ── 合計スコアとグレードを計算（complete画面用） ──
  const totalScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0
  const finalGrade = calcGrade(totalScore)

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
  //  完了画面
  // =====================================================
  if (phase === 'complete') {
    const gs = gradeStyle(finalGrade)
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8">

        {/* タイトル */}
        <div>
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">ゲーム完了！</h1>
          <p className="text-indigo-300">{game?.title}</p>
        </div>

        {/* スコアカード */}
        <div className="bg-indigo-900/60 backdrop-blur-sm border border-indigo-700/50 rounded-2xl p-8">
          <div className="mb-6">
            <p className="text-indigo-300 text-sm mb-2">総合スコア</p>
            <div className="text-6xl font-bold text-white mb-3">{totalScore}</div>
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ring-4 ${gs.bg} ${gs.text} ${gs.ring}`}>
              {finalGrade}
            </div>
          </div>

          {/* シナリオ別スコア */}
          <div className="mt-6 space-y-2">
            <p className="text-indigo-300 text-sm text-left mb-3">シナリオ別スコア</p>
            {scores.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-indigo-400 text-sm w-24 text-left">シナリオ {i + 1}</span>
                <div className="flex-1 bg-indigo-800/60 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      s >= 75 ? 'bg-green-400' : s >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${s}%` }}
                  />
                </div>
                <span className="text-white text-sm font-bold w-10 text-right">{s}点</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notion保存ステータス */}
        <div className="text-sm">
          {notionSaved === null && (
            <p className="text-indigo-400">
              <Loader2 className="w-4 h-4 inline animate-spin mr-1" />
              研修ログを保存中...
            </p>
          )}
          {notionSaved === true && (
            <p className="text-green-400">
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              研修ログをNotionに保存しました
            </p>
          )}
          {notionSaved === false && (
            <p className="text-indigo-400">
              研修ログの保存はスキップされました
            </p>
          )}
        </div>

        {/* ボタン */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push('/skill-game/select')}
            className="px-6 py-3 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-medium transition-colors"
          >
            ゲーム選択に戻る
          </button>
          <button
            onClick={() => {
              // リセットして同じゲームをもう一度
              setScIdx(0)
              setScores([])
              setSelected(null)
              setResult(null)
              setNotionSaved(null)
              setPhase('idle')
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
  //  プレイ画面（idle / evaluating / feedback）
  // =====================================================
  if (!scenario || !game) return null

  const isEvaluating = phase === 'evaluating'
  const isFeedback   = phase === 'feedback'

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── 進捗バー ── */}
      <div className="flex items-center gap-4">
        <span className="text-indigo-300 text-sm">
          {scIdx + 1} / {scenarios.length} シナリオ
        </span>
        <div className="flex-1 bg-indigo-800/50 rounded-full h-2">
          <div
            className="bg-indigo-400 h-2 rounded-full transition-all duration-500"
            style={{ width: `${((scIdx) / scenarios.length) * 100}%` }}
          />
        </div>
        {/* 現在の累積スコア */}
        {scores.length > 0 && (
          <span className="text-indigo-300 text-sm">
            平均 {Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}点
          </span>
        )}
      </div>

      {/* ── ゲームカード ── */}
      <div className="bg-indigo-900/60 backdrop-blur-sm border border-indigo-700/50 rounded-2xl overflow-hidden">

        {/* ゲームタイトル帯 */}
        <div className="px-6 py-3 border-b border-indigo-700/40 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          <span className="text-indigo-200 text-sm font-medium">{game.title}</span>
          {staffName && (
            <span className="ml-auto text-indigo-400 text-xs">{staffName}</span>
          )}
        </div>

        {/* シナリオ本文 */}
        <div className="p-6 space-y-6">

          {/* 状況説明 */}
          <div className="bg-indigo-950/50 rounded-xl p-4 border border-indigo-700/30">
            <p className="text-xs text-indigo-400 font-semibold uppercase mb-2">■ 状況</p>
            <p className="text-indigo-100 text-sm leading-relaxed">{scenario.situation}</p>
          </div>

          {/* 設問 */}
          <div>
            <p className="text-white font-bold text-base leading-relaxed">{scenario.question}</p>
          </div>

          {/* 選択肢（4択） */}
          <div className="space-y-3">
            {scenario.choices.map((choice) => {
              const isSelected = selected?.id === choice.id

              // フィードバック時の選択肢スタイル
              const feedbackStyle = isFeedback
                ? isSelected
                  ? result && result.score >= 75
                    ? 'border-green-400 bg-green-900/30 text-green-100'   // 高得点 → 緑
                    : 'border-orange-400 bg-orange-900/30 text-orange-100' // 低得点 → オレンジ
                  : 'border-indigo-700/30 bg-indigo-950/30 text-indigo-400 opacity-50'  // 非選択
                : isSelected
                  ? 'border-indigo-400 bg-indigo-700/50 text-white shadow-lg shadow-indigo-500/20'
                  : 'border-indigo-700/40 bg-indigo-950/30 text-indigo-200 hover:border-indigo-500 hover:bg-indigo-800/40'

              return (
                <button
                  key={choice.id}
                  onClick={() => handleChoiceClick(choice)}
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
              onClick={handleEvaluate}
              disabled={!selected}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                selected
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-500/30'
                  : 'bg-indigo-800/40 text-indigo-500 cursor-not-allowed'
              }`}
            >
              {selected ? '採点する →' : '選択肢を選んでください'}
            </button>
          )}

          {/* 採点中（evaluating） */}
          {isEvaluating && (
            <div className="w-full py-3.5 rounded-xl bg-indigo-800/40 text-indigo-300 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              AIが採点中です...
            </div>
          )}
        </div>
      </div>

      {/* ── フィードバックカード（feedback時のみ） ── */}
      {isFeedback && result && (
        <div className="bg-indigo-900/60 backdrop-blur-sm border border-indigo-700/50 rounded-2xl p-6 space-y-5 animate-in fade-in duration-300">

          {/* スコア・グレード */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ring-4 ${gradeStyle(result.grade).bg} ${gradeStyle(result.grade).text} ${gradeStyle(result.grade).ring}`}>
              {result.grade}
            </div>
            <div>
              <div className="text-3xl font-bold text-white">{result.score}点</div>
              <div className="text-indigo-400 text-sm">このシナリオのスコア</div>
            </div>
          </div>

          {/* 良かった点 */}
          <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-300 text-xs font-bold mb-1">良かった点</p>
              <p className="text-indigo-100 text-sm leading-relaxed">{result.goodPoints}</p>
            </div>
          </div>

          {/* 改善できる点 */}
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-300 text-xs font-bold mb-1">改善できる点</p>
              <p className="text-indigo-100 text-sm leading-relaxed">{result.improvements}</p>
            </div>
          </div>

          {/* より良い対応 */}
          <div className="flex gap-3">
            <Lightbulb className="w-5 h-5 text-indigo-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-indigo-300 text-xs font-bold mb-1">より良い対応</p>
              <p className="text-indigo-100 text-sm leading-relaxed">{result.betterApproach}</p>
            </div>
          </div>

          {/* 次へボタン */}
          <button
            onClick={handleNext}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {scIdx + 1 < scenarios.length ? (
              <>次のシナリオへ <ChevronRight className="w-4 h-4" /></>
            ) : (
              <>結果を見る <Trophy className="w-4 h-4" /></>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
