import type {
  AiProposalRiskLevel,
  AiProposalSource,
  AiProposalStatus,
  AiProposalType,
  ChapterEmotion,
  ChapterFunction,
  ChapterBeatStatus,
  ChapterDeltaExtractorVersion,
  ChapterDeltaStatus,
  ChapterOutlineStatus,
  ChapterProseSource,
  ChapterSummaryItemSeverity,
  ChapterSummaryItemType,
  ChapterSummaryProposalStatus,
  ChapterSummaryStatus,
  ChapterWritingStatus,
  PublishChecklistItemId,
  PublishPackageGeneratorVersion,
  PublishPackageStatus,
  CharacterRole,
  CharacterSource,
  CharacterStatus,
  ContextPacketBuilderVersion,
  CreditBalanceSource,
  CreditLedgerDirection,
  GenerationStatus,
  GenerationType,
  DefaultLanguage,
  DetectedSignalStatus,
  DetectedSignalType,
  FactCanonStatus,
  FactCategory,
  FactImportance,
  FactSource,
  FoundationReadinessLevel,
  FoundationStatus,
  IntakeMessageRole,
  IntakePhase,
  IntakeSessionStatus,
  MobileFormatPreference,
  OpenLoopStatus,
  OutlinePlanStatus,
  PlannedRevealStatus,
  ProjectEntryPath,
  ProjectStatus,
  ReaderTarget,
  RevealRiskLevel,
  RetentionMarkerType,
  SpeechRuleSource,
  SpeechRuleStatus,
  StoryConceptSource,
  StoryConceptStatus,
  StoryGenre,
  SubscriptionPlan,
  TargetLengthPlan,
  UserRole,
  WorkflowPhase,
  WriterQualityMode,
  WritingSessionStatus,
} from "./enums.js";
import type { ID, ISODateTime, JsonObject, Timestamps } from "./utils.js";

// --- User / profile ---

export interface UserProfile extends Timestamps {
  id: ID;
  displayName: string;
  email: string;
  defaultLanguage: DefaultLanguage;
  /** Display-only plan label (e.g. "Free Plan") — not billing state in Sprint 2. */
  planLabel: string;
  role?: UserRole;
  subscriptionPlan?: SubscriptionPlan;
}

// --- Project ---

export interface Project extends Timestamps {
  id: ID;
  ownerId: ID;
  title: string;
  genre: StoryGenre | string | null;
  status: ProjectStatus;
  currentChapter: number;
  entryPath: ProjectEntryPath | null;
  isActive: boolean;
  lastEditedAt: ISODateTime;
  /** Sprint 3 — selected concept pointer; not canon. */
  selectedConceptId?: ID | null;
  /** Sprint 3+ — workflow routing through outline lock. */
  workflowPhase?: WorkflowPhase;
}

export interface ProjectSettings extends Timestamps {
  id: ID;
  projectId: ID;
  /** User-facing Mode Kualitas — hemat / seimbang / terbaik only. */
  qualityTier: WriterQualityMode;
  defaultOutputStyle: string;
  defaultFormat: MobileFormatPreference;
  /** Placeholder for Sprint 4 length planner. */
  targetLengthBand: TargetLengthPlan | null;
}

// --- Story foundation ---

export interface FoundationReadinessCheck {
  percent: number;
  level: FoundationReadinessLevel;
  missingItems: string[];
  canProceed: boolean;
  canLock: boolean;
}

export interface StoryFoundation extends Timestamps {
  id: ID;
  projectId: ID;
  premise: string;
  mainConflict: string;
  readerPromise: string;
  tone: string | null;
  genre: StoryGenre | string | null;
  targetReader: ReaderTarget | string | null;
  /** User-facing: Rahasia Cerita preview — not raw reveal truth. */
  storySecretsPreview: string | null;
  styleTags: string[];
  readinessPercent: number;
  readinessStatus: FoundationReadinessLevel;
  status: FoundationStatus;
  isLocked: boolean;
  lockedAt: ISODateTime | null;
}

// --- Character ---

export type CharacterImportance = "main" | "supporting" | "minor";

export interface Character extends Timestamps {
  id: ID;
  projectId: ID;
  name: string;
  /** User-facing role label (e.g. Tokoh Utama, Suami). */
  roleLabel: string;
  role: CharacterRole;
  description: string;
  importance: CharacterImportance;
  status: CharacterStatus;
  source: CharacterSource;
  sortOrder: number;
}

// --- Facts (confirmed canon only — AI output must go through ai_proposals) ---

export interface Fact extends Timestamps {
  id: ID;
  projectId: ID;
  text: string;
  category: FactCategory;
  importance: FactImportance;
  /** Facts table holds confirmed canon; proposed facts live in ai_proposals. */
  canonStatus: FactCanonStatus;
  /** User-facing: Fakta yang Dikunci */
  isLocked: boolean;
  source: FactSource;
  acceptedFromProposalId: ID | null;
}

// --- Relationship speech rules (internal: relationship_speech_rules; UI: Panggilan & Gaya Bicara) ---

export interface RelationshipSpeechRule extends Timestamps {
  id: ID;
  projectId: ID;
  relationshipLabel: string;
  characterAId: ID | null;
  characterBId: ID | null;
  ruleText: string;
  examples: string[] | null;
  status: SpeechRuleStatus;
  source: SpeechRuleSource;
}

// --- AI proposals (canon promotion queue — never write AI output directly to facts) ---

export interface AiProposal extends Timestamps {
  id: ID;
  projectId: ID;
  proposalType: AiProposalType;
  status: AiProposalStatus;
  riskLevel: AiProposalRiskLevel;
  source: AiProposalSource;
  title: string;
  payload: JsonObject;
  reviewNote: string | null;
  reviewedAt: ISODateTime | null;
  reviewedBy: ID | null;
  mergedIntoId: ID | null;
  resultFactId: ID | null;
  resultCharacterId: ID | null;
}

// --- Credit balance (display/seed only in Sprint 2 — no ledger) ---

export interface CreditBalance {
  id: ID;
  userId: ID;
  balance: number;
  monthlyQuota: number;
  monthlyUsed: number;
  resetAt: string | null;
  source: CreditBalanceSource;
  updatedAt: ISODateTime;
}

/**
 * One idempotent AI generation lifecycle row.
 * promptHash only — never raw prompt. metadata must not contain packet_json,
 * planningTruth, raw prompt, provider secret, or raw prose.
 */
export interface GenerationAttempt extends Timestamps {
  id: ID;
  projectId: ID;
  userId: ID;
  chapterOutlineId: ID | null;
  beatId: ID | null;
  writingSessionId: ID | null;
  generationType: GenerationType;
  status: GenerationStatus;
  idempotencyKey: string;
  provider: string | null;
  model: string | null;
  promptHash: string | null;
  contextPacketLogId: ID | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  creditCost: number;
  errorCode: string | null;
  errorMessageSafe: string | null;
  outputEntityType: string | null;
  outputEntityId: ID | null;
  metadata: JsonObject;
}

/**
 * Append-only credit mutation trail — amount always positive; direction sets semantics.
 * metadata must not store raw prompt, provider secret, or prose.
 */
export interface CreditLedgerEntry {
  id: ID;
  userId: ID;
  projectId: ID | null;
  attemptId: ID | null;
  amount: number;
  direction: CreditLedgerDirection;
  reason: string;
  balanceAfter: number;
  metadata: JsonObject;
  createdAt: ISODateTime;
}

// --- Sprint 3: intake & concepts (not canon — no direct writes to facts) ---

export interface IntakeSession extends Timestamps {
  id: ID;
  projectId: ID;
  status: IntakeSessionStatus;
  phase: IntakePhase;
  progressPercent: number;
  summary: string | null;
  metadata: JsonObject;
}

/** Chat messages during intake — not canon. */
export interface IntakeMessage {
  id: ID;
  projectId: ID;
  sessionId: ID;
  role: IntakeMessageRole;
  content: string;
  metadata: JsonObject;
  createdAt: ISODateTime;
}

/** Extracted signals from intake — not canon until promoted via proposals. */
export interface DetectedSignal extends Timestamps {
  id: ID;
  projectId: ID;
  sessionId: ID | null;
  type: DetectedSignalType;
  label: string;
  value: string;
  confidence: number | null;
  status: DetectedSignalStatus;
  sourceMessageId: ID | null;
  metadata: JsonObject;
}

/** Concept options — not canon; selection does not lock foundation or write facts. */
export interface StoryConcept extends Timestamps {
  id: ID;
  projectId: ID;
  title: string;
  shortPitch: string;
  readerPromise: string | null;
  coreConflict: string | null;
  genre: string | null;
  tone: string | null;
  targetReader: string | null;
  status: StoryConceptStatus;
  source: StoryConceptSource;
  score: number | null;
  payload: JsonObject;
}

// --- Sprint 4: outline planning (NOT prose — beat_contracts/prose_versions deferred Sprint 5+) ---

/** Retention marker on a chapter outline row (maps to UI badges). */
export interface ChapterOutlineMarker {
  type: RetentionMarkerType;
  label?: string;
}

/**
 * Outline plan for a project batch (e.g. chapters 1–10).
 * Planning artifact only — not accepted prose.
 */
export interface OutlinePlan extends Timestamps {
  id: ID;
  projectId: ID;
  status: OutlinePlanStatus;
  seasonLabel: string;
  arcSummary: string | null;
  retentionSummary: string | null;
  targetChapterCount: number;
  planningNotes: string | null;
  metadata: JsonObject;
  lockedAt: ISODateTime | null;
}

/**
 * Chapter outline row — planner may reference future plot.
 * Writer context (Sprint 5+) must receive slice-only fields for the active chapter.
 */
export interface ChapterOutline extends Timestamps {
  id: ID;
  projectId: ID;
  outlinePlanId: ID;
  chapterNumber: number;
  title: string;
  summary: string;
  purpose: string | null;
  chapterFunction: ChapterFunction;
  emotionalDirection: ChapterEmotion | null;
  hook: string | null;
  endingHook: string | null;
  miniVictory: string | null;
  povCharacterId: ID | null;
  status: ChapterOutlineStatus;
  markers: ChapterOutlineMarker[];
  metadata: JsonObject;
}

/** Reader question tracked across chapters — status changes do not mutate facts. */
export interface OpenLoop extends Timestamps {
  id: ID;
  projectId: ID;
  outlinePlanId: ID;
  openedInChapterOutlineId: ID | null;
  payoffChapterOutlineId: ID | null;
  question: string;
  readerFacingHint: string | null;
  status: OpenLoopStatus;
  importance: FactImportance;
  metadata: JsonObject;
}

/**
 * Reveal schedule entry — planning_truth is planner-only.
 * Must NOT enter raw writer prompts; Reveal Gate compiles safe breadcrumbs later.
 */
export interface PlannedReveal extends Timestamps {
  id: ID;
  projectId: ID;
  outlinePlanId: ID;
  plannedChapterOutlineId: ID | null;
  relatedFactId: ID | null;
  relatedProposalId: ID | null;
  title: string;
  /** Planner-only — never ship raw to writer Context Packet. */
  planningTruth: string;
  readerFacingHint: string | null;
  forbiddenBeforeChapter: number | null;
  status: PlannedRevealStatus;
  riskLevel: RevealRiskLevel;
  metadata: JsonObject;
}

// --- Sprint 5: write room (draft storage — NOT canon until Sprint 6 summary) ---

/** Active or completed writing attempt for one chapter outline row. */
export interface WritingSession extends Timestamps {
  id: ID;
  projectId: ID;
  chapterOutlineId: ID;
  status: WritingSessionStatus;
  activeBeatId: ID | null;
  startedAt: ISODateTime;
  lastActivityAt: ISODateTime;
  readyForSummaryAt: ISODateTime | null;
  metadata: JsonObject;
}

/** Prose lifecycle metadata per chapter — separate from planning `chapter_outlines`. */
export interface ChapterWritingState extends Timestamps {
  id: ID;
  projectId: ID;
  chapterOutlineId: ID;
  writingSessionId: ID | null;
  status: ChapterWritingStatus;
  wordCount: number;
  lastSavedAt: ISODateTime | null;
  metadata: JsonObject;
}

/** Scene/beat row for Write Room — beat contract lite fields. */
export interface ChapterBeat extends Timestamps {
  id: ID;
  projectId: ID;
  chapterOutlineId: ID;
  writingSessionId: ID | null;
  beatNumber: number;
  title: string;
  summary: string;
  direction: string | null;
  status: ChapterBeatStatus;
  emotionalShift: string | null;
  mustInclude: string[];
  mustNotInclude: string[];
  wordTarget: number | null;
  stopCondition: string | null;
  sortOrder: number;
  metadata: JsonObject;
}

/**
 * Draft prose version per beat — NOT canon.
 * New facts discovered in prose must become proposals in Sprint 6+, not direct fact writes.
 */
export interface ChapterProseVersion {
  id: ID;
  projectId: ID;
  chapterBeatId: ID;
  versionNumber: number;
  proseText: string;
  wordCount: number;
  source: ChapterProseSource;
  isCurrent: boolean;
  contextPacketLogId: ID | null;
  metadata: JsonObject;
  createdAt: ISODateTime;
}

/**
 * Audit log of backend-built Context Packet snapshots.
 * packetJson must be safe-only — must NOT contain planningTruth or full outline dump.
 */
export interface ContextPacketLog {
  id: ID;
  projectId: ID;
  writingSessionId: ID | null;
  chapterOutlineId: ID;
  chapterBeatId: ID | null;
  chapterNumber: number;
  packetHash: string;
  packetJson: JsonObject;
  builderVersion: ContextPacketBuilderVersion | string;
  createdAt: ISODateTime;
}

/** Redacted character entry safe for writer context. */
export interface CharacterSafeSummary {
  id: ID;
  name: string;
  roleLabel: string;
  descriptionSummary: string;
}

/** Redacted speech rule entry safe for writer context. */
export interface SpeechRuleSummary {
  id: ID;
  relationshipLabel: string;
  ruleText: string;
  examples: string[] | null;
}

/** Open loop safe summary — no future payoff spoiler detail. */
export interface OpenLoopSafeSummary {
  id: ID;
  question: string;
  readerFacingHint: string | null;
  status: OpenLoopStatus;
}

/** Reveal safe summary — breadcrumb/hint only, never planningTruth. */
export interface RevealSafeSummary {
  id: ID;
  title: string;
  readerFacingHint: string | null;
}

/** Forbidden reveal entry for active chapter — explicit constraint, not usable lore. */
export interface ForbiddenRevealEntry {
  id: ID;
  label: string;
  forbiddenConcepts: string[];
}

/**
 * Full writer Context Packet — slice-only, backend-built.
 * Must NOT include full outline dump, future chapters, or planningTruth raw.
 */
export interface WriterContextPacket {
  meta: {
    projectId: ID;
    chapterOutlineId: ID;
    chapterNumber: number;
    beatId?: ID;
    beatNumber?: number;
    builderVersion: ContextPacketBuilderVersion | string;
    packetHash: string;
    generatedAt: ISODateTime;
    truncated?: boolean;
  };
  foundation: {
    premiseSummary: string;
    mainConflictSummary: string;
    readerPromise: string;
    tone: string | null;
    storySecretsPreview: string | null;
  };
  concept: {
    title: string;
    shortPitch: string;
    readerPromise: string | null;
  };
  canon: {
    characters: CharacterSafeSummary[];
    facts: string[];
    speechRules: SpeechRuleSummary[];
  };
  currentChapter: {
    title: string;
    summary: string;
    purpose: string | null;
    chapterFunction: ChapterFunction;
    emotionalDirection: ChapterEmotion | null;
    endingHook: string | null;
    miniVictory: string | null;
    hook: string | null;
    markers: ChapterOutlineMarker[];
  };
  continuity: {
    previousChapterSummaries: string[];
    openLoopsActive: OpenLoopSafeSummary[];
    unresolvedThreadLabels: string[];
  };
  revealGate: {
    allowedBreadcrumbs: string[];
    allowedReveals: RevealSafeSummary[];
    forbiddenReveals: ForbiddenRevealEntry[];
    forbiddenConcepts: string[];
  };
  emotionalTarget: {
    chapterEmotion: ChapterEmotion | null;
    beatEmotionalShift: string | null;
  };
  hookTarget: {
    chapterEndingHook: string | null;
    beatStopCondition: string | null;
  };
  constraints: {
    mustInclude: string[];
    mustNotInclude: string[];
    wordTarget: number | null;
    mobileFormatRules: string[];
  };
}

/**
 * User-facing preview of Context Packet — plain-language direction only.
 * Normal web API must return this, not raw packetJson or model metadata.
 */
export interface WriterContextPacketPreview {
  chapterNumber: number;
  chapterTitle: string;
  beatNumber?: number;
  beatTitle?: string;
  direction: string | null;
  emotionalTarget: string | null;
  hookTarget: string | null;
  mustInclude: string[];
  mustNotInclude: string[];
  storyCheckLabels: string[];
  packetLogId: ID;
}

// --- Sprint 6: chapter summary & delta (NOT canon — candidate changes go to ai_proposals) ---

/**
 * Safety flags on summary/delta artifacts — plain keys, not canon.
 * Summary approval does NOT auto-accept proposals.
 */
export interface SummarySafetyFlags {
  possibleHallucination?: boolean;
  uncertainExtraction?: boolean;
  revealRisk?: boolean;
  summaryProseMismatch?: boolean;
  overExtraction?: boolean;
  [key: string]: boolean | undefined;
}

/** Line item inside structured chapter delta JSON. */
export interface ChapterDeltaLineItem {
  id?: ID;
  label?: string;
  body: string;
  emphasis?: string;
}

export interface ChapterDeltaCharacterChange {
  characterId?: ID;
  characterName: string;
  characterInitial?: string;
  change: string;
}

export interface ChapterDeltaFactCandidate {
  text: string;
  category?: string;
  importance?: string;
  evidenceSnippet?: string;
  proposalRequired: true;
}

export interface ChapterDeltaOpenLoopCandidate {
  openLoopId?: ID;
  question: string;
  suggestedStatus?: string;
  evidenceSnippet?: string;
}

export interface ChapterDeltaRevealCandidate {
  plannedRevealId?: ID;
  title: string;
  suggestedStatus?: string;
  evidenceSnippet?: string;
}

export interface ChapterDeltaStoryCheck {
  id?: ID;
  status: "ok" | "warning";
  label: string;
  detail?: string;
}

/**
 * Structured delta payload stored in chapter_deltas.delta_json.
 * NOT canon — extraction candidates must become ai_proposals before promotion.
 */
export interface ChapterDeltaPayload {
  meta: {
    chapterOutlineId: ID;
    chapterNumber: number;
    writingSessionId?: ID;
    proseVersionIds: ID[];
    extractorVersion: ChapterDeltaExtractorVersion | string;
    generatedAt: ISODateTime;
  };
  synopsis: string;
  emotionalOutcome: string | null;
  endingHook: string | null;
  continuityNotes: string | null;
  miniVictories: ChapterDeltaLineItem[];
  characterChanges: ChapterDeltaCharacterChange[];
  relationshipChanges: ChapterDeltaLineItem[];
  newFactCandidates: ChapterDeltaFactCandidate[];
  openLoops: {
    opened: ChapterDeltaLineItem[];
    paidOffCandidates: ChapterDeltaOpenLoopCandidate[];
  };
  reveals: {
    occurredCandidates: ChapterDeltaRevealCandidate[];
    heldSecrets: ChapterDeltaLineItem[];
  };
  storyCheckNotes: ChapterDeltaStoryCheck[];
  safetyFlags: SummarySafetyFlags;
}

/**
 * Chapter summary artifact — user-facing review document.
 * NOT canon automatically; approving does not write to facts/characters.
 */
export interface ChapterSummary extends Timestamps {
  id: ID;
  projectId: ID;
  chapterOutlineId: ID;
  writingSessionId: ID | null;
  /** Snapshot of current prose version ids at generation time — reference only. */
  currentProseVersionIds: ID[];
  status: ChapterSummaryStatus;
  chapterNumber: number;
  title: string;
  synopsis: string;
  miniVictory: string | null;
  emotionalOutcome: string | null;
  endingHook: string | null;
  wordCount: number;
  summaryVersion: number;
  isCurrent: boolean;
  safetyFlags: SummarySafetyFlags;
  metadata: JsonObject;
  approvedAt: ISODateTime | null;
}

/**
 * Structured chapter delta — 1:1 with a chapter summary generation.
 * NOT canon — proposal queue is the promotion path.
 */
export interface ChapterDelta extends Timestamps {
  id: ID;
  projectId: ID;
  chapterSummaryId: ID;
  chapterOutlineId: ID;
  status: ChapterDeltaStatus;
  deltaJson: ChapterDeltaPayload | JsonObject;
  safetyFlags: SummarySafetyFlags;
  extractorVersion: ChapterDeltaExtractorVersion | string;
}

/**
 * Normalized summary line item for SummaryPage sections.
 * new_fact_candidate items are review hints — canon requires ai_proposals accept.
 */
export interface ChapterSummaryItem extends Timestamps {
  id: ID;
  projectId: ID;
  chapterSummaryId: ID;
  itemType: ChapterSummaryItemType;
  severity: ChapterSummaryItemSeverity;
  title: string;
  body: string;
  relatedCharacterId: ID | null;
  relatedFactId: ID | null;
  relatedOpenLoopId: ID | null;
  relatedRevealId: ID | null;
  metadata: JsonObject;
  sortOrder: number;
}

/**
 * Junction linking a summary generation batch to ai_proposals queue items.
 * status tracks review outcome at summary scope — distinct from ai_proposals.status.
 */
export interface ChapterSummaryProposal extends Timestamps {
  id: ID;
  projectId: ID;
  chapterSummaryId: ID;
  aiProposalId: ID;
  status: ChapterSummaryProposalStatus;
  metadata: JsonObject;
}

// --- Sprint 7: publish package (export artifact — NOT canon) ---

/**
 * Safety flags for publish package stub generation and user edits.
 * Does not gate canon — informational for PublishPage review only.
 */
export interface PublishSafetyFlags {
  possibleSpoilerInTeaser?: boolean;
  possibleFutureLeakInNextTeaser?: boolean;
  genericCaption?: boolean;
  stubGenerated?: boolean;
  summaryProseMismatch?: boolean;
  overclaimUnlock?: boolean;
  revealRisk?: boolean;
  [key: string]: boolean | undefined;
}

/**
 * Internal publish package metadata — audit references only.
 * Must NOT store raw prose dumps, planningTruth, packet_json, context_packet,
 * delta_json, or ai_proposal payloads.
 */
export interface PublishPackageMetadata {
  chapterSummaryId?: ID;
  proseVersionIds?: ID[];
  generatedAt?: ISODateTime;
  stubMarker?: boolean;
  [key: string]: string | string[] | boolean | number | null | undefined;
}

/** Fixed MVP checklist row — state persisted in checklist_json. */
export interface PublishChecklistItem {
  id: PublishChecklistItemId | string;
  label: string;
  checked: boolean;
  /** Optional user note — max 280 chars in API validation. */
  note?: string;
}

/** Prose excerpt slice for stub generator input — not full prose_text. */
export interface PublishPackageProseExcerpt {
  beatNumber: number;
  firstSentence: string;
  wordCount: number;
}

/** Safe next-chapter outline slice — hook/ending_hook only, no full summary dump. */
export interface PublishPackageNextChapterSlice {
  chapterNumber: number;
  title: string;
  hook: string | null;
  endingHook: string | null;
}

/**
 * Read-only snapshot inputs for publish_stub_v1 (Task 7.2+).
 * Not persisted as a table — helper for generator services.
 */
export interface PublishPackageSnapshot {
  approvedSummaryId: ID;
  chapterOutlineId: ID;
  chapterNumber: number;
  chapterTitle: string;
  synopsis: string;
  miniVictory: string | null;
  emotionalOutcome: string | null;
  endingHook: string | null;
  proseExcerpts: PublishPackageProseExcerpt[];
  nextChapterSlice: PublishPackageNextChapterSlice | null;
  genre: string | null;
  styleTags: string[];
}

/**
 * KBM-oriented publish export artifact — copy-ready fields for manual paste.
 * NOT canon. Does NOT auto-post to KBM. Must NOT be used as Context Packet source.
 * Must NOT store raw prose full dump, planningTruth, packet_json, delta_json,
 * or proposal payloads in metadata or text columns.
 */
export interface PublishPackage extends Timestamps {
  id: ID;
  projectId: ID;
  chapterOutlineId: ID;
  chapterSummaryId: ID;
  chapterNumber: number;
  chapterTitle: string;
  status: PublishPackageStatus;
  packageVersion: number;
  isCurrent: boolean;
  displayTitle: string;
  teaser: string;
  shortSynopsis: string;
  caption: string;
  readerQuestion: string;
  nextChapterTeaser: string | null;
  tags: string[];
  genre: string | null;
  mobilePreviewExcerpt: string;
  checklist: PublishChecklistItem[];
  safetyFlags: PublishSafetyFlags;
  generatorVersion: PublishPackageGeneratorVersion | string;
  exportedAt: ISODateTime | null;
  metadata: PublishPackageMetadata;
}

// Sprint 6+: validation_reports — deferred.