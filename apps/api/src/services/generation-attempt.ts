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
  "id, project_id, user_id, chapter_outline_id, beat_id, writing_session_id, generation_type, status, idempotency_key, provider, model, logical_model, routing_policy_version, fallback_used, retry_count, provider_latency_ms, prompt_hash, context_packet_log_id, input_tokens, output_tokens, estimated_cost_usd, credit_cost, error_code, error_message_safe, output_entity_type, output_entity_id, metadata, created_at, updated_at";

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
  logical_model: string | null;
  routing_policy_version: string | null;
  fallback_used: boolean;
  retry_count: number;
  provider_latency_ms: number | null;
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
  logicalModel: string | null;
  routingPolicyVersion: string | null;
  fallbackUsed: boolean;
  retryCount: number;
  providerLatencyMs: number | null;
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
    logicalModel: row.logical_model ?? null,
    routingPolicyVersion: row.routing_policy_version ?? null,
    fallbackUsed: row.fallback_used ?? false,
    retryCount: row.retry_count ?? 0,
    providerLatencyMs: row.provider_latency_ms ?? null,
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
    logicalModel: attempt.logicalModel,
    routingPolicyVersion: attempt.routingPolicyVersion,
    fallbackUsed: attempt.fallbackUsed,
    retryCount: attempt.retryCount,
    providerLatencyMs: attempt.providerLatencyMs,
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
    logicalModel?: string | null;
    routingPolicyVersion?: string | null;
    fallbackUsed?: boolean;
    retryCount?: number;
    providerLatencyMs?: number | null;
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
    logical_model: input.logicalModel ?? null,
    routing_policy_version: input.routingPolicyVersion ?? null,
    fallback_used: input.fallbackUsed ?? false,
    retry_count: input.retryCount ?? 0,
    provider_latency_ms: input.providerLatencyMs ?? null,
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

export interface GenerationAttemptRoutingSummaryInput {
  attemptId: string;
  provider: string;
  providerModelId: string;
  logicalModel: string;
  routingPolicyVersion: string;
  fallbackUsed: boolean;
  retryCount: number;
  providerLatencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number | null;
}

/**
 * Persist the final route summary before a failed attempt rethrows, so that
 * the subsequent markGenerationAttemptFailed only touches status/error fields
 * while the provider/route summary is preserved for admin diagnostics.
 */
export async function updateGenerationAttemptRoutingSummary(
  bindings: AppBindings,
  input: GenerationAttemptRoutingSummaryInput,
): Promise<GenerationAttempt> {
  return updateGenerationAttemptStatus(bindings, input.attemptId, {
    provider: input.provider,
    model: input.providerModelId,
    logical_model: input.logicalModel,
    routing_policy_version: input.routingPolicyVersion,
    fallback_used: input.fallbackUsed,
    retry_count: input.retryCount,
    provider_latency_ms: input.providerLatencyMs,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    estimated_cost_usd:
      typeof input.estimatedCostUsd === "number"
        ? input.estimatedCostUsd
        : null,
  });
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
    // Log the provider/DB error class server-side without leaking it to clients.
    console.error("generation_attempts update failed", error?.code ?? "", error?.message ?? "");
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

export type GenerationRuntime = "worker" | "node";
export type GenerationContextBudgetProfile = "conservative" | "full";

export interface SafeGenerationObservabilityMetadata {
  [key: string]: unknown;
  contextPacketVersion: string;
  safetyEnvelopeVersion: string;
  contextBudgetProfile: GenerationContextBudgetProfile;
  packetBytes: number;
  serializedContextChars: number;
  serializedPromptChars: number;
  sectionChars: Record<string, number>;
  truncatedSectionNames: string[];
  precedingProseTailIncluded: boolean;
  precedingProseTailChars: number;
  canonFactCount: number;
  characterCount: number;
  timelineCount: number;
  retrievalSnippetCount: number;
  validationCheckCount: number;
  semanticJudgeMode: "off" | "shadow" | "enforce";
  semanticJudgeCalled: boolean;
  semanticJudgeInputTokens: number;
  semanticJudgeOutputTokens: number;
  semanticJudgeEstimatedCostUsd: number;
  repairAttempts: number;
  runtime: GenerationRuntime;
  latencyBreakdownMs: {
    contextBuild: number;
    provider: number;
    validation: number;
    persistence: number;
  };
}

const SAFE_SECTION_KEYS = [
  "currentChapterAndBeat",
  "canonFacts",
  "charactersAndState",
  "knowledge",
  "precedingProseTail",
  "retrievalMemory",
  "styleRules",
] as const;

function safeNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function safeVersion(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

/**
 * Strict allowlist compiler for attempt metadata. Raw prompt/prose/secret fields
 * are ignored even when a caller accidentally includes them.
 */
export function buildSafeGenerationObservabilityMetadata(
  raw: Record<string, unknown>,
): SafeGenerationObservabilityMetadata {
  const rawSections =
    raw.sectionChars && typeof raw.sectionChars === "object" && !Array.isArray(raw.sectionChars)
      ? raw.sectionChars as Record<string, unknown>
      : {};
  const rawLatency =
    raw.latencyBreakdownMs &&
    typeof raw.latencyBreakdownMs === "object" &&
    !Array.isArray(raw.latencyBreakdownMs)
      ? raw.latencyBreakdownMs as Record<string, unknown>
      : {};
  const sectionChars: Record<string, number> = {};
  for (const key of SAFE_SECTION_KEYS) {
    sectionChars[key] = safeNonNegativeNumber(rawSections[key]);
  }
  const profile = raw.contextBudgetProfile === "full" ? "full" : "conservative";
  const judgeMode =
    raw.semanticJudgeMode === "off" || raw.semanticJudgeMode === "enforce"
      ? raw.semanticJudgeMode
      : "shadow";
  return {
    contextPacketVersion: safeVersion(raw.contextPacketVersion),
    safetyEnvelopeVersion: safeVersion(raw.safetyEnvelopeVersion),
    contextBudgetProfile: profile,
    packetBytes: safeNonNegativeNumber(raw.packetBytes),
    serializedContextChars: safeNonNegativeNumber(raw.serializedContextChars),
    serializedPromptChars: safeNonNegativeNumber(raw.serializedPromptChars),
    sectionChars,
    truncatedSectionNames: Array.isArray(raw.truncatedSectionNames)
      ? raw.truncatedSectionNames
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.slice(0, 80))
          .slice(0, 20)
      : [],
    precedingProseTailIncluded: raw.precedingProseTailIncluded === true,
    precedingProseTailChars: safeNonNegativeNumber(raw.precedingProseTailChars),
    canonFactCount: safeNonNegativeNumber(raw.canonFactCount),
    characterCount: safeNonNegativeNumber(raw.characterCount),
    timelineCount: safeNonNegativeNumber(raw.timelineCount),
    retrievalSnippetCount: safeNonNegativeNumber(raw.retrievalSnippetCount),
    validationCheckCount: safeNonNegativeNumber(raw.validationCheckCount),
    semanticJudgeMode: judgeMode,
    semanticJudgeCalled: raw.semanticJudgeCalled === true,
    semanticJudgeInputTokens: safeNonNegativeNumber(raw.semanticJudgeInputTokens),
    semanticJudgeOutputTokens: safeNonNegativeNumber(raw.semanticJudgeOutputTokens),
    semanticJudgeEstimatedCostUsd: safeNonNegativeNumber(
      raw.semanticJudgeEstimatedCostUsd,
    ),
    repairAttempts: safeNonNegativeNumber(raw.repairAttempts),
    runtime: raw.runtime === "node" ? "node" : "worker",
    latencyBreakdownMs: {
      contextBuild: safeNonNegativeNumber(rawLatency.contextBuild),
      provider: safeNonNegativeNumber(rawLatency.provider),
      validation: safeNonNegativeNumber(rawLatency.validation),
      persistence: safeNonNegativeNumber(rawLatency.persistence),
    },
  };
}
