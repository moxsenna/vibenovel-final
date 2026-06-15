import {
  IMPORT_JOB_PHASES,
  IMPORT_JOB_STATUSES,
  type ImportJob,
  type ImportJobPhase,
  type ImportJobStatus,
  type JsonObject,
} from "@vibenovel/shared";
import type { AppBindings } from "../../env.js";
import { AppError } from "../../errors.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import { getOwnedProjectRow } from "../project.js";

const IMPORT_JOB_SELECT =
  "id, project_id, owner_id, draft_import_id, status, current_phase, progress_percent, error_code, error_message_safe, phase_state, metadata, started_at, finished_at, created_at, updated_at";

const PHASE_PROGRESS: Record<ImportJobPhase, number> = {
  [IMPORT_JOB_PHASES.uploaded]: 5,
  [IMPORT_JOB_PHASES.chunking]: 20,
  [IMPORT_JOB_PHASES.embedding]: 45,
  [IMPORT_JOB_PHASES.analysis]: 60,
  [IMPORT_JOB_PHASES.entity_extraction]: 75,
  [IMPORT_JOB_PHASES.style_extraction]: 90,
  [IMPORT_JOB_PHASES.ready_for_review]: 100,
};

const ERROR_MARKER_RE = /openrouter|provider|model|token|api[_-]?key|secret|sk-[a-z0-9_-]+/i;
const SAFE_ERROR_MAX_CHARS = 180;

export interface ImportJobRow {
  id: string;
  project_id: string;
  owner_id: string;
  draft_import_id: string | null;
  status: ImportJobStatus | string;
  current_phase: ImportJobPhase | string;
  progress_percent: number;
  error_code: string | null;
  error_message_safe: string | null;
  phase_state: JsonObject | null;
  metadata: JsonObject | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportJobPatch {
  status: ImportJobStatus;
  current_phase: ImportJobPhase;
  progress_percent: number;
  error_code: string | null;
  error_message_safe: string | null;
  phase_state: JsonObject;
  metadata?: JsonObject;
  started_at?: string;
  finished_at?: string | null;
}

export interface ImportJobPhasePatchOptions {
  status?: ImportJobStatus;
  progressPercent?: number;
  metadata?: JsonObject;
}

export interface ImportJobFailureInput {
  phase: ImportJobPhase;
  errorCode: string;
  errorMessage: string;
  phaseState?: JsonObject;
  metadata?: JsonObject;
}

export interface ImportJobResumeInput {
  id: string;
  status: ImportJobStatus | string;
  current_phase: ImportJobPhase | string;
  progress_percent: number;
  phase_state: JsonObject | null;
  metadata: JsonObject | null;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function normalizeJsonObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function phaseProgress(phase: ImportJobPhase): number {
  return PHASE_PROGRESS[phase] ?? 0;
}

function sanitizeErrorMessage(phase: ImportJobPhase, message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized || ERROR_MARKER_RE.test(normalized)) {
    return `Import job failed during ${phase}; resume is available.`;
  }
  return normalized.slice(0, SAFE_ERROR_MAX_CHARS);
}

export function buildImportJobPhasePatch(
  phase: ImportJobPhase,
  phaseState: JsonObject = {},
  options: ImportJobPhasePatchOptions = {},
): ImportJobPatch {
  const status =
    options.status ??
    (phase === IMPORT_JOB_PHASES.ready_for_review
      ? IMPORT_JOB_STATUSES.succeeded
      : IMPORT_JOB_STATUSES.running);

  return {
    status,
    current_phase: phase,
    progress_percent: clampProgress(options.progressPercent ?? phaseProgress(phase)),
    error_code: null,
    error_message_safe: null,
    phase_state: phaseState,
    ...(options.metadata ? { metadata: options.metadata } : {}),
    ...(status === IMPORT_JOB_STATUSES.succeeded ? { finished_at: new Date().toISOString() } : {}),
  };
}

export function buildImportJobFailurePatch(input: ImportJobFailureInput): ImportJobPatch {
  return {
    status: IMPORT_JOB_STATUSES.failed,
    current_phase: input.phase,
    progress_percent: phaseProgress(input.phase),
    error_code: input.errorCode.slice(0, 80),
    error_message_safe: sanitizeErrorMessage(input.phase, input.errorMessage),
    phase_state: input.phaseState ?? {},
    ...(input.metadata ? { metadata: input.metadata } : {}),
    finished_at: new Date().toISOString(),
  };
}

export function buildImportJobResumePatch(job: ImportJobResumeInput): ImportJobPatch {
  const phase = Object.values(IMPORT_JOB_PHASES).includes(job.current_phase as ImportJobPhase)
    ? (job.current_phase as ImportJobPhase)
    : IMPORT_JOB_PHASES.uploaded;
  const metadata = normalizeJsonObject(job.metadata);
  const resumeCount =
    typeof metadata.resumeCount === "number" && Number.isFinite(metadata.resumeCount)
      ? metadata.resumeCount + 1
      : 1;

  return {
    status: IMPORT_JOB_STATUSES.running,
    current_phase: phase,
    progress_percent: clampProgress(job.progress_percent),
    error_code: null,
    error_message_safe: null,
    phase_state: normalizeJsonObject(job.phase_state),
    metadata: {
      ...metadata,
      resumeCount,
      lastResumedAt: new Date().toISOString(),
    },
    started_at: new Date().toISOString(),
    finished_at: null,
  };
}

export function mapImportJob(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    draftImportId: row.draft_import_id,
    status: row.status as ImportJobStatus,
    currentPhase: row.current_phase as ImportJobPhase,
    progressPercent: row.progress_percent,
    errorCode: row.error_code,
    errorMessageSafe: row.error_message_safe,
    phaseState: normalizeJsonObject(row.phase_state),
    metadata: normalizeJsonObject(row.metadata),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertOwnedDraftImport(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<void> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("draft_imports")
    .select("id")
    .eq("id", draftImportId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    console.error("draft_imports ownership check for import job failed");
    throw AppError.internal("Failed to load draft import");
  }
  if (!data) {
    throw AppError.notFound("Draft import not found");
  }
}

async function loadLatestImportJobRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<ImportJobRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("import_jobs")
    .select(IMPORT_JOB_SELECT)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .eq("draft_import_id", draftImportId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("import_jobs latest select failed");
    throw AppError.internal("Failed to load import job");
  }
  return data as ImportJobRow | null;
}

export async function getLatestDraftImportJobForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<{ importJob: ImportJob | null }> {
  await assertOwnedDraftImport(bindings, ownerId, projectId, draftImportId);
  const row = await loadLatestImportJobRow(bindings, ownerId, projectId, draftImportId);
  return { importJob: row ? mapImportJob(row) : null };
}

export async function resumeDraftImportJobForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<{ importJob: ImportJob; resumed: boolean }> {
  await assertOwnedDraftImport(bindings, ownerId, projectId, draftImportId);
  const admin = createServiceRoleClient(bindings);
  const existing = await loadLatestImportJobRow(bindings, ownerId, projectId, draftImportId);

  if (!existing) {
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("import_jobs")
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        draft_import_id: draftImportId,
        ...buildImportJobPhasePatch(IMPORT_JOB_PHASES.uploaded, {
          resumedFrom: null,
        }),
        metadata: { resumeCount: 0, createdBy: "import_job_resume" },
        started_at: now,
      })
      .select(IMPORT_JOB_SELECT)
      .single();

    if (error || !data) {
      console.error("import_jobs insert failed");
      throw AppError.internal("Failed to create import job");
    }
    return { importJob: mapImportJob(data as ImportJobRow), resumed: false };
  }

  if (existing.status === IMPORT_JOB_STATUSES.succeeded) {
    return { importJob: mapImportJob(existing), resumed: false };
  }

  const patch = buildImportJobResumePatch(existing);
  const { data, error } = await admin
    .from("import_jobs")
    .update(patch)
    .eq("id", existing.id)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .select(IMPORT_JOB_SELECT)
    .single();

  if (error || !data) {
    console.error("import_jobs resume update failed");
    throw AppError.internal("Failed to resume import job");
  }

  return { importJob: mapImportJob(data as ImportJobRow), resumed: true };
}

export async function patchImportJobForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  importJobId: string,
  patch: ImportJobPatch,
): Promise<ImportJob> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("import_jobs")
    .update(patch)
    .eq("id", importJobId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .select(IMPORT_JOB_SELECT)
    .single();

  if (error || !data) {
    console.error("import_jobs patch failed");
    throw AppError.internal("Failed to update import job");
  }

  return mapImportJob(data as ImportJobRow);
}
