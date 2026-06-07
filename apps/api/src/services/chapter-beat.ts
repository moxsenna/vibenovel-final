import {
  CHAPTER_BEAT_STATUSES,
  WRITING_SESSION_STATUSES,
  type ChapterBeat,
  type ChapterBeatStatus,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapChapterBeatRow, type ChapterBeatRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";
import { getOwnedWritingSessionRow } from "./write-session.js";

const BEAT_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, beat_number, title, summary, direction, status, emotional_shift, must_include, must_not_include, word_target, stop_condition, sort_order, metadata, created_at, updated_at";

const STATUS_SET = new Set<string>(Object.values(CHAPTER_BEAT_STATUSES));

const FORBIDDEN_BEAT_PATCH_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "chapterOutlineId",
  "chapter_outline_id",
  "writingSessionId",
  "writing_session_id",
  "beatNumber",
  "beat_number",
  "contextPacketJson",
  "context_packet_json",
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

const TITLE_MAX = 200;
const SUMMARY_MAX = 2000;
const DIRECTION_MAX = 2000;
const TEXT_FIELD_MAX = 500;
const ARRAY_MAX = 20;
const METADATA_MAX_BYTES = 4096;

/** Deterministic stub beats — parity supabase/seed.sql + apps/web/src/mocks/chapter.ts Bab 1. */
export const STUB_BEAT_TEMPLATES: ReadonlyArray<{
  beatNumber: number;
  title: string;
  summary: string;
  direction: string;
  emotionalShift: string;
  mustInclude: string[];
  mustNotInclude: string[];
  wordTarget: number;
  stopCondition: string;
  sortOrder: number;
}> = [
  {
    beatNumber: 1,
    title: "Makan malam dimulai",
    summary:
      "Nadira sibuk di dapur sambil berusaha tampak tenang, padahal malam ini ada makan malam keluarga.",
    direction:
      "Tunjukkan rutinitas Nadira yang hafal di luar kepala — dia tahu apa yang diharapkan keluarga, tapi jangan buat dia terlihat lemah total.",
    emotionalShift: "tenang di permukaan, tegang di bawah",
    mustInclude: ["rutinitas dapur Nadira", "antisipasi tamu keluarga"],
    mustNotInclude: ["nama Siska disebutkan", "konfrontasi langsung"],
    wordTarget: 350,
    stopCondition: "Makan malam siap disajikan; tamu belum datang.",
    sortOrder: 1,
  },
  {
    beatNumber: 2,
    title: "Keluarga datang",
    summary:
      "Tamu keluarga mulai berdatangan; suasana ramai tapi Nadira merasa seperti tamu di rumahnya sendiri.",
    direction:
      "Buat kontras antara keramaian dan kesendirian Nadira — dia sibuk melayani, tapi jarang dipanggil namanya.",
    emotionalShift: "ramai di luar, sendirian di dalam",
    mustInclude: ["kontras keramaian vs isolasi Nadira"],
    mustNotInclude: ["Nadira menangis terang-terangan"],
    wordTarget: 400,
    stopCondition: "Semua tamu sudah duduk di meja makan.",
    sortOrder: 2,
  },
  {
    beatNumber: 3,
    title: "Sindiran mertua",
    summary:
      "Bu Siti menyindir Nadira di depan tamu dengan kalimat yang terdengar sopan tapi menusuk.",
    direction:
      "Sindiran harus terasa halus di permukaan, tajam di bawah — pembaca ikut merasakan malu yang ditahan Nadira.",
    emotionalShift: "malu tertahan, tekanan sosial",
    mustInclude: ["sindiran halus Bu Siti", "reaksi Nadira menahan diri"],
    mustNotInclude: ["Nadira membalas keras"],
    wordTarget: 400,
    stopCondition: "Sindiran selesai; suasana meja makan tegang.",
    sortOrder: 3,
  },
  {
    beatNumber: 4,
    title: "Arman diam",
    summary: "Sindiran makin tajam; Arman memilih diam dan mengalihkan topik.",
    direction:
      "Fokus pada keheningan Arman — bukan sekadar marah, tapi kecewa karena dia tidak berdiri di sisi Nadira.",
    emotionalShift: "kecewa, ditinggalkan sendirian",
    mustInclude: ["keheningan Arman", "Nadira menunggu dukungan"],
    mustNotInclude: ["Arman membela Nadira"],
    wordTarget: 400,
    stopCondition: "Arman mengalihkan topik; Nadira menahan emosi.",
    sortOrder: 4,
  },
  {
    beatNumber: 5,
    title: "Pesan di ponsel",
    summary:
      "Saat makan malam hampir selesai, ponsel Arman bergetar — Nadira melihat nama yang tidak dikenalnya.",
    direction:
      "Akhiri dengan hook kuat: nama Siska terlihat sekilas, Arman buru-buru mematikan layar. Rahasia belum terbuka penuh.",
    emotionalShift: "curiga, penasaran, dingin",
    mustInclude: ["ponsel bergetar", "hook penasaran di akhir"],
    mustNotInclude: ["rahasia Siska dijelaskan penuh"],
    wordTarget: 450,
    stopCondition: "Ponsel dimatikan; Nadira menyimpan kecurigaan.",
    sortOrder: 5,
  },
];

export interface GenerateBeatsInput {
  regenerate?: boolean;
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

function assertStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw AppError.badRequest(`${field} must be an array`);
  }
  if (value.length > ARRAY_MAX) {
    throw AppError.badRequest(`${field} must have at most ${ARRAY_MAX} items`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw AppError.badRequest(`${field}[${index}] must be a string`);
    }
    const trimmed = item.trim();
    if (!trimmed) {
      throw AppError.badRequest(`${field}[${index}] cannot be empty`);
    }
    if (trimmed.length > TEXT_FIELD_MAX) {
      throw AppError.badRequest(`${field}[${index}] is too long`);
    }
    return trimmed;
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
    if (
      PROSE_FORBIDDEN_KEYS.has(key) ||
      key === "model" ||
      key === "provider" ||
      key === "token"
    ) {
      throw AppError.badRequest(`metadata key "${key}" is not allowed`);
    }
  }
  return obj;
}

function assertNoForbiddenBeatPatchKeys(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_BEAT_PATCH_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be updated`);
    }
    if (PROSE_FORBIDDEN_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" is not allowed on beat updates`);
    }
  }
}

async function fetchBeatsForChapter(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<ChapterBeatRow[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_beats")
    .select(BEAT_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .order("sort_order", { ascending: true })
    .order("beat_number", { ascending: true });

  if (error) {
    console.error("chapter_beats list failed");
    throw AppError.internal("Failed to load chapter beats");
  }
  return (data ?? []) as ChapterBeatRow[];
}

async function linkBeatsToSession(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
  sessionId: string,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { error } = await admin
    .from("chapter_beats")
    .update({ writing_session_id: sessionId })
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .is("writing_session_id", null);

  if (error) {
    console.error("chapter_beats link session failed");
    throw AppError.internal("Failed to link beats to session");
  }
}

async function proseVersionsExistForBeats(
  bindings: AppBindings,
  beatIds: string[],
): Promise<boolean> {
  if (beatIds.length === 0) return false;
  const admin = createServiceRoleClient(bindings);
  const { count, error } = await admin
    .from("chapter_prose_versions")
    .select("id", { count: "exact", head: true })
    .in("chapter_beat_id", beatIds);

  if (error) {
    console.error("chapter_prose_versions count failed");
    throw AppError.internal("Failed to check prose versions");
  }
  return (count ?? 0) > 0;
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
    console.error("writing_sessions touch activity failed");
    throw AppError.internal("Failed to update session activity");
  }
}

export async function getOwnedBeatRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  beatId: string,
): Promise<ChapterBeatRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_beats")
    .select(BEAT_SELECT)
    .eq("id", beatId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("chapter_beats select by id failed");
    throw AppError.internal("Failed to load chapter beat");
  }
  if (!data) {
    throw AppError.notFound("Chapter beat not found");
  }
  return data as ChapterBeatRow;
}

export async function listBeatsForSessionForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  sessionId: string,
): Promise<ChapterBeat[]> {
  const sessionRow = await getOwnedWritingSessionRow(bindings, ownerId, projectId, sessionId);
  const rows = await fetchBeatsForChapter(bindings, projectId, sessionRow.chapter_outline_id);
  return rows.map(mapChapterBeatRow);
}

export async function generateBeatsForSessionForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  sessionId: string,
  raw: unknown,
): Promise<{ beats: ChapterBeat[]; created: boolean }> {
  const body =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const regenerate = body.regenerate === true;

  const sessionRow = await getOwnedWritingSessionRow(bindings, ownerId, projectId, sessionId);

  if (
    sessionRow.status === WRITING_SESSION_STATUSES.ready_for_summary ||
    sessionRow.status === WRITING_SESSION_STATUSES.completed
  ) {
    throw AppError.conflict("Cannot generate beats for a session that is ready or completed");
  }

  const existing = await fetchBeatsForChapter(
    bindings,
    projectId,
    sessionRow.chapter_outline_id,
  );

  if (existing.length > 0 && !regenerate) {
    await linkBeatsToSession(
      bindings,
      projectId,
      sessionRow.chapter_outline_id,
      sessionRow.id,
    );
    await touchSessionActivity(bindings, projectId, sessionRow.id);
    return { beats: existing.map(mapChapterBeatRow), created: false };
  }

  if (existing.length > 0 && regenerate) {
    const beatIds = existing.map((row) => row.id);
    const hasProse = await proseVersionsExistForBeats(bindings, beatIds);
    if (hasProse) {
      throw AppError.conflict(
        "Cannot regenerate beats while prose versions exist for this chapter",
        { missing: ["no_prose_versions"] },
      );
    }
  }

  const admin = createServiceRoleClient(bindings);

  if (existing.length > 0) {
    const { error: deleteError } = await admin
      .from("chapter_beats")
      .delete()
      .eq("project_id", projectId)
      .eq("chapter_outline_id", sessionRow.chapter_outline_id);

    if (deleteError) {
      console.error("chapter_beats delete for regenerate failed");
      throw AppError.internal("Failed to regenerate chapter beats");
    }

    if (sessionRow.active_beat_id) {
      await admin
        .from("writing_sessions")
        .update({ active_beat_id: null })
        .eq("id", sessionRow.id)
        .eq("project_id", projectId);
    }
  }

  const inserts = STUB_BEAT_TEMPLATES.map((template) => ({
    project_id: projectId,
    chapter_outline_id: sessionRow.chapter_outline_id,
    writing_session_id: sessionRow.id,
    beat_number: template.beatNumber,
    title: template.title,
    summary: template.summary,
    direction: template.direction,
    status: CHAPTER_BEAT_STATUSES.empty,
    emotional_shift: template.emotionalShift,
    must_include: template.mustInclude,
    must_not_include: template.mustNotInclude,
    word_target: template.wordTarget,
    stop_condition: template.stopCondition,
    sort_order: template.sortOrder,
    metadata: { generator: "beat_stub_deterministic" },
  }));

  const { data, error } = await admin.from("chapter_beats").insert(inserts).select(BEAT_SELECT);

  if (error || !data) {
    console.error("chapter_beats insert stub failed");
    throw AppError.internal("Failed to generate chapter beats");
  }

  await touchSessionActivity(bindings, projectId, sessionRow.id);

  const rows = (data as ChapterBeatRow[]).sort(
    (a, b) => a.sort_order - b.sort_order || a.beat_number - b.beat_number,
  );
  return { beats: rows.map(mapChapterBeatRow), created: true };
}

export async function patchChapterBeatForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  beatId: string,
  raw: unknown,
): Promise<ChapterBeat> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  assertNoForbiddenBeatPatchKeys(body);

  const beatRow = await getOwnedBeatRow(bindings, ownerId, projectId, beatId);

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    updates.title = assertNonEmptyText(body.title, "title", TITLE_MAX);
  }
  if (body.summary !== undefined) {
    updates.summary = assertNonEmptyText(body.summary, "summary", SUMMARY_MAX);
  }
  if (body.direction !== undefined) {
    updates.direction = assertOptionalText(body.direction, "direction", DIRECTION_MAX);
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status must be empty, draft, or done");
    }
    updates.status = body.status as ChapterBeatStatus;
  }
  if (body.emotionalShift !== undefined) {
    updates.emotional_shift = assertOptionalText(
      body.emotionalShift,
      "emotionalShift",
      TEXT_FIELD_MAX,
    );
  }
  if (body.mustInclude !== undefined) {
    updates.must_include = assertStringArray(body.mustInclude, "mustInclude") ?? [];
  }
  if (body.mustNotInclude !== undefined) {
    updates.must_not_include = assertStringArray(body.mustNotInclude, "mustNotInclude") ?? [];
  }
  if (body.wordTarget !== undefined) {
    if (body.wordTarget === null) {
      updates.word_target = null;
    } else {
      if (typeof body.wordTarget !== "number" || !Number.isInteger(body.wordTarget)) {
        throw AppError.badRequest("wordTarget must be a positive integer");
      }
      if (body.wordTarget <= 0) {
        throw AppError.badRequest("wordTarget must be greater than 0");
      }
      updates.word_target = body.wordTarget;
    }
  }
  if (body.stopCondition !== undefined) {
    updates.stop_condition = assertOptionalText(
      body.stopCondition,
      "stopCondition",
      TEXT_FIELD_MAX,
    );
  }
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== "number" || !Number.isInteger(body.sortOrder)) {
      throw AppError.badRequest("sortOrder must be an integer");
    }
    updates.sort_order = body.sortOrder;
  }
  if (body.metadata !== undefined) {
    updates.metadata = assertLightMetadata(body.metadata) ?? {};
  }

  if (Object.keys(updates).length === 0) {
    throw AppError.badRequest("No updatable fields provided");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_beats")
    .update(updates)
    .eq("id", beatId)
    .eq("project_id", projectId)
    .select(BEAT_SELECT)
    .single();

  if (error || !data) {
    console.error("chapter_beats patch failed");
    throw AppError.internal("Failed to update chapter beat");
  }

  if (beatRow.writing_session_id) {
    await touchSessionActivity(bindings, projectId, beatRow.writing_session_id);
  }

  return mapChapterBeatRow(data as ChapterBeatRow);
}