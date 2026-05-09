'use client'
// =====================================================
//  src/app/(dashboard)/admin/menu-design-agent/page.tsx
//  メニュー設計エージェント — Sprint #30
//
//  ■ 機能
//    エクセレントサービス実現を前提に、企業ごとのヒアリングを行い、
//    最適なメニュー構成を決定するためのエージェント機能。
//
//  ■ フロー
//    Step 1: 企業選択
//    Step 2: 基本情報（スタッフ規模・顧客層・品質自己評価）
//    Step 3: 課題と目標（改善課題・6ヶ月目標・最大の悩み）
//    Step 4: AI活用準備度（AI経験・データ収集・重視機能）
//    → 保存 → Sprint #31 で AI 提案画面へ遷移
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Wand2, ChevronRight, ChevronLeft, Building2,
  Users, Star, Target, Brain, CheckCircle2,
  Loader2, RefreshCw, AlertCircle, Save,
} from 'lucide-react'
import { COMPANIES } from '@/config/companies'
import type { HearingData } from '@/app/api/menu-design/hearing/route'

// ── 定数 ─────────────────────────────────────────────

const STAFF_SIZES = ['〜10名', '11〜30名', '31〜100名', '101〜300名', '300名超'] as const

const SERVICE_RATINGS = [
  { value: '1 - 課題多い',    label: '1', desc: '課題が多い' },
  { value: '2 - やや課題あり', label: '2', desc: 'やや課題あり' },
  { value: '3 - 普通',        label: '3', desc: '普通' },
  { value: '4 - 良好',        label: '4', desc: '良好' },
  { value: '5 - 優秀',        label: '5', desc: '優秀' },
] as const

const CHALLENGES = [
  '顧客対応のばらつき', 'スタッフのモチベーション', 'クレーム対応',
  'リピート率向上', '新人育成', '業務効率化', 'データ活用', 'その他',
] as const

const AI_EXPERIENCES = ['未経験', '少し使ったことがある', '日常的に使っている'] as const

const DATA_COLLECTIONS = [
  '紙・手書き', 'Excel/スプレッドシート', '専用システム', 'Notion', 'その他デジタル',
] as const

const PRIORITY_FEATURES = [
  '顧客フィードバック分析', '問い合わせ自動対応', 'スタッフコンディション管理',
  '研修・スキルアップ', 'KPI管理', 'プロジェクト管理', 'AI経営顧問', '売上予測',
] as const

// ── 初期フォーム状態 ──────────────────────────────────

const INITIAL_FORM: Omit<HearingData, 'companyId' | 'companyName'> = {
  staffSize:        '',
  mainCustomers:    '',
  serviceRating:    '',
  challenges:       [],
  goalIn6Months:    '',
  biggestPain:      '',
  aiExperience:     '',
  dataCollection:   [],
  priorityFeatures: [],
  interviewedBy:    '',
  notes:            '',
}

// ── ステッププログレスバー ────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  const steps = [
    { icon: Building2, label: '企業選択' },
    { icon: Users,     label: '基本情報' },
    { icon: Target,    label: '課題と目標' },
    { icon: Brain,     label: 'AI準備度' },
  ]
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((s, i) => {
        const Icon = s.icon
        const isActive    = i + 1 === step
        const isCompleted = i + 1 < step
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                ${isCompleted ? 'bg-indigo-600 border-indigo-600 text-white'
                  : isActive  ? 'bg-white border-indigo-600 text-indigo-600'
                  : 'bg-gray-50 border-gray-300 text-gray-400'}
              `}>
                {isCompleted
                  ? <CheckCircle2 className="w-5 h-5" />
                  : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs mt-1 font-medium ${
                isActive ? 'text-indigo-600' : isCompleted ? 'text-indigo-500' : 'text-gray-400'
              }`}>
                {s.label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`
                h-0.5 w-16 mx-2 mb-4 transition-colors
                ${i + 1 < step ? 'bg-indigo-600' : 'bg-gray-200'}
              `} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── チェックボックスグループ ──────────────────────────

function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: readonly string[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const toggle = (v: string) => {
    onChange(
      selected.includes(v)
        ? selected.filter(s => s !== v)
        : [...selected, v]
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(opt => (
        <label
          key={opt}
          className={`
            flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer
            text-sm transition-colors
            ${selected.includes(opt)
              ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
              : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'}
          `}
        >
          <input
            type="checkbox"
            className="hidden"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
          />
          <div className={`
            w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
            ${selected.includes(opt) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}
          `}>
            {selected.includes(opt) && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </div>
          {opt}
        </label>
      ))}
    </div>
  )
}

// =====================================================
//  メインコンポーネント
// =====================================================

export default function MenuDesignAgentPage() {
  const [step,      setStep]      = useState(1)
  const [companyId, setCompanyId] = useState('')
  const [form,      setForm]      = useState(INITIAL_FORM)
  const [pageId,    setPageId]    = useState<string | undefined>(undefined)

  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [aiSaved,      setAiSaved]      = useState(false)  // AI提案ボタン押下後の完了状態
  const [error,        setError]        = useState('')

  // ── 企業選択時に既存ヒアリングデータを読み込む ──
  const loadExisting = useCallback(async (cId: string) => {
    if (!cId) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/menu-design/hearing?companyId=${cId}`)
      const data = await res.json()
      if (data.hasRecord && data.data) {
        // 既存データをフォームに反映
        const d = data.data
        setForm({
          staffSize:        d.staffSize        ?? '',
          mainCustomers:    d.mainCustomers    ?? '',
          serviceRating:    d.serviceRating    ?? '',
          challenges:       d.challenges       ?? [],
          goalIn6Months:    d.goalIn6Months    ?? '',
          biggestPain:      d.biggestPain      ?? '',
          aiExperience:     d.aiExperience     ?? '',
          dataCollection:   d.dataCollection   ?? [],
          priorityFeatures: d.priorityFeatures ?? [],
          interviewedBy:    d.interviewedBy    ?? '',
          notes:            d.notes            ?? '',
        })
        setPageId(data.pageId)
      } else {
        // 未実施 → フォームをリセット
        setForm(INITIAL_FORM)
        setPageId(undefined)
      }
    } catch {
      setError('既存データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (companyId) loadExisting(companyId)
  }, [companyId, loadExisting])

  // ── フォーム値更新ヘルパー ──
  const set = <K extends keyof typeof INITIAL_FORM>(
    key: K, value: typeof INITIAL_FORM[K]
  ) => {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)    // 値を変えたら「保存済み」表示をリセット
    setAiSaved(false)
  }

  // ── ステップ移動（saved フラグもリセット）──
  const goToStep = (n: number) => {
    setStep(n)
    setSaved(false)
    setAiSaved(false)
    setError('')
  }

  // ── Notion 保存（共通処理）──
  const saveToNotion = async (): Promise<boolean> => {
    if (!companyId) return false
    setSaving(true)
    setSaved(false)
    setAiSaved(false)
    setError('')
    try {
      const company = COMPANIES.find(c => c.id === companyId)
      const payload: HearingData & { pageId?: string } = {
        companyId,
        companyName: company?.name ?? companyId,
        ...form,
        pageId,
      }
      const res  = await fetch('/api/menu-design/hearing', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        setPageId(data.pageId)
        return true
      } else {
        setError(data.error ?? '保存に失敗しました')
        return false
      }
    } catch {
      setError('通信エラーが発生しました')
      return false
    } finally {
      setSaving(false)
    }
  }

  // ── 「保存して次へ」ボタン ──
  const save = async (goNext = false) => {
    const ok = await saveToNotion()
    if (ok) {
      setSaved(true)
      if (goNext) goToStep(step + 1)
    }
  }

  // ── 「保存して AI に提案してもらう」ボタン ──
  const saveAndRequestAI = async () => {
    const ok = await saveToNotion()
    if (ok) {
      setAiSaved(true)   // AI提案待ち状態を表示（Sprint #31 で実際の提案処理に差し替え）
    }
  }

  // ── 選択企業の情報 ──
  const company = COMPANIES.find(c => c.id === companyId)

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ページタイトル */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Wand2 className="w-6 h-6 text-indigo-600" />
          メニュー設計エージェント
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          エクセレントサービス実現に向けたヒアリングを行い、
          最適な AI 機能メニューを AI が提案します
        </p>
      </div>

      {/* ステップインジケーター */}
      {step > 1 && (
        <StepIndicator step={step - 1} total={4} />
      )}

      {/* ── Step 1: 企業選択 ── */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" />
            ヒアリングする企業を選択してください
          </h2>

          <div className="grid gap-3">
            {COMPANIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCompanyId(c.id)}
                className={`
                  flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all
                  ${companyId === c.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300 bg-white'}
                `}
              >
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-white text-lg
                  ${c.color === 'indigo' ? 'bg-indigo-500'
                    : c.color === 'rose'  ? 'bg-rose-500'
                    : c.color === 'amber' ? 'bg-amber-500'
                    : 'bg-green-500'}
                `}>
                  {c.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{c.industry}</p>
                </div>
                {companyId === c.id && (
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 ml-auto" />
                )}
              </button>
            ))}
          </div>

          {companyId && (
            <div className="pt-2">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  既存データを確認中...
                </div>
              ) : pageId ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg">
                  <RefreshCw className="w-4 h-4" />
                  既存のヒアリング結果が見つかりました。編集して更新できます。
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                  <Wand2 className="w-4 h-4" />
                  新規ヒアリングを開始します。
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => goToStep(2)}
              disabled={!companyId || loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              次へ
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: 基本情報 ── */}
      {step === 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            基本情報
            {company && (
              <span className="text-sm font-normal text-gray-500 ml-1">— {company.name}</span>
            )}
          </h2>

          {/* スタッフ規模 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              スタッフ規模 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {STAFF_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => set('staffSize', s)}
                  className={`
                    px-3 py-1.5 rounded-lg border text-sm transition-colors
                    ${form.staffSize === s
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:border-indigo-400'}
                  `}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 主な顧客層 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              主な顧客層
              <span className="text-xs text-gray-400 ml-1">（年齢層・リピート率・来店頻度など）</span>
            </label>
            <input
              type="text"
              value={form.mainCustomers}
              onChange={e => set('mainCustomers', e.target.value)}
              placeholder="例：30〜60代のリピーター中心。月1〜2回来店が多い。"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* サービス品質自己評価 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              現在のサービス品質（自己評価）<span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {SERVICE_RATINGS.map(r => (
                <button
                  key={r.value}
                  onClick={() => set('serviceRating', r.value)}
                  className={`
                    flex-1 py-2 rounded-lg border text-sm transition-colors
                    ${form.serviceRating === r.value
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:border-indigo-400'}
                  `}
                >
                  <div className="font-bold">{r.label}</div>
                  <div className="text-xs mt-0.5 leading-tight">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => goToStep(1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />戻る
            </button>
            <button
              onClick={() => save(true)}
              disabled={!form.staffSize || !form.serviceRating || saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              保存して次へ <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: 課題と目標 ── */}
      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" />
            課題と目標
          </h2>

          {/* 改善したい課題 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              最も改善したい課題
              <span className="text-xs text-gray-400 ml-1">（複数選択可）</span>
            </label>
            <CheckboxGroup
              options={CHALLENGES}
              selected={form.challenges}
              onChange={v => set('challenges', v)}
            />
          </div>

          {/* 6ヶ月後の目標 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              6ヶ月後に達成したい状態
            </label>
            <textarea
              value={form.goalIn6Months}
              onChange={e => set('goalIn6Months', e.target.value)}
              rows={3}
              placeholder="例：スタッフ全員が自信を持って接客できるようになり、リピート率を20%向上させたい。"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>

          {/* 最も困っていること */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              今最も困っていること
            </label>
            <textarea
              value={form.biggestPain}
              onChange={e => set('biggestPain', e.target.value)}
              rows={3}
              placeholder="例：新人スタッフの教育コストが高く、クレーム対応がベテランに集中している。"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => goToStep(2)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />戻る
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              保存して次へ <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: AI活用準備度 ── */}
      {step === 4 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" />
            AI 活用の準備度
          </h2>

          {/* AI活用経験 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI 活用経験 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col gap-2">
              {AI_EXPERIENCES.map(exp => (
                <button
                  key={exp}
                  onClick={() => set('aiExperience', exp)}
                  className={`
                    text-left px-4 py-2.5 rounded-lg border text-sm transition-colors
                    ${form.aiExperience === exp
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:border-indigo-400'}
                  `}
                >
                  {exp}
                </button>
              ))}
            </div>
          </div>

          {/* データ収集状況 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              現在のデータ収集・管理方法
              <span className="text-xs text-gray-400 ml-1">（複数選択可）</span>
            </label>
            <CheckboxGroup
              options={DATA_COLLECTIONS}
              selected={form.dataCollection}
              onChange={v => set('dataCollection', v)}
            />
          </div>

          {/* 重視するAI機能 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              優先したい AI 機能
              <span className="text-xs text-gray-400 ml-1">（複数選択可）</span>
            </label>
            <CheckboxGroup
              options={PRIORITY_FEATURES}
              selected={form.priorityFeatures}
              onChange={v => set('priorityFeatures', v)}
            />
          </div>

          {/* ヒアリング実施者 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              ヒアリング実施者名
            </label>
            <input
              type="text"
              value={form.interviewedBy}
              onChange={e => set('interviewedBy', e.target.value)}
              placeholder="例：Yoshitaka"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* 保存済み表示（「保存」ボタン押下後） */}
          {saved && !aiSaved && !error && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Notion に保存しました
            </div>
          )}

          {/* AI提案リクエスト完了表示（「AIに提案してもらう」ボタン押下後） */}
          {aiSaved && !error && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ヒアリング結果を Notion に保存しました
              </div>
              <p className="text-xs text-indigo-600 pl-6">
                Sprint #31 で AI がヒアリング内容を分析し、最適なメニュー構成を提案します。
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => goToStep(3)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />戻る
            </button>

            <div className="flex gap-2">
              {/* 保存のみ */}
              <button
                onClick={() => save(false)}
                disabled={!form.aiExperience || saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存
              </button>

              {/* AI提案へ（Sprint #31 で提案処理を追加予定） */}
              <button
                onClick={() => saveAndRequestAI()}
                disabled={!form.aiExperience || saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                保存して AI に提案してもらう →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 注意書き ── */}
      <p className="text-xs text-gray-400 text-center">
        ヒアリング結果は Notion に自動保存されます。
        いつでも再編集できます。
      </p>
    </div>
  )
}
