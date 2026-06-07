/**
 * Sprint 2 domain enums — const objects + inferred union types.
 * User-facing quality modes: hemat / seimbang / terbaik only (no raw model IDs).
 */

// --- User / profile ---

export const USER_ROLES = {
  writer: "writer",
  admin: "admin",
} as const;
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const SUBSCRIPTION_PLANS = {
  free: "free",
  basic: "basic",
  pro: "pro",
} as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[keyof typeof SUBSCRIPTION_PLANS];

// --- Project ---

export const PROJECT_STATUSES = {
  draft: "draft",
  in_progress: "in_progress",
  published: "published",
} as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[keyof typeof PROJECT_STATUSES];

export const PROJECT_ENTRY_PATHS = {
  no_idea: "no_idea",
  rough_idea: "rough_idea",
  has_draft: "has_draft",
  has_outline: "has_outline",
  repair_only: "repair_only",
} as const;
export type ProjectEntryPath = (typeof PROJECT_ENTRY_PATHS)[keyof typeof PROJECT_ENTRY_PATHS];

/** User-facing: Mode Kualitas — not raw model ID or provider. */
export const WRITER_QUALITY_MODES = {
  hemat: "hemat",
  seimbang: "seimbang",
  terbaik: "terbaik",
} as const;
export type WriterQualityMode = (typeof WRITER_QUALITY_MODES)[keyof typeof WRITER_QUALITY_MODES];

export const DEFAULT_LANGUAGES = {
  id: "id",
  en: "en",
} as const;
export type DefaultLanguage = (typeof DEFAULT_LANGUAGES)[keyof typeof DEFAULT_LANGUAGES];

export const MOBILE_FORMAT_PREFERENCES = {
  hp_kbm: "hp_kbm",
  desktop: "desktop",
} as const;
export type MobileFormatPreference =
  (typeof MOBILE_FORMAT_PREFERENCES)[keyof typeof MOBILE_FORMAT_PREFERENCES];

export const OUTPUT_STYLE_PREFERENCES = {
  warm_emotional: "warm_emotional",
  fast_paced: "fast_paced",
  poetic: "poetic",
  conversational: "conversational",
  custom: "custom",
} as const;
export type OutputStylePreference =
  (typeof OUTPUT_STYLE_PREFERENCES)[keyof typeof OUTPUT_STYLE_PREFERENCES];

/** Placeholder for Sprint 4 target length planner. */
export const TARGET_LENGTH_PLANS = {
  short_30_50: "30_50",
  medium_70_100: "70_100",
  long_120_150: "120_150",
  epic_180_plus: "180_plus",
  suggest: "suggest",
} as const;
export type TargetLengthPlan = (typeof TARGET_LENGTH_PLANS)[keyof typeof TARGET_LENGTH_PLANS];

// --- Story foundation ---

export const FOUNDATION_STATUSES = {
  draft: "draft",
  in_review: "in_review",
  locked: "locked",
} as const;
export type FoundationStatus = (typeof FOUNDATION_STATUSES)[keyof typeof FOUNDATION_STATUSES];

/** User-facing readiness bands (Kesiapan Fondasi). */
export const FOUNDATION_READINESS_LEVELS = {
  belum_siap: "belum_siap",
  bisa_lanjut: "bisa_lanjut",
  siap_dikunci: "siap_dikunci",
} as const;
export type FoundationReadinessLevel =
  (typeof FOUNDATION_READINESS_LEVELS)[keyof typeof FOUNDATION_READINESS_LEVELS];

export const STORY_GENRES = {
  drama_domestic: "drama_domestic",
  romance: "romance",
  mystery: "mystery",
  fantasy: "fantasy",
  thriller: "thriller",
  other: "other",
} as const;
export type StoryGenre = (typeof STORY_GENRES)[keyof typeof STORY_GENRES];

export const READER_TARGETS = {
  hp_serial: "hp_serial",
  young_adult: "young_adult",
  general: "general",
  female_lead: "female_lead",
  other: "other",
} as const;
export type ReaderTarget = (typeof READER_TARGETS)[keyof typeof READER_TARGETS];

// --- Character ---

export const CHARACTER_ROLES = {
  protagonist: "protagonist",
  antagonist: "antagonist",
  supporting: "supporting",
  minor: "minor",
  other: "other",
} as const;
export type CharacterRole = (typeof CHARACTER_ROLES)[keyof typeof CHARACTER_ROLES];

export const CHARACTER_STATUSES = {
  active: "active",
  archived: "archived",
} as const;
export type CharacterStatus = (typeof CHARACTER_STATUSES)[keyof typeof CHARACTER_STATUSES];

export const CHARACTER_SOURCES = {
  user: "user",
  system_seed: "system_seed",
  accepted_proposal: "accepted_proposal",
} as const;
export type CharacterSource = (typeof CHARACTER_SOURCES)[keyof typeof CHARACTER_SOURCES];

// --- Facts (confirmed canon only in `facts` table) ---

export const FACT_CATEGORIES = {
  identity: "identity",
  relationship: "relationship",
  family: "family",
  event: "event",
  secret: "secret",
  motive: "motive",
  location: "location",
  item: "item",
  world_rule: "world_rule",
  timeline: "timeline",
  status: "status",
  promise: "promise",
} as const;
export type FactCategory = (typeof FACT_CATEGORIES)[keyof typeof FACT_CATEGORIES];

/** Facts table holds confirmed canon; proposed AI facts live in ai_proposals. */
export const FACT_CANON_STATUSES = {
  confirmed: "confirmed",
  deprecated: "deprecated",
} as const;
export type FactCanonStatus = (typeof FACT_CANON_STATUSES)[keyof typeof FACT_CANON_STATUSES];

/**
 * Allowed sources for rows in `facts`.
 * AI raw output must NOT use these — use ai_proposals first.
 */
export const FACT_SOURCES = {
  user: "user",
  system: "system",
  accepted_proposal: "accepted_proposal",
  /** Sprint 10+ — inactive in Sprint 2 */
  imported_draft: "imported_draft",
} as const;
export type FactSource = (typeof FACT_SOURCES)[keyof typeof FACT_SOURCES];

export const FACT_IMPORTANCE = {
  minor: "minor",
  major: "major",
  core: "core",
} as const;
export type FactImportance = (typeof FACT_IMPORTANCE)[keyof typeof FACT_IMPORTANCE];

// --- Relationship speech rules (user-facing: Panggilan & Gaya Bicara) ---

export const SPEECH_RULE_STATUSES = {
  active: "active",
  draft: "draft",
  deprecated: "deprecated",
} as const;
export type SpeechRuleStatus = (typeof SPEECH_RULE_STATUSES)[keyof typeof SPEECH_RULE_STATUSES];

export const SPEECH_RULE_SOURCES = {
  user: "user",
  accepted_proposal: "accepted_proposal",
} as const;
export type SpeechRuleSource = (typeof SPEECH_RULE_SOURCES)[keyof typeof SPEECH_RULE_SOURCES];

// --- AI proposals ---

export const AI_PROPOSAL_STATUSES = {
  proposed: "proposed",
  accepted: "accepted",
  rejected: "rejected",
  merged: "merged",
} as const;
export type AiProposalStatus = (typeof AI_PROPOSAL_STATUSES)[keyof typeof AI_PROPOSAL_STATUSES];

export const AI_PROPOSAL_TYPES = {
  character: "character",
  fact: "fact",
  relationship_speech_rule: "relationship_speech_rule",
  secret: "secret",
  reveal: "reveal",
  style: "style",
  foundation: "foundation",
  chapter_delta: "chapter_delta",
} as const;
export type AiProposalType = (typeof AI_PROPOSAL_TYPES)[keyof typeof AI_PROPOSAL_TYPES];

export const AI_PROPOSAL_RISK_LEVELS = {
  low: "low",
  medium: "medium",
  high: "high",
} as const;
export type AiProposalRiskLevel =
  (typeof AI_PROPOSAL_RISK_LEVELS)[keyof typeof AI_PROPOSAL_RISK_LEVELS];

export const AI_PROPOSAL_SOURCES = {
  user_manual: "user_manual",
  system_seed: "system_seed",
  /** Sprint 3+ — inactive in Sprint 2 */
  ai_chat: "ai_chat",
  ai_foundation: "ai_foundation",
  ai_import: "ai_import",
} as const;
export type AiProposalSource = (typeof AI_PROPOSAL_SOURCES)[keyof typeof AI_PROPOSAL_SOURCES];

/** High-risk fact categories — must go through ai_proposals with risk_level high. */
export const HIGH_RISK_FACT_CATEGORIES = {
  kehamilan: "kehamilan",
  anak: "anak",
  kematian: "kematian",
  hubungan_keluarga: "hubungan_keluarga",
  masa_lalu_romantis: "masa_lalu_romantis",
  rahasia_besar: "rahasia_besar",
  benda_penting: "benda_penting",
  status_nikah_hukum: "status_nikah_hukum",
} as const;
export type HighRiskFactCategory =
  (typeof HIGH_RISK_FACT_CATEGORIES)[keyof typeof HIGH_RISK_FACT_CATEGORIES];

export const HIGH_RISK_FACT_CATEGORY_LIST: readonly HighRiskFactCategory[] = Object.values(
  HIGH_RISK_FACT_CATEGORIES,
);

// --- Sprint 3: intake → concepts flow (not canon) ---

export const WORKFLOW_PHASES = {
  intake: "intake",
  concepts: "concepts",
  foundation: "foundation",
  foundation_locked: "foundation_locked",
} as const;
export type WorkflowPhase = (typeof WORKFLOW_PHASES)[keyof typeof WORKFLOW_PHASES];

export const INTAKE_SESSION_STATUSES = {
  active: "active",
  completed: "completed",
  abandoned: "abandoned",
} as const;
export type IntakeSessionStatus =
  (typeof INTAKE_SESSION_STATUSES)[keyof typeof INTAKE_SESSION_STATUSES];

export const INTAKE_PHASES = {
  idea_collection: "idea_collection",
  signal_detection: "signal_detection",
  concept_generation: "concept_generation",
  foundation_preparation: "foundation_preparation",
} as const;
export type IntakePhase = (typeof INTAKE_PHASES)[keyof typeof INTAKE_PHASES];

export const INTAKE_MESSAGE_ROLES = {
  user: "user",
  agent: "agent",
  system: "system",
} as const;
export type IntakeMessageRole =
  (typeof INTAKE_MESSAGE_ROLES)[keyof typeof INTAKE_MESSAGE_ROLES];

export const DETECTED_SIGNAL_TYPES = {
  genre: "genre",
  target_reader: "target_reader",
  protagonist: "protagonist",
  antagonist: "antagonist",
  core_conflict: "core_conflict",
  reader_promise: "reader_promise",
  tone: "tone",
  secret_candidate: "secret_candidate",
  relationship_dynamic: "relationship_dynamic",
  setting: "setting",
  theme: "theme",
  style_preference: "style_preference",
} as const;
export type DetectedSignalType =
  (typeof DETECTED_SIGNAL_TYPES)[keyof typeof DETECTED_SIGNAL_TYPES];

export const DETECTED_SIGNAL_STATUSES = {
  detected: "detected",
  confirmed: "confirmed",
  dismissed: "dismissed",
} as const;
export type DetectedSignalStatus =
  (typeof DETECTED_SIGNAL_STATUSES)[keyof typeof DETECTED_SIGNAL_STATUSES];

/** Concept options are not canon — selection does not write to facts. */
export const STORY_CONCEPT_STATUSES = {
  proposed: "proposed",
  selected: "selected",
  rejected: "rejected",
} as const;
export type StoryConceptStatus =
  (typeof STORY_CONCEPT_STATUSES)[keyof typeof STORY_CONCEPT_STATUSES];

export const STORY_CONCEPT_SOURCES = {
  user: "user",
  system: "system",
  stub: "stub",
  accepted_proposal: "accepted_proposal",
} as const;
export type StoryConceptSource =
  (typeof STORY_CONCEPT_SOURCES)[keyof typeof STORY_CONCEPT_SOURCES];

// --- Credit balance (display/seed only in Sprint 2) ---

export const CREDIT_BALANCE_SOURCES = {
  seed: "seed",
  admin_grant: "admin_grant",
  /** Sprint 8+ — ledger-backed adjustments */
  ledger: "ledger",
} as const;
export type CreditBalanceSource =
  (typeof CREDIT_BALANCE_SOURCES)[keyof typeof CREDIT_BALANCE_SOURCES];