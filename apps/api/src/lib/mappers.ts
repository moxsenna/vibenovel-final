import type { CreditBalance, UserProfile } from "@vibenovel/shared";

export interface ProfileRow {
  id: string;
  display_name: string;
  email: string;
  default_language: string;
  plan_label: string;
  role: string;
  subscription_plan: string;
  created_at: string;
  updated_at: string;
}

export interface CreditBalanceRow {
  id: string;
  user_id: string;
  balance: number;
  monthly_quota: number;
  monthly_used: number;
  reset_at: string | null;
  source: string;
  updated_at: string;
}

export function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    defaultLanguage: row.default_language as UserProfile["defaultLanguage"],
    planLabel: row.plan_label,
    role: row.role as UserProfile["role"],
    subscriptionPlan: row.subscription_plan as UserProfile["subscriptionPlan"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCreditBalanceRow(row: CreditBalanceRow): CreditBalance {
  return {
    id: row.id,
    userId: row.user_id,
    balance: row.balance,
    monthlyQuota: row.monthly_quota,
    monthlyUsed: row.monthly_used,
    resetAt: row.reset_at,
    source: row.source as CreditBalance["source"],
    updatedAt: row.updated_at,
  };
}