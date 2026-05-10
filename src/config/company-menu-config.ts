// =====================================================
//  src/config/company-menu-config.ts
//  企業別メニュー設定
//
//  ■ 役割
//    メニュー設計エージェントのヒアリング結果をもとに、
//    企業ごとにどの機能モジュールを有効化するかを管理する。
//
//  ■ 設計方針
//    - ヒアリング未実施の企業はすべて enabled:true（全機能表示）
//    - ヒアリング承認後、AI提案に基づいて enabled を切り替える
//    - features.ts の id と一致させることで動的サイドバーを実現する
//
//  ■ 利用箇所
//    Sprint #30〜 で実装するメニュー設計エージェント
//    Sprint #32〜 で実装する企業別ページの CompanySidebar
//
//  ■ 更新ルール
//    手動編集は禁止。メニュー設計エージェントの「承認」ボタンが
//    この設定を自動更新する（Sprint #31 で実装）。
// =====================================================

import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Star, Phone, Users, FolderOpen, MessageCircle,
  Zap, Brain, BookOpen, FileText, TrendingUp, ScrollText,
  TrendingDown, ShieldAlert, UserMinus, Gamepad2, GraduationCap,
} from 'lucide-react'

// ── 型定義 ──────────────────────────────────────────

/** 1つの機能モジュールの設定 */
export type CompanyMenuModule = {
  /** features.ts の id に対応 */
  id: string
  /** メニュー表示名 */
  label: string
  /** リンク先（?companyId=xxx 付き） */
  href: string
  /** アイコン */
  icon: LucideIcon
  /** グループ（features.ts と同じ分類） */
  group: 'core' | 'ai-basic' | 'ai-specialized' | 'ai-training'
  /** この企業で有効か（false = メニューに表示しない） */
  enabled: boolean
  /** 表示優先順（小さいほど上に表示） */
  priority: number
}

/** 企業全体のメニュー設定 */
export type CompanyMenuConfig = {
  /** 企業ID（companies.ts の id に対応） */
  companyId: string
  /** 企業表示名 */
  companyName: string
  /** ヒアリング完了日時（ISO8601）。未実施の場合は空文字 */
  hearingCompletedAt: string
  /** ヒアリングに基づく目標テキスト（未実施の場合は空文字） */
  hearingGoal: string
  /** 機能モジュール一覧 */
  modules: CompanyMenuModule[]
}

// ── デフォルトモジュール定義 ──────────────────────────
// ヒアリング未実施時の初期状態：全モジュールを enabled:true で定義する

/** companyId を受け取りデフォルトモジュール一覧を生成する */
function buildDefaultModules(companyId: string): CompanyMenuModule[] {
  // ★ Sprint #37: 全リンクを /company/${companyId}/[feature] に変更
  //    企業専用ページはすべて company レイアウト配下に統一し、
  //    ナビゲーション時に企業ロゴ・サイドバーが維持されるようにする。
  const base = `/company/${companyId}`
  return [
    // ── 必須機能（core） ────────────────────────────────
    {
      id: 'dashboard',       label: '📊 KPIダッシュボード',
      href: `${base}/dashboard`,
      icon: LayoutDashboard, group: 'core', enabled: true, priority: 10,
    },
    {
      id: 'customer-feedback', label: '⭐ 顧客フィードバック',
      href: `${base}/feedback`,
      icon: Star,            group: 'core', enabled: true, priority: 20,
    },
    {
      id: 'customer-contacts', label: '📞 問い合わせ管理',
      href: `${base}/contacts`,
      icon: Phone,           group: 'core', enabled: true, priority: 30,
    },
    {
      id: 'staff',           label: '💚 社員コンディション',
      href: `${base}/staff`,
      icon: Users,           group: 'core', enabled: true, priority: 40,
    },
    {
      id: 'projects',        label: '📁 プロジェクト管理',
      href: `${base}/projects`,
      icon: FolderOpen,      group: 'core', enabled: true, priority: 50,
    },
    {
      id: 'ai-chat',         label: '💬 AIフリーチャット',
      href: `${base}/ai-chat`,
      icon: MessageCircle,   group: 'core', enabled: true, priority: 60,
    },

    // ── AI拡張機能 > 基本AIセット（ai-basic） ──────────────
    {
      id: 'dispatch',        label: '⚡ AIディスパッチ / 育成',
      href: `${base}/dispatch`,
      icon: Zap,             group: 'ai-basic', enabled: true, priority: 110,
    },
    {
      id: 'ai-advisor',      label: '🤖 AI経営顧問',
      href: `${base}/ai-advisor`,
      icon: Brain,           group: 'ai-basic', enabled: true, priority: 120,
    },
    {
      id: 'knowledge',       label: '🔍 AIナレッジ検索',
      href: `${base}/knowledge`,
      icon: BookOpen,        group: 'ai-basic', enabled: true, priority: 130,
    },
    {
      id: 'weekly-report',   label: '📋 週次レポート自動生成',
      href: `${base}/weekly-report`,
      icon: FileText,        group: 'ai-basic', enabled: true, priority: 140,
    },
    {
      id: 'kpi',             label: '📈 KPI目標管理',
      href: `${base}/kpi`,
      icon: TrendingUp,      group: 'ai-basic', enabled: true, priority: 150,
    },
    {
      id: 'ai-logs',         label: '📜 AIログ分析',
      href: `${base}/ai-logs`,
      icon: ScrollText,      group: 'ai-basic', enabled: true, priority: 160,
    },

    // ── AI拡張機能 > 課題特化型AI（ai-specialized） ─────────
    {
      id: 'churn-risk',      label: '⚠️ 顧客離反リスクAI',
      href: `${base}/churn-risk`,
      icon: TrendingDown,    group: 'ai-specialized', enabled: true, priority: 210,
    },
    {
      id: 'cs-quality',      label: '🎯 CS品質スコアAI',
      href: `${base}/cs-quality`,
      icon: ShieldAlert,     group: 'ai-specialized', enabled: true, priority: 220,
    },
    {
      id: 'staff-turnover',  label: '🔴 社員離職リスクAI',
      href: `${base}/staff-turnover`,
      icon: UserMinus,       group: 'ai-specialized', enabled: true, priority: 230,
    },
    {
      id: 'sales-forecast',  label: '📊 売上予測AI',
      href: `${base}/sales-forecast`,
      icon: TrendingUp,      group: 'ai-specialized', enabled: true, priority: 240,
    },

    // ── AI拡張機能 > 研修・学習（ai-training） ─────────────
    {
      id: 'skill-game',      label: '🎮 スキル向上ゲーム',
      href: `${base}/skill-game`,
      icon: Gamepad2,        group: 'ai-training', enabled: true, priority: 310,
    },
    {
      id: 'training-log',    label: '📚 研修ログ管理',
      href: `${base}/training`,
      icon: GraduationCap,   group: 'ai-training', enabled: true, priority: 320,
    },
  ]
}

// ── 企業別メニュー設定（初期値：ヒアリング未実施・全機能有効） ──

export const COMPANY_MENU_CONFIG: Record<string, CompanyMenuConfig> = {

  'kitano-resort': {
    companyId:          'kitano-resort',
    companyName:        '北野リゾートホテル',
    hearingCompletedAt: '',   // ヒアリング未実施
    hearingGoal:        '',
    modules:            buildDefaultModules('kitano-resort'),
  },

  'sakura-medical': {
    companyId:          'sakura-medical',
    companyName:        'さくら医療グループ',
    hearingCompletedAt: '',
    hearingGoal:        '',
    modules:            buildDefaultModules('sakura-medical'),
  },

  'mensho-food': {
    companyId:          'mensho-food',
    companyName:        '麺屋フードチェーン',
    hearingCompletedAt: '',
    hearingGoal:        '',
    modules:            buildDefaultModules('mensho-food'),
  },

  'hanamaru-store': {
    companyId:          'hanamaru-store',
    companyName:        'ハナマルストア',
    hearingCompletedAt: '',
    hearingGoal:        '',
    modules:            buildDefaultModules('hanamaru-store'),
  },
}

// ── ヘルパー関数 ──────────────────────────────────────

/**
 * 企業IDに対応するメニュー設定を取得する。
 * 未登録の企業は全機能有効のデフォルト設定を返す。
 */
export function getCompanyMenuConfig(companyId: string): CompanyMenuConfig {
  return COMPANY_MENU_CONFIG[companyId] ?? {
    companyId,
    companyName:        '',
    hearingCompletedAt: '',
    hearingGoal:        '',
    modules:            buildDefaultModules(companyId),
  }
}

/**
 * 有効なモジュールだけを priority 昇順で返す。
 */
export function getEnabledModules(companyId: string): CompanyMenuModule[] {
  const config = getCompanyMenuConfig(companyId)
  return config.modules
    .filter(m => m.enabled)
    .sort((a, b) => a.priority - b.priority)
}

/**
 * 有効なモジュールをグループ別に返す。
 */
export function getEnabledModulesByGroup(
  companyId: string,
  group: CompanyMenuModule['group'],
): CompanyMenuModule[] {
  return getEnabledModules(companyId).filter(m => m.group === group)
}
