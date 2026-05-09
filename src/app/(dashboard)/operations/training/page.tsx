'use client'
// =====================================================
//  src/app/(dashboard)/operations/training/page.tsx
//  研修ログ管理ページ — Sprint #28
//
//  ■ 機能
//    スキル向上ゲームのプレイ履歴（研修ログ）を一覧表示する。
//    スタッフ名・ゲームID でフィルタリング可能。
//    Notion の trainingLogDbId から取得（企業別DB対応）。
//
//  ■ 表示内容
//    スタッフ名 / ゲームタイトル / スコア / グレード /
//    回答シナリオ数 / 実施日
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import {
  GraduationCap, Loader2, RefreshCw, Filter,
  Trophy, ChevronDown, Users, Gamepad2, AlertCircle,
} from 'lucide-react'
import { useCompany }     from '@/contexts/CompanyContext'
import { GAME_CATALOG }   from '@/config/skill-game-catalog'
import type { TrainingLog, TrainingLogListResponse } from '@/app/api/training-log/list/route'

// ── グレードのスタイル ────────────────────────────────

function GradeBadge({ grade }: { grade: TrainingLog['grade'] }) {
  const styles: Record<TrainingLog['grade'], string> = {
    S: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    A: 'bg-green-100  text-green-800  border-green-300',
    B: 'bg-blue-100   text-blue-800   border-blue-300',
    C: 'bg-orange-100 text-orange-800 border-orange-300',
    D: 'bg-red-100    text-red-800    border-red-300',
  }
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 ${styles[grade]}`}>
      {grade}
    </span>
  )
}

// ── スコアバー ────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-700 w-8 text-right">{score}</span>
    </div>
  )
}

// ── 日付フォーマット ──────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

// =====================================================
//  メインコンポーネント
// =====================================================

export default function TrainingLogPage() {
  const { companyId } = useCompany()

  const [logs,       setLogs]       = useState<TrainingLog[]>([])
  const [loading,    setLoading]    = useState(true)
  const [hasDb,      setHasDb]      = useState(true)
  const [staffFilter, setStaffFilter] = useState('')
  const [gameFilter,  setGameFilter]  = useState('')

  // ── ログ取得 ──
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ companyId })
      if (staffFilter) params.set('staffName', staffFilter)
      if (gameFilter)  params.set('gameId',    gameFilter)
      const res  = await fetch(`/api/training-log/list?${params}`)
      const data = await res.json() as TrainingLogListResponse
      setLogs(data.logs)
      setHasDb(data.hasDb)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [companyId, staffFilter, gameFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // ── スタッフ名リスト（ログから一意に抽出） ──
  const staffNames = Array.from(new Set(logs.map(l => l.staffName).filter(Boolean)))

  // ── スコア統計 ──
  const avgScore = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length)
    : 0
  const gradeCount = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.grade] = (acc[l.grade] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">

      {/* ── ページタイトル ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            研修ログ管理
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            スキル向上ゲームのプレイ履歴・研修実績を確認できます
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {/* ── DB未設定の警告 ── */}
      {!hasDb && !loading && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">研修ログDBが未設定です</p>
            <p>スキル向上ゲームをプレイすると、ここに実績が記録されます。</p>
          </div>
        </div>
      )}

      {/* ── サマリーカード ── */}
      {hasDb && logs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">総プレイ数</p>
            <p className="text-2xl font-bold text-gray-800">{logs.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">平均スコア</p>
            <p className="text-2xl font-bold text-indigo-600">{avgScore}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">参加スタッフ数</p>
            <p className="text-2xl font-bold text-green-600">{staffNames.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">グレード分布</p>
            <div className="flex items-center gap-1 justify-center">
              {(['S','A','B','C','D'] as const).map(g => gradeCount[g] ? (
                <span key={g} className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  g === 'S' ? 'bg-yellow-100 text-yellow-700' :
                  g === 'A' ? 'bg-green-100 text-green-700' :
                  g === 'B' ? 'bg-blue-100 text-blue-700' :
                  g === 'C' ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {g}:{gradeCount[g]}
                </span>
              ) : null)}
            </div>
          </div>
        </div>
      )}

      {/* ── フィルター ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-600">
          <Filter className="w-4 h-4" />
          絞り込み
        </div>
        <div className="flex gap-4 flex-wrap">

          {/* スタッフ名フィルター */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Users className="w-3 h-3" />スタッフ名
            </label>
            <div className="relative">
              <select
                value={staffFilter}
                onChange={e => setStaffFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-400 appearance-none bg-white pr-8"
              >
                <option value="">すべて</option>
                {staffNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* ゲームフィルター */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Gamepad2 className="w-3 h-3" />ゲーム
            </label>
            <div className="relative">
              <select
                value={gameFilter}
                onChange={e => setGameFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-400 appearance-none bg-white pr-8"
              >
                <option value="">すべて</option>
                {GAME_CATALOG.filter(g => g.available).map(g => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ── ログ一覧テーブル ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            ログを読み込み中...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Trophy className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">
              {hasDb
                ? '研修ログがありません。スキル向上ゲームをプレイすると記録されます。'
                : '研修ログDBが設定されていません。'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">スタッフ名</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">ゲームタイトル</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs">グレード</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">スコア</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs">回答数</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">実施日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{log.staffName || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {/* ゲームIDから正式タイトルを表示 */}
                    {log.gameTitle.replace('[ゲーム] ', '')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <GradeBadge grade={log.grade} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBar score={log.score} />
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{log.scenariosPlayed}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(log.playedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ゲームへの誘導 */}
      <div className="text-center text-xs text-gray-400 pt-2">
        スキル向上ゲームのプレイ結果が自動的にここに記録されます。
        <a href="/skill-game/select" className="text-indigo-500 hover:underline ml-1">
          ゲームを始める →
        </a>
      </div>
    </div>
  )
}
