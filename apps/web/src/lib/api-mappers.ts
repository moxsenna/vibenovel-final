import type {
  Character,
  CreditBalance,
  Fact,
  Project,
  StoryFoundation,
  WriterQualityMode,
} from "@vibenovel/shared";
import type {
  DashboardActiveProject,
  DashboardRecentProject,
  DashboardUsageSummary,
} from "@/mocks/dashboard";
import { DEMO_PROJECT_ID } from "@/mocks/projects";
import { mockStoryFoundation } from "@/mocks/storyFoundation";
import { ROUTES } from "@/routes/paths";
import type { ModelTier, ModelTierOption, MonthlyUsage, UserSettings } from "@/types";
import type { StoryFoundation as UiStoryFoundation } from "@/types/storyFoundation";
import { mockSettings } from "@/mocks/settings";

const GENRE_BADGE_CLASSES = [
  "bg-accent-soft text-on-secondary-container",
  "bg-surface-container text-primary-dark",
  "bg-surface-dim text-on-surface-variant",
] as const;

const READINESS_LABELS: Record<string, string> = {
  belum_siap: "Belum siap",
  bisa_lanjut: "Bisa lanjut",
  siap_dikunci: "Hampir siap dikunci",
};

const STATUS_BADGES: Record<string, string> = {
  in_progress: "Sedang Diedit",
  draft: "Draft",
  published: "Diterbitkan",
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: "Sedang ditulis",
  draft: "Draft",
  published: "Diterbitkan",
};

const LANGUAGE_LABELS: Record<string, string> = {
  id: "Indonesia",
  en: "English",
};

const FORMAT_LABELS: Record<string, string> = {
  hp_kbm: "Format HP/KBM",
  desktop: "Format Desktop",
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Baru saja";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  const weeks = Math.floor(days / 7);
  return `${weeks} minggu lalu`;
}

function buildProgressSteps(currentChapter: number): DashboardActiveProject["progressSteps"] {
  return [
    { id: "foundation", label: "Fondasi cerita selesai", status: "done" },
    { id: "outline", label: "Outline siap", status: currentChapter >= 1 ? "done" : "pending" },
    {
      id: "chapter",
      label: `Bab ${Math.max(1, currentChapter)} sedang ditulis`,
      status: "current",
    },
    { id: "publish", label: "Paket publish belum dibuat", status: "pending" },
  ];
}

export function mapProjectToActiveCard(project: Project): DashboardActiveProject {
  return {
    id: project.id,
    title: project.title,
    subtitle: project.genre ? `Kisah ${project.genre}` : "Proyek cerita Anda",
    genre: project.genre ?? "Cerita",
    lastEditedLabel: formatRelativeTime(project.lastEditedAt),
    statusBadge: STATUS_BADGES[project.status] ?? "Aktif",
    currentChapter: project.currentChapter,
    writeRoute: ROUTES.project.write(project.id),
    progressSteps: buildProgressSteps(project.currentChapter),
  };
}

export function mapProjectToRecentCard(
  project: Project,
  index: number,
): DashboardRecentProject {
  const statusLabel =
    project.currentChapter > 0
      ? `Bab ${project.currentChapter}`
      : STATUS_LABELS[project.status] ?? "Proyek";

  return {
    id: project.id,
    title: project.title,
    genre: project.genre ?? "Cerita",
    genreBadgeClass: GENRE_BADGE_CLASSES[index % GENRE_BADGE_CLASSES.length],
    excerpt: project.genre
      ? `Proyek ${project.genre} — lanjutkan dari terakhir kali Anda menulis.`
      : "Lanjutkan proyek cerita Anda.",
    lastEditedLabel: formatRelativeTime(project.lastEditedAt),
    statusLabel,
    bookmarked: project.isActive,
    route: ROUTES.project.write(project.id),
  };
}

export function mapCreditToUsage(balance: CreditBalance | null): DashboardUsageSummary {
  if (!balance) {
    return {
      label: "Pemakaian AI Bulan Ini",
      used: 0,
      total: 0,
    };
  }
  return {
    label: "Pemakaian AI Bulan Ini",
    used: balance.monthlyUsed,
    total: balance.monthlyQuota,
  };
}

export function mapCreditToMonthlyUsage(balance: CreditBalance | null): MonthlyUsage {
  if (!balance) {
    return mockSettings.monthlyUsage;
  }
  const percentUsed =
    balance.monthlyQuota > 0
      ? Math.round((balance.monthlyUsed / balance.monthlyQuota) * 100)
      : 0;
  const resetLabel = balance.resetAt
    ? `Batas reset pada ${new Date(balance.resetAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
    : mockSettings.monthlyUsage.resetLabel;

  return {
    used: balance.monthlyUsed,
    quota: balance.monthlyQuota,
    percentUsed,
    resetLabel,
    infoMessage: `Anda telah menggunakan ${percentUsed}% dari kuota pemakaian bulan ini.`,
  };
}

function buildModelTiers(selected: WriterQualityMode): ModelTierOption[] {
  const tiers: Array<{ id: ModelTier; label: string; description: string; badgeLabel: string; badgeVariant: ModelTierOption["badgeVariant"] }> = [
    {
      id: "hemat",
      label: "Hemat",
      description: "Lebih irit untuk draft cepat dan eksplorasi ide awal.",
      badgeLabel: "Cepat",
      badgeVariant: "neutral",
    },
    {
      id: "seimbang",
      label: "Seimbang",
      description: "Kualitas default yang disarankan untuk bab biasa.",
      badgeLabel: "Rekomendasi",
      badgeVariant: "primary",
    },
    {
      id: "terbaik",
      label: "Terbaik",
      description: "Untuk bab penting, rewrite, atau perbaikan yang lebih rumit.",
      badgeLabel: "Kualitas tinggi",
      badgeVariant: "success",
    },
  ];

  return tiers.map((tier) => ({
    ...tier,
    isSelected: tier.id === selected,
  }));
}

export interface ApiSettingsInput {
  qualityMode: WriterQualityMode;
  defaultOutputStyle: string;
  defaultFormat: string;
  defaultLanguage?: string | null;
}

export function mergeSettingsWithApi(
  apiSettings: ApiSettingsInput,
  creditBalance: CreditBalance | null,
  profile?: { displayName: string; email: string; planLabel: string },
): UserSettings {
  const base = mockSettings;
  return {
    ...base,
    displayName: profile?.displayName ?? base.displayName,
    email: profile?.email ?? base.email,
    planLabel: profile?.planLabel ?? base.planLabel,
    creditsRemaining: creditBalance?.balance ?? base.creditsRemaining,
    monthlyUsage: mapCreditToMonthlyUsage(creditBalance),
    modelTiers: buildModelTiers(apiSettings.qualityMode),
    writerPreferences: {
      defaultLanguage:
        apiSettings.defaultLanguage != null
          ? (LANGUAGE_LABELS[apiSettings.defaultLanguage] ?? apiSettings.defaultLanguage)
          : base.writerPreferences.defaultLanguage,
      defaultOutputStyle: apiSettings.defaultOutputStyle,
      defaultFormat:
        FORMAT_LABELS[apiSettings.defaultFormat] ?? apiSettings.defaultFormat,
    },
    pageCopy: {
      ...base.pageCopy,
      subtitle:
        "Kelola kredit, mode kualitas AI, dan preferensi penulis Anda. Pengaturan aktif disimpan ke API untuk proyek aktif.",
      sprintNoteTitle: "Catatan Sprint 2",
      sprintNoteBody:
        "Mode kualitas dan preferensi penulis untuk proyek aktif dibaca/ditulis via API. Kredit masih display-only; belum ada pemotongan nyata atau billing.",
    },
  };
}

function splitReaderPromise(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function mapFoundationBundleToUi(
  projectId: string,
  foundation: StoryFoundation,
  characters: Character[],
  facts: Fact[],
): UiStoryFoundation {
  const mainCharacters = characters
    .filter((c) => c.importance === "main")
    .map((c) => ({
      id: c.id,
      name: c.name,
      role: c.roleLabel,
      description: c.description,
    }));

  const supportingCharacters = characters
    .filter((c) => c.importance !== "main")
    .map((c) => ({
      id: c.id,
      name: c.name,
      role: c.roleLabel,
      description: c.description,
    }));

  const lockedFacts = facts
    .filter((f) => f.isLocked)
    .map((f) => ({
      id: f.id,
      label: f.category,
      value: f.text,
      isLocked: f.isLocked,
    }));

  const fallback = mockStoryFoundation;

  return {
    projectId,
    readiness: {
      percent: foundation.readinessPercent,
      title: "Kesiapan Fondasi",
      statusLabel:
        READINESS_LABELS[foundation.readinessStatus] ?? foundation.readinessStatus,
      hint:
        foundation.readinessPercent >= 80
          ? "Sebagian besar fondasi sudah lengkap. Tinjau sebelum lanjut ke outline."
          : "Lengkapi bagian fondasi yang masih kosong sebelum lanjut.",
      missingItems: fallback.readiness.missingItems,
    },
    premise: foundation.premise || fallback.premise,
    mainCharacters: mainCharacters.length > 0 ? mainCharacters : fallback.mainCharacters,
    supportingCharacters:
      supportingCharacters.length > 0 ? supportingCharacters : fallback.supportingCharacters,
    lockedFacts: lockedFacts.length > 0 ? lockedFacts : fallback.lockedFacts,
    mainConflict: foundation.mainConflict || fallback.mainConflict,
    readerPromiseItems: foundation.readerPromise
      ? splitReaderPromise(foundation.readerPromise)
      : fallback.readerPromiseItems,
    storySecretsPreview:
      foundation.storySecretsPreview ?? fallback.storySecretsPreview,
    secretSchedule: fallback.secretSchedule,
    storyStyleTags:
      foundation.styleTags.length > 0 ? foundation.styleTags : fallback.storyStyleTags,
    outlineRoute: ROUTES.project.outline(projectId),
    isLocked: foundation.isLocked,
    pageCopy: fallback.pageCopy,
  };
}

export function resolveApiProjectId(
  routeProjectId: string | undefined,
  activeProjectId: string | null,
): string | null {
  if (!routeProjectId) return activeProjectId;
  if (routeProjectId === DEMO_PROJECT_ID && activeProjectId) return activeProjectId;
  return routeProjectId;
}