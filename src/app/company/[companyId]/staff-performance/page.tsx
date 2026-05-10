'use client'
// =====================================================
//  src/app/company/[companyId]/staff-performance/page.tsx
//  スタッフパフォーマンスサマリー — Sprint #44
//
//  ■ 役割
//    感動ログ・研修ログをスタッフ別に集計し、
//    貢献度・研修実績・総合ランクをカード形式で可視化する。
//
//  ■ ランク定義
//    スター  → 総合スコア 75以上
//    エース  → 50以上
//    成長中  → 25以上
//    新人    → 25未満
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Trophy,
  RefreshCw,
  Star,
  Sparkles,
  BookOpen,
  TrendingUp,
  Award,
  Users,
  ChevronRight,
} from 'lucide-react'
import type { StaffPerformance, PerformanceRank } from '@/app/api/staff/performance/route'

// ── ランクの見た目定義 ────────────────────────────────

const RANK_STYLES: Record<PerformanceRank, { bg: string; border: string; badge: string; icon: string }> = {
  'スター':  { bg: 'bg-yellow-50',  border: 'border-yellow-300', badge: 'bg-yellow-400 text-yellow-900',  icon: '👑' },
  'エース':  { bg: 'bg-indigo-50',  border: 'border-indigo-300', badge: 'bg-indigo-500 text-white',       icon: '⭐' },
  '成長中':  { bg: 'bg-green-50',   border: 'border-green-300',  badge: 'bg-green-500 text-white',        icon: '🌱' },
  '新人':    { bg: 'bg-gray-50',    border: 'border-gray-200',   badge: 'bg-gray-400 text-white',         icon: '🆕' },
}

// ── スコアバー ────────────────────────────────────────

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── グレードバッジ ────────────────────────────────────

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    S: 'bg-yellow-400 text-yellow-900',
    A: 'bg-green-500 text-white',
    B: 'bg-blue-500 text-white',
    C: 'bg-gray-400 text-white',
    D: 'bg-red-400 text-white',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[grade] ?? 'bg-gray-200 text-gray-600'}`}>
      {grade}
    </span>
  )
}

// ── スタッフカード ────────────────────────────────────

function StaffCard({ staff, rank: cardRank }: { staff: StaffPerformance; rank: number }) {
  const style = RANK_STYLES[staff.rank]

  return (
    <div className={`rounded-xl border-2 ${style.border} ${style.bg} p-4 flex flex-col gap-3`}>
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {/* 順位 */}
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            cardRank === 1 ? 'bg-yellow-400 text-yellow-900' :
            cardRank === 2 ? 'bg-gray-300 text-gray-700' :
            cardRank === 3 ? 'bg-amber-600 text-white' :
            'bg-gray-100 text-gray-500'
          }`}>
            {cardRank}
          </span>
          <div>
            <p className="font-bold text-gray-800 text-sm">{staff.staffName}</p>
            <p className="text-xs text-gray-500">総合スコア {staff.performanceScore}点</p>
          </div>
        </div>
        {/* ランクバッジ */}
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${style.badge}`}>
          {style.icon} {staff.rank}
        </span>
      </div>

      {/* 感動ログ貢献 */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>感動ログ</span>
          </div>
          <span className="font-semibold">
            {staff.delightLogCount}件 / 平均{staff.avgDelightScore.toFixed(1)}点
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBar value={staff.delightLogCount} max={10} color="bg-amber-400" />
          {staff.topCategory && (
            <span className="text-xs text-gray-400 shrink-0 max-w-20 truncate">
              得意: {staff.topCategory}
            </span>
          )}
        </div>
      </div>

      {/* 研修実績 */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <div className="flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-indigo-500" />
            <span>研修実績</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{staff.trainingCount}回</span>
            {staff.bestGrade !== '—' && <GradeBadge grade={staff.bestGrade} />}
          </div>
        </div>
        <ScoreBar value={staff.trainingCount} max={10} color="bg-indigo-400" />
      </div>

      {/* AIコメント */}
      <div className="bg-white/70 rounded-lg px-3 py-2 text-xs text-gray-700 leading-relaxed">
        ✨ {staff.aiComment}
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────

export default function StaffPerformancePage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [staffList, setStaffList]   = useState<StaffPerformance[]>([])
  const [isLoading, setIsLoading]   = useState(false)

  const fetchPerformance = useCallback(async () => {
    setIsLoading(true)
    setStaffList([])
    try {
      const res  = await fetch(`/api/staff/performance?companyId=${companyId}`)
      const data = await res.json() as { staff: StaffPerformance[] }
      setStaffList(data.staff ?? [])
    } catch (err) {
      console.error('パフォーマンス取得エラー:', err)
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchPerformance() }, [fetchPerformance])

  // ── 統計 ─────────────────────────────────────────
  const starCount  = staffList.filter(s => s.rank === 'スター').length
  const aceCount   = staffList.filter(s => s.rank === 'エース').length
  const topStaff   = staffList[0]

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Trophy className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">スタッフパフォーマンス</h1>
            <p className="text-sm text-gray-500">感動ログ貢献度 × 研修実績 × AI総合評価</p>
          </div>
        </div>
        <button
          onClick={fetchPerformance}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? '分析中...' : '更新'}
        </button>
      </div>

      {/* ── ローディング ── */}
      {isLoading && (
        <div className="text-center py-20 text-gray-500">
          <Trophy className="w-10 h-10 animate-pulse mx-auto mb-3 text-yellow-400" />
          <p className="text-sm">スタッフデータを分析中...</p>
          <p className="text-xs text-gray-400 mt-1">感動ログ・研修ログを集計しています</p>
        </div>
      )}

      {/* ── データなし ── */}
      {!isLoading && staffList.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">パフォーマンスデータがありません</p>
          <p className="text-xs mt-1">感動ログや研修ログを記録すると表示されます</p>
        </div>
      )}

      {!isLoading && staffList.length > 0 && (
        <>
          {/* ── サマリーカード ── */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center border border-gray-100">
              <Users className="w-5 h-5 text-gray-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-800">{staffList.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">集計スタッフ数</p>
            </div>
            <div className="bg-yellow-50 rounded-xl shadow-sm p-4 text-center border border-yellow-100">
              <Star className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-yellow-700">{starCount}</p>
              <p className="text-xs text-yellow-500 mt-0.5">👑 スター</p>
            </div>
            <div className="bg-indigo-50 rounded-xl shadow-sm p-4 text-center border border-indigo-100">
              <Award className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-indigo-700">{aceCount}</p>
              <p className="text-xs text-indigo-500 mt-0.5">⭐ エース</p>
            </div>
          </div>

          {/* ── 今月のMVP（トップ1名） ── */}
          {topStaff && (
            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 rounded-xl p-4 mb-5 flex items-center gap-4 shadow">
              <div className="text-4xl">🏆</div>
              <div className="flex-1">
                <p className="text-xs font-bold text-yellow-900/70 uppercase tracking-wider mb-0.5">今月のMVP</p>
                <p className="text-lg font-bold text-white">{topStaff.staffName}</p>
                <p className="text-sm text-yellow-100">{topStaff.aiComment}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white">{topStaff.performanceScore}</p>
                <p className="text-xs text-yellow-100">/ 100点</p>
              </div>
            </div>
          )}

          {/* ── スタッフカードグリッド ── */}
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-600">全スタッフランキング</h2>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-400">感動貢献度 × 研修実績で算出</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {staffList.map((staff, i) => (
              <StaffCard key={staff.staffName} staff={staff} rank={i + 1} />
            ))}
          </div>
        </>
      )}

    </div>
  )
}
