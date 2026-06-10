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
  /** Sprint 6 — open loop status change candidate from chapter delta */
  open_loop_update: "open_loop_update",
  /** Sprint 6 — reveal status change candidate from chapter delta */
  reveal_status_update: "reveal_status_update",
  /** Sprint 6 — existing character state/description change candidate */
  character_update: "character_update",
  /** Sprint 6 — relationship dynamic change candidate */
  relationship_update: "relationship_update",
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
  /** Sprint 6 — deterministic summary stub extractor */
  summary_stub: "summary_stub",
  /** Sprint 6 — deterministic chapter delta stub extractor */
  chapter_delta_stub: "chapter_delta_stub",
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
  outline: "outline",
  outline_locked: "outline_locked",
  /** Sprint 5 — user actively writing a chapter (optional routing; gate remains outline_locked). */
  writing: "writing",
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

// --- Sprint 4: outline planning (not prose — planner may know future; writer slice-only later) ---

export const OUTLINE_PLAN_STATUSES = {
  draft: "draft",
  generated: "generated",
  reviewing: "reviewing",
  locked: "locked",
} as const;
export type OutlinePlanStatus =
  (typeof OUTLINE_PLAN_STATUSES)[keyof typeof OUTLINE_PLAN_STATUSES];

export const CHAPTER_OUTLINE_STATUSES = {
  planned: "planned",
  reviewing: "reviewing",
  approved: "approved",
  locked: "locked",
} as const;
export type ChapterOutlineStatus =
  (typeof CHAPTER_OUTLINE_STATUSES)[keyof typeof CHAPTER_OUTLINE_STATUSES];

export const CHAPTER_FUNCTIONS = {
  setup: "setup",
  conflict: "conflict",
  escalation: "escalation",
  emotional_turn: "emotional_turn",
  mini_victory: "mini_victory",
  reveal: "reveal",
  cliffhanger: "cliffhanger",
  payoff: "payoff",
  transition: "transition",
} as const;
export type ChapterFunction = (typeof CHAPTER_FUNCTIONS)[keyof typeof CHAPTER_FUNCTIONS];

export const CHAPTER_EMOTIONS = {
  hurt: "hurt",
  tense: "tense",
  angry: "angry",
  hopeful: "hopeful",
  satisfying: "satisfying",
  curious: "curious",
  anxious: "anxious",
  triumphant: "triumphant",
} as const;
export type ChapterEmotion = (typeof CHAPTER_EMOTIONS)[keyof typeof CHAPTER_EMOTIONS];

export const OPEN_LOOP_STATUSES = {
  opened: "opened",
  developed: "developed",
  paid_off: "paid_off",
  dropped: "dropped",
} as const;
export type OpenLoopStatus = (typeof OPEN_LOOP_STATUSES)[keyof typeof OPEN_LOOP_STATUSES];

export const PLANNED_REVEAL_STATUSES = {
  planned: "planned",
  armed: "armed",
  revealed: "revealed",
  delayed: "delayed",
  cancelled: "cancelled",
} as const;
export type PlannedRevealStatus =
  (typeof PLANNED_REVEAL_STATUSES)[keyof typeof PLANNED_REVEAL_STATUSES];

export const REVEAL_RISK_LEVELS = {
  low: "low",
  medium: "medium",
  high: "high",
} as const;
export type RevealRiskLevel = (typeof REVEAL_RISK_LEVELS)[keyof typeof REVEAL_RISK_LEVELS];

export const RETENTION_MARKER_TYPES = {
  hook: "hook",
  mini_victory: "mini_victory",
  open_loop: "open_loop",
  cliffhanger: "cliffhanger",
  emotional_payoff: "emotional_payoff",
  reversal: "reversal",
  secret_hint: "secret_hint",
} as const;
export type RetentionMarkerType =
  (typeof RETENTION_MARKER_TYPES)[keyof typeof RETENTION_MARKER_TYPES];

// --- Sprint 5: write room (draft prose — NOT canon until Sprint 6 summary) ---

export const WRITING_SESSION_STATUSES = {
  active: "active",
  paused: "paused",
  ready_for_summary: "ready_for_summary",
  completed: "completed",
  abandoned: "abandoned",
} as const;
export type WritingSessionStatus =
  (typeof WRITING_SESSION_STATUSES)[keyof typeof WRITING_SESSION_STATUSES];

export const CHAPTER_WRITING_STATUSES = {
  not_started: "not_started",
  drafting: "drafting",
  ready_for_summary: "ready_for_summary",
  summarized: "summarized",
} as const;
export type ChapterWritingStatus =
  (typeof CHAPTER_WRITING_STATUSES)[keyof typeof CHAPTER_WRITING_STATUSES];

export const CHAPTER_BEAT_STATUSES = {
  empty: "empty",
  draft: "draft",
  done: "done",
} as const;
export type ChapterBeatStatus =
  (typeof CHAPTER_BEAT_STATUSES)[keyof typeof CHAPTER_BEAT_STATUSES];

export const CHAPTER_PROSE_SOURCES = {
  user_edited: "user_edited",
  stub_deterministic: "stub_deterministic",
  /** Reserved for future AI generation — not approval for OpenRouter in Sprint 5. */
  ai_generated: "ai_generated",
} as const;
export type ChapterProseSource =
  (typeof CHAPTER_PROSE_SOURCES)[keyof typeof CHAPTER_PROSE_SOURCES];

/** Context Packet builder version identifiers (string const — not a DB enum). */
export const CONTEXT_PACKET_BUILDER_VERSIONS = {
  v1_stub: "context_packet_v1_stub",
} as const;
export type ContextPacketBuilderVersion =
  (typeof CONTEXT_PACKET_BUILDER_VERSIONS)[keyof typeof CONTEXT_PACKET_BUILDER_VERSIONS];

// --- Sprint 6: chapter summary & delta (NOT canon — proposals required for canon changes) ---

/** Chapter summary lifecycle — approving summary does NOT auto-accept proposals. */
export const CHAPTER_SUMMARY_STATUSES = {
  draft: "draft",
  generated: "generated",
  reviewing: "reviewing",
  approved: "approved",
  superseded: "superseded",
} as const;
export type ChapterSummaryStatus =
  (typeof CHAPTER_SUMMARY_STATUSES)[keyof typeof CHAPTER_SUMMARY_STATUSES];

/** Chapter delta artifact lifecycle — delta_json is not canon. */
export const CHAPTER_DELTA_STATUSES = {
  generated: "generated",
  reviewing: "reviewing",
  approved: "approved",
  superseded: "superseded",
} as const;
export type ChapterDeltaStatus =
  (typeof CHAPTER_DELTA_STATUSES)[keyof typeof CHAPTER_DELTA_STATUSES];

/** Normalized summary line items for SummaryPage parity — review hints, not canon. */
export const CHAPTER_SUMMARY_ITEM_TYPES = {
  synopsis: "synopsis",
  mini_victory: "mini_victory",
  character_change: "character_change",
  relationship_change: "relationship_change",
  new_fact_candidate: "new_fact_candidate",
  open_loop_opened: "open_loop_opened",
  open_loop_paid_off: "open_loop_paid_off",
  reveal_candidate: "reveal_candidate",
  emotional_outcome: "emotional_outcome",
  ending_hook: "ending_hook",
  continuity_note: "continuity_note",
  safety_flag: "safety_flag",
} as const;
export type ChapterSummaryItemType =
  (typeof CHAPTER_SUMMARY_ITEM_TYPES)[keyof typeof CHAPTER_SUMMARY_ITEM_TYPES];

export const CHAPTER_SUMMARY_ITEM_SEVERITIES = {
  info: "info",
  warning: "warning",
  high_risk: "high_risk",
} as const;
export type ChapterSummaryItemSeverity =
  (typeof CHAPTER_SUMMARY_ITEM_SEVERITIES)[keyof typeof CHAPTER_SUMMARY_ITEM_SEVERITIES];

/** Junction status linking a summary batch to ai_proposals queue items. */
export const CHAPTER_SUMMARY_PROPOSAL_STATUSES = {
  linked: "linked",
  accepted: "accepted",
  rejected: "rejected",
  superseded: "superseded",
} as const;
export type ChapterSummaryProposalStatus =
  (typeof CHAPTER_SUMMARY_PROPOSAL_STATUSES)[keyof typeof CHAPTER_SUMMARY_PROPOSAL_STATUSES];

/** Chapter delta extractor version identifiers (string const — aligns DB default). */
export const CHAPTER_DELTA_EXTRACTOR_VERSIONS = {
  v1_stub: "chapter_delta_v1_stub",
} as const;
export type ChapterDeltaExtractorVersion =
  (typeof CHAPTER_DELTA_EXTRACTOR_VERSIONS)[keyof typeof CHAPTER_DELTA_EXTRACTOR_VERSIONS];

// --- Sprint 7: publish package (export artifact — NOT canon, NOT auto-post KBM) ---

/** Publish package lifecycle — exported is local marker only, not platform publish. */
export const PUBLISH_PACKAGE_STATUSES = {
  draft: "draft",
  ready: "ready",
  exported: "exported",
  superseded: "superseded",
} as const;
export type PublishPackageStatus =
  (typeof PUBLISH_PACKAGE_STATUSES)[keyof typeof PUBLISH_PACKAGE_STATUSES];

/** Fixed MVP checklist item ids — parity PublishPage mock labels. */
export const PUBLISH_CHECKLIST_ITEM_IDS = {
  chk_teaser: "chk_teaser",
  chk_caption: "chk_caption",
  chk_tags: "chk_tags",
  chk_question: "chk_question",
  chk_preview: "chk_preview",
} as const;
export type PublishChecklistItemId =
  (typeof PUBLISH_CHECKLIST_ITEM_IDS)[keyof typeof PUBLISH_CHECKLIST_ITEM_IDS];

/** Publish package generator version (text column in DB — string const, not PostgreSQL enum). */
export const PUBLISH_PACKAGE_GENERATOR_VERSIONS = {
  v1_stub: "publish_stub_v1",
} as const;
export type PublishPackageGeneratorVersion =
  (typeof PUBLISH_PACKAGE_GENERATOR_VERSIONS)[keyof typeof PUBLISH_PACKAGE_GENERATOR_VERSIONS];

// --- Audit logs (align migration 00001 + 00007) ---

export const AUDIT_ACTIONS = {
  project_created: "project_created",
  project_updated: "project_updated",
  settings_updated: "settings_updated",
  foundation_created: "foundation_created",
  foundation_updated: "foundation_updated",
  foundation_locked: "foundation_locked",
  character_created: "character_created",
  character_updated: "character_updated",
  fact_created: "fact_created",
  fact_updated: "fact_updated",
  fact_deprecated: "fact_deprecated",
  speech_rule_created: "speech_rule_created",
  speech_rule_updated: "speech_rule_updated",
  ai_proposal_created: "ai_proposal_created",
  ai_proposal_accepted: "ai_proposal_accepted",
  ai_proposal_rejected: "ai_proposal_rejected",
  ai_proposal_merged: "ai_proposal_merged",
  credit_balance_seeded: "credit_balance_seeded",
  intake_session_created: "intake_session_created",
  intake_message_created: "intake_message_created",
  detected_signal_created: "detected_signal_created",
  detected_signal_updated: "detected_signal_updated",
  story_concepts_generated: "story_concepts_generated",
  story_concept_selected: "story_concept_selected",
  foundation_proposals_generated: "foundation_proposals_generated",
  foundation_proposal_accepted: "foundation_proposal_accepted",
  foundation_lock_started: "foundation_lock_started",
  foundation_lock_failed: "foundation_lock_failed",
  outline_generated: "outline_generated",
  chapter_outline_updated: "chapter_outline_updated",
  open_loop_updated: "open_loop_updated",
  planned_reveal_updated: "planned_reveal_updated",
  outline_approved: "outline_approved",
  outline_locked: "outline_locked",
  writing_session_started: "writing_session_started",
  writing_session_updated: "writing_session_updated",
  chapter_beats_generated: "chapter_beats_generated",
  chapter_beat_updated: "chapter_beat_updated",
  prose_version_created: "prose_version_created",
  prose_version_made_current: "prose_version_made_current",
  context_packet_built: "context_packet_built",
  chapter_ready_for_summary: "chapter_ready_for_summary",
  chapter_summary_generated: "chapter_summary_generated",
  chapter_delta_extracted: "chapter_delta_extracted",
  chapter_summary_approved: "chapter_summary_approved",
  summary_proposal_linked: "summary_proposal_linked",
  summary_proposal_accepted: "summary_proposal_accepted",
  summary_proposal_rejected: "summary_proposal_rejected",
  canon_promotion_applied: "canon_promotion_applied",
  canon_promotion_failed: "canon_promotion_failed",
  publish_package_generated: "publish_package_generated",
  publish_package_updated: "publish_package_updated",
  publish_checklist_updated: "publish_checklist_updated",
  publish_package_exported: "publish_package_exported",
  publish_package_regenerated: "publish_package_regenerated",
  generation_attempt_created: "generation_attempt_created",
  generation_attempt_succeeded: "generation_attempt_succeeded",
  generation_attempt_failed: "generation_attempt_failed",
  credit_debited: "credit_debited",
  credit_refunded: "credit_refunded",
  ai_output_persisted: "ai_output_persisted",
  credit_topup_checkout_created: "credit_topup_checkout_created",
  payment_invoice_created: "payment_invoice_created",
  payment_webhook_received: "payment_webhook_received",
  payment_webhook_processed: "payment_webhook_processed",
  payment_webhook_failed: "payment_webhook_failed",
  credit_topup_granted: "credit_topup_granted",
  credit_topup_grant_failed: "credit_topup_grant_failed",
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITY_TYPES = {
  profile: "profile",
  project: "project",
  project_settings: "project_settings",
  story_foundation: "story_foundation",
  character: "character",
  fact: "fact",
  relationship_speech_rule: "relationship_speech_rule",
  ai_proposal: "ai_proposal",
  credit_balance: "credit_balance",
  intake_session: "intake_session",
  intake_message: "intake_message",
  detected_signal: "detected_signal",
  story_concept: "story_concept",
  outline_plan: "outline_plan",
  chapter_outline: "chapter_outline",
  open_loop: "open_loop",
  planned_reveal: "planned_reveal",
  writing_session: "writing_session",
  chapter_beat: "chapter_beat",
  chapter_prose_version: "chapter_prose_version",
  context_packet_log: "context_packet_log",
  chapter_summary: "chapter_summary",
  chapter_delta: "chapter_delta",
  chapter_summary_proposal: "chapter_summary_proposal",
  publish_package: "publish_package",
  generation_attempt: "generation_attempt",
  credit_ledger_entry: "credit_ledger_entry",
  credit_topup_product: "credit_topup_product",
  credit_topup_order: "credit_topup_order",
  payment_webhook_event: "payment_webhook_event",
} as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];

// --- Sprint 8: AI generation attempts + credit ledger (schema only in 8.1) ---

export const GENERATION_TYPES = {
  prose_beat: "prose_beat",
  prose_rewrite: "prose_rewrite",
  publish_copy: "publish_copy",
  /** Reserved — summary/delta AI deferred beyond Sprint 8 MVP */
  summary_delta: "summary_delta",
} as const;
export type GenerationType = (typeof GENERATION_TYPES)[keyof typeof GENERATION_TYPES];

export const GENERATION_STATUSES = {
  pending: "pending",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
} as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[keyof typeof GENERATION_STATUSES];

/** Append-only ledger direction — amount is always positive magnitude. */
export const CREDIT_LEDGER_DIRECTIONS = {
  debit: "debit",
  credit: "credit",
  refund: "refund",
} as const;
export type CreditLedgerDirection =
  (typeof CREDIT_LEDGER_DIRECTIONS)[keyof typeof CREDIT_LEDGER_DIRECTIONS];

// --- Credit balance (display/seed only in Sprint 2) ---

export const CREDIT_BALANCE_SOURCES = {
  seed: "seed",
  admin_grant: "admin_grant",
  /** Sprint 8+ — ledger-backed adjustments */
  ledger: "ledger",
} as const;
export type CreditBalanceSource =
  (typeof CREDIT_BALANCE_SOURCES)[keyof typeof CREDIT_BALANCE_SOURCES];

// --- Sprint 10: payment topup (schema Task 10.1 — checkout/webhook Task 10.2+) ---

export const CREDIT_TOPUP_ORDER_STATUSES = {
  pending: "pending",
  paid: "paid",
  expired: "expired",
  failed: "failed",
  cancelled: "cancelled",
} as const;
export type CreditTopupOrderStatus =
  (typeof CREDIT_TOPUP_ORDER_STATUSES)[keyof typeof CREDIT_TOPUP_ORDER_STATUSES];

export const PAYMENT_WEBHOOK_PROCESSING_STATUSES = {
  received: "received",
  processed: "processed",
  ignored: "ignored",
  failed: "failed",
} as const;
export type PaymentWebhookProcessingStatus =
  (typeof PAYMENT_WEBHOOK_PROCESSING_STATUSES)[keyof typeof PAYMENT_WEBHOOK_PROCESSING_STATUSES];

export const PAYMENT_PROVIDERS = {
  mayar: "mayar",
  duitku: "duitku",
  mock: "mock",
} as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];

export const CREDIT_TOPUP_PRODUCT_SLUGS = {
  starter: "starter",
  creator: "creator",
  pro: "pro",
  studio: "studio",
} as const;
export type CreditTopupProductSlug =
  (typeof CREDIT_TOPUP_PRODUCT_SLUGS)[keyof typeof CREDIT_TOPUP_PRODUCT_SLUGS];

/** Ledger reasons for topup grants (direction=credit) — writers in Task 10.3 */
export const CREDIT_LEDGER_TOPUP_REASONS = {
  credit_topup: "credit_topup",
  welcome_bonus: "welcome_bonus",
} as const;
export type CreditLedgerTopupReason =
  (typeof CREDIT_LEDGER_TOPUP_REASONS)[keyof typeof CREDIT_LEDGER_TOPUP_REASONS];