'use client'

// =====================================================
//  src/app/(dashboard)/management/dashboard/page.tsx
//  KPI ダッシュボード（経営・品質層）
//
//  ■ TODO（Sprint #1〜）
//    - Notion KPI DB から実データを取得して表示
//    - companyId でフィルタリング（マルチテナント）
//    - AI経営顧問への導線を追加
// =====================================================

import { useCompany } from '@/contexts/CompanyContext'
import { getCompanyById } from '@/config/companies'
import { BarChart3, TrendingUp, Users, Star } from 'lucide-react'

// デモ用サンプルデータ（後でNotionから取得に切り替える）
const DEMO_KPI = [
  { label: '顧客満足度スコア', value: '4.2 / 5.0', trend: '+0.3', icon: Star,      color: 'yellow' },
  { label: '今月の問い合わせ', value: '234件',      trend: '-12%', icon: BarChart3, color: 'blue'   },
  { label: '社員コンディション', value: '78%',      trend: '+5%',  icon: Users,     color: 'green'  },
  { label: '売上達成率',         value: '92%',      trend: '+8%',  icon: TrendingUp, color: 'indigo' },
]

export default function ManagementDashboardPage() {
  const { companyId } = useCompany()
  const company = getCompanyById(companyId)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          📊 KPIダッシュボード — {company.name}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          デモデータを表示中 — Notion DB 接続後に実データに切り替わります
        </p>
      </div>

      {/* KPI カード */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {DEMO_KPI.map(kpi => {
          const Icon = kpi.icon
          const isPositive = kpi.trend.startsWith('+')
          return (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{kpi.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{kpi.value}</p>
                </div>
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Icon className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
              <p className={`text-xs mt-2 font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                {kpi.trend} 前月比
              </p>
            </div>
          )
        })}
      </div>

      {/* AI顧問バナー */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl p-5 text-white">
        <h3 className="font-bold text-lg mb-1">🤖 AI経営顧問からの提言</h3>
        <p className="text-indigo-200 text-sm mb-3">
          顧客満足度データと社員コンディションを分析しました。
          今月の優先改善事項をご確認ください。
        </p>
        <a
          href="/ai-advisor"
          className="inline-block bg-white text-indigo-700 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-indigo-50 transition-colors"
        >
          AI顧問を開く →
        </a>
      </div>
    </div>
  )
}
