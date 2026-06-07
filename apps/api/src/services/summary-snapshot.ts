import {
  CHAPTER_WRITING_STATUSES,
  OUTLINE_PLAN_STATUSES,
  WRITING_SESSION_STATUSES,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapChapterBeatRow,
  mapChapterOutlineRow,
  type ChapterBeatRow,
  type ChapterOutlineRow,
  type ChapterProseVersionRow,
  type ChapterWritingStateRow,
  type FoundationRow,
  type OutlinePlanRow,
  type ProjectRow,
  type WritingSessionRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";
import { assertWriteRoomGates } from "./write-snapshot.js";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

const PLAN_SELECT =
  "id, project_id, status, season_label, arc_summary, retention_summary, target_chapter_count, planning_notes, metadata, locked_at, created_at, updated_at";

const CHAPTER_SELECT =
  "id, project_id, outline_plan_id, chapter_number, title, summary, purpose, chapter_function, emotional_direction, hook, ending_hook, mini_victory, pov_character_id, status, markers, metadata, created_at, updated_at";

const SESSION_SELECT =
  "id, project_id, chapter_outline_id, status, active_beat_id, started_at, last_activity_at, ready_for_summary_at, metadata, created_at, updated_at";

const WRITING_STATE_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, status, word_count, last_saved_at, metadata, created_at, updated_at";

const BEAT_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, beat_number, title, summary, direction, status, emotional_shift, must_include, must_not_include, word_target, stop_condition, sort_order, metadata, created_at, updated_at";

const PROSE_SELECT =
  "id, project_id, chapter_beat_id, version_number, prose_text, word_count, source, is_current, context_packet_log_id, metadata, created_at";

export interface BeatProseSnapshot {
  beat: ReturnType<typeof mapChapterBeatRow>;
  currentProse: ChapterProseVersionRow | null;
}

export interface SummaryGenerationSnapshot {
  project: ProjectRow;
  chapterOutline: ReturnType<typeof mapChapterOutlineRow>;
  writingSession: WritingSessionRow;
  writingState: ChapterWritingStateRow;
  beatProse: BeatProseSnapshot[];
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
    console.error("story_foundations select for summary snapshot failed");
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
    console.error("outline_plans select for summary snapshot failed");
    throw AppError.internal("Failed to load outline plan");
  }
  return data as OutlinePlanRow | null;
}

async function fetchChapterOutlineRow(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<ChapterOutlineRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_outlines")
    .select(CHAPTER_SELECT)
    .eq("id", chapterOutlineId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("chapter_outlines select for summary snapshot failed");
    throw AppError.internal("Failed to load chapter outline");
  }
  if (!data) {
    throw AppError.notFound("Chapter outline not found");
  }
  return data as ChapterOutlineRow;
}

export function assertSummaryGenerationGates(
  project: ProjectRow,
  foundation: FoundationRow | null,
  outlinePlan: OutlinePlanRow | null,
  writingSession: WritingSessionRow,
  writingState: ChapterWritingStateRow | null,
  hasCurrentProse: boolean,
): void {
  assertWriteRoomGates(project, foundation, outlinePlan);

  const missing: string[] = [];

  if (writingSession.status !== WRITING_SESSION_STATUSES.ready_for_summary) {
    missing.push("session_ready_for_summary");
  }

  if (!writingState || writingState.status !== CHAPTER_WRITING_STATUSES.ready_for_summary) {
    missing.push("chapter_ready_for_summary");
  }

  if (!hasCurrentProse) {
    missing.push("current_prose_required");
  }

  if (!outlinePlan || outlinePlan.status !== OUTLINE_PLAN_STATUSES.locked) {
    missing.push("outline_plan_locked");
  }

  if (!foundation?.is_locked) {
    missing.push("foundation_locked");
  }

  if (missing.length > 0) {
    throw AppError.conflict("Chapter summary generation is not ready", {
      missing: [...new Set(missing)],
    });
  }
}

export async function loadSummaryGenerationSnapshot(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  chapterOutlineId: string,
  writingSessionId?: string,
): Promise<SummaryGenerationSnapshot> {
  const project = await getOwnedProjectRow(bindings, ownerId, projectId);
  const [foundation, outlinePlan, chapterRow] = await Promise.all([
    fetchFoundationRow(bindings, projectId),
    fetchOutlinePlanRow(bindings, projectId),
    fetchChapterOutlineRow(bindings, projectId, chapterOutlineId),
  ]);

  const admin = createServiceRoleClient(bindings);

  let sessionQuery = admin
    .from("writing_sessions")
    .select(SESSION_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId);

  if (writingSessionId) {
    sessionQuery = sessionQuery.eq("id", writingSessionId);
  } else {
    sessionQuery = sessionQuery.eq("status", WRITING_SESSION_STATUSES.ready_for_summary);
  }

  const { data: sessionData, error: sessionError } = await sessionQuery
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    console.error("writing_sessions select for summary snapshot failed");
    throw AppError.internal("Failed to load writing session");
  }
  if (!sessionData) {
    throw AppError.conflict("Chapter summary generation is not ready", {
      missing: ["session_ready_for_summary"],
    });
  }

  const writingSession = sessionData as WritingSessionRow;

  const { data: stateData, error: stateError } = await admin
    .from("chapter_writing_states")
    .select(WRITING_STATE_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .maybeSingle();

  if (stateError) {
    console.error("chapter_writing_states select for summary snapshot failed");
    throw AppError.internal("Failed to load chapter writing state");
  }

  const { data: beatRows, error: beatsError } = await admin
    .from("chapter_beats")
    .select(BEAT_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .order("sort_order", { ascending: true })
    .order("beat_number", { ascending: true });

  if (beatsError) {
    console.error("chapter_beats select for summary snapshot failed");
    throw AppError.internal("Failed to load chapter beats");
  }

  const beats = (beatRows ?? []) as ChapterBeatRow[];
  const beatIds = beats.map((b) => b.id);

  let proseByBeatId = new Map<string, ChapterProseVersionRow>();
  if (beatIds.length > 0) {
    const { data: proseRows, error: proseError } = await admin
      .from("chapter_prose_versions")
      .select(PROSE_SELECT)
      .eq("project_id", projectId)
      .in("chapter_beat_id", beatIds)
      .eq("is_current", true);

    if (proseError) {
      console.error("chapter_prose_versions select for summary snapshot failed");
      throw AppError.internal("Failed to load prose versions");
    }

    for (const row of (proseRows ?? []) as ChapterProseVersionRow[]) {
      proseByBeatId.set(row.chapter_beat_id, row);
    }
  }

  const beatProse: BeatProseSnapshot[] = beats.map((beatRow) => ({
    beat: mapChapterBeatRow(beatRow),
    currentProse: proseByBeatId.get(beatRow.id) ?? null,
  }));

  const hasCurrentProse = beatProse.some((bp) => bp.currentProse !== null);

  assertSummaryGenerationGates(
    project,
    foundation,
    outlinePlan,
    writingSession,
    stateData as ChapterWritingStateRow | null,
    hasCurrentProse,
  );

  return {
    project,
    chapterOutline: mapChapterOutlineRow(chapterRow),
    writingSession,
    writingState: stateData as ChapterWritingStateRow,
    beatProse,
  };
}