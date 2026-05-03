// =====================================================
//  src/config/features.ts
//  サイドバーメニュー定義
//
//  ■ このファイルの役割
//    左サイドバーに表示するメニュー項目をここで一元管理する。
//    ここに追加するだけでサイドバーとホーム画面に自動反映される。
//
//  ■ グループ構成
//    core       → 必須機能（常時展開）
//    company    → 企業別リンク（デフォルト閉じ）
//    admin      → 管理者向け（デフォルト閉じ）
//
//  ■ RunWith との対応
//    features.ts の構造はほぼ同じ
//    municipality グループ → company グループ
// =====================================================

import {
  LayoutDashboard,
  MessageSquare,
  Phone,
  Users,
  BookOpen,
  GraduationCap,
  BarChart3,
  Brain,
  FileText,
  Settings,
  Activity,
  Building2,
  type LucideIcon,
} from 'lucide-react'

export type FeatureGroup = 'core' | 'company' | 'admin'

export type Feature = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  group: FeatureGroup
  /** true にするとサイドバーから非表示（ページは存在） */
  hidden?: boolean
  /** 準備中フラグ（グレーアウト表示） */
  coming?: boolean
}

export const FEATURES: Feature[] = [
  // ===== core グループ（必須機能） =====
  {
    id:    'dashboard',
    label: 'ダッシュボード',
    href:  '/management/dashboard',
    icon:  LayoutDashboard,
    group: 'core',
  },
  {
    id:    'customer-feedback',
    label: '顧客フィードバック',
    href:  '/customer/feedback',
    icon:  MessageSquare,
    group: 'core',
  },
  {
    id:    'customer-contacts',
    label: '問い合わせ管理',
    href:  '/customer/contacts',
    icon:  Phone,
    group: 'core',
  },
  {
    id:    'staff',
    label: '社員コンディション',
    href:  '/operations/staff',
    icon:  Users,
    group: 'core',
  },
  {
    id:    'knowledge',
    label: 'AIナレッジ検索',
    href:  '/operations/knowledge',
    icon:  BookOpen,
    group: 'core',
  },
  {
    id:    'training',
    label: 'スキル向上ゲーム',
    href:  '/skill-game/select',
    icon:  GraduationCap,
    group: 'core',
  },
  {
    id:    'kpi',
    label: 'KPI管理',
    href:  '/management/kpi',
    icon:  BarChart3,
    group: 'core',
  },
  {
    id:    'ai-advisor',
    label: 'AI経営顧問',
    href:  '/ai-advisor',
    icon:  Brain,
    group: 'core',
  },
  {
    id:    'weekly-report',
    label: '週次レポート',
    href:  '/management/weekly-report',
    icon:  FileText,
    group: 'core',
  },

  // ===== company グループ（企業別リンク） =====
  // 企業を追加するときはここにも追記する
  // href に ?companyId=xxx を必ず付けること
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

  // ===== admin グループ =====
  {
    id:    'settings',
    label: '企業プロファイル設定',
    href:  '/settings/company',
    icon:  Settings,
    group: 'admin',
  },
  {
    id:    'system-health',
    label: 'システムヘルス',
    href:  '/admin/system-health',
    icon:  Activity,
    group: 'admin',
  },
]

/** hidden でないページだけを返す */
export function getVisibleFeatures(): Feature[] {
  return FEATURES.filter(f => !f.hidden)
}

/** グループ別にフィルタリング */
export function getFeaturesByGroup(group: FeatureGroup): Feature[] {
  return FEATURES.filter(f => f.group === group && !f.hidden)
}
