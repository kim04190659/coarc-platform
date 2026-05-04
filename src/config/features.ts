// =====================================================
//  src/config/features.ts
//  サイドバーメニュー定義
//
//  ■ グループ構成
//    core          → 必須機能（常時展開）
//    ai-basic      → AI拡張機能 > 基本AIセット
//    ai-specialized→ AI拡張機能 > 課題特化型AI
//    ai-training   → AI拡張機能 > 研修・学習
//    company       → 企業別（デフォルト閉じ）
//    admin         → 管理・設定（デフォルト閉じ）
//
//  ■ AI拡張機能 は3つのサブグループをまとめて1つのセクションに表示
//    Sidebar.tsx でまとめてトグル管理している
// =====================================================

import {
  LayoutDashboard,
  MessageSquare,
  Phone,
  Users,
  Star,
  Brain,
  BookOpen,
  FileText,
  TrendingDown,
  ShieldAlert,
  UserMinus,
  TrendingUp,
  GraduationCap,
  Gamepad2,
  Settings,
  Activity,
  Building2,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export type FeatureGroup =
  | 'core'
  | 'ai-basic'
  | 'ai-specialized'
  | 'ai-training'
  | 'company'
  | 'admin'

export type Feature = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  group: FeatureGroup
  hidden?: boolean
  coming?: boolean
}

export const FEATURES: Feature[] = [

  // ===== 必須機能（core） =====
  {
    id:    'dashboard',
    label: '📊 KPIダッシュボード',
    href:  '/management/dashboard',
    icon:  LayoutDashboard,
    group: 'core',
  },
  {
    id:    'customer-feedback',
    label: '⭐ 顧客フィードバック',
    href:  '/customer/feedback',
    icon:  Star,
    group: 'core',
  },
  {
    id:    'customer-contacts',
    label: '📞 問い合わせ管理',
    href:  '/customer/contacts',
    icon:  Phone,
    group: 'core',
  },
  {
    id:    'staff',
    label: '💚 社員コンディション',
    href:  '/operations/staff',
    icon:  Users,
    group: 'core',
  },

  // ===== AI拡張機能 > 基本AIセット（ai-basic） =====
  {
    id:    'dispatch',
    label: '⚡ AIディスパッチ / 育成',
    href:  '/operations/dispatch',
    icon:  Zap,
    group: 'ai-basic',
  },
  {
    id:    'ai-advisor',
    label: '🤖 AI経営顧問',
    href:  '/ai-advisor',
    icon:  Brain,
    group: 'ai-basic',
  },
  {
    id:    'knowledge',
    label: '🔍 AIナレッジ検索',
    href:  '/operations/knowledge',
    icon:  BookOpen,
    group: 'ai-basic',
  },
  {
    id:    'weekly-report',
    label: '📋 週次レポート自動生成',
    href:  '/management/weekly-report',
    icon:  FileText,
    group: 'ai-basic',
  },
  {
    id:    'kpi',
    label: '📈 KPI目標管理',
    href:  '/management/kpi',
    icon:  TrendingUp,
    group: 'ai-basic',
  },

  // ===== AI拡張機能 > 課題特化型AI（ai-specialized） =====
  {
    id:    'churn-risk',
    label: '⚠️ 顧客離反リスクAI',
    href:  '/ai-ext/churn-risk',
    icon:  TrendingDown,
    group: 'ai-specialized',
    coming: true,
  },
  {
    id:    'cs-quality',
    label: '🎯 CS品質スコアAI',
    href:  '/ai-ext/cs-quality',
    icon:  ShieldAlert,
    group: 'ai-specialized',
    coming: true,
  },
  {
    id:    'staff-turnover',
    label: '🔴 社員離職リスクAI',
    href:  '/ai-ext/staff-turnover',
    icon:  UserMinus,
    group: 'ai-specialized',
    coming: true,
  },
  {
    id:    'sales-forecast',
    label: '📊 売上予測AI',
    href:  '/ai-ext/sales-forecast',
    icon:  TrendingUp,
    group: 'ai-specialized',
    coming: true,
  },

  // ===== AI拡張機能 > 研修・学習（ai-training） =====
  {
    id:    'skill-game',
    label: '🎮 スキル向上ゲーム',
    href:  '/skill-game/select',
    icon:  Gamepad2,
    group: 'ai-training',
  },
  {
    id:    'training-log',
    label: '📚 研修ログ管理',
    href:  '/operations/training',
    icon:  GraduationCap,
    group: 'ai-training',
  },

  // ===== 企業別（company） =====
  {
    id:    'company-kitano',
    label: '🏨 北野リゾートホテル',
    href:  '/management/dashboard?companyId=kitano-resort',
    icon:  Building2,
    group: 'company',
  },
  {
    id:    'company-sakura',
    label: '🏥 さくら医療グループ',
    href:  '/management/dashboard?companyId=sakura-medical',
    icon:  Building2,
    group: 'company',
  },
  {
    id:    'company-mensho',
    label: '🍽️ 麺屋フードチェーン',
    href:  '/management/dashboard?companyId=mensho-food',
    icon:  Building2,
    group: 'company',
  },
  {
    id:    'company-hanamaru',
    label: '🛒 ハナマルストア',
    href:  '/management/dashboard?companyId=hanamaru-store',
    icon:  Building2,
    group: 'company',
  },

  // ===== 管理・設定（admin） =====
  {
    id:    'settings',
    label: '⚙️ 企業プロファイル設定',
    href:  '/settings/company',
    icon:  Settings,
    group: 'admin',
  },
  {
    id:    'system-health',
    label: '🩺 システムヘルス監視',
    href:  '/admin/system-health',
    icon:  Activity,
    group: 'admin',
  },
]

/** hidden でないページだけを返す */
export function getVisibleFeatures(): Feature[] {
  return FEATURES.filter(f => !f.hidden)
}

/** グループ別にフィルタリング（hidden 除外） */
export function getFeaturesByGroup(group: FeatureGroup): Feature[] {
  return FEATURES.filter(f => f.group === group && !f.hidden)
}
