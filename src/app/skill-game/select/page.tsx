'use client'

// =====================================================
//  src/app/skill-game/select/page.tsx
//  スキル向上ゲーム — ゲーム選択画面 — Sprint #24
//
//  ■ 画面構成
//    1. スタッフ選択 + AI推薦パネル
//    2. カテゴリタブ（全て / CS / コミュニケーション / AI活用 / 業務改善 / 業種別）
//    3. ゲームカード一覧（難易度バッジ・プレイ時間・スキルタグ表示）
//    4. 近日公開ゲームは "Coming Soon" オーバーレイ
//
//  ■ 動作フロー
//    ① companyId をコンテキストから取得
//    ② 社員一覧をfetch → スタッフセレクター表示
//    ③ スタッフ選択 or 「推薦を見る」→ /api/skill-game/recommend をfetch
//    ④ 推薦結果をバナーに表示、ゲームカード一覧を絞り込み
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Gamepad2, Loader2, Zap, Star, Clock, ChevronRight,
  Users, RefreshCw, Lock, Sparkles, Filter,
} from 'lucide-react'
import { useCompany } from '@/contexts/CompanyContext'
import {
  GAME_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  DIFFICULTY_LABELS,
  INDUSTRY_LABELS,
  getIndustryByCompanyId,
  type GameCategory,
  type GameDef,
} from '@/config/skill-game-catalog'
import type { RecommendResult } from '@/app/api/skill-game/recommend/route'

// ── タブ定義 ─────────────────────────────────────────

const TABS: { id: 'all' | GameCategory; label: string }[] = [
  { id: 'all',             label: '🎮 すべて' },
  { id: 'cs',              label: '📞 CS・クレーム' },
  { id: 'communication',   label: '💬 コミュニケーション' },
  { id: 'ai-literacy',     label: '🤖 AI活用' },
  { id: 'problem-solving', label: '🔧 業務改善' },
  { id: 'management',      label: '📊 マネジメント' },
  { id: 'industry',        label: '🏢 業種別' },
]

// ── 難易度バッジ ────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty: 1 | 2 | 3 }) {
  const d = DIFFICULTY_LABELS[difficulty]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${d.color}`}>
      {d.label}
    </span>
  )
}

// ── ゲームカード ────────────────────────────────────

function GameCard({
  game,
  isRecommended,
  recommendReason,
  priority,
  onPlay,
}: {
  game:            GameDef
  isRecommended:   boolean
  recommendReason: string
  priority:        number
  onPlay:          (game: GameDef) => void   // プレイ開始コールバック
}) {
  const catColor = CATEGORY_COLORS[game.category]

  return (
    <div className={`relative bg-white rounded-xl border shadow-sm overflow-hidden transition-all
      ${isRecommended ? 'border-yellow-300 ring-2 ring-yellow-200 shadow-yellow-50' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'}
      ${!game.available ? 'opacity-80' : ''}
    `}>

      {/* 推薦バッジ */}
      {isRecommended && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold py-1 px-3 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          AI推薦 #{priority}
        </div>
      )}

      <div className={`p-4 ${isRecommended ? 'pt-8' : ''}`}>

        {/* カテゴリ + 難易度 */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${catColor.bg} ${catColor.text} ${catColor.border}`}>
            {CATEGORY_LABELS[game.category]}
          </span>
          <DifficultyBadge difficulty={game.difficulty} />
          {game.industry !== 'all' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-50 text-rose-700 border border-rose-200">
              業種別
            </span>
          )}
        </div>

        {/* タイトル */}
        <h3 className="text-sm font-bold text-gray-800 mb-1 leading-snug">{game.title}</h3>

        {/* 説明文 */}
        <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{game.description}</p>

        {/* AI推薦理由 */}
        {isRecommended && recommendReason && (
          <div className="mb-3 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-xs text-yellow-800 leading-relaxed">
              <Sparkles className="w-3 h-3 inline mr-1" />
              {recommendReason}
            </p>
          </div>
        )}

        {/* スキルタグ */}
        <div className="flex flex-wrap gap-1 mb-3">
          {game.skillTags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>

        {/* フッター：プレイ時間 + ボタン */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            約{game.estimatedMinutes}分
          </div>

          {game.available ? (
            <button
              onClick={() => onPlay(game)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              プレイ開始
              <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">
              <Lock className="w-3 h-3" />
              Sprint {game.sprint}で公開
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────

export default function SkillGameSelectPage() {
  const { companyId } = useCompany()
  const router        = useRouter()
  const industry      = getIndustryByCompanyId(companyId)

  // ── State ──
  const [staffList,  setStaffList]  = useState<Array<{ name: string; role: string; department: string }>>([])
  const [staffName,  setStaffName]  = useState('')
  const [recommend,  setRecommend]  = useState<RecommendResult | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [activeTab,  setActiveTab]  = useState<'all' | GameCategory>('all')
  const [difficulty, setDifficulty] = useState<0 | 1 | 2 | 3>(0)  // 0 = すべて

  // ── プレイ開始：プレイ画面に遷移 ──
  function handlePlay(game: GameDef) {
    const params = new URLSearchParams({ companyId })
    if (staffName) params.set('staffName', staffName)
    router.push(`/skill-game/play/${game.id}?${params.toString()}`)
  }

  // ── 社員一覧取得 ──
  useEffect(() => {
    async function loadStaff() {
      try {
        const res  = await fetch(`/api/staff/list?companyId=${companyId}`)
        const data = await res.json() as { staff: Array<{ name: string; role: string; department: string }> }
        setStaffList(data.staff ?? [])
      } catch {
        setStaffList([])
      }
    }
    loadStaff()
  }, [companyId])

  // ── AI推薦取得 ──
  const fetchRecommend = useCallback(async () => {
    setRecLoading(true)
    try {
      const params = new URLSearchParams({ companyId })
      if (staffName) params.set('staffName', staffName)
      const res  = await fetch(`/api/skill-game/recommend?${params}`)
      const data = await res.json() as RecommendResult
      setRecommend(data)
    } catch {
      setRecommend(null)
    } finally {
      setRecLoading(false)
    }
  }, [companyId, staffName])

  // 初回ロード時に推薦を自動取得
  useEffect(() => { fetchRecommend() }, [fetchRecommend])

  // ── ゲームフィルタリング ──
  const visibleGames = GAME_CATALOG.filter(g => {
    const matchIndustry  = g.industry === 'all' || g.industry === industry
    const matchCategory  = activeTab === 'all' || g.category === activeTab
    const matchDifficulty = difficulty === 0 || g.difficulty === difficulty
    return matchIndustry && matchCategory && matchDifficulty
  })

  // 推薦ゲームIDのセット
  const recommendedIds = new Set(recommend?.recommendations.map(r => r.gameId) ?? [])

  // 推薦ゲームを先頭に、残りを後ろに並べ替え
  const sortedGames = [
    ...visibleGames.filter(g => recommendedIds.has(g.id)),
    ...visibleGames.filter(g => !recommendedIds.has(g.id)),
  ]

  return (
    <div className="space-y-6">

      {/* ── ページタイトル ── */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Gamepad2 className="w-7 h-7 text-indigo-300" />
          スキル向上ゲーム
        </h1>
        <p className="text-indigo-300 text-sm mt-1">
          {INDUSTRY_LABELS[industry]} 向け・全{GAME_CATALOG.filter(g => g.industry === 'all' || g.industry === industry).length}ゲーム収録
        </p>
      </div>

      {/* ── スタッフ選択 + AI推薦 ── */}
      <div className="bg-indigo-900/60 border border-indigo-700/50 rounded-2xl p-5 backdrop-blur-sm">
        <div className="flex items-start gap-4 flex-wrap">

          {/* スタッフ選択 */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-indigo-300 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              対象スタッフを選択
            </label>
            <select
              value={staffName}
              onChange={e => setStaffName(e.target.value)}
              className="w-full px-3 py-2 bg-indigo-800/60 border border-indigo-600/50 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-400"
            >
              <option value="">（スタッフを選んでください）</option>
              {staffList.map(s => (
                <option key={s.name} value={s.name}>
                  {s.name}（{s.department}・{s.role}）
                </option>
              ))}
            </select>
          </div>

          {/* 推薦ボタン */}
          <div className="flex items-end">
            <button
              onClick={fetchRecommend}
              disabled={recLoading}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {recLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Sparkles className="w-4 h-4" />
              }
              AI推薦を更新
            </button>
          </div>

          {/* スタッフ情報サマリー */}
          {recommend?.staffProfile && (
            <div className="w-full bg-indigo-800/40 rounded-xl p-3 mt-1">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-indigo-200">
                  👤 <span className="font-semibold text-white">{recommend.staffProfile.name}</span>
                  　{recommend.staffProfile.department} / {recommend.staffProfile.role}
                </span>
                <span className="text-indigo-300">
                  スキルLv.
                  <span className={`font-bold ml-0.5 ${
                    recommend.staffProfile.skillLevel >= 4 ? 'text-yellow-400' :
                    recommend.staffProfile.skillLevel >= 3 ? 'text-green-400' : 'text-blue-400'
                  }`}>
                    {recommend.staffProfile.skillLevel}
                  </span>/5
                </span>
                {recommend.staffProfile.skillSet.length > 0 && (
                  <span className="text-indigo-400">
                    スキル: {recommend.staffProfile.skillSet.slice(0, 3).join('・')}
                    {recommend.staffProfile.skillSet.length > 3 && '…'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 推薦サマリー（スタッフ未選択時） */}
          {recommend && !recommend.staffProfile && (
            <div className="w-full text-xs text-indigo-400 mt-1">
              <Sparkles className="w-3 h-3 inline mr-1" />
              スタッフを選択するとスキルに合わせた個別推薦が表示されます
            </div>
          )}
        </div>
      </div>

      {/* ── フィルター（タブ + 難易度） ── */}
      <div className="space-y-3">
        {/* カテゴリタブ */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${activeTab === tab.id
                  ? 'bg-white text-indigo-900 shadow'
                  : 'bg-indigo-900/40 text-indigo-300 hover:bg-indigo-800/60 hover:text-white border border-indigo-700/40'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 難易度フィルター */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs text-indigo-400">難易度:</span>
          {([0, 1, 2, 3] as const).map(lv => (
            <button
              key={lv}
              onClick={() => setDifficulty(lv)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                ${difficulty === lv
                  ? 'bg-white text-indigo-900'
                  : 'bg-indigo-900/40 text-indigo-400 hover:bg-indigo-800/50 border border-indigo-700/40'
                }`}
            >
              {lv === 0 ? 'すべて' : `Lv.${lv}`}
            </button>
          ))}
          <span className="text-xs text-indigo-500 ml-2">{visibleGames.length}件</span>
        </div>
      </div>

      {/* ── ゲームカード一覧 ── */}
      {recLoading && (
        <div className="flex items-center gap-2 text-indigo-300 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          AIがあなたに最適なゲームを分析中...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedGames.map(game => {
          const rec = recommend?.recommendations.find(r => r.gameId === game.id)
          return (
            <GameCard
              key={game.id}
              game={game}
              isRecommended={!!rec}
              recommendReason={rec?.reason ?? ''}
              priority={rec?.priority ?? 0}
              onPlay={handlePlay}
            />
          )
        })}
      </div>

      {sortedGames.length === 0 && (
        <div className="text-center py-12 text-indigo-400">
          <Gamepad2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>このフィルター条件に一致するゲームがありません</p>
        </div>
      )}

      {/* ── 凡例 ── */}
      <div className="flex items-center gap-6 text-xs text-indigo-500 pt-2 border-t border-indigo-800/50">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          AI推薦はスキルギャップを分析して選出
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          順次リリース予定（Sprint 25〜27）
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-green-400" />
          クリアするとスキルレベルが上昇（Sprint 26〜）
        </div>
      </div>
    </div>
  )
}
