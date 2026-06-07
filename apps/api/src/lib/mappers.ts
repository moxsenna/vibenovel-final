import type {
  AiProposal,
  Character,
  CreditBalance,
  DetectedSignal,
  Fact,
  IntakeMessage,
  IntakeSession,
  JsonObject,
  Project,
  ProjectSettings,
  RelationshipSpeechRule,
  StoryFoundation,
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

export interface FoundationRow {
  id: string;
  project_id: string;
  premise: string;
  main_conflict: string;
  reader_promise: string;
  tone: string | null;
  genre: string | null;
  target_reader: string | null;
  story_secrets_preview: string | null;
  style_tags: string[] | unknown;
  readiness_percent: number;
  readiness_status: string;
  status: string;
  is_locked: boolean;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapFoundationRow(row: FoundationRow): StoryFoundation {
  const styleTags = Array.isArray(row.style_tags)
    ? (row.style_tags as string[])
    : [];
  return {
    id: row.id,
    projectId: row.project_id,
    premise: row.premise,
    mainConflict: row.main_conflict,
    readerPromise: row.reader_promise,
    tone: row.tone,
    genre: row.genre,
    targetReader: row.target_reader,
    storySecretsPreview: row.story_secrets_preview,
    styleTags,
    readinessPercent: row.readiness_percent,
    readinessStatus: row.readiness_status as StoryFoundation["readinessStatus"],
    status: row.status as StoryFoundation["status"],
    isLocked: row.is_locked,
    lockedAt: row.locked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CharacterRow {
  id: string;
  project_id: string;
  name: string;
  role_label: string;
  role: string;
  description: string;
  importance: string;
  status: string;
  source: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function mapCharacterRow(row: CharacterRow): Character {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    roleLabel: row.role_label,
    role: row.role as Character["role"],
    description: row.description,
    importance: row.importance as Character["importance"],
    status: row.status as Character["status"],
    source: row.source as Character["source"],
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface FactRow {
  id: string;
  project_id: string;
  text: string;
  category: string;
  importance: string;
  canon_status: string;
  is_locked: boolean;
  source: string;
  accepted_from_proposal_id: string | null;
  created_at: string;
  updated_at: string;
}

export function mapFactRow(row: FactRow): Fact {
  return {
    id: row.id,
    projectId: row.project_id,
    text: row.text,
    category: row.category as Fact["category"],
    importance: row.importance as Fact["importance"],
    canonStatus: row.canon_status as Fact["canonStatus"],
    isLocked: row.is_locked,
    source: row.source as Fact["source"],
    acceptedFromProposalId: row.accepted_from_proposal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface SpeechRuleRow {
  id: string;
  project_id: string;
  relationship_label: string;
  character_a_id: string | null;
  character_b_id: string | null;
  rule_text: string;
  examples: string[] | unknown;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export function mapSpeechRuleRow(row: SpeechRuleRow): RelationshipSpeechRule {
  const examples = Array.isArray(row.examples) ? (row.examples as string[]) : null;
  return {
    id: row.id,
    projectId: row.project_id,
    relationshipLabel: row.relationship_label,
    characterAId: row.character_a_id,
    characterBId: row.character_b_id,
    ruleText: row.rule_text,
    examples,
    status: row.status as RelationshipSpeechRule["status"],
    source: row.source as RelationshipSpeechRule["source"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** API response with task-friendly aliases. */
export interface SpeechRuleResponse extends RelationshipSpeechRule {
  fromCharacterId: RelationshipSpeechRule["characterAId"];
  toCharacterId: RelationshipSpeechRule["characterBId"];
  speechStyle: string;
}

export function mapSpeechRuleResponse(row: SpeechRuleRow): SpeechRuleResponse {
  const base = mapSpeechRuleRow(row);
  return {
    ...base,
    fromCharacterId: base.characterAId,
    toCharacterId: base.characterBId,
    speechStyle: base.ruleText,
  };
}

export interface AiProposalRow {
  id: string;
  project_id: string;
  proposal_type: string;
  status: string;
  risk_level: string;
  source: string;
  title: string;
  payload: JsonObject | unknown;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  merged_into_id: string | null;
  result_fact_id: string | null;
  result_character_id: string | null;
  created_at: string;
  updated_at: string;
}

export function mapAiProposalRow(row: AiProposalRow): AiProposal {
  const payload =
    row.payload !== null && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as JsonObject)
      : {};
  return {
    id: row.id,
    projectId: row.project_id,
    proposalType: row.proposal_type as AiProposal["proposalType"],
    status: row.status as AiProposal["status"],
    riskLevel: row.risk_level as AiProposal["riskLevel"],
    source: row.source as AiProposal["source"],
    title: row.title,
    payload,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    mergedIntoId: row.merged_into_id,
    resultFactId: row.result_fact_id,
    resultCharacterId: row.result_character_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** API response with task-friendly aliases. */
export interface AiProposalResponse extends AiProposal {
  type: AiProposal["proposalType"];
  summary: string | null;
}

export function mapAiProposalResponse(row: AiProposalRow): AiProposalResponse {
  const base = mapAiProposalRow(row);
  const payload = base.payload;
  const summary =
    (typeof payload.summary === "string" ? payload.summary : null) ??
    (typeof payload.description === "string" ? payload.description : null);
  return {
    ...base,
    type: base.proposalType,
    summary,
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

function parseJsonObject(value: unknown): JsonObject {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

export interface IntakeSessionRow {
  id: string;
  project_id: string;
  status: string;
  phase: string;
  progress_percent: number;
  summary: string | null;
  metadata: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export function mapIntakeSessionRow(row: IntakeSessionRow): IntakeSession {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status as IntakeSession["status"],
    phase: row.phase as IntakeSession["phase"],
    progressPercent: row.progress_percent,
    summary: row.summary,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface IntakeMessageRow {
  id: string;
  project_id: string;
  session_id: string;
  role: string;
  content: string;
  metadata: JsonObject | unknown;
  created_at: string;
}

export function mapIntakeMessageRow(row: IntakeMessageRow): IntakeMessage {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    role: row.role as IntakeMessage["role"],
    content: row.content,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
  };
}

export interface DetectedSignalRow {
  id: string;
  project_id: string;
  session_id: string | null;
  type: string;
  label: string;
  value: string;
  confidence: number | null;
  status: string;
  source_message_id: string | null;
  metadata: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export function mapDetectedSignalRow(row: DetectedSignalRow): DetectedSignal {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    type: row.type as DetectedSignal["type"],
    label: row.label,
    value: row.value,
    confidence: row.confidence,
    status: row.status as DetectedSignal["status"],
    sourceMessageId: row.source_message_id,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}