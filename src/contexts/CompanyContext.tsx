'use client'

// =====================================================
//  src/contexts/CompanyContext.tsx
//  選択中企業のグローバル状態管理（マルチテナント）
//
//  ■ このファイルの役割
//    ヘッダーのドロップダウンで選択した企業 ID を
//    アプリ全体で共有するための React Context。
//
//  ■ RunWith との対応
//    MunicipalityContext.tsx → CompanyContext.tsx
//    municipalityId          → companyId
// =====================================================

import { createContext, useContext, useState, ReactNode } from 'react'
import { DEFAULT_COMPANY } from '@/config/companies'

type CompanyContextType = {
  companyId: string
  setCompanyId: (id: string) => void
}

const CompanyContext = createContext<CompanyContextType>({
  companyId:    DEFAULT_COMPANY.id,
  setCompanyId: () => {},
})

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY.id)

  return (
    <CompanyContext.Provider value={{ companyId, setCompanyId }}>
      {children}
    </CompanyContext.Provider>
  )
}

/** 選択中の企業 ID を取得する Hook */
export function useCompany() {
  return useContext(CompanyContext)
}
