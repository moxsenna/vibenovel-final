import {
  CHAPTER_BEAT_STATUSES,
  CHAPTER_PROSE_SOURCES,
  WRITING_SESSION_STATUSES,
  type ChapterProseSource,
  type ChapterProseVersion,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapChapterProseVersionRow,
  type ChapterProseVersionRow,
  type FoundationRow,
  type OutlinePlanRow,
  type WritingSessionRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedBeatRow } from "./chapter-beat.js";
import { getOwnedProjectRow } from "./project.js";
import { assertWriteRoomGates } from "./write-snapshot.js";

const PROSE_SELECT =
  "id, project_id, chapter_beat_id, version_number, prose_text, word_count, source, is_current, context_packet_log_id, metadata, created_at";

const SESSION_SELECT =
  "id, project_id, chapter_outline_id, status, active_beat_id, started_at, last_activity_at, ready_for_summary_at, metadata, created_at, updated_at";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

const PLAN_SELECT =
  "id, project_id, status, season_label, arc_summary, retention_summary, target_chapter_count, planning_notes, metadata, locked_at, created_at, updated_at";

const PACKET_LOG_SELECT =
  "id, project_id, chapter_outline_id, chapter_beat_id, packet_hash, builder_version, created_at";

const PROSE_MAX_CHARS = 30_000;
const METADATA_MAX_BYTES = 4096;

const ALLOWED_SOURCES = new Set<string>([
  CHAPTER_PROSE_SOURCES.user_edited,
  CHAPTER_PROSE_SOURCES.stub_deterministic,
]);

const WRITABLE_SESSION_STATUSES = new Set<string>([
  WRITING_SESSION_STATUSES.active,
  WRITING_SESSION_STATUSES.paused,
]);

const PROSE_LEAKAGE_MARKERS = [
  "planningtruth",
  "planning_truth",
  "full_prompt",
  "context_packet",
  "packet_json",
  "openrouter",
  "provider",
  "model",
  "token",
];

const METADATA_FORBIDDEN_KEYS = new Set([
  "full_prompt",
  "fullPrompt",
  "context_packet",
  "contextPacket",
  "packet_json",
  "packetJson",
  "contextPacketJson",
  "context_packet_json",
  "planningTruth",
  "planning_truth",
  "model",
  "provider",
  "token",
  "openrouter",
  "openRouter",
]);

export interface BeatProseVersionsResult {
  versions: ChapterProseVersion[];
  currentVersion: ChapterProseVersion | null;
}

export interface SaveProseDraftResult {
  version: ChapterProseVersion;
  chapterWordCount: number;
}

export interface MakeCurrentProseResult {
  version: ChapterProseVersion;
  chapterWordCount: number;
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
    console.error("story_foundations select for prose draft failed");
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
    console.error("outline_plans select for prose draft failed");
    throw AppError.internal("Failed to load outline plan");
  }
  return data as OutlinePlanRow | null;
}

async function assertProseWriteGates(
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

async function requireWritableSessionForChapter(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<WritingSessionRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("writing_sessions")
    .select(SESSION_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .in("status", [...WRITABLE_SESSION_STATUSES])
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("writing_sessions select for prose gate failed");
    throw AppError.internal("Failed to load writing session");
  }
  if (!data) {
    throw AppError.conflict("Writing session required", { missing: ["writing_session"] });
  }
  return data as WritingSessionRow;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function assertProseTextSafe(proseText: string): void {
  const lower = proseText.toLowerCase();

  for (const marker of PROSE_LEAKAGE_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      throw AppError.badRequest("Prose text contains disallowed internal metadata markers");
    }
  }

  if (
    lower.includes('"currentchapter"') &&
    lower.includes('"revealgate"') &&
    lower.includes('"forbiddenreveals"')
  ) {
    throw AppError.badRequest("Prose text appears to contain a context packet dump");
  }
}

function assertNonEmptyProseText(value: unknown): string {
  if (typeof value !== "string") {
    throw AppError.badRequest("proseText must be a string");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest("proseText cannot be empty");
  }
  if (trimmed.length > PROSE_MAX_CHARS) {
    throw AppError.badRequest(`proseText must be at most ${PROSE_MAX_CHARS} characters`);
  }
  assertProseTextSafe(trimmed);
  return trimmed;
}

function assertProseSource(value: unknown): ChapterProseSource {
  if (value === undefined || value === null) {
    return CHAPTER_PROSE_SOURCES.user_edited;
  }
  if (typeof value !== "string") {
    throw AppError.badRequest("source must be a string");
  }
  if (value === CHAPTER_PROSE_SOURCES.ai_generated) {
    throw AppError.badRequest("ai_generated source is reserved");
  }
  if (!ALLOWED_SOURCES.has(value)) {
    throw AppError.badRequest("source must be user_edited or stub_deterministic");
  }
  return value as ChapterProseSource;
}

function assertLightMetadata(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
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
    if (METADATA_FORBIDDEN_KEYS.has(key)) {
      throw AppError.badRequest(`metadata key "${key}" is not allowed`);
    }
  }
  return obj;
}

async function validateContextPacketLogId(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
  beatId: string,
  logId: string,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("context_packet_logs")
    .select(PACKET_LOG_SELECT)
    .eq("id", logId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("context_packet_logs select for prose link failed");
    throw AppError.internal("Failed to load context packet log");
  }
  if (!data) {
    throw AppError.badRequest("contextPacketLogId not found for this project");
  }

  const log = data as {
    chapter_outline_id: string;
    chapter_beat_id: string | null;
  };

  if (log.chapter_outline_id !== chapterOutlineId) {
    throw AppError.badRequest("contextPacketLogId does not match this chapter");
  }
  if (log.chapter_beat_id !== null && log.chapter_beat_id !== beatId) {
    throw AppError.badRequest("contextPacketLogId does not match this beat");
  }
}

async function getOwnedProseVersionRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  versionId: string,
): Promise<ChapterProseVersionRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_prose_versions")
    .select(PROSE_SELECT)
    .eq("id", versionId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("chapter_prose_versions select by id failed");
    throw AppError.internal("Failed to load prose version");
  }
  if (!data) {
    throw AppError.notFound("Prose version not found");
  }
  return data as ChapterProseVersionRow;
}

async function computeChapterWordCount(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<number> {
  const admin = createServiceRoleClient(bindings);

  const { data: beats, error: beatsError } = await admin
    .from("chapter_beats")
    .select("id")
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId);

  if (beatsError) {
    console.error("chapter_beats select for word count failed");
    throw AppError.internal("Failed to compute chapter word count");
  }

  const beatIds = ((beats ?? []) as { id: string }[]).map((b) => b.id);
  if (beatIds.length === 0) {
    return 0;
  }

  const { data: versions, error: versionsError } = await admin
    .from("chapter_prose_versions")
    .select("word_count")
    .eq("project_id", projectId)
    .in("chapter_beat_id", beatIds)
    .eq("is_current", true);

  if (versionsError) {
    console.error("chapter_prose_versions select for word count failed");
    throw AppError.internal("Failed to compute chapter word count");
  }

  return ((versions ?? []) as { word_count: number }[]).reduce(
    (sum, row) => sum + (row.word_count ?? 0),
    0,
  );
}

async function updateChapterWritingState(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
  sessionId: string | null,
  chapterWordCount: number,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();

  const { error } = await admin.from("chapter_writing_states").upsert(
    {
      project_id: projectId,
      chapter_outline_id: chapterOutlineId,
      writing_session_id: sessionId,
      word_count: chapterWordCount,
      last_saved_at: now,
    },
    { onConflict: "chapter_outline_id" },
  );

  if (error) {
    console.error("chapter_writing_states upsert for prose failed");
    throw AppError.internal("Failed to update chapter writing state");
  }
}

async function touchSessionActivity(
  bindings: AppBindings,
  projectId: string,
  sessionId: string,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { error } = await admin
    .from("writing_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("project_id", projectId);

  if (error) {
    console.error("writing_sessions touch activity for prose failed");
    throw AppError.internal("Failed to update session activity");
  }
}

function resolveBeatStatusAfterSave(currentStatus: string): string {
  if (currentStatus === CHAPTER_BEAT_STATUSES.done) {
    return CHAPTER_BEAT_STATUSES.done;
  }
  return CHAPTER_BEAT_STATUSES.draft;
}

export async function listProseVersionsForBeatForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  beatId: string,
): Promise<BeatProseVersionsResult> {
  await assertProseWriteGates(bindings, ownerId, projectId);
  await getOwnedBeatRow(bindings, ownerId, projectId, beatId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_prose_versions")
    .select(PROSE_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_beat_id", beatId)
    .order("version_number", { ascending: false });

  if (error) {
    console.error("chapter_prose_versions list failed");
    throw AppError.internal("Failed to load prose versions");
  }

  const rows = (data ?? []) as ChapterProseVersionRow[];
  const versions = rows.map(mapChapterProseVersionRow);
  const currentVersion = versions.find((v) => v.isCurrent) ?? null;

  return { versions, currentVersion };
}

export async function getProseVersionForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  versionId: string,
): Promise<ChapterProseVersion> {
  await assertProseWriteGates(bindings, ownerId, projectId);
  const row = await getOwnedProseVersionRow(bindings, ownerId, projectId, versionId);
  return mapChapterProseVersionRow(row);
}

export interface SaveAiGeneratedProseInput {
  proseText: string;
  contextPacketLogId: string;
}

export interface SaveAiRewrittenProseInput {
  proseText: string;
  contextPacketLogId: string;
  sourceProseVersionId: string;
  rewriteMode: string;
  generationAttemptId: string;
}

export async function getCurrentProseVersionRowForBeat(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  beatId: string,
): Promise<ChapterProseVersionRow | null> {
  await assertProseWriteGates(bindings, ownerId, projectId);
  await getOwnedBeatRow(bindings, ownerId, projectId, beatId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_prose_versions")
    .select(PROSE_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_beat_id", beatId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    console.error("chapter_prose_versions current lookup failed");
    throw AppError.internal("Failed to load current prose version");
  }
  if (!data) return null;
  return data as ChapterProseVersionRow;
}

/** Internal path for AI generation — source fixed to ai_generated; not exposed via public POST body. */
export async function saveAiGeneratedProseVersionForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  beatId: string,
  input: SaveAiGeneratedProseInput,
): Promise<SaveProseDraftResult> {
  const proseText = assertNonEmptyProseText(input.proseText);
  if (typeof input.contextPacketLogId !== "string" || !input.contextPacketLogId.trim()) {
    throw AppError.badRequest("contextPacketLogId is required for AI prose");
  }

  await assertProseWriteGates(bindings, ownerId, projectId);
  const beatRow = await getOwnedBeatRow(bindings, ownerId, projectId, beatId);
  const session = await requireWritableSessionForChapter(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
  );

  await validateContextPacketLogId(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
    beatId,
    input.contextPacketLogId.trim(),
  );

  const admin = createServiceRoleClient(bindings);
  const wordCount = countWords(proseText);

  const { data: maxRow, error: maxError } = await admin
    .from("chapter_prose_versions")
    .select("version_number")
    .eq("chapter_beat_id", beatId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    console.error("chapter_prose_versions max version lookup failed");
    throw AppError.internal("Failed to save AI prose");
  }

  const nextVersion =
    maxRow !== null ? ((maxRow as { version_number: number }).version_number + 1) : 1;

  const { error: clearError } = await admin
    .from("chapter_prose_versions")
    .update({ is_current: false })
    .eq("chapter_beat_id", beatId)
    .eq("project_id", projectId)
    .eq("is_current", true);

  if (clearError) {
    console.error("chapter_prose_versions clear current failed");
    throw AppError.internal("Failed to save AI prose");
  }

  const { data: inserted, error: insertError } = await admin
    .from("chapter_prose_versions")
    .insert({
      project_id: projectId,
      chapter_beat_id: beatId,
      version_number: nextVersion,
      prose_text: proseText,
      word_count: wordCount,
      source: CHAPTER_PROSE_SOURCES.ai_generated,
      is_current: true,
      context_packet_log_id: input.contextPacketLogId.trim(),
      metadata: {},
    })
    .select(PROSE_SELECT)
    .single();

  if (insertError || !inserted) {
    console.error("chapter_prose_versions AI insert failed");
    throw AppError.internal("Failed to save AI prose");
  }

  const newBeatStatus = resolveBeatStatusAfterSave(beatRow.status);
  if (newBeatStatus !== beatRow.status) {
    const { error: beatError } = await admin
      .from("chapter_beats")
      .update({ status: newBeatStatus })
      .eq("id", beatId)
      .eq("project_id", projectId);

    if (beatError) {
      console.error("chapter_beats status update after AI prose failed");
      throw AppError.internal("Failed to update beat status");
    }
  }

  const chapterWordCount = await computeChapterWordCount(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
  );

  await updateChapterWritingState(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
    session.id,
    chapterWordCount,
  );

  await touchSessionActivity(bindings, projectId, session.id);

  return {
    version: mapChapterProseVersionRow(inserted as ChapterProseVersionRow),
    chapterWordCount,
  };
}

/** Internal path for AI rewrite — source ai_generated with rewrite metadata. */
export async function saveAiRewrittenProseVersionForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  beatId: string,
  input: SaveAiRewrittenProseInput,
): Promise<SaveProseDraftResult> {
  const proseText = assertNonEmptyProseText(input.proseText);
  if (typeof input.contextPacketLogId !== "string" || !input.contextPacketLogId.trim()) {
    throw AppError.badRequest("contextPacketLogId is required for AI rewrite prose");
  }
  if (typeof input.sourceProseVersionId !== "string" || !input.sourceProseVersionId.trim()) {
    throw AppError.badRequest("sourceProseVersionId is required for AI rewrite prose");
  }
  if (typeof input.rewriteMode !== "string" || !input.rewriteMode.trim()) {
    throw AppError.badRequest("rewriteMode is required for AI rewrite prose");
  }
  if (typeof input.generationAttemptId !== "string" || !input.generationAttemptId.trim()) {
    throw AppError.badRequest("generationAttemptId is required for AI rewrite prose");
  }

  const metadata = assertLightMetadata({
    generationType: "prose_rewrite",
    rewriteMode: input.rewriteMode.trim(),
    sourceProseVersionId: input.sourceProseVersionId.trim(),
    generationAttemptId: input.generationAttemptId.trim(),
  });

  await assertProseWriteGates(bindings, ownerId, projectId);
  const beatRow = await getOwnedBeatRow(bindings, ownerId, projectId, beatId);
  const session = await requireWritableSessionForChapter(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
  );

  await validateContextPacketLogId(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
    beatId,
    input.contextPacketLogId.trim(),
  );

  const admin = createServiceRoleClient(bindings);
  const wordCount = countWords(proseText);

  const { data: maxRow, error: maxError } = await admin
    .from("chapter_prose_versions")
    .select("version_number")
    .eq("chapter_beat_id", beatId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    console.error("chapter_prose_versions max version lookup failed");
    throw AppError.internal("Failed to save AI rewrite prose");
  }

  const nextVersion =
    maxRow !== null ? ((maxRow as { version_number: number }).version_number + 1) : 1;

  const { error: clearError } = await admin
    .from("chapter_prose_versions")
    .update({ is_current: false })
    .eq("chapter_beat_id", beatId)
    .eq("project_id", projectId)
    .eq("is_current", true);

  if (clearError) {
    console.error("chapter_prose_versions clear current failed");
    throw AppError.internal("Failed to save AI rewrite prose");
  }

  const { data: inserted, error: insertError } = await admin
    .from("chapter_prose_versions")
    .insert({
      project_id: projectId,
      chapter_beat_id: beatId,
      version_number: nextVersion,
      prose_text: proseText,
      word_count: wordCount,
      source: CHAPTER_PROSE_SOURCES.ai_generated,
      is_current: true,
      context_packet_log_id: input.contextPacketLogId.trim(),
      metadata,
    })
    .select(PROSE_SELECT)
    .single();

  if (insertError || !inserted) {
    console.error("chapter_prose_versions AI rewrite insert failed");
    throw AppError.internal("Failed to save AI rewrite prose");
  }

  const newBeatStatus = resolveBeatStatusAfterSave(beatRow.status);
  if (newBeatStatus !== beatRow.status) {
    const { error: beatError } = await admin
      .from("chapter_beats")
      .update({ status: newBeatStatus })
      .eq("id", beatId)
      .eq("project_id", projectId);

    if (beatError) {
      console.error("chapter_beats status update after AI rewrite prose failed");
      throw AppError.internal("Failed to update beat status");
    }
  }

  const chapterWordCount = await computeChapterWordCount(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
  );

  await updateChapterWritingState(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
    session.id,
    chapterWordCount,
  );

  await touchSessionActivity(bindings, projectId, session.id);

  return {
    version: mapChapterProseVersionRow(inserted as ChapterProseVersionRow),
    chapterWordCount,
  };
}

export async function saveProseDraftForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  beatId: string,
  raw: unknown,
): Promise<SaveProseDraftResult> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;

  await assertProseWriteGates(bindings, ownerId, projectId);
  const beatRow = await getOwnedBeatRow(bindings, ownerId, projectId, beatId);

  const session = await requireWritableSessionForChapter(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
  );

  const proseText = assertNonEmptyProseText(body.proseText);
  const source = assertProseSource(body.source);
  const metadata = assertLightMetadata(body.metadata);

  let contextPacketLogId: string | null = null;
  if (body.contextPacketLogId !== undefined && body.contextPacketLogId !== null) {
    if (typeof body.contextPacketLogId !== "string" || !body.contextPacketLogId.trim()) {
      throw AppError.badRequest("contextPacketLogId must be a non-empty string");
    }
    contextPacketLogId = body.contextPacketLogId.trim();
    await validateContextPacketLogId(
      bindings,
      projectId,
      beatRow.chapter_outline_id,
      beatId,
      contextPacketLogId,
    );
  }

  const admin = createServiceRoleClient(bindings);
  const wordCount = countWords(proseText);

  const { data: maxRow, error: maxError } = await admin
    .from("chapter_prose_versions")
    .select("version_number")
    .eq("chapter_beat_id", beatId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    console.error("chapter_prose_versions max version lookup failed");
    throw AppError.internal("Failed to save prose draft");
  }

  const nextVersion =
    maxRow !== null ? ((maxRow as { version_number: number }).version_number + 1) : 1;

  const { error: clearError } = await admin
    .from("chapter_prose_versions")
    .update({ is_current: false })
    .eq("chapter_beat_id", beatId)
    .eq("project_id", projectId)
    .eq("is_current", true);

  if (clearError) {
    console.error("chapter_prose_versions clear current failed");
    throw AppError.internal("Failed to save prose draft");
  }

  const { data: inserted, error: insertError } = await admin
    .from("chapter_prose_versions")
    .insert({
      project_id: projectId,
      chapter_beat_id: beatId,
      version_number: nextVersion,
      prose_text: proseText,
      word_count: wordCount,
      source,
      is_current: true,
      context_packet_log_id: contextPacketLogId,
      metadata,
    })
    .select(PROSE_SELECT)
    .single();

  if (insertError || !inserted) {
    console.error("chapter_prose_versions insert failed");
    throw AppError.internal("Failed to save prose draft");
  }

  const newBeatStatus = resolveBeatStatusAfterSave(beatRow.status);
  if (newBeatStatus !== beatRow.status) {
    const { error: beatError } = await admin
      .from("chapter_beats")
      .update({ status: newBeatStatus })
      .eq("id", beatId)
      .eq("project_id", projectId);

    if (beatError) {
      console.error("chapter_beats status update after prose save failed");
      throw AppError.internal("Failed to update beat status");
    }
  }

  const chapterWordCount = await computeChapterWordCount(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
  );

  await updateChapterWritingState(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
    session.id,
    chapterWordCount,
  );

  await touchSessionActivity(bindings, projectId, session.id);

  return {
    version: mapChapterProseVersionRow(inserted as ChapterProseVersionRow),
    chapterWordCount,
  };
}

export async function makeProseVersionCurrentForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  versionId: string,
): Promise<MakeCurrentProseResult> {
  await assertProseWriteGates(bindings, ownerId, projectId);
  const versionRow = await getOwnedProseVersionRow(bindings, ownerId, projectId, versionId);
  const beatRow = await getOwnedBeatRow(bindings, ownerId, projectId, versionRow.chapter_beat_id);

  const session = await requireWritableSessionForChapter(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
  );

  if (versionRow.is_current) {
    const chapterWordCount = await computeChapterWordCount(
      bindings,
      projectId,
      beatRow.chapter_outline_id,
    );
    return {
      version: mapChapterProseVersionRow(versionRow),
      chapterWordCount,
    };
  }

  const admin = createServiceRoleClient(bindings);

  const { error: clearError } = await admin
    .from("chapter_prose_versions")
    .update({ is_current: false })
    .eq("chapter_beat_id", versionRow.chapter_beat_id)
    .eq("project_id", projectId)
    .eq("is_current", true);

  if (clearError) {
    console.error("chapter_prose_versions clear current for make-current failed");
    throw AppError.internal("Failed to set current prose version");
  }

  const { data: updated, error: updateError } = await admin
    .from("chapter_prose_versions")
    .update({ is_current: true })
    .eq("id", versionId)
    .eq("project_id", projectId)
    .select(PROSE_SELECT)
    .single();

  if (updateError || !updated) {
    console.error("chapter_prose_versions make-current failed");
    throw AppError.internal("Failed to set current prose version");
  }

  const chapterWordCount = await computeChapterWordCount(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
  );

  await updateChapterWritingState(
    bindings,
    projectId,
    beatRow.chapter_outline_id,
    session.id,
    chapterWordCount,
  );

  await touchSessionActivity(bindings, projectId, session.id);

  return {
    version: mapChapterProseVersionRow(updated as ChapterProseVersionRow),
    chapterWordCount,
  };
}