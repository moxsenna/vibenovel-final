export type ModelTier = "hemat" | "seimbang" | "terbaik";

export interface ModelTierOption {
  id: ModelTier;
  label: string;
  description: string;
  badgeLabel: string;
  badgeVariant: "neutral" | "primary" | "success";
  isSelected: boolean;
}

export interface MonthlyUsage {
  used: number;
  quota: number;
  percentUsed: number;
  resetLabel: string;
  infoMessage: string;
}

export interface WriterPreferences {
  defaultLanguage: string;
  defaultOutputStyle: string;
  defaultFormat: string;
}

export interface SettingsPageCopy {
  title: string;
  subtitle: string;
  creditCardTitle: string;
  creditCardSubtitle: string;
  creditBalanceLabel: string;
  usageSectionTitle: string;
  usageUsedLabel: string;
  usageUpgradeCta: string;
  qualityModeTitle: string;
  qualityModeSubtitle: string;
  writerPreferencesTitle: string;
  accountSectionTitle: string;
  displayNameLabel: string;
  emailLabel: string;
  planLabel: string;
  editProfileCta: string;
  sprintNoteTitle: string;
  sprintNoteBody: string;
  cancelCta: string;
  saveCta: string;
}

export interface UserSettings {
  displayName: string;
  email: string;
  planLabel: string;
  creditsRemaining: number;
  monthlyUsage: MonthlyUsage;
  modelTiers: ModelTierOption[];
  writerPreferences: WriterPreferences;
  pageCopy: SettingsPageCopy;
}