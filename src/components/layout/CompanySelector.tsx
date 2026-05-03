'use client'

// =====================================================
//  src/components/layout/CompanySelector.tsx
//  ヘッダーの企業切り替えドロップダウン
//
//  ■ RunWith との対応
//    MunicipalitySelector.tsx → CompanySelector.tsx
// =====================================================

import { useCompany } from '@/contexts/CompanyContext'
import { COMPANIES, getCompanyById } from '@/config/companies'
import { Building2 } from 'lucide-react'

export default function CompanySelector() {
  const { companyId, setCompanyId } = useCompany()
  const current = getCompanyById(companyId)

  return (
    <div className="flex items-center gap-2">
      <Building2 className="w-4 h-4 text-indigo-400" />
      <select
        value={companyId}
        onChange={e => setCompanyId(e.target.value)}
        className="text-sm bg-indigo-900 text-white border border-indigo-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {COMPANIES.map(company => (
          <option
            key={company.id}
            value={company.id}
            disabled={company.status === 'coming'}
          >
            {company.name}
            {company.status === 'coming' ? '（準備中）' : ''}
          </option>
        ))}
      </select>
      {/* 業種バッジ */}
      <span className="hidden sm:inline text-xs text-indigo-300">
        {current.implementedFeatures?.map(f => f.emoji).join(' ')}
      </span>
    </div>
  )
}
