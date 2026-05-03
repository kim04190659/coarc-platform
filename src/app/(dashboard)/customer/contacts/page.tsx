'use client'

// =====================================================
//  src/app/(dashboard)/customer/contacts/page.tsx
//  問い合わせ管理ページ（AI下書き + ステータス変更 + Notion保存）
//
//  ■ 機能概要
//    左列: 問い合わせ一覧（ステータス・カテゴリでフィルタ）
//    右列: 詳細 + ステータス変更 + AI下書き生成 + Notionへの保存
//
//  ■ ステータス変更
//    画面上で変更 → localStorageに永続保存
//    → 次回アクセス時も変更が反映される
//
//  ■ Notion保存
//    AI下書き生成後に「Notionに保存」ボタンが表示される
//    → /api/contacts/save → 企業NotionページにAI下書きと対応情報が子ページとして作成される
//    → 作成されたNotionページへのリンクを表示
//
//  ■ 将来の拡張
//    サンプルデータ（contacts-sample.ts）を Notion DBからの取得に切り替えることで
//    完全なNotion統合が実現する
// =====================================================

import { useState, useCallback, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { getCompanyById } from '@/config/companies'
import { getContactsByCompany, type Contact, type ContactStatus } from '@/data/contacts-sample'
import {
  MessageSquare, Phone, Globe, Store, Smartphone,
  Sparkles, Clock, CheckCircle2, AlertCircle,
  ChevronRight, Copy, Check, Save, ExternalLink,
  ChevronDown,
} from 'lucide-react'

// ──────────────────────────────────────────────────
//  localStorageキー
// ──────────────────────────────────────────────────
const LS_KEY = 'coarc-contact-statuses'

/** localStorageからステータスオーバーライドを読み込む */
function loadStatusOverrides(): Record<string, ContactStatus> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// ──────────────────────────────────────────────────
//  表示用ヘルパー
// ──────────────────────────────────────────────────

function ChannelIcon({ channel }: { channel: Contact['channel'] }) {
  const map = {
    'メール':  <MessageSquare className="w-3 h-3" />,
    '電話':   <Phone className="w-3 h-3" />,
    'Web':    <Globe className="w-3 h-3" />,
    '店頭':   <Store className="w-3 h-3" />,
    'LINE':   <Smartphone className="w-3 h-3" />,
  }
  return map[channel] ?? <MessageSquare className="w-3 h-3" />
}

function StatusBadge({ status }: { status: ContactStatus }) {
  const styles: Record<ContactStatus, string> = {
    '未対応': 'bg-red-100 text-red-700',
    '対応中': 'bg-yellow-100 text-yellow-700',
    '完了':   'bg-green-100 text-green-700',
  }
  const icons: Record<ContactStatus, React.ReactNode> = {
    '未対応': <AlertCircle className="w-3 h-3" />,
    '対応中': <Clock className="w-3 h-3" />,
    '完了':   <CheckCircle2 className="w-3 h-3" />,
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {icons[status]}{status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: Contact['priority'] }) {
  const styles = { '高': 'bg-red-500 text-white', '中': 'bg-orange-400 text-white', '低': 'bg-gray-300 text-gray-600' }
  return <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${styles[priority]}`}>{priority}</span>
}

function CategoryBadge({ category }: { category: Contact['category'] }) {
  const styles = {
    '苦情':     'bg-red-50 text-red-600 border border-red-200',
    '問い合わせ': 'bg-blue-50 text-blue-600 border border-blue-200',
    '要望':     'bg-purple-50 text-purple-600 border border-purple-200',
    '感謝':     'bg-green-50 text-green-600 border border-green-200',
    'その他':   'bg-gray-50 text-gray-600 border border-gray-200',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[category]}`}>{category}</span>
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi}`
}

// ──────────────────────────────────────────────────
//  AI下書き用 systemPrompt ビルダー
// ──────────────────────────────────────────────────
function buildDraftSystemPrompt(company: ReturnType<typeof getCompanyById>, contact: Contact): string {
  const industryMap: Record<string, string> = {
    hotel: 'ホテル・宿泊施設', medical: '医療・クリニック',
    food: '飲食・フードチェーン', retail: '小売・ストア',
  }
  const industryLabel = industryMap[company.industry] ?? 'サービス業'
  return `あなたは${company.name}（${industryLabel}）のカスタマーサポート担当者です。
以下の問い合わせに対して、顧客への返信メールの「下書き」を作成してください。

【企業情報】企業名: ${company.name} / 業種: ${industryLabel}
【問い合わせ情報】
- 受付日: ${formatDate(contact.date)} / チャネル: ${contact.channel} / カテゴリ: ${contact.category} / 優先度: ${contact.priority}
- 顧客名: ${contact.customerName} 様 / 件名: ${contact.subject}
- 内容:\n${contact.content}

【下書き作成ルール】
1. 冒頭は「${contact.customerName} 様」から始める
2. お問い合わせへの感謝を述べる
3. 問い合わせ内容を簡潔に受け止めた旨を伝える
4. 具体的な対応方針・回答または確認事項を記載する
5. 苦情・優先度が高い場合は謝罪と迅速対応の意思を明確にする
6. 締めの言葉で終わる
7. 丁寧語・敬語、400字以内を目安にする
8. 署名は「${company.name} カスタマーサポート」とする
9. 返信文のみを出力すること（説明や補足は不要）`
}

// ──────────────────────────────────────────────────
//  メインコンポーネント
// ──────────────────────────────────────────────────
export default function ContactsPage() {
  const { companyId } = useCompany()
  const company = getCompanyById(companyId)
  const baseContacts = getContactsByCompany(companyId)

  // ── ステータスオーバーライド（localStorage永続化）──
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ContactStatus>>({})

  // マウント時にlocalStorageからロード（SSR対策でuseEffect内）
  useEffect(() => {
    setStatusOverrides(loadStatusOverrides())
  }, [])

  // 企業切り替え時は選択をリセット
  useEffect(() => {
    setSelectedId(baseContacts[0]?.id ?? null)
    setDraft('')
    setNotionUrl('')
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  /** ステータスを変更してlocalStorageに保存する */
  const handleStatusChange = useCallback((contactId: string, newStatus: ContactStatus) => {
    setStatusOverrides(prev => {
      const next = { ...prev, [contactId]: newStatus }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  /** オーバーライドを適用した問い合わせ一覧 */
  const contacts = baseContacts.map(c => ({
    ...c,
    status: (statusOverrides[c.id] ?? c.status) as ContactStatus,
  }))

  // 選択中の問い合わせ
  const [selectedId, setSelectedId] = useState<string | null>(contacts[0]?.id ?? null)
  const selected = contacts.find(c => c.id === selectedId) ?? null

  // フィルタ
  const [filterStatus, setFilterStatus] = useState<ContactStatus | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // AI下書き
  const [draft, setDraft] = useState<string>('')
  const [isDrafting, setIsDrafting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Notion保存
  const [isSaving, setIsSaving] = useState(false)
  const [notionUrl, setNotionUrl] = useState<string>('')
  const [saveError, setSaveError] = useState<string>('')

  const filtered = contacts.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterCategory !== 'all' && c.category !== filterCategory) return false
    return true
  })

  const unresolved = contacts.filter(c => c.status === '未対応').length

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    setDraft('')
    setCopied(false)
    setNotionUrl('')
    setSaveError('')
  }, [])

  // AI下書き生成
  const generateDraft = useCallback(async () => {
    if (!selected) return
    setIsDrafting(true)
    setDraft('')
    setNotionUrl('')
    setSaveError('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `次の問い合わせへの返信下書きを作成してください:\n\n件名: ${selected.subject}\n\n${selected.content}`,
          systemPrompt: buildDraftSystemPrompt(company, selected),
        }),
      })
      const data = await res.json()
      setDraft(data.reply ?? data.error ?? 'エラーが発生しました')
    } catch {
      setDraft('通信エラーが発生しました。もう一度お試しください。')
    } finally {
      setIsDrafting(false)
    }
  }, [selected, company])

  // 下書きをクリップボードにコピー
  const copyDraft = useCallback(() => {
    navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [draft])

  // Notionに保存
  const saveToNotion = useCallback(async () => {
    if (!selected || !draft) return
    setIsSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/contacts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId:    selected.id,
          companyId:    company.id,
          companyName:  company.name,
          notionPageId: company.notionPageId,
          date:         selected.date,
          channel:      selected.channel,
          category:     selected.category,
          status:       selected.status,
          priority:     selected.priority,
          customerName: selected.customerName,
          subject:      selected.subject,
          content:      selected.content,
          draft,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNotionUrl(data.pageUrl)
      } else {
        setSaveError(data.error ?? 'Notionへの保存に失敗しました')
      }
    } catch (e) {
      setSaveError('通信エラーが発生しました')
    } finally {
      setIsSaving(false)
    }
  }, [selected, company, draft])

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">

      {/* ── ページヘッダー ── */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-800">📞 問い合わせ管理</h2>
          <p className="text-xs text-gray-500 mt-0.5">{company.name} — 全 {contacts.length} 件</p>
        </div>
        {unresolved > 0 && (
          <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
            未対応 {unresolved} 件
          </span>
        )}
      </div>

      {/* ── フィルタバー ── */}
      <div className="flex gap-2 mb-3 flex-shrink-0 flex-wrap">
        {(['all', '未対応', '対応中', '完了'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'すべて' : s}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {(['all', '苦情', '問い合わせ', '要望', '感謝'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterCategory === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat === 'all' ? 'カテゴリ: 全て' : cat}
          </button>
        ))}
      </div>

      {/* ── 2カラムレイアウト ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── 左列: 一覧 ── */}
        <div className="w-80 flex-shrink-0 overflow-y-auto bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">該当する問い合わせはありません</p>
          ) : filtered.map(c => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${
                selectedId === c.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <CategoryBadge category={c.category} />
                  <PriorityBadge priority={c.priority} />
                </div>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <ChannelIcon channel={c.channel} />
                  {formatDate(c.date)}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">{c.subject}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-gray-500">{c.customerName}</span>
                <StatusBadge status={c.status} />
              </div>
            </button>
          ))}
        </div>

        {/* ── 右列: 詳細 ── */}
        {selected ? (
          <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 p-5 space-y-4">

            {/* 詳細ヘッダー */}
            <div className="pb-3 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-gray-800 leading-snug">{selected.subject}</h3>
                <PriorityBadge priority={selected.priority} />
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><ChannelIcon channel={selected.channel} />{selected.channel}</span>
                <span>受付: {formatDate(selected.date)}</span>
                <span>顧客: {selected.customerName}</span>
                {selected.assignee && <span>担当: {selected.assignee}</span>}
              </div>
            </div>

            {/* カテゴリ + ステータス変更セレクト */}
            <div className="flex items-center gap-3">
              <CategoryBadge category={selected.category} />
              {/* ステータス変更ドロップダウン */}
              <div className="relative inline-flex items-center">
                <select
                  value={selected.status}
                  onChange={e => handleStatusChange(selected.id, e.target.value as ContactStatus)}
                  className={`appearance-none pl-2 pr-6 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                    selected.status === '未対応' ? 'bg-red-100 text-red-700' :
                    selected.status === '対応中' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}
                >
                  <option value="未対応">未対応</option>
                  <option value="対応中">対応中</option>
                  <option value="完了">完了</option>
                </select>
                <ChevronDown className="w-3 h-3 absolute right-1 pointer-events-none text-gray-500" />
              </div>
              {/* ステータス変更されたことを示すインジケーター */}
              {statusOverrides[selected.id] && (
                <span className="text-xs text-indigo-500 flex items-center gap-1">
                  <Check className="w-3 h-3" /> 変更済み
                </span>
              )}
            </div>

            {/* 問い合わせ本文 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">📋 お問い合わせ内容</p>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {selected.content}
              </div>
            </div>

            {/* 対応済み返答（あれば） */}
            {selected.response && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">✅ 対応済み内容</p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 leading-relaxed whitespace-pre-wrap">
                  {selected.response}
                </div>
              </div>
            )}

            {/* AI下書きセクション */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500">🤖 AI返信下書き</p>
                <button
                  onClick={generateDraft}
                  disabled={isDrafting}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isDrafting ? '生成中...' : draft ? '再生成' : 'AI下書きを生成'}
                </button>
              </div>

              {isDrafting && (
                <div className="bg-indigo-50 rounded-lg p-4 text-sm text-indigo-600">
                  <span className="animate-pulse">AIが返信文を考えています...</span>
                </div>
              )}

              {!isDrafting && draft && (
                <div>
                  {/* 編集可能テキストエリア */}
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="w-full h-52 border border-indigo-200 rounded-lg p-3 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:border-indigo-400 bg-indigo-50"
                  />

                  {/* アクションボタン行 */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-2">
                      {/* コピーボタン */}
                      <button
                        onClick={copyDraft}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'コピー済み' : 'コピー'}
                      </button>

                      {/* Notion保存ボタン */}
                      {!notionUrl && (
                        <button
                          onClick={saveToNotion}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isSaving ? '保存中...' : 'Notionに保存'}
                        </button>
                      )}
                    </div>

                    {/* Notion保存済みリンク */}
                    {notionUrl && (
                      <a
                        href={notionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Notionに保存しました
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* エラーメッセージ */}
                  {saveError && (
                    <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>
                  )}
                </div>
              )}

              {!isDrafting && !draft && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                  「AI下書きを生成」を押すと、この問い合わせに合わせた返信文の下書きをAIが自動作成します。
                  生成後は編集してコピー、またはそのままNotionに保存できます。
                </p>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-200">
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <ChevronRight className="w-4 h-4" />
              左の一覧から問い合わせを選択してください
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
