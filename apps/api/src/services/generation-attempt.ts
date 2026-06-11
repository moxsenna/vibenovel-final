import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  GENERATION_STATUSES,
  type GenerationStatus,
  type GenerationType,
  type GenerationAttempt,
  type WriterQualityMode,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { writeAuditLog } from "./audit.js";
import { generateCorrelationId, sanitizeAuditMetadata } from "./audit-snapshot.js";

const ATTEMPT_SELECT =
  "id, project_id, user_id, chapter_outline_id, beat_id, writing_session_id, generation_type, status, idempotency_key, provider, model, prompt_hash, context_packet_log_id, input_tokens, output_tokens, estimated_cost_usd, credit_cost, error_code, error_message_safe, output_entity_type, output_entity_id, metadata, created_at, updated_at";

export interface GenerationAttemptRow {
  id: string;
  project_id: string;
  user_id: string;
  chapter_outline_id: string | null;
  beat_id: string | null;
  writing_session_id: string | null;
  generation_type: string;
  status: string;
  idempotency_key: string;
  provider: string | null;
  model: string | null;
  prompt_hash: string | null;
  context_packet_log_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  credit_cost: number;
  error_code: string | null;
  error_message_safe: string | null;
  output_entity_type: string | null;
  output_entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationAttemptSafeSummary {
  id: string;
  status: GenerationStatus;
  generationType: GenerationType;
  creditCost: number;
  provider: string | null;
  model: string | null;
  promptHash: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  outputEntityType: string | null;
  outputEntityId: string | null;
  errorCode: string | null;
  errorMessageSafe: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGenerationAttemptInput {
  projectId: string;
  userId: string;
  chapterOutlineId?: string | null;
  beatId?: string | null;
  writingSessionId?: string | null;
  generationType: GenerationType;
  idempotencyKey: string;
  creditCost: number;
  promptHash: string;
  contextPacketLogId?: string | null;
  qualityMode: WriterQualityMode;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export function mapGenerationAttemptRow(row: GenerationAttemptRow): GenerationAttempt {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    chapterOutlineId: row.chapter_outline_id,
    beatId: row.beat_id,
    writingSessionId: row.writing_session_id,
    generationType: row.generation_type as GenerationType,
    status: row.status as GenerationStatus,
    idempotencyKey: row.idempotency_key,
    provider: row.provider,
    model: row.model,
    promptHash: row.prompt_hash,
    contextPacketLogId: row.context_packet_log_id,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostUsd:
      row.estimated_cost_usd !== null ? Number(row.estimated_cost_usd) : null,
    creditCost: row.credit_cost,
    errorCode: row.error_code,
    errorMessageSafe: row.error_message_safe,
    outputEntityType: row.output_entity_type,
    outputEntityId: row.output_entity_id,
    metadata: (row.metadata ?? {}) as GenerationAttempt["metadata"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toGenerationAttemptSafeSummary(
  attempt: GenerationAttempt,
): GenerationAttemptSafeSummary {
  return {
    id: attempt.id,
    status: attempt.status,
    generationType: attempt.generationType,
    creditCost: attempt.creditCost,
    provider: attempt.provider,
    model: attempt.model,
    promptHash: attempt.promptHash,
    inputTokens: attempt.inputTokens,
    outputTokens: attempt.outputTokens,
    estimatedCostUsd: attempt.estimatedCostUsd,
    outputEntityType: attempt.outputEntityType,
    outputEntityId: attempt.outputEntityId,
    errorCode: attempt.errorCode,
    errorMessageSafe: attempt.errorMessageSafe,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  };
}

function truncateSafeMessage(message: string, max = 200): string {
  const trimmed = message.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

export async function getGenerationAttemptByIdempotencyKey(
  bindings: AppBindings,
  userId: string,
  idempotencyKey: string,
): Promise<GenerationAttempt | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("generation_attempts")
    .select(ATTEMPT_SELECT)
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    console.error("generation_attempts idempotency lookup failed");
    throw AppError.internal("Failed to load generation attempt");
  }
  if (!data) return null;
  return mapGenerationAttemptRow(data as GenerationAttemptRow);
}

export async function getGenerationAttemptById(
  bindings: AppBindings,
  attemptId: string,
): Promise<GenerationAttempt | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("generation_attempts")
    .select(ATTEMPT_SELECT)
    .eq("id", attemptId)
    .maybeSingle();

  if (error) {
    console.error("generation_attempts select by id failed");
    throw AppError.internal("Failed to load generation attempt");
  }
  if (!data) return null;
  return mapGenerationAttemptRow(data as GenerationAttemptRow);
}

export async function createGenerationAttempt(
  bindings: AppBindings,
  input: CreateGenerationAttemptInput,
): Promise<GenerationAttempt> {
  const admin = createServiceRoleClient(bindings);
  const correlationId = input.correlationId ?? generateCorrelationId();
  const metadata = sanitizeAuditMetadata({
    qualityMode: input.qualityMode,
    correlationId,
    ...(input.metadata ?? {}),
  });

  const { data, error } = await admin
    .from("generation_attempts")
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      chapter_outline_id: input.chapterOutlineId ?? null,
      beat_id: input.beatId ?? null,
      writing_session_id: input.writingSessionId ?? null,
      generation_type: input.generationType,
      status: GENERATION_STATUSES.pending,
      idempotency_key: input.idempotencyKey,
      prompt_hash: input.promptHash,
      context_packet_log_id: input.contextPacketLogId ?? null,
      credit_cost: input.creditCost,
      metadata,
    })
    .select(ATTEMPT_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        "CREDIT_LEDGER_CONFLICT",
        "Generation attempt idempotency conflict",
        409,
      );
    }
    console.error("generation_attempts insert failed:", error);
    throw AppError.internal("Failed to create generation attempt");
  }

  const attempt = mapGenerationAttemptRow(data as GenerationAttemptRow);

  await writeAuditLog(bindings, {
    userId: input.userId,
    projectId: input.projectId,
    action: AUDIT_ACTIONS.generation_attempt_created,
    entityType: AUDIT_ENTITY_TYPES.generation_attempt,
    entityId: attempt.id,
    metadata: sanitizeAuditMetadata({
      attemptId: attempt.id,
      generationType: attempt.generationType,
      creditCost: attempt.creditCost,
      promptHash: attempt.promptHash,
      correlationId,
      status: attempt.status,
    }),
  });

  return attempt;
}

export async function markGenerationAttemptRunning(
  bindings: AppBindings,
  attemptId: string,
): Promise<GenerationAttempt> {
  return updateGenerationAttemptStatus(bindings, attemptId, {
    status: GENERATION_STATUSES.running,
  });
}

export interface GenerationAttemptCostEstimateMetadata {
  costEstimateApproximate?: boolean;
  costEstimateReason?: string;
  costModel?: string;
  mockProvider?: boolean;
}

export async function markGenerationAttemptSucceeded(
  bindings: AppBindings,
  input: {
    attemptId: string;
    userId: string;
    projectId: string;
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    outputEntityId: string;
    outputEntityType?: string;
    correlationId?: string;
    estimatedCostUsd?: number | null;
    costEstimateMetadata?: GenerationAttemptCostEstimateMetadata;
    additionalMetadata?: Record<string, unknown>;
  },
): Promise<GenerationAttempt> {
  const existing = await getGenerationAttemptById(bindings, input.attemptId);
  const mergedMetadata = sanitizeAuditMetadata({
    ...(existing?.metadata ?? {}),
    ...(input.costEstimateMetadata ?? {}),
    ...(input.additionalMetadata ?? {}),
  });

  const attempt = await updateGenerationAttemptStatus(bindings, input.attemptId, {
    status: GENERATION_STATUSES.succeeded,
    provider: input.provider,
    model: input.model,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    estimated_cost_usd:
      typeof input.estimatedCostUsd === "number" ? input.estimatedCostUsd : null,
    output_entity_type: input.outputEntityType ?? "chapter_prose_version",
    output_entity_id: input.outputEntityId,
    error_code: null,
    error_message_safe: null,
    metadata: mergedMetadata,
  });

  await writeAuditLog(bindings, {
    userId: input.userId,
    projectId: input.projectId,
    action: AUDIT_ACTIONS.generation_attempt_succeeded,
    entityType: AUDIT_ENTITY_TYPES.generation_attempt,
    entityId: attempt.id,
    metadata: sanitizeAuditMetadata({
      attemptId: attempt.id,
      generationType: attempt.generationType,
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      outputEntityId: input.outputEntityId,
      correlationId: input.correlationId,
    }),
  });

  return attempt;
}

export async function markGenerationAttemptFailed(
  bindings: AppBindings,
  input: {
    attemptId: string;
    userId: string;
    projectId: string;
    errorCode: string;
    errorMessage: string;
    correlationId?: string;
  },
): Promise<GenerationAttempt> {
  const attempt = await updateGenerationAttemptStatus(bindings, input.attemptId, {
    status: GENERATION_STATUSES.failed,
    error_code: input.errorCode,
    error_message_safe: truncateSafeMessage(input.errorMessage),
  });

  await writeAuditLog(bindings, {
    userId: input.userId,
    projectId: input.projectId,
    action: AUDIT_ACTIONS.generation_attempt_failed,
    entityType: AUDIT_ENTITY_TYPES.generation_attempt,
    entityId: attempt.id,
    metadata: sanitizeAuditMetadata({
      attemptId: attempt.id,
      generationType: attempt.generationType,
      errorCode: input.errorCode,
      correlationId: input.correlationId,
    }),
  });

  return attempt;
}

async function updateGenerationAttemptStatus(
  bindings: AppBindings,
  attemptId: string,
  patch: Record<string, unknown>,
): Promise<GenerationAttempt> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("generation_attempts")
    .update(patch)
    .eq("id", attemptId)
    .select(ATTEMPT_SELECT)
    .single();

  if (error || !data) {
    console.error("generation_attempts update failed");
    throw AppError.internal("Failed to update generation attempt");
  }

  return mapGenerationAttemptRow(data as GenerationAttemptRow);
}

export async function writeAiOutputPersistedAudit(
  bindings: AppBindings,
  input: {
    userId: string;
    projectId: string;
    attemptId: string;
    versionId: string;
    beatId: string;
    correlationId?: string;
    generationType?: GenerationType;
    sourceProseVersionId?: string;
    rewriteMode?: string;
  },
): Promise<void> {
  await writeAuditLog(bindings, {
    userId: input.userId,
    projectId: input.projectId,
    action: AUDIT_ACTIONS.ai_output_persisted,
    entityType: AUDIT_ENTITY_TYPES.chapter_prose_version,
    entityId: input.versionId,
    metadata: sanitizeAuditMetadata({
      attemptId: input.attemptId,
      versionId: input.versionId,
      beatId: input.beatId,
      source: "ai_generated",
      ...(input.generationType ? { generationType: input.generationType } : {}),
      ...(input.sourceProseVersionId
        ? { sourceProseVersionId: input.sourceProseVersionId }
        : {}),
      ...(input.rewriteMode ? { rewriteMode: input.rewriteMode } : {}),
      correlationId: input.correlationId,
    }),
  });
}