import {
  GENERATION_STATUSES,
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  WRITING_SESSION_STATUSES,
  type ChapterProseVersion,
  type CreditBalance,
  type WriterQualityMode,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { isAiGenerationEnabled } from "../env.js";
import { AppError } from "../errors.js";
import type { ChapterBeatRow, ChapterProseVersionRow } from "../lib/mappers.js";
import { getCreditBalanceForUser } from "./credit.js";
import {
  CREDIT_LEDGER_REASONS,
  debitCreditsForAttempt,
  refundCreditsForAttempt,
} from "./credit-ledger.js";
import { getCreditCostForGeneration } from "./ai-credit-policy.js";
import { buildContextPacketForOwner } from "./context-packet-builder.js";
import { getOwnedBeatRow } from "./chapter-beat.js";
import { calculateEstimatedCostUsd } from "./model-cost-map.js";
import { generateWithModelRouter } from "./model-router.js";
import { getOwnedProjectRow } from "./project.js";
import {
  getCurrentProseVersionRowForBeat,
  getProseVersionForOwner,
  saveAiRewrittenProseVersionForOwner,
} from "./prose-draft.js";
import {
  buildProseRewritePrompt,
  parseProseRewriteMode,
  PROSE_REWRITE_MODES,
  type ProseRewriteMode,
} from "./prose-rewrite-prompt.js";
import { getOwnedWritingSessionRow } from "./write-session.js";
import {
  createGenerationAttempt,
  getGenerationAttemptById,
  getGenerationAttemptByIdempotencyKey,
  markGenerationAttemptFailed,
  markGenerationAttemptRunning,
  markGenerationAttemptSucceeded,
  toGenerationAttemptSafeSummary,
  writeAiOutputPersistedAudit,
  type GenerationAttemptCostEstimateMetadata,
  type GenerationAttemptSafeSummary,
} from "./generation-attempt.js";
import { generateCorrelationId } from "./audit-snapshot.js";
import { createServiceRoleClient } from "../lib/supabase.js";

const IDEMPOTENCY_KEY_MAX = 120;
const INSTRUCTION_MAX = 500;
const WRITABLE_SESSION_STATUSES = new Set<string>([
  WRITING_SESSION_STATUSES.active,
  WRITING_SESSION_STATUSES.paused,
]);

const FORBIDDEN_BODY_KEYS = new Set([
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "userId",
  "user_id",
  "model",
  "provider",
  "creditCost",
  "credit_cost",
  "packet_json",
  "packetJson",
  "contextPacket",
  "context_packet",
  "contextPacketJson",
  "context_packet_json",
  "planningTruth",
  "planning_truth",
  "prompt",
  "promptText",
  "prompt_text",
  "promptMessages",
  "prompt_messages",
  "rawPrompt",
  "raw_prompt",
]);

const QUALITY_SET = new Set<string>(Object.values(WRITER_QUALITY_MODES));

export interface RewriteProseInput {
  proseVersionId?: string;
  beatId?: string;
  writingSessionId: string;
  rewriteMode: ProseRewriteMode;
  qualityMode: WriterQualityMode;
  idempotencyKey: string;
  instruction?: string;
}

export interface RewriteProseResult {
  proseVersion: ChapterProseVersion;
  generationAttempt: GenerationAttemptSafeSummary;
  creditBalance: CreditBalance | null;
  rewriteMode: ProseRewriteMode;
  idempotentReplay: boolean;
}

function assertNoForbiddenBodyKeys(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_BODY_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" is not allowed in request body`);
    }
  }
}

function parseUuidField(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw AppError.badRequest(`${fieldName} is required`);
  }
  const trimmed = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      trimmed,
    )
  ) {
    throw AppError.badRequest(`${fieldName} must be a valid UUID`);
  }
  return trimmed;
}

function parseOptionalUuidField(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return parseUuidField(value, fieldName);
}

function parseQualityMode(value: unknown): WriterQualityMode {
  if (value === undefined || value === null) {
    return WRITER_QUALITY_MODES.seimbang;
  }
  if (typeof value !== "string" || !QUALITY_SET.has(value)) {
    throw AppError.badRequest("qualityMode must be hemat, seimbang, or terbaik");
  }
  return value as WriterQualityMode;
}

function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw AppError.badRequest("idempotencyKey is required");
  }
  const trimmed = value.trim();
  if (trimmed.length > IDEMPOTENCY_KEY_MAX) {
    throw AppError.badRequest(`idempotencyKey must be at most ${IDEMPOTENCY_KEY_MAX} characters`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw AppError.badRequest("idempotencyKey contains invalid characters");
  }
  return trimmed;
}

function parseOptionalInstruction(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw AppError.badRequest("instruction must be a string");
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > INSTRUCTION_MAX) {
    throw AppError.badRequest(`instruction must be at most ${INSTRUCTION_MAX} characters`);
  }
  return trimmed;
}

export function parseRewriteProseBody(raw: unknown): RewriteProseInput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;
  assertNoForbiddenBodyKeys(body);

  const proseVersionId = parseOptionalUuidField(body.proseVersionId, "proseVersionId");
  const beatId = parseOptionalUuidField(body.beatId, "beatId");
  if (!proseVersionId && !beatId) {
    throw AppError.badRequest("proseVersionId or beatId is required");
  }

  const rewriteMode = parseProseRewriteMode(body.rewriteMode);
  const instruction = parseOptionalInstruction(body.instruction);

  if (rewriteMode === PROSE_REWRITE_MODES.custom && !instruction) {
    throw AppError.badRequest("instruction is required when rewriteMode is custom");
  }

  return {
    proseVersionId,
    beatId,
    writingSessionId: parseUuidField(body.writingSessionId, "writingSessionId"),
    rewriteMode,
    qualityMode: parseQualityMode(body.qualityMode),
    idempotencyKey: parseIdempotencyKey(body.idempotencyKey),
    instruction,
  };
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
    .select(
      "id, project_id, chapter_beat_id, version_number, prose_text, word_count, source, is_current, context_packet_log_id, metadata, created_at",
    )
    .eq("id", versionId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("chapter_prose_versions select for rewrite failed");
    throw AppError.internal("Failed to load prose version");
  }
  if (!data) {
    throw AppError.notFound("Prose version not found");
  }
  return data as ChapterProseVersionRow;
}

async function resolveSourceProse(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  input: RewriteProseInput,
): Promise<{ sourceRow: ChapterProseVersionRow; beatRow: ChapterBeatRow }> {
  if (input.proseVersionId) {
    const sourceRow = await getOwnedProseVersionRow(
      bindings,
      ownerId,
      projectId,
      input.proseVersionId,
    );
    const beatRow = await getOwnedBeatRow(
      bindings,
      ownerId,
      projectId,
      sourceRow.chapter_beat_id,
    );
    if (input.beatId && input.beatId !== sourceRow.chapter_beat_id) {
      throw AppError.conflict("proseVersionId does not belong to beatId");
    }
    return { sourceRow, beatRow };
  }

  const beatId = input.beatId!;
  const beatRow = await getOwnedBeatRow(bindings, ownerId, projectId, beatId);
  const sourceRow = await getCurrentProseVersionRowForBeat(
    bindings,
    ownerId,
    projectId,
    beatId,
  );
  if (!sourceRow) {
    throw new AppError(
      "NO_PROSE_TO_REWRITE",
      "No prose version exists to rewrite",
      409,
    );
  }
  return { sourceRow, beatRow };
}

async function assertWritableSession(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  chapterOutlineId: string,
  writingSessionId: string,
): Promise<void> {
  const session = await getOwnedWritingSessionRow(
    bindings,
    ownerId,
    projectId,
    writingSessionId,
  );
  if (session.chapter_outline_id !== chapterOutlineId) {
    throw AppError.conflict("Writing session does not match chapter outline");
  }
  if (!WRITABLE_SESSION_STATUSES.has(session.status)) {
    throw AppError.conflict("Writing session is not active for rewrite", {
      code: "INVALID_STATE",
    });
  }
}

async function buildIdempotentSuccessResult(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  attemptId: string,
  outputEntityId: string,
  rewriteMode: ProseRewriteMode,
): Promise<RewriteProseResult> {
  const [proseVersion, creditBalance, attempt] = await Promise.all([
    getProseVersionForOwner(bindings, ownerId, projectId, outputEntityId),
    getCreditBalanceForUser(bindings, ownerId),
    getGenerationAttemptById(bindings, attemptId),
  ]);

  if (!attempt) {
    throw AppError.internal("Generation attempt missing for idempotent replay");
  }

  return {
    proseVersion,
    generationAttempt: toGenerationAttemptSafeSummary(attempt),
    creditBalance,
    rewriteMode,
    idempotentReplay: true,
  };
}

async function handleProviderFailure(
  bindings: AppBindings,
  input: {
    attemptId: string;
    userId: string;
    projectId: string;
    amount: number;
    idempotencyKey: string;
    correlationId: string;
    err: unknown;
  },
): Promise<never> {
  const appErr =
    input.err instanceof AppError
      ? input.err
      : new AppError("AI_PROVIDER_ERROR", "AI rewrite failed", 502);

  try {
    await refundCreditsForAttempt(bindings, {
      userId: input.userId,
      projectId: input.projectId,
      attemptId: input.attemptId,
      amount: input.amount,
      reason: CREDIT_LEDGER_REASONS.generationRefund,
      generationType: GENERATION_TYPES.prose_rewrite,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
    });
  } catch (refundErr) {
    console.error("credit refund after rewrite provider failure failed");
    if (refundErr instanceof Error) {
      console.error(refundErr.message);
    }
  }

  await markGenerationAttemptFailed(bindings, {
    attemptId: input.attemptId,
    userId: input.userId,
    projectId: input.projectId,
    errorCode: appErr.code,
    errorMessage: appErr.message,
    correlationId: input.correlationId,
  });

  throw appErr;
}

export async function rewriteProseForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  rawBody: unknown,
): Promise<RewriteProseResult> {
  if (!isAiGenerationEnabled(bindings)) {
    throw new AppError("AI_DISABLED", "AI generation is disabled", 503);
  }

  const body = parseRewriteProseBody(rawBody);
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const existing = await getGenerationAttemptByIdempotencyKey(
    bindings,
    ownerId,
    body.idempotencyKey,
  );

  if (existing) {
    if (
      existing.status === GENERATION_STATUSES.succeeded &&
      existing.outputEntityId
    ) {
      const rewriteMode =
        (existing.metadata?.rewriteMode as ProseRewriteMode | undefined) ??
        body.rewriteMode;
      return buildIdempotentSuccessResult(
        bindings,
        ownerId,
        projectId,
        existing.id,
        existing.outputEntityId,
        rewriteMode,
      );
    }
    if (
      existing.status === GENERATION_STATUSES.pending ||
      existing.status === GENERATION_STATUSES.running
    ) {
      throw new AppError(
        "GENERATION_IN_PROGRESS",
        "A rewrite attempt is already in progress for this idempotency key",
        409,
      );
    }
    if (existing.status === GENERATION_STATUSES.failed) {
      throw new AppError(
        "GENERATION_FAILED",
        "Previous rewrite attempt failed for this idempotency key",
        422,
        { generationAttempt: toGenerationAttemptSafeSummary(existing) },
      );
    }
  }

  const { sourceRow, beatRow } = await resolveSourceProse(
    bindings,
    ownerId,
    projectId,
    body,
  );

  await assertWritableSession(
    bindings,
    ownerId,
    projectId,
    beatRow.chapter_outline_id,
    body.writingSessionId,
  );

  const packetResult = await buildContextPacketForOwner(bindings, ownerId, projectId, {
    chapterOutlineId: beatRow.chapter_outline_id,
    beatId: beatRow.id,
  });

  const promptResult = await buildProseRewritePrompt(
    bindings,
    projectId,
    packetResult.packetLogId,
    beatRow,
    sourceRow.prose_text,
    body.rewriteMode,
    body.instruction,
  );

  const creditCost = getCreditCostForGeneration({
    generationType: GENERATION_TYPES.prose_rewrite,
    qualityMode: body.qualityMode,
  });

  const correlationId = generateCorrelationId();
  let attempt = await createGenerationAttempt(bindings, {
    projectId,
    userId: ownerId,
    chapterOutlineId: beatRow.chapter_outline_id,
    beatId: beatRow.id,
    writingSessionId: body.writingSessionId,
    generationType: GENERATION_TYPES.prose_rewrite,
    idempotencyKey: body.idempotencyKey,
    creditCost,
    promptHash: promptResult.promptHash,
    contextPacketLogId: packetResult.packetLogId,
    qualityMode: body.qualityMode,
    correlationId,
    metadata: {
      rewriteMode: body.rewriteMode,
      sourceProseVersionId: sourceRow.id,
    },
  });

  let debited = false;
  try {
    await debitCreditsForAttempt(bindings, {
      userId: ownerId,
      projectId,
      attemptId: attempt.id,
      amount: creditCost,
      reason: CREDIT_LEDGER_REASONS.generationDebit,
      generationType: GENERATION_TYPES.prose_rewrite,
      idempotencyKey: body.idempotencyKey,
      correlationId,
    });
    debited = true;
  } catch (err) {
    if (err instanceof AppError && err.code === "INSUFFICIENT_CREDIT") {
      attempt = await markGenerationAttemptFailed(bindings, {
        attemptId: attempt.id,
        userId: ownerId,
        projectId,
        errorCode: "INSUFFICIENT_CREDIT",
        errorMessage: err.message,
        correlationId,
      });
      throw err;
    }
    throw err;
  }

  attempt = await markGenerationAttemptRunning(bindings, attempt.id);

  let providerResult;
  try {
    providerResult = await generateWithModelRouter(bindings, {
      generationType: GENERATION_TYPES.prose_rewrite,
      qualityMode: body.qualityMode,
      promptHash: promptResult.promptHash,
      promptMessages: promptResult.promptMessages,
      metadata: {
        beatNumber: beatRow.beat_number,
        rewriteMode: body.rewriteMode,
      },
    });
  } catch (err) {
    if (debited) {
      await handleProviderFailure(bindings, {
        attemptId: attempt.id,
        userId: ownerId,
        projectId,
        amount: creditCost,
        idempotencyKey: body.idempotencyKey,
        correlationId,
        err,
      });
    }
    throw err;
  }

  let saved;
  try {
    saved = await saveAiRewrittenProseVersionForOwner(
      bindings,
      ownerId,
      projectId,
      beatRow.id,
      {
        proseText: providerResult.text,
        contextPacketLogId: packetResult.packetLogId,
        sourceProseVersionId: sourceRow.id,
        rewriteMode: body.rewriteMode,
        generationAttemptId: attempt.id,
      },
    );
  } catch (err) {
    if (debited) {
      await handleProviderFailure(bindings, {
        attemptId: attempt.id,
        userId: ownerId,
        projectId,
        amount: creditCost,
        idempotencyKey: body.idempotencyKey,
        correlationId,
        err,
      });
    }
    throw err;
  }

  let estimatedCostUsd: number | null = null;
  let costEstimateMetadata: GenerationAttemptCostEstimateMetadata = {};

  if (providerResult.provider === "mock") {
    estimatedCostUsd = 0;
    costEstimateMetadata = {
      costEstimateApproximate: true,
      mockProvider: true,
      costModel: providerResult.model,
    };
  } else {
    const costResult = calculateEstimatedCostUsd({
      model: providerResult.model,
      inputTokens: providerResult.inputTokens,
      outputTokens: providerResult.outputTokens,
    });
    estimatedCostUsd = costResult.estimatedCostUsd;
    costEstimateMetadata = {
      costEstimateApproximate: costResult.approximate,
      ...(costResult.reason ? { costEstimateReason: costResult.reason } : {}),
      ...(costResult.costModel ? { costModel: costResult.costModel } : {}),
    };
  }

  attempt = await markGenerationAttemptSucceeded(bindings, {
    attemptId: attempt.id,
    userId: ownerId,
    projectId,
    provider: providerResult.provider,
    model: providerResult.model,
    inputTokens: providerResult.inputTokens,
    outputTokens: providerResult.outputTokens,
    outputEntityId: saved.version.id,
    correlationId,
    estimatedCostUsd,
    costEstimateMetadata,
  });

  await writeAiOutputPersistedAudit(bindings, {
    userId: ownerId,
    projectId,
    attemptId: attempt.id,
    versionId: saved.version.id,
    beatId: beatRow.id,
    correlationId,
    generationType: GENERATION_TYPES.prose_rewrite,
    sourceProseVersionId: sourceRow.id,
    rewriteMode: body.rewriteMode,
  });

  const creditBalance = await getCreditBalanceForUser(bindings, ownerId);

  return {
    proseVersion: saved.version,
    generationAttempt: toGenerationAttemptSafeSummary(attempt),
    creditBalance,
    rewriteMode: body.rewriteMode,
    idempotentReplay: false,
  };
}