import type {
  CreditBalance,
  Project,
  ProjectSettings,
  UserProfile,
} from "@vibenovel/shared";

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

export interface ProjectRow {
  id: string;
  owner_id: string;
  title: string;
  genre: string | null;
  status: string;
  current_chapter: number;
  entry_path: string | null;
  is_active: boolean;
  last_edited_at: string;
  created_at: string;
  updated_at: string;
}

export function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    genre: row.genre,
    status: row.status as Project["status"],
    currentChapter: row.current_chapter,
    entryPath: row.entry_path as Project["entryPath"],
    isActive: row.is_active,
    lastEditedAt: row.last_edited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProjectSettingsRow {
  id: string;
  project_id: string;
  quality_tier: string;
  output_style_preference: string;
  default_format: string;
  target_length_band: string | null;
  created_at: string;
  updated_at: string;
}

const OUTPUT_STYLE_LABELS: Record<string, string> = {
  warm_emotional: "Narasi hangat & emosional",
  fast_paced: "Cepat & dinamis",
  poetic: "Puitis & imajinatif",
  conversational: "Santai & percakapan",
  custom: "Kustom",
};

export function mapProjectSettingsRow(row: ProjectSettingsRow): ProjectSettings {
  return {
    id: row.id,
    projectId: row.project_id,
    qualityTier: row.quality_tier as ProjectSettings["qualityTier"],
    defaultOutputStyle:
      OUTPUT_STYLE_LABELS[row.output_style_preference] ?? row.output_style_preference,
    defaultFormat: row.default_format as ProjectSettings["defaultFormat"],
    targetLengthBand: row.target_length_band as ProjectSettings["targetLengthBand"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** API response with task-friendly aliases alongside shared ProjectSettings fields. */
export interface ProjectSettingsResponse extends ProjectSettings {
  qualityMode: ProjectSettings["qualityTier"];
  outputStylePreference: string;
  mobileFormatPreference: ProjectSettings["defaultFormat"];
  targetLengthPlan: ProjectSettings["targetLengthBand"];
}

export function mapProjectSettingsResponse(row: ProjectSettingsRow): ProjectSettingsResponse {
  const base = mapProjectSettingsRow(row);
  return {
    ...base,
    qualityMode: base.qualityTier,
    outputStylePreference: row.output_style_preference,
    mobileFormatPreference: base.defaultFormat,
    targetLengthPlan: base.targetLengthBand,
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