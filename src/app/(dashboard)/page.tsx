'use client'

// =====================================================
//  src/app/(dashboard)/page.tsx
//  ダッシュボード トップページ（ホーム）
// =====================================================

import Link from 'next/link'
import { useCompany } from '@/contexts/CompanyContext'
import { getCompanyById } from '@/config/companies'
import { getFeaturesByGroup } from '@/config/features'
import {
  MessageSquare, Phone, Users, BookOpen,
  BarChart3, Brain, FileText, GraduationCap,
} from 'lucide-react'

export default function HomePage() {
  const { companyId } = useCompany()
  const company = getCompanyById(companyId)
  const coreFeatures = getFeaturesByGroup('core')

  return (
    <div className="max-w-5xl mx-auto">
      {/* ウェルカムメッセージ */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">
          ようこそ、{company.name} さん
        </h2>
        <p className="text-gray-500 mt-1">
          エクセレントサービス × AI基盤 — Coarc Platform
        </p>
        {/* 実装済み機能バッジ */}
        {company.implementedFeatures && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {company.implementedFeatures.map(f => (
              <span
                key={f.label}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium"
              >
                {f.emoji} {f.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 機能カード一覧 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {coreFeatures.map(feature => {
          const Icon = feature.icon
          return (
            <Link
              key={feature.id}
              href={feature.href}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-300 transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                  <Icon className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="font-semibold text-gray-800 text-sm">{feature.label}</span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ステータス */}
      <div className="mt-8 bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <h3 className="font-semibold text-indigo-800 mb-2">📊 プラットフォーム状態</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-indigo-600">4</p>
            <p className="text-xs text-gray-500 mt-1">展開企業数</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-600">10</p>
            <p className="text-xs text-gray-500 mt-1">標準DB数</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">✓</p>
            <p className="text-xs text-gray-500 mt-1">Notion連携</p>
          </div>
        </div>
      </div>
    </div>
  )
}
