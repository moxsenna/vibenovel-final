import type {
  AiProposalRiskLevel,
  AiProposalSource,
  AiProposalStatus,
  AiProposalType,
  ChapterEmotion,
  ChapterFunction,
  ChapterOutlineStatus,
  CharacterRole,
  CharacterSource,
  CharacterStatus,
  CreditBalanceSource,
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

// Sprint 5+: beat_contracts, prose_versions, chapter_deltas — deferred.