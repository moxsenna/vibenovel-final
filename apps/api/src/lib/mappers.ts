import type {
  AiProposal,
  ChapterBeat,
  ChapterBeatStatus,
  ChapterDelta,
  ChapterDeltaStatus,
  ChapterProseSource,
  ChapterProseVersion,
  ChapterOutline,
  ChapterOutlineMarker,
  ChapterSummary,
  ChapterSummaryItem,
  ChapterSummaryItemSeverity,
  ChapterSummaryItemType,
  ChapterSummaryProposal,
  ChapterSummaryProposalStatus,
  ChapterSummaryStatus,
  ChapterWritingState,
  ChapterWritingStatus,
  Character,
  CreditBalance,
  DetectedSignal,
  Fact,
  IntakeMessage,
  IntakeSession,
  JsonObject,
  OpenLoop,
  OutlinePlan,
  PlannedReveal,
  Project,
  ProjectSettings,
  RelationshipSpeechRule,
  StoryConcept,
  StoryFoundation,
  SummarySafetyFlags,
  UserProfile,
  WritingSession,
  WritingSessionStatus,
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
  workflow_phase?: string | null;
  selected_concept_id?: string | null;
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
    workflowPhase: row.workflow_phase as Project["workflowPhase"],
    selectedConceptId: row.selected_concept_id ?? null,
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

export interface StoryConceptRow {
  id: string;
  project_id: string;
  title: string;
  short_pitch: string;
  reader_promise: string | null;
  core_conflict: string | null;
  genre: string | null;
  tone: string | null;
  target_reader: string | null;
  status: string;
  source: string;
  score: number | null;
  payload: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export function mapStoryConceptRow(row: StoryConceptRow): StoryConcept {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    shortPitch: row.short_pitch,
    readerPromise: row.reader_promise,
    coreConflict: row.core_conflict,
    genre: row.genre,
    tone: row.tone,
    targetReader: row.target_reader,
    status: row.status as StoryConcept["status"],
    source: row.source as StoryConcept["source"],
    score: row.score,
    payload: parseJsonObject(row.payload),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseMarkers(value: unknown): ChapterOutlineMarker[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is ChapterOutlineMarker =>
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof (item as ChapterOutlineMarker).type === "string",
    )
    .map((item) => ({
      type: item.type,
      ...(item.label ? { label: item.label } : {}),
    }));
}

export interface OutlinePlanRow {
  id: string;
  project_id: string;
  status: string;
  season_label: string;
  arc_summary: string | null;
  retention_summary: string | null;
  target_chapter_count: number;
  planning_notes: string | null;
  metadata: JsonObject | unknown;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapOutlinePlanRow(row: OutlinePlanRow): OutlinePlan {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status as OutlinePlan["status"],
    seasonLabel: row.season_label,
    arcSummary: row.arc_summary,
    retentionSummary: row.retention_summary,
    targetChapterCount: row.target_chapter_count,
    planningNotes: row.planning_notes,
    metadata: parseJsonObject(row.metadata),
    lockedAt: row.locked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ChapterOutlineRow {
  id: string;
  project_id: string;
  outline_plan_id: string;
  chapter_number: number;
  title: string;
  summary: string;
  purpose: string | null;
  chapter_function: string;
  emotional_direction: string | null;
  hook: string | null;
  ending_hook: string | null;
  mini_victory: string | null;
  pov_character_id: string | null;
  status: string;
  markers: JsonObject | unknown;
  metadata: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export function mapChapterOutlineRow(row: ChapterOutlineRow): ChapterOutline {
  return {
    id: row.id,
    projectId: row.project_id,
    outlinePlanId: row.outline_plan_id,
    chapterNumber: row.chapter_number,
    title: row.title,
    summary: row.summary,
    purpose: row.purpose,
    chapterFunction: row.chapter_function as ChapterOutline["chapterFunction"],
    emotionalDirection: row.emotional_direction as ChapterOutline["emotionalDirection"],
    hook: row.hook,
    endingHook: row.ending_hook,
    miniVictory: row.mini_victory,
    povCharacterId: row.pov_character_id,
    status: row.status as ChapterOutline["status"],
    markers: parseMarkers(row.markers),
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface OpenLoopRow {
  id: string;
  project_id: string;
  outline_plan_id: string;
  opened_in_chapter_outline_id: string | null;
  payoff_chapter_outline_id: string | null;
  question: string;
  reader_facing_hint: string | null;
  status: string;
  importance: string;
  metadata: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export function mapOpenLoopRow(row: OpenLoopRow): OpenLoop {
  return {
    id: row.id,
    projectId: row.project_id,
    outlinePlanId: row.outline_plan_id,
    openedInChapterOutlineId: row.opened_in_chapter_outline_id,
    payoffChapterOutlineId: row.payoff_chapter_outline_id,
    question: row.question,
    readerFacingHint: row.reader_facing_hint,
    status: row.status as OpenLoop["status"],
    importance: row.importance as OpenLoop["importance"],
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PlannedRevealRow {
  id: string;
  project_id: string;
  outline_plan_id: string;
  planned_chapter_outline_id: string | null;
  related_fact_id: string | null;
  related_proposal_id: string | null;
  title: string;
  planning_truth: string;
  reader_facing_hint: string | null;
  forbidden_before_chapter: number | null;
  status: string;
  risk_level: string;
  metadata: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export function mapPlannedRevealRow(row: PlannedRevealRow): PlannedReveal {
  return {
    id: row.id,
    projectId: row.project_id,
    outlinePlanId: row.outline_plan_id,
    plannedChapterOutlineId: row.planned_chapter_outline_id,
    relatedFactId: row.related_fact_id,
    relatedProposalId: row.related_proposal_id,
    title: row.title,
    planningTruth: row.planning_truth,
    readerFacingHint: row.reader_facing_hint,
    forbiddenBeforeChapter: row.forbidden_before_chapter,
    status: row.status as PlannedReveal["status"],
    riskLevel: row.risk_level as PlannedReveal["riskLevel"],
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Default GET — planner UI summary without raw planning_truth (writer-safe boundary). */
export type PlannedRevealPublic = Omit<PlannedReveal, "planningTruth"> & {
  planningTruthRedacted: true;
};

export function mapPlannedRevealPublic(row: PlannedRevealRow): PlannedRevealPublic {
  const full = mapPlannedRevealRow(row);
  const { planningTruth: _omitted, ...rest } = full;
  return { ...rest, planningTruthRedacted: true };
}

/** Writer SELECT — planning_truth column never fetched. */
export interface PlannedRevealSafeRow {
  id: string;
  project_id: string;
  outline_plan_id: string;
  planned_chapter_outline_id: string | null;
  related_fact_id: string | null;
  related_proposal_id: string | null;
  title: string;
  reader_facing_hint: string | null;
  forbidden_before_chapter: number | null;
  status: string;
  risk_level: string;
  metadata: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export interface ChapterBeatRow {
  id: string;
  project_id: string;
  chapter_outline_id: string;
  writing_session_id: string | null;
  beat_number: number;
  title: string;
  summary: string;
  direction: string | null;
  status: string;
  emotional_shift: string | null;
  must_include: string[];
  must_not_include: string[];
  word_target: number | null;
  stop_condition: string | null;
  sort_order: number;
  metadata: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export function mapChapterBeatRow(row: ChapterBeatRow): ChapterBeat {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterOutlineId: row.chapter_outline_id,
    writingSessionId: row.writing_session_id,
    beatNumber: row.beat_number,
    title: row.title,
    summary: row.summary,
    direction: row.direction,
    status: row.status as ChapterBeatStatus,
    emotionalShift: row.emotional_shift,
    mustInclude: row.must_include ?? [],
    mustNotInclude: row.must_not_include ?? [],
    wordTarget: row.word_target,
    stopCondition: row.stop_condition,
    sortOrder: row.sort_order,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface WritingSessionRow {
  id: string;
  project_id: string;
  chapter_outline_id: string;
  status: string;
  active_beat_id: string | null;
  started_at: string;
  last_activity_at: string;
  ready_for_summary_at: string | null;
  metadata: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export function mapWritingSessionRow(row: WritingSessionRow): WritingSession {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterOutlineId: row.chapter_outline_id,
    status: row.status as WritingSessionStatus,
    activeBeatId: row.active_beat_id,
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
    readyForSummaryAt: row.ready_for_summary_at,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ChapterWritingStateRow {
  id: string;
  project_id: string;
  chapter_outline_id: string;
  writing_session_id: string | null;
  status: string;
  word_count: number;
  last_saved_at: string | null;
  metadata: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export function mapChapterWritingStateRow(row: ChapterWritingStateRow): ChapterWritingState {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterOutlineId: row.chapter_outline_id,
    writingSessionId: row.writing_session_id,
    status: row.status as ChapterWritingStatus,
    wordCount: row.word_count,
    lastSavedAt: row.last_saved_at,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ChapterProseVersionRow {
  id: string;
  project_id: string;
  chapter_beat_id: string;
  version_number: number;
  prose_text: string;
  word_count: number;
  source: string;
  is_current: boolean;
  context_packet_log_id: string | null;
  metadata: JsonObject | unknown;
  created_at: string;
}

export function mapChapterProseVersionRow(row: ChapterProseVersionRow): ChapterProseVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterBeatId: row.chapter_beat_id,
    versionNumber: row.version_number,
    proseText: row.prose_text,
    wordCount: row.word_count,
    source: row.source as ChapterProseSource,
    isCurrent: row.is_current,
    contextPacketLogId: row.context_packet_log_id,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
  };
}

export interface ChapterSummaryRow {
  id: string;
  project_id: string;
  chapter_outline_id: string;
  writing_session_id: string | null;
  current_prose_version_ids: string[];
  status: string;
  chapter_number: number;
  title: string;
  synopsis: string;
  mini_victory: string | null;
  emotional_outcome: string | null;
  ending_hook: string | null;
  word_count: number;
  summary_version: number;
  is_current: boolean;
  safety_flags: JsonObject | unknown;
  metadata: JsonObject | unknown;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapChapterSummaryRow(row: ChapterSummaryRow): ChapterSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterOutlineId: row.chapter_outline_id,
    writingSessionId: row.writing_session_id,
    currentProseVersionIds: row.current_prose_version_ids ?? [],
    status: row.status as ChapterSummaryStatus,
    chapterNumber: row.chapter_number,
    title: row.title,
    synopsis: row.synopsis,
    miniVictory: row.mini_victory,
    emotionalOutcome: row.emotional_outcome,
    endingHook: row.ending_hook,
    wordCount: row.word_count,
    summaryVersion: row.summary_version,
    isCurrent: row.is_current,
    safetyFlags: parseJsonObject(row.safety_flags) as SummarySafetyFlags,
    metadata: parseJsonObject(row.metadata),
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ChapterSummaryItemRow {
  id: string;
  project_id: string;
  chapter_summary_id: string;
  item_type: string;
  severity: string;
  title: string;
  body: string;
  related_character_id: string | null;
  related_fact_id: string | null;
  related_open_loop_id: string | null;
  related_reveal_id: string | null;
  metadata: JsonObject | unknown;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function mapChapterSummaryItemRow(row: ChapterSummaryItemRow): ChapterSummaryItem {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterSummaryId: row.chapter_summary_id,
    itemType: row.item_type as ChapterSummaryItemType,
    severity: row.severity as ChapterSummaryItemSeverity,
    title: row.title,
    body: row.body,
    relatedCharacterId: row.related_character_id,
    relatedFactId: row.related_fact_id,
    relatedOpenLoopId: row.related_open_loop_id,
    relatedRevealId: row.related_reveal_id,
    metadata: parseJsonObject(row.metadata),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ChapterDeltaRow {
  id: string;
  project_id: string;
  chapter_summary_id: string;
  chapter_outline_id: string;
  status: string;
  delta_json: JsonObject | unknown;
  safety_flags: JsonObject | unknown;
  extractor_version: string;
  created_at: string;
  updated_at: string;
}

export function mapChapterDeltaRow(row: ChapterDeltaRow): ChapterDelta {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterSummaryId: row.chapter_summary_id,
    chapterOutlineId: row.chapter_outline_id,
    status: row.status as ChapterDeltaStatus,
    deltaJson: parseJsonObject(row.delta_json),
    safetyFlags: parseJsonObject(row.safety_flags) as SummarySafetyFlags,
    extractorVersion: row.extractor_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ChapterSummaryProposalRow {
  id: string;
  project_id: string;
  chapter_summary_id: string;
  ai_proposal_id: string;
  status: string;
  metadata: JsonObject | unknown;
  created_at: string;
  updated_at: string;
}

export function mapChapterSummaryProposalRow(
  row: ChapterSummaryProposalRow,
): ChapterSummaryProposal {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterSummaryId: row.chapter_summary_id,
    aiProposalId: row.ai_proposal_id,
    status: row.status as ChapterSummaryProposalStatus,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Safe linked proposal excerpt for summary delta GET endpoints. */
export interface LinkedProposalSummary {
  linkId: string;
  linkStatus: ChapterSummaryProposalStatus;
  proposalId: string;
  type: string;
  status: string;
  riskLevel: string;
  title: string;
  summary: string | null;
  payloadExcerpt: JsonObject;
  source: string;
  metadata: JsonObject;
}

export function mapLinkedProposalSummary(
  link: ChapterSummaryProposalRow,
  proposal: AiProposalRow,
): LinkedProposalSummary {
  const payload =
    proposal.payload !== null && typeof proposal.payload === "object" && !Array.isArray(proposal.payload)
      ? (proposal.payload as JsonObject)
      : {};

  const safeExcerpt: JsonObject = {};
  const allowedKeys = [
    "summaryId",
    "chapterOutlineId",
    "chapterNumber",
    "reason",
    "proposedFactText",
    "category",
    "changeSummary",
    "suggestedStatus",
    "targetEntityType",
    "targetEntityId",
  ];
  for (const key of allowedKeys) {
    if (key in payload) safeExcerpt[key] = payload[key];
  }

  const summary =
    (typeof payload.summary === "string" ? payload.summary : null) ??
    (typeof payload.reason === "string" ? payload.reason : null);

  return {
    linkId: link.id,
    linkStatus: link.status as ChapterSummaryProposalStatus,
    proposalId: proposal.id,
    type: proposal.proposal_type,
    status: proposal.status,
    riskLevel: proposal.risk_level,
    title: proposal.title,
    summary,
    payloadExcerpt: safeExcerpt,
    source: proposal.source,
    metadata: parseJsonObject(link.metadata),
  };
}

