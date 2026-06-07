import type {
  AiProposal,
  Character,
  CreditBalance,
  DetectedSignal as ApiDetectedSignal,
  Fact,
  IntakeMessage as ApiIntakeMessage,
  IntakeSession as ApiIntakeSession,
  Project,
  StoryConcept as ApiStoryConcept,
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
import type {
  ConceptAccent,
  DetectedSignal,
  IntakeMessage,
  IntakeSession,
  StoryConcept,
} from "@/types";
import { mockIntakeSession } from "@/mocks/intake";
import { mockSettings } from "@/mocks/settings";
interface FoundationReadinessApi {
  readinessScore: number;
  readinessLevel: string;
  canLock: boolean;
  missing: string[];
}

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

  const lockedFacts = facts.map((f) => ({
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

const SIGNAL_TYPE_ICONS: Record<string, string> = {
  genre: "theater_comedy",
  tone: "local_fire_department",
  target_reader: "smartphone",
  relationship_dynamic: "family_restroom",
  secret_candidate: "key",
  conflict: "swords",
  reader_promise: "volunteer_activism",
};

const CONCEPT_ACCENTS: ConceptAccent[] = [
  "primary-soft",
  "secondary-container",
  "success-soft",
];

const CONCEPT_BADGE_TONES = [
  "text-primary-dark",
  "text-secondary",
  "text-tertiary-container",
] as const;

function parsePayloadRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function mapApiMessageToUi(message: ApiIntakeMessage): IntakeMessage {
  const role: IntakeMessage["role"] =
    message.role === "user" ? "user" : "agent";
  return {
    id: message.id,
    role,
    content: message.content,
    timestamp: message.createdAt,
  };
}

export function mapApiSignalToUi(signal: ApiDetectedSignal): DetectedSignal {
  const pending = signal.status === "detected";
  return {
    id: signal.id,
    label: signal.label || signal.value,
    icon: SIGNAL_TYPE_ICONS[signal.type] ?? "psychology_alt",
    pending,
  };
}

export function mapIntakeBundleToUi(
  projectId: string,
  session: ApiIntakeSession,
  messages: ApiIntakeMessage[],
  signals: ApiDetectedSignal[],
): IntakeSession {
  const fallback = mockIntakeSession;
  const uiMessages =
    messages.length > 0 ? messages.map(mapApiMessageToUi) : fallback.messages;
  const uiSignals =
    signals.length > 0 ? signals.map(mapApiSignalToUi) : fallback.detectedSignals;

  return {
    projectId,
    pageTitle: fallback.pageTitle,
    introTitle: fallback.introTitle,
    introSubtitle: fallback.introSubtitle,
    messages: uiMessages,
    progress: fallback.progress,
    progressPercent: session.progressPercent ?? fallback.progressPercent,
    detectedSignals: uiSignals,
    suggestedActions: fallback.suggestedActions,
    conceptsRoute: ROUTES.project.concepts(projectId),
    inputPlaceholder: fallback.inputPlaceholder,
    inputTip: isApiModeEnabled()
      ? "Balasan dari server (stub). Pesan tersimpan ke API."
      : fallback.inputTip,
    ctaLabel: fallback.ctaLabel,
    ctaHint: fallback.ctaHint,
  };
}

function isApiModeEnabled(): boolean {
  const raw = import.meta.env.VITE_USE_MOCKS?.trim().toLowerCase();
  return raw === "false";
}

export function mapApiConceptToUi(concept: ApiStoryConcept, projectId: string, index: number): StoryConcept {
  const payload = parsePayloadRecord(concept.payload);
  const accent =
    (payload.decorativeAccent as ConceptAccent | undefined) ??
    CONCEPT_ACCENTS[index % CONCEPT_ACCENTS.length];
  const badgeLabel =
    (typeof payload.badgeLabel === "string" && payload.badgeLabel) ||
    [concept.genre, concept.tone].filter(Boolean).join(" / ") ||
    "Konsep Cerita";
  const badgeIcon =
    (typeof payload.badgeIcon === "string" && payload.badgeIcon) || "auto_awesome";

  return {
    id: concept.id,
    title: concept.title,
    pitchShort: concept.shortPitch,
    badgeLabel,
    badgeIcon,
    badgeToneClass: CONCEPT_BADGE_TONES[index % CONCEPT_BADGE_TONES.length],
    mainConflict: concept.coreConflict ?? "",
    readerPromise: concept.readerPromise ?? "",
    commercialStrength:
      (typeof payload.whyReadersCare === "string" && payload.whyReadersCare) ||
      (typeof payload.emotionalPromise === "string" && payload.emotionalPromise) ||
      "Arah cerita ini punya daya tarik emosional untuk pembaca serial.",
    decorativeAccent: accent,
    featured: payload.featured === true,
    foundationRoute: ROUTES.project.foundation(projectId),
    status: concept.status,
  };
}

export function mapReadinessApiToUi(
  readiness: FoundationReadinessApi,
): UiStoryFoundation["readiness"] {
  const percent = readiness.readinessScore;
  return {
    percent,
    title: "Kesiapan Fondasi",
    statusLabel: READINESS_LABELS[readiness.readinessLevel] ?? readiness.readinessLevel,
    hint: readiness.canLock
      ? "Fondasi siap dikunci. Tinjau usulan yang tersisa sebelum mengunci."
      : percent >= 45
        ? "Lengkapi bagian yang masih kurang dan terima usulan yang diperlukan."
        : "Lengkapi intake dan konsep terlebih dahulu.",
    missingItems: readiness.missing,
  };
}

export interface UiFoundationProposal {
  id: string;
  proposalType: string;
  title: string;
  summary: string | null;
  status: string;
  riskLevel: string;
}

const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  foundation: "Fondasi",
  character: "Tokoh",
  fact: "Fakta",
  relationship_speech_rule: "Aturan Bicara",
  style: "Gaya",
  secret: "Rahasia",
  reveal: "Pengungkapan",
};

export function mapProposalToUi(proposal: AiProposal): UiFoundationProposal {
  const payload = parsePayloadRecord(proposal.payload);
  const summary =
    (typeof payload.summary === "string" ? payload.summary : null) ??
    (typeof payload.reason === "string" ? payload.reason : null);

  return {
    id: proposal.id,
    proposalType: PROPOSAL_TYPE_LABELS[proposal.proposalType] ?? proposal.proposalType,
    title: proposal.title,
    summary,
    status: proposal.status,
    riskLevel: proposal.riskLevel,
  };
}