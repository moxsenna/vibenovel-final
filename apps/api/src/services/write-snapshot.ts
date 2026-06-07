import {
  CONTEXT_PACKET_BUILDER_VERSIONS,
  MOBILE_FORMAT_PREFERENCES,
  OPEN_LOOP_STATUSES,
  OUTLINE_PLAN_STATUSES,
  STORY_CONCEPT_STATUSES,
  WORKFLOW_PHASES,
  type ChapterBeat,
  type ChapterOutline,
  type Character,
  type Fact,
  type OpenLoop,
  type RelationshipSpeechRule,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapChapterBeatRow,
  mapChapterOutlineRow,
  type ChapterBeatRow,
  type ChapterOutlineRow,
  type FoundationRow,
  type OutlinePlanRow,
  type PlannedRevealSafeRow,
  type ProjectRow,
  type StoryConceptRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { listCharactersForOwner } from "./character.js";
import { listFactsForOwner } from "./fact.js";
import { getOwnedProjectRow } from "./project.js";
import { listSpeechRulesForOwner } from "./speech-rule.js";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

const CONCEPT_SELECT =
  "id, project_id, title, short_pitch, reader_promise, core_conflict, genre, tone, target_reader, status, source, score, payload, created_at, updated_at";

const PLAN_SELECT =
  "id, project_id, status, season_label, arc_summary, retention_summary, target_chapter_count, planning_notes, metadata, locked_at, created_at, updated_at";

const CHAPTER_SELECT =
  "id, project_id, outline_plan_id, chapter_number, title, summary, purpose, chapter_function, emotional_direction, hook, ending_hook, mini_victory, pov_character_id, status, markers, metadata, created_at, updated_at";

const BEAT_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, beat_number, title, summary, direction, status, emotional_shift, must_include, must_not_include, word_target, stop_condition, sort_order, metadata, created_at, updated_at";

/** Planned reveal columns — planning_truth explicitly excluded. */
const REVEAL_SAFE_SELECT =
  "id, project_id, outline_plan_id, planned_chapter_outline_id, related_fact_id, related_proposal_id, title, reader_facing_hint, forbidden_before_chapter, status, risk_level, metadata, created_at, updated_at";

const LOOP_SELECT =
  "id, project_id, outline_plan_id, opened_in_chapter_outline_id, payoff_chapter_outline_id, question, reader_facing_hint, status, importance, metadata, created_at, updated_at";

const SETTINGS_SELECT = "id, project_id, default_format";

const ACTIVE_LOOP_STATUSES = new Set<string>([
  OPEN_LOOP_STATUSES.opened,
  OPEN_LOOP_STATUSES.developed,
]);

const ALLOWED_WORKFLOW_PHASES = new Set<string>([
  WORKFLOW_PHASES.outline_locked,
  WORKFLOW_PHASES.writing,
]);

export interface WriteSnapshotInput {
  chapterOutlineId: string;
  beatId?: string;
}

export interface WriteContextSnapshot {
  project: ProjectRow;
  foundation: FoundationRow;
  concept: StoryConceptRow;
  outlinePlan: OutlinePlanRow;
  currentChapter: ChapterOutline;
  previousChapters: ChapterOutline[];
  futureChapterTitles: string[];
  futureChapterSummaries: string[];
  chapterNumberByOutlineId: Map<string, number>;
  openLoops: OpenLoop[];
  plannedReveals: PlannedRevealSafeRow[];
  beat: ChapterBeat | null;
  characters: Character[];
  facts: Fact[];
  speechRules: RelationshipSpeechRule[];
  mobileFormat: string;
  builderVersion: string;
}

async function fetchFoundationRow(
  bindings: AppBindings,
  projectId: string,
): Promise<FoundationRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_foundations")
    .select(FOUNDATION_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("story_foundations select for write snapshot failed");
    throw AppError.internal("Failed to load foundation");
  }
  return data as FoundationRow | null;
}

async function fetchOutlinePlanRow(
  bindings: AppBindings,
  projectId: string,
): Promise<OutlinePlanRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("outline_plans")
    .select(PLAN_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("outline_plans select for write snapshot failed");
    throw AppError.internal("Failed to load outline plan");
  }
  return data as OutlinePlanRow | null;
}

async function loadSelectedConcept(
  bindings: AppBindings,
  projectRow: ProjectRow,
): Promise<StoryConceptRow> {
  if (!projectRow.selected_concept_id) {
    throw AppError.badRequest("Select a story concept before writing");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_concepts")
    .select(CONCEPT_SELECT)
    .eq("id", projectRow.selected_concept_id)
    .eq("project_id", projectRow.id)
    .maybeSingle();

  if (error) {
    console.error("story_concepts select for write snapshot failed");
    throw AppError.internal("Failed to load selected concept");
  }
  if (!data) {
    throw AppError.notFound("Selected concept not found");
  }

  const concept = data as StoryConceptRow;
  if (concept.status !== STORY_CONCEPT_STATUSES.selected) {
    throw AppError.badRequest("Selected concept must have status selected");
  }
  return concept;
}

async function fetchChapterOutlinesForPlan(
  bindings: AppBindings,
  projectId: string,
  outlinePlanId: string,
): Promise<ChapterOutlineRow[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_outlines")
    .select(CHAPTER_SELECT)
    .eq("project_id", projectId)
    .eq("outline_plan_id", outlinePlanId)
    .order("chapter_number", { ascending: true });

  if (error) {
    console.error("chapter_outlines select for write snapshot failed");
    throw AppError.internal("Failed to load chapter outlines");
  }
  return (data ?? []) as ChapterOutlineRow[];
}

async function fetchBeatRow(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
  beatId: string,
): Promise<ChapterBeatRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_beats")
    .select(BEAT_SELECT)
    .eq("id", beatId)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .maybeSingle();

  if (error) {
    console.error("chapter_beats select for write snapshot failed");
    throw AppError.internal("Failed to load chapter beat");
  }
  if (!data) {
    throw AppError.notFound("Chapter beat not found");
  }
  return data as ChapterBeatRow;
}

async function fetchDefaultFormat(bindings: AppBindings, projectId: string): Promise<string> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("project_settings")
    .select(SETTINGS_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("project_settings select for write snapshot failed");
    throw AppError.internal("Failed to load project settings");
  }
  const format = (data as { default_format?: string } | null)?.default_format;
  return format === MOBILE_FORMAT_PREFERENCES.desktop
    ? MOBILE_FORMAT_PREFERENCES.desktop
    : MOBILE_FORMAT_PREFERENCES.hp_kbm;
}

export function assertWriteRoomGates(
  project: ProjectRow,
  foundation: FoundationRow | null,
  outlinePlan: OutlinePlanRow | null,
): void {
  const missing: string[] = [];

  const phase = project.workflow_phase ?? WORKFLOW_PHASES.intake;
  if (!ALLOWED_WORKFLOW_PHASES.has(phase)) {
    missing.push("outline_locked");
  }

  if (!outlinePlan || outlinePlan.status !== OUTLINE_PLAN_STATUSES.locked) {
    missing.push("outline_plan_locked");
  }

  if (!foundation?.is_locked) {
    missing.push("foundation_locked");
  }

  if (missing.length > 0) {
    throw AppError.conflict("Write room is not ready", { missing: [...new Set(missing)] });
  }
}

export async function loadWriteContextSnapshot(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  input: WriteSnapshotInput,
): Promise<WriteContextSnapshot> {
  const project = await getOwnedProjectRow(bindings, ownerId, projectId);
  const [foundation, outlinePlan, concept, characters, facts, speechRules, mobileFormat] =
    await Promise.all([
      fetchFoundationRow(bindings, projectId),
      fetchOutlinePlanRow(bindings, projectId),
      loadSelectedConcept(bindings, project),
      listCharactersForOwner(bindings, ownerId, projectId, false),
      listFactsForOwner(bindings, ownerId, projectId, false),
      listSpeechRulesForOwner(bindings, ownerId, projectId, false),
      fetchDefaultFormat(bindings, projectId),
    ]);

  assertWriteRoomGates(project, foundation, outlinePlan);

  const plan = outlinePlan!;
  const foundationRow = foundation!;

  const chapterRows = await fetchChapterOutlinesForPlan(bindings, projectId, plan.id);
  const currentRow = chapterRows.find((row) => row.id === input.chapterOutlineId);
  if (!currentRow) {
    throw AppError.notFound("Chapter outline not found");
  }

  const currentNumber = currentRow.chapter_number;
  const chapterNumberByOutlineId = new Map<string, number>();
  for (const row of chapterRows) {
    chapterNumberByOutlineId.set(row.id, row.chapter_number);
  }

  const previousRows = chapterRows.filter((row) => row.chapter_number < currentNumber);
  const futureRows = chapterRows.filter((row) => row.chapter_number > currentNumber);

  let beat: ChapterBeat | null = null;
  if (input.beatId) {
    const beatRow = await fetchBeatRow(bindings, projectId, currentRow.id, input.beatId);
    beat = mapChapterBeatRow(beatRow);
  }

  const admin = createServiceRoleClient(bindings);

  const [loopsRes, revealsRes] = await Promise.all([
    admin
      .from("open_loops")
      .select(LOOP_SELECT)
      .eq("project_id", projectId)
      .eq("outline_plan_id", plan.id),
    admin
      .from("planned_reveals")
      .select(REVEAL_SAFE_SELECT)
      .eq("project_id", projectId)
      .eq("outline_plan_id", plan.id),
  ]);

  if (loopsRes.error) {
    console.error("open_loops select for write snapshot failed");
    throw AppError.internal("Failed to load open loops");
  }
  if (revealsRes.error) {
    console.error("planned_reveals select for write snapshot failed");
    throw AppError.internal("Failed to load planned reveals");
  }

  const openLoops = ((loopsRes.data ?? []) as Parameters<typeof mapOpenLoopRowSafe>[0][]).map(
    mapOpenLoopRowSafe,
  );

  return {
    project,
    foundation: foundationRow,
    concept,
    outlinePlan: plan,
    currentChapter: mapChapterOutlineRow(currentRow),
    previousChapters: previousRows.map(mapChapterOutlineRow),
    futureChapterTitles: futureRows.map((row) => row.title),
    futureChapterSummaries: futureRows.map((row) => row.summary),
    chapterNumberByOutlineId,
    openLoops,
    plannedReveals: (revealsRes.data ?? []) as PlannedRevealSafeRow[],
    beat,
    characters,
    facts,
    speechRules,
    mobileFormat,
    builderVersion: CONTEXT_PACKET_BUILDER_VERSIONS.v1_stub,
  };
}

function mapOpenLoopRowSafe(row: {
  id: string;
  project_id: string;
  outline_plan_id: string;
  opened_in_chapter_outline_id: string | null;
  payoff_chapter_outline_id: string | null;
  question: string;
  reader_facing_hint: string | null;
  status: string;
  importance: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}): OpenLoop {
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
    metadata:
      row.metadata !== null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as OpenLoop["metadata"])
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function filterActiveOpenLoops(
  loops: OpenLoop[],
  chapterNumberByOutlineId: Map<string, number>,
  currentChapterNumber: number,
): OpenLoop[] {
  return loops.filter((loop) => {
    if (!ACTIVE_LOOP_STATUSES.has(loop.status)) {
      return false;
    }
    const openedId = loop.openedInChapterOutlineId;
    if (!openedId) {
      return true;
    }
    const openedAt = chapterNumberByOutlineId.get(openedId);
    return openedAt !== undefined && openedAt <= currentChapterNumber;
  });
}

