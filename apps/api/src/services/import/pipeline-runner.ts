import {
  IMPORT_JOB_PHASES,
  IMPORT_JOB_STATUSES,
  type ImportJob,
  type ImportJobPhase,
  type JsonObject,
} from "@vibenovel/shared";
import type { AppBindings } from "../../env.js";
import { AppError } from "../../errors.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import {
  extractDraftImportSignalsForOwner,
  materializeDraftImportProposalsForOwner,
  type DraftImportRow,
} from "../draft-import.js";
import { chunkDraftForImport } from "./chunking.js";
import {
  buildProseEmbeddingInsertRows,
  embedTextsWithOpenRouter,
  type ProseEmbeddingInsertRow,
} from "./embedding.js";
import {
  buildImportJobFailurePatch,
  buildImportJobPhasePatch,
  patchImportJobForOwner,
  resumeDraftImportJobForOwner,
} from "./job-progress.js";

const DRAFT_IMPORT_CONTENT_SELECT =
  "id, project_id, owner_id, content_text, content_hash, excerpt_preview, word_count, status, metadata, created_at, updated_at";

const RUNNER_VERSION = "draft_import_prep_runner_v1";

export interface RunDraftImportPrepOptions {
  fetcher?: typeof fetch;
  maxChunkChars?: number;
}

export interface DraftImportPrepSummary {
  chunkCount: number;
  embeddingCount: number;
  proposalCount: number;
  proposalTypes: string[];
}

export interface RunDraftImportPrepResult {
  importJob: ImportJob;
  resumed: boolean;
  prep: DraftImportPrepSummary | null;
}

async function loadDraftImportContentForRunner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<DraftImportRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("draft_imports")
    .select(DRAFT_IMPORT_CONTENT_SELECT)
    .eq("id", draftImportId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    console.error("draft_imports select for prep runner failed");
    throw AppError.internal("Failed to load draft import");
  }
  if (!data) {
    throw AppError.notFound("Draft import not found");
  }
  return data as DraftImportRow;
}

async function replaceProseEmbeddings(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
  rows: ProseEmbeddingInsertRow[],
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { error: deleteError } = await admin
    .from("prose_embeddings")
    .delete()
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .eq("draft_import_id", draftImportId);

  if (deleteError) {
    console.error("prose_embeddings cleanup failed");
    throw AppError.internal("Failed to refresh prose embeddings");
  }

  if (rows.length === 0) return;

  const { error: insertError } = await admin.from("prose_embeddings").insert(rows);
  if (insertError) {
    console.error("prose_embeddings insert failed");
    throw AppError.internal("Failed to store prose embeddings");
  }
}

function failureCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  return "IMPORT_PREP_FAILED";
}

function failureMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Draft import prep failed";
}

async function markPhase(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  importJobId: string,
  phase: ImportJobPhase,
  phaseState: JsonObject,
  metadata?: JsonObject,
): Promise<ImportJob> {
  return patchImportJobForOwner(
    bindings,
    ownerId,
    projectId,
    importJobId,
    buildImportJobPhasePatch(phase, phaseState, metadata ? { metadata } : {}),
  );
}

export async function runDraftImportPrepForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
  options: RunDraftImportPrepOptions = {},
): Promise<RunDraftImportPrepResult> {
  const resumedJob = await resumeDraftImportJobForOwner(
    bindings,
    ownerId,
    projectId,
    draftImportId,
  );
  let importJob = resumedJob.importJob;

  if (importJob.status === IMPORT_JOB_STATUSES.succeeded) {
    return {
      importJob,
      resumed: resumedJob.resumed,
      prep: null,
    };
  }

  let activePhase: ImportJobPhase = importJob.currentPhase;
  let activeState: JsonObject = importJob.phaseState;

  try {
    const row = await loadDraftImportContentForRunner(
      bindings,
      ownerId,
      projectId,
      draftImportId,
    );

    activePhase = IMPORT_JOB_PHASES.chunking;
    const chunks = await chunkDraftForImport({
      projectId,
      draftImportId,
      content: row.content_text,
      maxChunkChars: options.maxChunkChars,
    });
    activeState = {
      runner: RUNNER_VERSION,
      chunkCount: chunks.length,
      wordCount: row.word_count,
    };
    importJob = await markPhase(bindings, ownerId, projectId, importJob.id, activePhase, activeState);

    activePhase = IMPORT_JOB_PHASES.embedding;
    activeState = {
      runner: RUNNER_VERSION,
      chunkCount: chunks.length,
      sourceRefs: chunks.map((chunk) => chunk.sourceRef),
    };
    importJob = await markPhase(bindings, ownerId, projectId, importJob.id, activePhase, activeState);
    const embeddingResult = await embedTextsWithOpenRouter(
      bindings,
      chunks.map((chunk) => chunk.chunkText),
      options.fetcher,
    );
    const embeddingRows = buildProseEmbeddingInsertRows({
      ownerId,
      importJobId: importJob.id,
      chunks,
      embeddingResult,
    });
    await replaceProseEmbeddings(bindings, ownerId, projectId, draftImportId, embeddingRows);

    activePhase = IMPORT_JOB_PHASES.analysis;
    activeState = {
      runner: RUNNER_VERSION,
      chunkCount: chunks.length,
      embeddingCount: embeddingRows.length,
    };
    importJob = await markPhase(bindings, ownerId, projectId, importJob.id, activePhase, activeState);

    activePhase = IMPORT_JOB_PHASES.entity_extraction;
    activeState = {
      runner: RUNNER_VERSION,
      chunkCount: chunks.length,
      embeddingCount: embeddingRows.length,
    };
    importJob = await markPhase(bindings, ownerId, projectId, importJob.id, activePhase, activeState);
    await extractDraftImportSignalsForOwner(bindings, ownerId, projectId, draftImportId);

    activePhase = IMPORT_JOB_PHASES.style_extraction;
    activeState = {
      runner: RUNNER_VERSION,
      chunkCount: chunks.length,
      embeddingCount: embeddingRows.length,
    };
    importJob = await markPhase(bindings, ownerId, projectId, importJob.id, activePhase, activeState);
    const proposals = await materializeDraftImportProposalsForOwner(
      bindings,
      ownerId,
      projectId,
      draftImportId,
    );

    const prep: DraftImportPrepSummary = {
      chunkCount: chunks.length,
      embeddingCount: embeddingRows.length,
      proposalCount: proposals.proposalCount,
      proposalTypes: proposals.proposalTypes,
    };

    activePhase = IMPORT_JOB_PHASES.ready_for_review;
    activeState = {
      runner: RUNNER_VERSION,
      ...prep,
    };
    importJob = await patchImportJobForOwner(
      bindings,
      ownerId,
      projectId,
      importJob.id,
      buildImportJobPhasePatch(activePhase, activeState, {
        metadata: {
          runner: RUNNER_VERSION,
          draftImportId,
          proposalIds: proposals.proposalIds,
        },
      }),
    );

    return {
      importJob,
      resumed: resumedJob.resumed,
      prep,
    };
  } catch (error) {
    await patchImportJobForOwner(
      bindings,
      ownerId,
      projectId,
      importJob.id,
      buildImportJobFailurePatch({
        phase: activePhase,
        errorCode: failureCode(error),
        errorMessage: failureMessage(error),
        phaseState: activeState,
        metadata: {
          runner: RUNNER_VERSION,
          draftImportId,
        },
      }),
    );

    if (error instanceof AppError) throw error;
    throw AppError.internal("Draft import prep failed");
  }
}
