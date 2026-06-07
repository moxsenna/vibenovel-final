import {
  CHAPTER_WRITING_STATUSES,
  WORKFLOW_PHASES,
  WRITING_SESSION_STATUSES,
  type ChapterBeat,
  type ChapterOutline,
  type ChapterWritingState,
  type WritingSession,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapChapterBeatRow,
  mapChapterOutlineRow,
  mapChapterWritingStateRow,
  mapWritingSessionRow,
  type ChapterBeatRow,
  type ChapterOutlineRow,
  type ChapterWritingStateRow,
  type FoundationRow,
  type OutlinePlanRow,
  type WritingSessionRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";
import { assertWriteRoomGates } from "./write-snapshot.js";

const SESSION_SELECT =
  "id, project_id, chapter_outline_id, status, active_beat_id, started_at, last_activity_at, ready_for_summary_at, metadata, created_at, updated_at";

const WRITING_STATE_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, status, word_count, last_saved_at, metadata, created_at, updated_at";

const CHAPTER_SAFE_SELECT =
  "id, project_id, outline_plan_id, chapter_number, title, summary, status, created_at, updated_at";

const BEAT_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, beat_number, title, summary, direction, status, emotional_shift, must_include, must_not_include, word_target, stop_condition, sort_order, metadata, created_at, updated_at";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

const PLAN_SELECT =
  "id, project_id, status, season_label, arc_summary, retention_summary, target_chapter_count, planning_notes, metadata, locked_at, created_at, updated_at";

const PATCHABLE_SESSION_STATUSES = new Set<string>([
  WRITING_SESSION_STATUSES.active,
  WRITING_SESSION_STATUSES.paused,
  WRITING_SESSION_STATUSES.abandoned,
]);

const FORBIDDEN_SESSION_PATCH_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "chapterOutlineId",
  "chapter_outline_id",
  "contextPacketJson",
  "context_packet_json",
  "proseText",
  "prose_text",
  "planningTruth",
  "planning_truth",
  "readyForSummaryAt",
  "ready_for_summary_at",
  "startedAt",
  "started_at",
  "lastActivityAt",
  "last_activity_at",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
]);

const PROSE_FORBIDDEN_KEYS = new Set([
  "chapterText",
  "chapter_text",
  "prose",
  "proseText",
  "prose_text",
  "body",
  "full_prompt",
  "fullPrompt",
  "beatText",
  "beat_text",
  "sceneText",
  "scene_text",
  "contextPacketJson",
  "context_packet_json",
  "planningTruth",
  "planning_truth",
]);

const METADATA_MAX_BYTES = 4096;

export interface StartWritingSessionInput {
  chapterOutlineId: string;
  activeBeatId?: string;
}

export interface PatchWritingSessionInput {
  status?: string;
  activeBeatId?: string | null;
  metadata?: unknown;
}

export interface ChapterOutlineSafeSummary {
  id: string;
  chapterNumber: number;
  title: string;
  summary: string;
  status: ChapterOutline["status"];
}

export interface WritingSessionDetail {
  session: WritingSession;
  writingState: ChapterWritingState;
  chapterOutline: ChapterOutlineSafeSummary;
  activeBeat: ChapterBeat | null;
  beatsCount: number;
}

export interface StartWritingSessionResult {
  session: WritingSession;
  writingState: ChapterWritingState;
  created: boolean;
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
    console.error("story_foundations select for write session failed");
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
    console.error("outline_plans select for write session failed");
    throw AppError.internal("Failed to load outline plan");
  }
  return data as OutlinePlanRow | null;
}

async function assertWriteGates(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<void> {
  const project = await getOwnedProjectRow(bindings, ownerId, projectId);
  const [foundation, outlinePlan] = await Promise.all([
    fetchFoundationRow(bindings, projectId),
    fetchOutlinePlanRow(bindings, projectId),
  ]);
  assertWriteRoomGates(project, foundation, outlinePlan);
}

async function fetchChapterOutlineRow(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<ChapterOutlineRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_outlines")
    .select(CHAPTER_SAFE_SELECT)
    .eq("id", chapterOutlineId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("chapter_outlines select for write session failed");
    throw AppError.internal("Failed to load chapter outline");
  }
  if (!data) {
    throw AppError.notFound("Chapter outline not found");
  }
  return data as ChapterOutlineRow;
}

export async function getOwnedWritingSessionRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  sessionId: string,
): Promise<WritingSessionRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("writing_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("writing_sessions select by id failed");
    throw AppError.internal("Failed to load writing session");
  }
  if (!data) {
    throw AppError.notFound("Writing session not found");
  }
  return data as WritingSessionRow;
}

async function fetchWritingStateForChapter(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<ChapterWritingStateRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_writing_states")
    .select(WRITING_STATE_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .maybeSingle();

  if (error) {
    console.error("chapter_writing_states select failed");
    throw AppError.internal("Failed to load chapter writing state");
  }
  return data as ChapterWritingStateRow | null;
}

async function fetchActiveSessionForChapter(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<WritingSessionRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("writing_sessions")
    .select(SESSION_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .eq("status", WRITING_SESSION_STATUSES.active)
    .maybeSingle();

  if (error) {
    console.error("writing_sessions select active failed");
    throw AppError.internal("Failed to load writing session");
  }
  return data as WritingSessionRow | null;
}

async function validateBeatForSession(
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
    console.error("chapter_beats select for session validation failed");
    throw AppError.internal("Failed to load chapter beat");
  }
  if (!data) {
    throw AppError.badRequest("activeBeatId does not belong to this chapter");
  }
  return data as ChapterBeatRow;
}

function assertLightMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw AppError.badRequest("metadata must be a JSON object");
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length > 20) {
    throw AppError.badRequest("metadata must have at most 20 keys");
  }
  const serialized = JSON.stringify(obj);
  if (serialized.length > METADATA_MAX_BYTES) {
    throw AppError.badRequest("metadata is too large");
  }
  for (const key of keys) {
    if (
      PROSE_FORBIDDEN_KEYS.has(key) ||
      key === "planningTruth" ||
      key === "planning_truth" ||
      key === "model" ||
      key === "provider" ||
      key === "token"
    ) {
      throw AppError.badRequest(`metadata key "${key}" is not allowed`);
    }
  }
  return obj;
}

function assertNoForbiddenSessionPatchKeys(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_SESSION_PATCH_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be updated`);
    }
    if (PROSE_FORBIDDEN_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" is not allowed on session updates`);
    }
  }
}

function toChapterOutlineSafeSummary(row: ChapterOutlineRow): ChapterOutlineSafeSummary {
  const mapped = mapChapterOutlineRow(row);
  return {
    id: mapped.id,
    chapterNumber: mapped.chapterNumber,
    title: mapped.title,
    summary: mapped.summary,
    status: mapped.status,
  };
}

async function countBeatsForChapter(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<number> {
  const admin = createServiceRoleClient(bindings);
  const { count, error } = await admin
    .from("chapter_beats")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId);

  if (error) {
    console.error("chapter_beats count failed");
    throw AppError.internal("Failed to count chapter beats");
  }
  return count ?? 0;
}

export async function startOrResumeWritingSessionForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<StartWritingSessionResult> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  const chapterOutlineId = body.chapterOutlineId;
  if (typeof chapterOutlineId !== "string" || !chapterOutlineId.trim()) {
    throw AppError.badRequest("chapterOutlineId is required");
  }

  await assertWriteGates(bindings, ownerId, projectId);
  await fetchChapterOutlineRow(bindings, projectId, chapterOutlineId);

  const existing = await fetchActiveSessionForChapter(bindings, projectId, chapterOutlineId);
  if (existing) {
    const writingState =
      (await fetchWritingStateForChapter(bindings, projectId, chapterOutlineId)) ??
      (await createDefaultWritingState(bindings, projectId, chapterOutlineId, existing.id));
    return {
      session: mapWritingSessionRow(existing),
      writingState: mapChapterWritingStateRow(writingState),
      created: false,
    };
  }

  let activeBeatId: string | null = null;
  if (body.activeBeatId !== undefined && body.activeBeatId !== null) {
    if (typeof body.activeBeatId !== "string" || !body.activeBeatId.trim()) {
      throw AppError.badRequest("activeBeatId must be a non-empty string");
    }
    await validateBeatForSession(bindings, projectId, chapterOutlineId, body.activeBeatId);
    activeBeatId = body.activeBeatId;
  }

  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();

  const { data: sessionData, error: sessionError } = await admin
    .from("writing_sessions")
    .insert({
      project_id: projectId,
      chapter_outline_id: chapterOutlineId,
      status: WRITING_SESSION_STATUSES.active,
      active_beat_id: activeBeatId,
      started_at: now,
      last_activity_at: now,
    })
    .select(SESSION_SELECT)
    .single();

  if (sessionError || !sessionData) {
    if (sessionError?.code === "23505") {
      const raced = await fetchActiveSessionForChapter(bindings, projectId, chapterOutlineId);
      if (raced) {
        const writingState =
          (await fetchWritingStateForChapter(bindings, projectId, chapterOutlineId)) ??
          (await createDefaultWritingState(bindings, projectId, chapterOutlineId, raced.id));
        return {
          session: mapWritingSessionRow(raced),
          writingState: mapChapterWritingStateRow(writingState),
          created: false,
        };
      }
    }
    console.error("writing_sessions insert failed");
    throw AppError.internal("Failed to create writing session");
  }

  const sessionRow = sessionData as WritingSessionRow;

  const { data: stateData, error: stateError } = await admin
    .from("chapter_writing_states")
    .upsert(
      {
        project_id: projectId,
        chapter_outline_id: chapterOutlineId,
        writing_session_id: sessionRow.id,
        status: CHAPTER_WRITING_STATUSES.drafting,
      },
      { onConflict: "chapter_outline_id" },
    )
    .select(WRITING_STATE_SELECT)
    .single();

  if (stateError || !stateData) {
    console.error("chapter_writing_states upsert failed");
    throw AppError.internal("Failed to update chapter writing state");
  }

  const project = await getOwnedProjectRow(bindings, ownerId, projectId);
  if (project.workflow_phase === WORKFLOW_PHASES.outline_locked) {
    await admin
      .from("projects")
      .update({
        workflow_phase: WORKFLOW_PHASES.writing,
        last_edited_at: now,
      })
      .eq("id", projectId)
      .eq("owner_id", ownerId);
  }

  return {
    session: mapWritingSessionRow(sessionRow),
    writingState: mapChapterWritingStateRow(stateData as ChapterWritingStateRow),
    created: true,
  };
}

async function createDefaultWritingState(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
  sessionId: string,
): Promise<ChapterWritingStateRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_writing_states")
    .upsert(
      {
        project_id: projectId,
        chapter_outline_id: chapterOutlineId,
        writing_session_id: sessionId,
        status: CHAPTER_WRITING_STATUSES.drafting,
      },
      { onConflict: "chapter_outline_id" },
    )
    .select(WRITING_STATE_SELECT)
    .single();

  if (error || !data) {
    console.error("chapter_writing_states default upsert failed");
    throw AppError.internal("Failed to update chapter writing state");
  }
  return data as ChapterWritingStateRow;
}

export async function getWritingSessionDetailForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  sessionId: string,
): Promise<WritingSessionDetail> {
  const sessionRow = await getOwnedWritingSessionRow(bindings, ownerId, projectId, sessionId);
  const chapterRow = await fetchChapterOutlineRow(
    bindings,
    projectId,
    sessionRow.chapter_outline_id,
  );

  const writingStateRow =
    (await fetchWritingStateForChapter(bindings, projectId, sessionRow.chapter_outline_id)) ??
    (await createDefaultWritingState(
      bindings,
      projectId,
      sessionRow.chapter_outline_id,
      sessionRow.id,
    ));

  let activeBeat: ChapterBeat | null = null;
  if (sessionRow.active_beat_id) {
    const admin = createServiceRoleClient(bindings);
    const { data, error } = await admin
      .from("chapter_beats")
      .select(BEAT_SELECT)
      .eq("id", sessionRow.active_beat_id)
      .eq("project_id", projectId)
      .eq("chapter_outline_id", sessionRow.chapter_outline_id)
      .maybeSingle();

    if (error) {
      console.error("chapter_beats select active beat failed");
      throw AppError.internal("Failed to load active beat");
    }
    if (data) {
      activeBeat = mapChapterBeatRow(data as ChapterBeatRow);
    }
  }

  const beatsCount = await countBeatsForChapter(
    bindings,
    projectId,
    sessionRow.chapter_outline_id,
  );

  return {
    session: mapWritingSessionRow(sessionRow),
    writingState: mapChapterWritingStateRow(writingStateRow),
    chapterOutline: toChapterOutlineSafeSummary(chapterRow),
    activeBeat,
    beatsCount,
  };
}

export async function patchWritingSessionForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  sessionId: string,
  raw: unknown,
): Promise<WritingSession> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  assertNoForbiddenSessionPatchKeys(body);

  const sessionRow = await getOwnedWritingSessionRow(bindings, ownerId, projectId, sessionId);

  const updates: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
  };

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !PATCHABLE_SESSION_STATUSES.has(body.status)) {
      throw AppError.badRequest("status must be active, paused, or abandoned");
    }
    updates.status = body.status;
  }

  if (body.activeBeatId !== undefined) {
    if (body.activeBeatId === null) {
      updates.active_beat_id = null;
    } else {
      if (typeof body.activeBeatId !== "string" || !body.activeBeatId.trim()) {
        throw AppError.badRequest("activeBeatId must be a non-empty string or null");
      }
      await validateBeatForSession(
        bindings,
        projectId,
        sessionRow.chapter_outline_id,
        body.activeBeatId,
      );
      updates.active_beat_id = body.activeBeatId;
    }
  }

  if (body.metadata !== undefined) {
    updates.metadata = assertLightMetadata(body.metadata) ?? {};
  }

  if (Object.keys(updates).length === 1) {
    throw AppError.badRequest("No updatable fields provided");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("writing_sessions")
    .update(updates)
    .eq("id", sessionId)
    .eq("project_id", projectId)
    .select(SESSION_SELECT)
    .single();

  if (error || !data) {
    console.error("writing_sessions patch failed");
    throw AppError.internal("Failed to update writing session");
  }

  return mapWritingSessionRow(data as WritingSessionRow);
}

export async function markWritingSessionReadyForSummaryForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  sessionId: string,
): Promise<{ session: WritingSession; writingState: ChapterWritingState }> {
  const sessionRow = await getOwnedWritingSessionRow(bindings, ownerId, projectId, sessionId);

  if (sessionRow.status === WRITING_SESSION_STATUSES.ready_for_summary) {
    throw AppError.conflict("Writing session is already ready for summary");
  }
  if (sessionRow.status === WRITING_SESSION_STATUSES.completed) {
    throw AppError.conflict("Writing session is already completed");
  }

  const beatsCount = await countBeatsForChapter(
    bindings,
    projectId,
    sessionRow.chapter_outline_id,
  );
  if (beatsCount < 1) {
    throw AppError.conflict("At least one chapter beat is required before ready for summary", {
      missing: ["beats"],
    });
  }

  const now = new Date().toISOString();
  const admin = createServiceRoleClient(bindings);

  const { data: sessionData, error: sessionError } = await admin
    .from("writing_sessions")
    .update({
      status: WRITING_SESSION_STATUSES.ready_for_summary,
      ready_for_summary_at: now,
      last_activity_at: now,
    })
    .eq("id", sessionId)
    .eq("project_id", projectId)
    .select(SESSION_SELECT)
    .single();

  if (sessionError || !sessionData) {
    console.error("writing_sessions ready_for_summary update failed");
    throw AppError.internal("Failed to mark session ready for summary");
  }

  const { data: stateData, error: stateError } = await admin
    .from("chapter_writing_states")
    .upsert(
      {
        project_id: projectId,
        chapter_outline_id: sessionRow.chapter_outline_id,
        writing_session_id: sessionId,
        status: CHAPTER_WRITING_STATUSES.ready_for_summary,
      },
      { onConflict: "chapter_outline_id" },
    )
    .select(WRITING_STATE_SELECT)
    .single();

  if (stateError || !stateData) {
    console.error("chapter_writing_states ready_for_summary upsert failed");
    throw AppError.internal("Failed to update chapter writing state");
  }

  return {
    session: mapWritingSessionRow(sessionData as WritingSessionRow),
    writingState: mapChapterWritingStateRow(stateData as ChapterWritingStateRow),
  };
}