import {
  CHAPTER_EMOTIONS,
  CHAPTER_FUNCTIONS,
  CHAPTER_OUTLINE_STATUSES,
  OUTLINE_PLAN_STATUSES,
  RETENTION_MARKER_TYPES,
  type ChapterEmotion,
  type ChapterFunction,
  type ChapterOutline,
  type ChapterOutlineMarker,
  type ChapterOutlineStatus,
  type RetentionMarkerType,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapChapterOutlineRow, type ChapterOutlineRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";

const PLAN_SELECT = "id, project_id, status";

interface OutlinePlanRefRow {
  id: string;
  project_id: string;
  status: string;
}

const CHAPTER_SELECT =
  "id, project_id, outline_plan_id, chapter_number, title, summary, purpose, chapter_function, emotional_direction, hook, ending_hook, mini_victory, pov_character_id, status, markers, metadata, created_at, updated_at";

const FUNCTION_SET = new Set<string>(Object.values(CHAPTER_FUNCTIONS));
const EMOTION_SET = new Set<string>(Object.values(CHAPTER_EMOTIONS));
const STATUS_SET = new Set<string>(Object.values(CHAPTER_OUTLINE_STATUSES));
const MARKER_TYPE_SET = new Set<string>(Object.values(RETENTION_MARKER_TYPES));

const FORBIDDEN_PATCH_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "outlinePlanId",
  "outline_plan_id",
  "chapterNumber",
  "chapter_number",
  "povCharacterId",
  "pov_character_id",
  "planningTruth",
  "planning_truth",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
]);

const PROSE_FORBIDDEN_KEYS = new Set([
  "chapterText",
  "chapter_text",
  "prose",
  "body",
  "chapterBody",
  "chapter_body",
  "fullOutline",
  "full_outline",
  "outlineDump",
  "outline_dump",
  "full_prompt",
  "fullPrompt",
  "beatText",
  "beat_text",
  "sceneText",
  "scene_text",
]);

const TITLE_MAX = 200;
const SUMMARY_MAX = 4000;
const PURPOSE_MAX = 2000;
const TEXT_FIELD_MAX = 2000;
const MARKERS_MAX = 20;
const METADATA_MAX_BYTES = 4096;

export interface ListChapterOutlinesQuery {
  status?: string;
  chapterNumber?: string;
}

async function fetchOutlinePlanRow(
  bindings: AppBindings,
  projectId: string,
): Promise<OutlinePlanRefRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("outline_plans")
    .select(PLAN_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("outline_plans select for chapters failed");
    throw AppError.internal("Failed to load outline plan");
  }
  return data as OutlinePlanRefRow | null;
}

async function getOwnedChapterOutlineRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  chapterId: string,
): Promise<{ chapter: ChapterOutlineRow; plan: OutlinePlanRefRow }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const plan = await fetchOutlinePlanRow(bindings, projectId);
  if (!plan) {
    throw AppError.notFound("Chapter outline not found");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_outlines")
    .select(CHAPTER_SELECT)
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .maybeSingle();

  if (error) {
    console.error("chapter_outlines select by id failed");
    throw AppError.internal("Failed to load chapter outline");
  }
  if (!data) {
    throw AppError.notFound("Chapter outline not found");
  }

  return { chapter: data as ChapterOutlineRow, plan };
}

function assertNoForbiddenKeys(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_PATCH_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be updated`);
    }
    if (PROSE_FORBIDDEN_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" is not allowed on chapter outline updates`);
    }
  }
}

function assertNonEmptyText(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== "string") {
    throw AppError.badRequest(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${field} cannot be empty`);
  }
  if (trimmed.length > maxLen) {
    throw AppError.badRequest(`${field} must be at most ${maxLen} characters`);
  }
  return trimmed;
}

function assertOptionalText(
  value: unknown,
  field: string,
  maxLen: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw AppError.badRequest(`${field} must be a string or null`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) {
    throw AppError.badRequest(`${field} must be at most ${maxLen} characters`);
  }
  return trimmed;
}

function assertMarkers(value: unknown): ChapterOutlineMarker[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw AppError.badRequest("markers must be an array");
  }
  if (value.length > MARKERS_MAX) {
    throw AppError.badRequest(`markers must have at most ${MARKERS_MAX} items`);
  }

  return value.map((item, index) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw AppError.badRequest(`markers[${index}] must be an object`);
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.type !== "string" || !MARKER_TYPE_SET.has(obj.type)) {
      throw AppError.badRequest(`markers[${index}].type is invalid`);
    }
    const marker: ChapterOutlineMarker = {
      type: obj.type as RetentionMarkerType,
    };
    if (obj.label !== undefined) {
      if (typeof obj.label !== "string") {
        throw AppError.badRequest(`markers[${index}].label must be a string`);
      }
      const label = obj.label.trim().slice(0, 80);
      if (label) marker.label = label;
    }
    return marker;
  });
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
    if (PROSE_FORBIDDEN_KEYS.has(key) || key === "planningTruth" || key === "planning_truth") {
      throw AppError.badRequest(`metadata key "${key}" is not allowed`);
    }
  }
  return obj;
}

function assertPlanEditableForPatch(plan: OutlinePlanRefRow): void {
  if (plan.status === OUTLINE_PLAN_STATUSES.locked) {
    throw AppError.conflict("Outline plan is locked; chapter outlines cannot be edited", {
      missing: ["outline_unlocked"],
    });
  }
}

export async function listChapterOutlinesForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  query: ListChapterOutlinesQuery = {},
): Promise<ChapterOutline[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const plan = await fetchOutlinePlanRow(bindings, projectId);
  if (!plan) {
    return [];
  }

  const admin = createServiceRoleClient(bindings);
  let dbQuery = admin
    .from("chapter_outlines")
    .select(CHAPTER_SELECT)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .order("chapter_number", { ascending: true });

  if (query.status) {
    if (!STATUS_SET.has(query.status)) {
      throw AppError.badRequest("status filter is invalid");
    }
    dbQuery = dbQuery.eq("status", query.status);
  }

  if (query.chapterNumber !== undefined && query.chapterNumber !== "") {
    const chapterNumber = Number.parseInt(query.chapterNumber, 10);
    if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
      throw AppError.badRequest("chapterNumber filter must be a positive integer");
    }
    dbQuery = dbQuery.eq("chapter_number", chapterNumber);
  }

  const { data, error } = await dbQuery;
  if (error) {
    console.error("chapter_outlines list failed");
    throw AppError.internal("Failed to list chapter outlines");
  }

  return ((data ?? []) as ChapterOutlineRow[]).map(mapChapterOutlineRow);
}

export async function getChapterOutlineForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  chapterId: string,
): Promise<ChapterOutline> {
  const { chapter } = await getOwnedChapterOutlineRow(bindings, ownerId, projectId, chapterId);
  return mapChapterOutlineRow(chapter);
}

export async function updateChapterOutlineForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  chapterId: string,
  raw: unknown,
): Promise<ChapterOutline> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  assertNoForbiddenKeys(body);

  if (Object.keys(body).length === 0) {
    throw AppError.badRequest("No updatable fields provided");
  }

  const { chapter: beforeRow, plan } = await getOwnedChapterOutlineRow(
    bindings,
    ownerId,
    projectId,
    chapterId,
  );
  assertPlanEditableForPatch(plan);

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    updates.title = assertNonEmptyText(body.title, "title", TITLE_MAX);
  }
  if (body.summary !== undefined) {
    updates.summary = assertNonEmptyText(body.summary, "summary", SUMMARY_MAX);
  }
  if (body.purpose !== undefined) {
    updates.purpose = assertOptionalText(body.purpose, "purpose", PURPOSE_MAX);
  }
  if (body.chapterFunction !== undefined) {
    if (typeof body.chapterFunction !== "string" || !FUNCTION_SET.has(body.chapterFunction)) {
      throw AppError.badRequest("chapterFunction is invalid");
    }
    updates.chapter_function = body.chapterFunction as ChapterFunction;
  }
  if (body.emotionalDirection !== undefined) {
    if (body.emotionalDirection === null) {
      updates.emotional_direction = null;
    } else if (
      typeof body.emotionalDirection !== "string" ||
      !EMOTION_SET.has(body.emotionalDirection)
    ) {
      throw AppError.badRequest("emotionalDirection is invalid");
    } else {
      updates.emotional_direction = body.emotionalDirection as ChapterEmotion;
    }
  }
  if (body.hook !== undefined) {
    updates.hook = assertOptionalText(body.hook, "hook", TEXT_FIELD_MAX);
  }
  if (body.endingHook !== undefined) {
    updates.ending_hook = assertOptionalText(body.endingHook, "endingHook", TEXT_FIELD_MAX);
  }
  if (body.miniVictory !== undefined) {
    updates.mini_victory = assertOptionalText(body.miniVictory, "miniVictory", TEXT_FIELD_MAX);
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
    updates.status = body.status as ChapterOutlineStatus;
  }
  if (body.markers !== undefined) {
    updates.markers = assertMarkers(body.markers);
  }
  if (body.metadata !== undefined) {
    updates.metadata = assertLightMetadata(body.metadata) ?? {};
  }

  if (Object.keys(updates).length === 0) {
    throw AppError.badRequest("No valid updatable fields provided");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_outlines")
    .update(updates)
    .eq("id", beforeRow.id)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .select(CHAPTER_SELECT)
    .single();

  if (error || !data) {
    console.error("chapter_outlines update failed");
    throw AppError.internal("Failed to update chapter outline");
  }

  return mapChapterOutlineRow(data as ChapterOutlineRow);
}