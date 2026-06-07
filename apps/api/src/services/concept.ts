import {
  STORY_CONCEPT_SOURCES,
  STORY_CONCEPT_STATUSES,
  WORKFLOW_PHASES,
  type JsonObject,
  type Project,
  type StoryConcept,
  type StoryConceptStatus,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapProjectRow,
  mapStoryConceptRow,
  type DetectedSignalRow,
  type ProjectRow,
  type StoryConceptRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";

const CONCEPT_SELECT =
  "id, project_id, title, short_pitch, reader_promise, core_conflict, genre, tone, target_reader, status, source, score, payload, created_at, updated_at";

const SIGNAL_SELECT =
  "id, project_id, session_id, type, label, value, confidence, status, source_message_id, metadata, created_at, updated_at";

const STATUS_SET = new Set<string>(Object.values(STORY_CONCEPT_STATUSES));

const TITLE_MAX_LENGTH = 120;
const PITCH_MAX_LENGTH = 2000;
const FIELD_MAX_LENGTH = 500;

const FORBIDDEN_BODY_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "status",
  "source",
  "selectedConceptId",
  "selected_concept_id",
  "workflowPhase",
  "workflow_phase",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
]);

interface ConceptDraft {
  title: string;
  shortPitch: string;
  readerPromise: string;
  coreConflict: string;
  genre: string;
  tone: string;
  targetReader: string;
  score: number;
  payload: JsonObject;
}

interface GenerationContext {
  projectTitle: string;
  projectGenre: string | null;
  genreLabel: string;
  toneLabel: string;
  targetReader: string;
  hasFamilyConflict: boolean;
  hasRevengeTone: boolean;
  hasSecret: boolean;
}

function assertNoForbiddenKeys(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_BODY_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" is not allowed in request body`);
    }
  }
}

function assertOptionalString(
  value: unknown,
  field: string,
  maxLength: number,
  required = false,
): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw AppError.badRequest(`${field} is required`);
    return undefined;
  }
  if (typeof value !== "string") {
    throw AppError.badRequest(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw AppError.badRequest(`${field} is required`);
  }
  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${field} must be at most ${maxLength} characters`);
  }
  return trimmed || undefined;
}

function assertOptionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw AppError.badRequest(`${field} must be a number`);
  }
  return value;
}

function assertOptionalPayload(value: unknown): JsonObject | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw AppError.badRequest("payload must be an object");
  }
  return value as JsonObject;
}

function assertOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw AppError.badRequest(`${field} must be a boolean`);
  }
  return value;
}

function sortConceptRows(rows: StoryConceptRow[]): StoryConceptRow[] {
  return [...rows].sort((a, b) => {
    if (a.status === STORY_CONCEPT_STATUSES.selected && b.status !== STORY_CONCEPT_STATUSES.selected) {
      return -1;
    }
    if (b.status === STORY_CONCEPT_STATUSES.selected && a.status !== STORY_CONCEPT_STATUSES.selected) {
      return 1;
    }
    const scoreA = a.score ?? 0;
    const scoreB = b.score ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.created_at.localeCompare(b.created_at);
  });
}

async function getOwnedConceptRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  conceptId: string,
): Promise<StoryConceptRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_concepts")
    .select(CONCEPT_SELECT)
    .eq("id", conceptId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("story_concepts select by id failed");
    throw AppError.internal("Failed to load concept");
  }
  if (!data) throw AppError.notFound("Concept not found");
  return data as StoryConceptRow;
}

async function listConceptRowsForProject(
  bindings: AppBindings,
  projectId: string,
  options: { status?: StoryConceptStatus; includeRejected?: boolean },
): Promise<StoryConceptRow[]> {
  const admin = createServiceRoleClient(bindings);
  let query = admin.from("story_concepts").select(CONCEPT_SELECT).eq("project_id", projectId);

  if (options.status) {
    query = query.eq("status", options.status);
  } else if (!options.includeRejected) {
    query = query.in("status", [STORY_CONCEPT_STATUSES.proposed, STORY_CONCEPT_STATUSES.selected]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("story_concepts list failed");
    throw AppError.internal("Failed to list concepts");
  }

  return sortConceptRows((data ?? []) as StoryConceptRow[]);
}

async function loadGenerationContext(
  bindings: AppBindings,
  projectRow: ProjectRow,
  basedOnSignals: boolean,
): Promise<GenerationContext> {
  let genreLabel = projectRow.genre ?? "Drama Rumah Tangga";
  let toneLabel = "Emosional";
  let targetReader = "hp_serial";
  let hasFamilyConflict = false;
  let hasRevengeTone = false;
  let hasSecret = false;

  if (basedOnSignals) {
    const admin = createServiceRoleClient(bindings);
    const { data: signals, error } = await admin
      .from("detected_signals")
      .select(SIGNAL_SELECT)
      .eq("project_id", projectRow.id)
      .neq("status", "dismissed")
      .order("created_at", { ascending: true });

    if (!error && signals) {
      for (const row of signals as DetectedSignalRow[]) {
        if (row.type === "genre" && row.label) genreLabel = row.label;
        if (row.type === "tone" && row.label) toneLabel = row.label;
        if (row.type === "target_reader" && row.value) targetReader = row.value;
        if (row.type === "relationship_dynamic") hasFamilyConflict = true;
        if (row.type === "reader_promise" || row.type === "tone") {
          if (/balas|bangkit|revenge/i.test(row.label + row.value)) hasRevengeTone = true;
        }
        if (row.type === "secret_candidate") hasSecret = true;
      }
    }
  }

  const titleLower = projectRow.title.toLowerCase();
  if (/istri|suami|mertua|rumah tangga|keluarga/.test(titleLower)) hasFamilyConflict = true;
  if (/buang|bangkit|balas|dendam/.test(titleLower)) hasRevengeTone = true;

  return {
    projectTitle: projectRow.title,
    projectGenre: projectRow.genre,
    genreLabel,
    toneLabel,
    targetReader,
    hasFamilyConflict,
    hasRevengeTone,
    hasSecret,
  };
}

function buildConceptDrafts(ctx: GenerationContext, batchId: string): ConceptDraft[] {
  const lead =
    ctx.projectTitle && ctx.projectTitle !== "Untitled Project"
      ? ctx.projectTitle
      : "Cerita Perempuan yang Bangkit";

  const emotionalTitle = ctx.hasFamilyConflict
    ? "Luka yang Dibayar Mahal"
    : `${lead}: Harga Diri`;

  const regretTitle = "Setelah Aku Pergi";
  const revengeTitle = ctx.hasRevengeTone ? lead : "Istri yang Mereka Remehkan";

  return [
    {
      title: emotionalTitle,
      shortPitch: `Seorang perempuan di tengah ${ctx.genreLabel.toLowerCase()} menghadapi tekanan keluarga dan pengkhianatan — setiap luka punya harganya, dan dia perlahan menemukan suaranya.`,
      readerPromise:
        "Perjalanan realistis menemukan suara dan harga diri — tanpa keajaiban instan, tapi memuaskan dibaca.",
      coreConflict:
        "Memilih antara mempertahankan rumah tangga demi anak-anak atau menuntut keadilan yang bisa menghancurkan segalanya.",
      genre: ctx.genreLabel,
      tone: ctx.toneLabel,
      targetReader: ctx.targetReader,
      score: 78.5,
      payload: {
        batchId,
        generator: "deterministic_stub",
        badgeLabel: `${ctx.genreLabel} / Emosional`,
        badgeIcon: "favorite",
        whyReadersCare: "Konflik keluarga dekat dengan kehidupan sehari-hari pembaca.",
        emotionalPromise: "Baper perlahan yang terasa adil dan relatable.",
        riskNotes: ctx.hasSecret ? "Potensi rahasia besar — tahan di fondasi nanti." : null,
        decorativeAccent: "primary-soft",
      },
    },
    {
      title: regretTitle,
      shortPitch: `Keputusan untuk pergi membawa luka yang menghantui semua orang yang pernah meremehkannya — ${ctx.genreLabel} dengan nuansa penyesalan.`,
      readerPromise:
        "Momen baper dan penyesalan yang menyentuh; pembaca ingin tahu apakah ada ruang pengampunan.",
      coreConflict:
        "Mantan istri yang bangkit harus berhadapan lagi dengan keluarga yang dulu merendahkannya.",
      genre: ctx.genreLabel,
      tone: "Penyesalan",
      targetReader: ctx.targetReader,
      score: 81.0,
      payload: {
        batchId,
        generator: "deterministic_stub",
        badgeLabel: "Drama Keluarga / Penyesalan",
        badgeIcon: "auto_awesome",
        featured: true,
        whyReadersCare: "Adegan konfrontasi emosional yang bikin betah baca bab demi bab.",
        emotionalPromise: "Penyesalan yang menusuk tapi tidak manipulatif.",
        riskNotes: null,
        decorativeAccent: "secondary-container",
      },
    },
    {
      title: revengeTitle,
      shortPitch: `Diremehkan lalu dianggap lemah — tapi dia bangkit dengan rencana tenang, mematikan, dan memuaskan dalam ${ctx.genreLabel.toLowerCase()}.`,
      readerPromise:
        "Kemenangan kecil di tiap bab dan hook kuat — cocok untuk serial mobile yang dibaca bertahap.",
      coreConflict:
        "Menjalankan pembalasan elegan tanpa kehilangan moral sebagai ibu dan perempuan yang ingin dihormati.",
      genre: ctx.genreLabel,
      tone: ctx.hasRevengeTone ? ctx.toneLabel : "Balas Dendam / Satisfying",
      targetReader: ctx.targetReader,
      score: 88.0,
      payload: {
        batchId,
        generator: "deterministic_stub",
        badgeLabel: "Balas Dendam / Satisfying",
        badgeIcon: "local_fire_department",
        whyReadersCare: "Ritme revenge yang memuaskan dengan hook di akhir bab.",
        emotionalPromise: "Balas dendam emosional yang terasa adil, bukan instan.",
        riskNotes: null,
        decorativeAccent: "success-soft",
      },
    },
  ];
}

async function insertConceptDrafts(
  bindings: AppBindings,
  projectId: string,
  drafts: ConceptDraft[],
): Promise<StoryConcept[]> {
  const admin = createServiceRoleClient(bindings);
  const rows = drafts.map((draft) => ({
    project_id: projectId,
    title: draft.title,
    short_pitch: draft.shortPitch,
    reader_promise: draft.readerPromise,
    core_conflict: draft.coreConflict,
    genre: draft.genre,
    tone: draft.tone,
    target_reader: draft.targetReader,
    status: STORY_CONCEPT_STATUSES.proposed,
    source: STORY_CONCEPT_SOURCES.stub,
    score: draft.score,
    payload: draft.payload,
  }));

  const { data, error } = await admin.from("story_concepts").insert(rows).select(CONCEPT_SELECT);

  if (error || !data) {
    console.error("story_concepts batch insert failed");
    throw AppError.internal("Failed to generate concepts");
  }

  return sortConceptRows(data as StoryConceptRow[]).map(mapStoryConceptRow);
}

export async function listConceptsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  query: { status?: string; includeRejected?: string },
): Promise<StoryConcept[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  let statusFilter: StoryConceptStatus | undefined;
  if (query.status) {
    if (!STATUS_SET.has(query.status)) {
      throw AppError.badRequest("status is invalid");
    }
    statusFilter = query.status as StoryConceptStatus;
  }

  const includeRejected = query.includeRejected === "true";
  const rows = await listConceptRowsForProject(bindings, projectId, {
    status: statusFilter,
    includeRejected,
  });

  return rows.map(mapStoryConceptRow);
}

export async function generateConceptsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<{ concepts: StoryConcept[]; created: boolean }> {
  assertNoForbiddenKeys(body);
  const projectRow = await getOwnedProjectRow(bindings, ownerId, projectId);

  const regenerate = assertOptionalBoolean(body.regenerate, "regenerate") ?? false;
  const basedOnSignals = assertOptionalBoolean(body.basedOnSignals, "basedOnSignals") ?? true;

  const activeRows = await listConceptRowsForProject(bindings, projectId, {
    includeRejected: false,
  });

  if (!regenerate && activeRows.length >= 3) {
    return {
      concepts: activeRows.map(mapStoryConceptRow),
      created: false,
    };
  }

  const admin = createServiceRoleClient(bindings);

  if (regenerate) {
    const { error: rejectError } = await admin
      .from("story_concepts")
      .update({ status: STORY_CONCEPT_STATUSES.rejected })
      .eq("project_id", projectId)
      .eq("status", STORY_CONCEPT_STATUSES.proposed);

    if (rejectError) {
      console.error("story_concepts reject old proposed failed");
      throw AppError.internal("Failed to regenerate concepts");
    }
  }

  const batchId = crypto.randomUUID();
  const ctx = await loadGenerationContext(bindings, projectRow, basedOnSignals);
  const drafts = buildConceptDrafts(ctx, batchId);
  const concepts = await insertConceptDrafts(bindings, projectId, drafts);

  await admin
    .from("projects")
    .update({ workflow_phase: WORKFLOW_PHASES.concepts })
    .eq("id", projectId)
    .neq("workflow_phase", WORKFLOW_PHASES.foundation_locked);

  return { concepts, created: true };
}

export async function getConceptForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  conceptId: string,
): Promise<StoryConcept> {
  const row = await getOwnedConceptRow(bindings, ownerId, projectId, conceptId);
  return mapStoryConceptRow(row);
}

export async function updateConceptForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  conceptId: string,
  body: Record<string, unknown>,
): Promise<StoryConcept> {
  assertNoForbiddenKeys(body);
  const existing = await getOwnedConceptRow(bindings, ownerId, projectId, conceptId);

  if (existing.status === STORY_CONCEPT_STATUSES.selected) {
    throw AppError.conflict("Selected concepts cannot be edited in Sprint 3");
  }
  if (existing.status === STORY_CONCEPT_STATUSES.rejected) {
    throw AppError.conflict("Rejected concepts cannot be edited");
  }

  const updates: Record<string, unknown> = {};

  const title = assertOptionalString(body.title, "title", TITLE_MAX_LENGTH);
  if (title !== undefined) updates.title = title;

  const shortPitch = assertOptionalString(body.shortPitch, "shortPitch", PITCH_MAX_LENGTH);
  if (shortPitch !== undefined) updates.short_pitch = shortPitch;

  const shortPitchSnake = assertOptionalString(body.short_pitch, "short_pitch", PITCH_MAX_LENGTH);
  if (shortPitchSnake !== undefined) updates.short_pitch = shortPitchSnake;

  const readerPromise = assertOptionalString(body.readerPromise, "readerPromise", PITCH_MAX_LENGTH);
  if (readerPromise !== undefined) updates.reader_promise = readerPromise;

  const coreConflict = assertOptionalString(body.coreConflict, "coreConflict", PITCH_MAX_LENGTH);
  if (coreConflict !== undefined) updates.core_conflict = coreConflict;

  const genre = assertOptionalString(body.genre, "genre", FIELD_MAX_LENGTH);
  if (genre !== undefined) updates.genre = genre;

  const tone = assertOptionalString(body.tone, "tone", FIELD_MAX_LENGTH);
  if (tone !== undefined) updates.tone = tone;

  const targetReader = assertOptionalString(body.targetReader, "targetReader", FIELD_MAX_LENGTH);
  if (targetReader !== undefined) updates.target_reader = targetReader;

  const score = assertOptionalNumber(body.score, "score");
  if (score !== undefined) updates.score = score;

  const payload = assertOptionalPayload(body.payload);
  if (payload !== undefined) {
    updates.payload = { ...parseJsonObject(existing.payload), ...payload };
  }

  if (Object.keys(updates).length === 0) {
    throw AppError.badRequest("No valid fields to update");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_concepts")
    .update(updates)
    .eq("id", conceptId)
    .eq("project_id", projectId)
    .eq("status", STORY_CONCEPT_STATUSES.proposed)
    .select(CONCEPT_SELECT)
    .single();

  if (error || !data) {
    console.error("story_concepts update failed");
    throw AppError.internal("Failed to update concept");
  }

  return mapStoryConceptRow(data as StoryConceptRow);
}

function parseJsonObject(value: unknown): JsonObject {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

export interface SelectConceptResult {
  concept: StoryConcept;
  project: Pick<Project, "id" | "selectedConceptId" | "workflowPhase">;
}

export async function selectConceptForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  conceptId: string,
): Promise<SelectConceptResult> {
  const conceptRow = await getOwnedConceptRow(bindings, ownerId, projectId, conceptId);

  if (conceptRow.status === STORY_CONCEPT_STATUSES.rejected) {
    throw AppError.conflict("Rejected concepts cannot be selected");
  }

  const admin = createServiceRoleClient(bindings);

  const { error: clearSelectedError } = await admin
    .from("story_concepts")
    .update({ status: STORY_CONCEPT_STATUSES.rejected })
    .eq("project_id", projectId)
    .eq("status", STORY_CONCEPT_STATUSES.selected)
    .neq("id", conceptId);

  if (clearSelectedError) {
    console.error("story_concepts clear selected failed");
    throw AppError.internal("Failed to select concept");
  }

  const { error: rejectOthersError } = await admin
    .from("story_concepts")
    .update({ status: STORY_CONCEPT_STATUSES.rejected })
    .eq("project_id", projectId)
    .eq("status", STORY_CONCEPT_STATUSES.proposed)
    .neq("id", conceptId);

  if (rejectOthersError) {
    console.error("story_concepts reject others failed");
    throw AppError.internal("Failed to select concept");
  }

  const { data: selectedRow, error: selectError } = await admin
    .from("story_concepts")
    .update({ status: STORY_CONCEPT_STATUSES.selected })
    .eq("id", conceptId)
    .eq("project_id", projectId)
    .select(CONCEPT_SELECT)
    .single();

  if (selectError || !selectedRow) {
    console.error("story_concepts select target failed");
    throw AppError.internal("Failed to select concept");
  }

  const { data: projectData, error: projectError } = await admin
    .from("projects")
    .update({
      selected_concept_id: conceptId,
      workflow_phase: WORKFLOW_PHASES.foundation,
    })
    .eq("id", projectId)
    .select("id, owner_id, title, genre, status, current_chapter, entry_path, is_active, last_edited_at, workflow_phase, selected_concept_id, created_at, updated_at")
    .single();

  if (projectError || !projectData) {
    console.error("projects update selected concept failed");
    throw AppError.internal("Failed to update project workflow");
  }

  const project = mapProjectRow(projectData as ProjectRow);

  return {
    concept: mapStoryConceptRow(selectedRow as StoryConceptRow),
    project: {
      id: project.id,
      selectedConceptId: project.selectedConceptId ?? conceptId,
      workflowPhase: project.workflowPhase ?? WORKFLOW_PHASES.foundation,
    },
  };
}