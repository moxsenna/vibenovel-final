import type {
  AiProposal,
  ChapterOutline,
  ChapterOutlineMarker,
  Character,
  CreditBalance,
  DetectedSignal as ApiDetectedSignal,
  Fact,
  IntakeMessage as ApiIntakeMessage,
  IntakeSession as ApiIntakeSession,
  OpenLoop,
  OutlinePlan,
  Project,
  StoryConcept as ApiStoryConcept,
  StoryFoundation,
  WriterQualityMode,
} from "@vibenovel/shared";
import type { PlannedRevealPublic } from "@/services/outline";
import type {
  DashboardActiveProject,
  DashboardRecentProject,
  DashboardUsageSummary,
} from "@/mocks/dashboard";
import { DEMO_PROJECT_ID } from "@/mocks/projects";
import { mockStoryFoundation } from "@/mocks/storyFoundation";
import { ROUTES } from "@/routes/paths";
import { shouldUseMocks } from "@/lib/env";
import {
  buildHonestProgressSteps,
  buildHonestRecentExcerpt,
  buildHonestRecentStatusLabel,
  INTAKE_STUB_ASSISTANT_LABEL,
  resolveActiveProjectCta,
  resolveHonestProjectRoute,
} from "@/lib/workflow-truth";
import type { ModelTier, ModelTierOption, MonthlyUsage, UserSettings } from "@/types";
import type { StoryFoundation as UiStoryFoundation } from "@/types/storyFoundation";
import type {
  ChapterBadge,
  ChapterBadgeType,
  ConceptAccent,
  DetectedSignal,
  IntakeMessage,
  IntakeSession,
  OutlineChapter,
  OutlineRetentionHint,
  StoryConcept,
  StoryOutline,
} from "@/types";
import { mockOutline } from "@/mocks/outline";
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

export function mapProjectToActiveCard(project: Project): DashboardActiveProject {
  const cta = resolveActiveProjectCta(project);
  return {
    id: project.id,
    title: project.title,
    subtitle: project.genre ? `Kisah ${project.genre}` : "Proyek cerita Anda",
    genre: project.genre ?? "Cerita",
    lastEditedLabel: formatRelativeTime(project.lastEditedAt),
    statusBadge: STATUS_BADGES[project.status] ?? "Aktif",
    currentChapter: project.currentChapter,
    writeRoute: cta.route,
    progressSteps: buildHonestProgressSteps(project),
    ctaLabel: cta.label,
    ctaDisabled: cta.disabled,
  };
}

export function mapProjectToRecentCard(
  project: Project,
  index: number,
): DashboardRecentProject {
  return {
    id: project.id,
    title: project.title,
    genre: project.genre ?? "Cerita",
    genreBadgeClass: GENRE_BADGE_CLASSES[index % GENRE_BADGE_CLASSES.length],
    excerpt: buildHonestRecentExcerpt(project),
    lastEditedLabel: formatRelativeTime(project.lastEditedAt),
    statusLabel: buildHonestRecentStatusLabel(project),
    bookmarked: project.isActive,
    route: resolveHonestProjectRoute(project),
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

  const useDemoCopy = isApiModeEnabled() === false;

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
      missingItems: useDemoCopy ? mockStoryFoundation.readiness.missingItems : [],
    },
    premise: foundation.premise || (useDemoCopy ? mockStoryFoundation.premise : "Belum diisi"),
    mainCharacters:
      mainCharacters.length > 0
        ? mainCharacters
        : useDemoCopy
          ? mockStoryFoundation.mainCharacters
          : [],
    supportingCharacters:
      supportingCharacters.length > 0
        ? supportingCharacters
        : useDemoCopy
          ? mockStoryFoundation.supportingCharacters
          : [],
    lockedFacts:
      lockedFacts.length > 0 ? lockedFacts : useDemoCopy ? mockStoryFoundation.lockedFacts : [],
    mainConflict:
      foundation.mainConflict || (useDemoCopy ? mockStoryFoundation.mainConflict : "Belum diisi"),
    readerPromiseItems: foundation.readerPromise
      ? splitReaderPromise(foundation.readerPromise)
      : useDemoCopy
        ? mockStoryFoundation.readerPromiseItems
        : ["Belum diisi"],
    storySecretsPreview:
      foundation.storySecretsPreview ??
      (useDemoCopy ? mockStoryFoundation.storySecretsPreview : "Belum diisi"),
    secretSchedule: useDemoCopy ? mockStoryFoundation.secretSchedule : [],
    storyStyleTags:
      foundation.styleTags.length > 0
        ? foundation.styleTags
        : useDemoCopy
          ? mockStoryFoundation.storyStyleTags
          : [],
    outlineRoute: ROUTES.project.outline(projectId),
    isLocked: foundation.isLocked,
    pageCopy: useDemoCopy
      ? mockStoryFoundation.pageCopy
      : {
          title: "Fondasi Cerita",
          subtitle:
            "Bangun fondasi dari konsep terpilih. Bagian kosong ditandai jujur — belum diisi.",
          warningTitle: "Catatan Beta",
          warningBody: "Fondasi penuh belum dihasilkan otomatis untuk semua proyek.",
          warningNote: "Lengkapi bagian yang masih kosong sebelum mengunci fondasi.",
          lockCtaLabel: "Kunci Fondasi",
        },
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
  const useDemoCopy = !isApiModeEnabled();
  const fallback = mockIntakeSession;
  const uiMessages =
    messages.length > 0 ? messages.map(mapApiMessageToUi) : useDemoCopy ? fallback.messages : [];
  const uiSignals =
    signals.length > 0 ? signals.map(mapApiSignalToUi) : useDemoCopy ? fallback.detectedSignals : [];

  return {
    projectId,
    pageTitle: useDemoCopy ? fallback.pageTitle : "Ceritakan Ide Anda",
    introTitle: useDemoCopy ? fallback.introTitle : "Mulai dari ide mentah",
    introSubtitle: useDemoCopy
      ? fallback.introSubtitle
      : "Ceritakan ide, konflik, atau suasana yang ingin Anda tulis.",
    messages: uiMessages,
    progress: useDemoCopy ? fallback.progress : [],
    progressPercent: session.progressPercent ?? (useDemoCopy ? fallback.progressPercent : 0),
    detectedSignals: uiSignals,
    suggestedActions: useDemoCopy ? fallback.suggestedActions : [],
    conceptsRoute: ROUTES.project.concepts(projectId),
    inputPlaceholder: useDemoCopy ? fallback.inputPlaceholder : "Tulis ide cerita Anda di sini…",
    inputTip: isApiModeEnabled() ? INTAKE_STUB_ASSISTANT_LABEL : fallback.inputTip,
    ctaLabel: useDemoCopy ? fallback.ctaLabel : "Lanjut ke Konsep",
    ctaHint: useDemoCopy
      ? fallback.ctaHint
      : "Lanjut setelah Anda merasa cukup banyak ide terkumpul.",
  };
}

function isApiModeEnabled(): boolean {
  return !shouldUseMocks();
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

const EMOTION_LABELS: Record<string, string> = {
  hurt: "Terluka / tertekan",
  tense: "Menegangkan",
  angry: "Marah",
  hopeful: "Penuh harapan",
  satisfying: "Memuaskan",
  curious: "Penasaran",
  anxious: "Cemas",
  triumphant: "Triumfan",
};

const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  generated: "Rencana dibuat",
  reviewing: "Sedang ditinjau",
  locked: "Outline terkunci",
};

const MARKER_BADGE_MAP: Record<string, { type: ChapterBadgeType; label: string }> = {
  mini_victory: { type: "mini_victory", label: "Kemenangan Kecil" },
  cliffhanger: { type: "cliffhanger", label: "Cliffhanger" },
  secret_hint: { type: "reveal", label: "Rahasia" },
  hook: { type: "emotion", label: "Hook" },
  open_loop: { type: "conflict", label: "Menggantung" },
  emotional_payoff: { type: "emotion", label: "Emosi" },
  reversal: { type: "conflict", label: "Balikan" },
};

const OUTLINE_LOCK_MISSING_LABELS: Record<string, string> = {
  foundationLocked: "Kunci fondasi cerita dulu",
  outlineExists: "Buat rencana outline dulu",
  notAlreadyLocked: "Outline sudah terkunci",
  chapterCount: "Jumlah bab belum lengkap",
  allChaptersHaveBasics: "Beberapa bab belum lengkap (judul, ringkasan, fungsi, hook)",
  hooksEveryChapter: "Beberapa bab masih kurang hook akhir bab",
  summariesEveryChapter: "Beberapa bab masih tanpa ringkasan",
  miniVictoryCadence: "Kemenangan kecil belum cukup (minimal 3 bab)",
  openLoopsEnough: "Yang masih menggantung belum cukup (minimal 2)",
  plannedRevealsEnough: "Jadwal rahasia belum cukup (minimal 2)",
  allChaptersApproveBasics: "Beberapa bab belum punya judul, ringkasan, atau hook",
  hasChapters: "Belum ada rencana bab",
  chapterCountMatchesTarget: "Jumlah bab belum sesuai target",
};

function mapMarkerToBadge(marker: ChapterOutlineMarker): ChapterBadge {
  const mapped = MARKER_BADGE_MAP[marker.type];
  if (mapped) {
    return { type: mapped.type, label: marker.label?.trim() || mapped.label };
  }
  return { type: "emotion", label: marker.label?.trim() || "Marker" };
}

export function mapApiChapterToUi(chapter: ChapterOutline): OutlineChapter {
  const badges = chapter.markers.map(mapMarkerToBadge);
  if (chapter.miniVictory && !badges.some((b) => b.type === "mini_victory")) {
    badges.push({ type: "mini_victory", label: "Kemenangan Kecil" });
  }

  return {
    id: chapter.id,
    number: chapter.chapterNumber,
    title: chapter.title,
    summary: chapter.summary,
    goal: chapter.purpose ?? "",
    emotionalGoal: chapter.emotionalDirection
      ? (EMOTION_LABELS[chapter.emotionalDirection] ?? chapter.emotionalDirection)
      : "",
    endingHook: chapter.endingHook ?? chapter.hook ?? "",
    badges,
  };
}

function buildRetentionHints(
  chapters: ChapterOutline[],
  openLoops: OpenLoop[],
  reveals: PlannedRevealPublic[],
): OutlineRetentionHint[] {
  const miniVictoryCount = chapters.filter(
    (ch) =>
      (ch.miniVictory && ch.miniVictory.trim().length > 0) ||
      ch.markers.some((m) => m.type === "mini_victory"),
  ).length;
  const hookCount = chapters.filter((ch) => (ch.endingHook ?? ch.hook)?.trim()).length;

  return [
    {
      id: "ret-open-loop",
      label: "Yang Menggantung",
      description: `${openLoops.length} pertanyaan pembaca dilacak di rencana ini.`,
      icon: "all_inclusive",
      tone: "primary",
    },
    {
      id: "ret-mini-win",
      label: "Kemenangan Kecil",
      description: `${miniVictoryCount} bab punya momen bangkit kecil.`,
      icon: "emoji_events",
      tone: "success",
    },
    {
      id: "ret-secret",
      label: "Jadwal Rahasia",
      description: `${reveals.length} rahasia dijadwalkan — detail internal tidak ditampilkan.`,
      icon: "lock",
      tone: "accent",
    },
    {
      id: "ret-unlock",
      label: "Hook Akhir Bab",
      description: `${hookCount} dari ${chapters.length} bab punya hook penutup.`,
      icon: "key",
      tone: "warning",
    },
  ];
}

export function mapOutlineBundleToUi(
  projectId: string,
  bundle: {
    outlinePlan: OutlinePlan | null;
    chapterOutlines: ChapterOutline[];
    openLoops: OpenLoop[];
    plannedReveals: PlannedRevealPublic[];
  },
): StoryOutline {
  const useDemoCopy = !isApiModeEnabled();
  const fallback = mockOutline;
  const plan = bundle.outlinePlan;
  const chapters = bundle.chapterOutlines.map(mapApiChapterToUi);
  const total = plan?.targetChapterCount ?? (chapters.length || (useDemoCopy ? 10 : 0));
  const statusKey = plan?.status ?? "draft";
  const isLocked = statusKey === "locked";

  return {
    projectId,
    seasonLabel: plan?.seasonLabel ?? (useDemoCopy ? fallback.seasonLabel : "Belum dibuat"),
    arcSummary: plan?.arcSummary ?? (useDemoCopy ? fallback.arcSummary : "Belum dibuat"),
    description:
      plan?.planningNotes?.trim() ||
      "Arah bab awal untuk membangun konflik dan daya tarik serial. Kamu bisa meninjau sebelum mulai menulis.",
    progress: {
      readyCount: chapters.length,
      totalCount: total,
      statusLabel: PLAN_STATUS_LABELS[statusKey] ?? "Rencana Bab",
      statusDescription: isLocked
        ? "Outline terkunci — siap lanjut ke ruang tulis."
        : "Outline ini masih bisa kamu sesuaikan sebelum dikunci.",
    },
    chapters,
    writeRoute: ROUTES.project.write(projectId),
    retentionHints: buildRetentionHints(
      bundle.chapterOutlines,
      bundle.openLoops,
      bundle.plannedReveals,
    ),
    pageCopy: useDemoCopy
      ? {
          ...fallback.pageCopy,
          planBadge: isLocked
            ? "Outline Terkunci"
            : (PLAN_STATUS_LABELS[statusKey] ?? fallback.pageCopy.planBadge),
          reviewNote: isLocked
            ? "Outline sudah dikunci. Edit rencana bab tidak tersedia."
            : fallback.pageCopy.reviewNote,
        }
      : {
          planBadge: isLocked
            ? "Outline Terkunci"
            : (PLAN_STATUS_LABELS[statusKey] ?? "Belum dibuat"),
          startWritingCta: isLocked ? "Buka Ruang Tulis" : "Kunci outline dulu",
          loadMoreCta: "Muat Bab Selanjutnya",
          loadMoreHint: "Bab tambahan tersedia setelah rencana outline dibuat.",
          reviewNote: isLocked
            ? "Outline sudah dikunci. Edit rencana bab tidak tersedia."
            : chapters.length > 0
              ? "Tinjau rencana bab sebelum dikunci."
              : "Belum ada rencana bab. Buat outline setelah fondasi dikunci.",
          retentionTitle: "Petunjuk Daya Tarik Serial",
          retentionSubtitle: "Ringkasan ringan — bukan skor otomatis.",
        },
  };
}

export interface UiOpenLoop {
  id: string;
  question: string;
  hint: string | null;
  statusLabel: string;
}

export interface UiPlannedReveal {
  id: string;
  title: string;
  hint: string | null;
  plannedChapterNumber: number | null;
  riskLabel: string;
  statusLabel: string;
}

const LOOP_STATUS_LABELS: Record<string, string> = {
  opened: "Dibuka",
  developed: "Berkembang",
  paid_off: "Terjawab",
  dropped: "Ditutup",
};

const REVEAL_STATUS_LABELS: Record<string, string> = {
  planned: "Direncanakan",
  armed: "Siap",
  revealed: "Terungkap",
  delayed: "Ditunda",
  cancelled: "Dibatalkan",
};

const RISK_LABELS: Record<string, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
};

export function mapOpenLoopsToUi(
  loops: OpenLoop[],
  _chapterNumberById: Map<string, number>,
): UiOpenLoop[] {
  return loops.map((loop) => ({
    id: loop.id,
    question: loop.question,
    hint: loop.readerFacingHint,
    statusLabel: LOOP_STATUS_LABELS[loop.status] ?? loop.status,
  }));
}

export function mapRevealsToUi(
  reveals: PlannedRevealPublic[],
  chapterNumberById: Map<string, number>,
): UiPlannedReveal[] {
  return reveals.map((reveal) => ({
    id: reveal.id,
    title: reveal.title,
    hint: reveal.readerFacingHint,
    plannedChapterNumber: reveal.plannedChapterOutlineId
      ? (chapterNumberById.get(reveal.plannedChapterOutlineId) ?? null)
      : null,
    riskLabel: RISK_LABELS[reveal.riskLevel] ?? reveal.riskLevel,
    statusLabel: REVEAL_STATUS_LABELS[reveal.status] ?? reveal.status,
  }));
}

export function formatOutlineWorkflowError(
  message: string,
  details?: unknown,
): string {
  const d = details as
    | { missing?: string[]; failedChecks?: string[]; readinessScore?: number }
    | undefined;
  const keys = [...(d?.missing ?? []), ...(d?.failedChecks ?? [])];
  const unique = [...new Set(keys)];
  const friendly = unique
    .map((key) => OUTLINE_LOCK_MISSING_LABELS[key] ?? key)
    .filter(Boolean);
  const parts = [message];
  if (friendly.length > 0) {
    parts.push(friendly.join(" · "));
  }
  if (typeof d?.readinessScore === "number") {
    parts.push(`Kesiapan: ${d.readinessScore}%`);
  }
  return parts.join(" — ");
}