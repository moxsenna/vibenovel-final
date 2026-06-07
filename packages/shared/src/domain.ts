import type {
  AiProposalRiskLevel,
  AiProposalSource,
  AiProposalStatus,
  AiProposalType,
  CharacterRole,
  CharacterSource,
  CharacterStatus,
  CreditBalanceSource,
  DefaultLanguage,
  FactCanonStatus,
  FactCategory,
  FactImportance,
  FactSource,
  FoundationReadinessLevel,
  FoundationStatus,
  MobileFormatPreference,
  ProjectEntryPath,
  ProjectStatus,
  ReaderTarget,
  SpeechRuleSource,
  SpeechRuleStatus,
  StoryGenre,
  SubscriptionPlan,
  TargetLengthPlan,
  UserRole,
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

// Sprint 4+: chapters, reveals, beat_contracts, prose_versions — deferred.