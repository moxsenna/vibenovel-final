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
import type { ChapterBeatRow } from "../lib/mappers.js";
import { getCreditBalanceForUser } from "./credit.js";
import {
  CREDIT_LEDGER_REASONS,
  debitCreditsForAttempt,
  refundCreditsForAttempt,
} from "./credit-ledger.js";
import { getCreditCostForGeneration } from "./ai-credit-policy.js";
import { buildContextPacketForOwner } from "./context-packet-builder.js";
import { getOwnedBeatRow } from "./chapter-beat.js";
import { generateWithModelRouter } from "./model-router.js";
import { getOwnedProjectRow } from "./project.js";
import { saveAiGeneratedProseVersionForOwner } from "./prose-draft.js";
import { buildProseBeatPrompt } from "./prose-generation-prompt.js";
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
  type GenerationAttemptSafeSummary,
} from "./generation-attempt.js";
import { generateCorrelationId } from "./audit-snapshot.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { getProseVersionForOwner } from "./prose-draft.js";

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
]);

const QUALITY_SET = new Set<string>(Object.values(WRITER_QUALITY_MODES));

export interface GenerateProseBeatInput {
  chapterOutlineId: string;
  beatId: string;
  qualityMode: WriterQualityMode;
  idempotencyKey: string;
  writingSessionId?: string;
  instruction?: string;
}

export interface GenerateProseBeatResult {
  version: ChapterProseVersion;
  generationAttempt: GenerationAttemptSafeSummary;
  creditBalance: CreditBalance | null;
  creditCost: number;
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

function parseQualityMode(value: unknown): WriterQualityMode {
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

export function parseGenerateProseBeatBody(raw: unknown): GenerateProseBeatInput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;
  assertNoForbiddenBodyKeys(body);

  const input: GenerateProseBeatInput = {
    chapterOutlineId: parseUuidField(body.chapterOutlineId, "chapterOutlineId"),
    beatId: parseUuidField(body.beatId, "beatId"),
    qualityMode: parseQualityMode(body.qualityMode),
    idempotencyKey: parseIdempotencyKey(body.idempotencyKey),
    instruction: parseOptionalInstruction(body.instruction),
  };

  if (body.writingSessionId !== undefined && body.writingSessionId !== null) {
    input.writingSessionId = parseUuidField(body.writingSessionId, "writingSessionId");
  }

  return input;
}

async function resolveWritableSession(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  chapterOutlineId: string,
  beatRow: ChapterBeatRow,
  writingSessionId?: string,
): Promise<string> {
  if (writingSessionId) {
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
      throw AppError.conflict("Writing session is not active for generation", {
        code: "INVALID_STATE",
      });
    }
    return session.id;
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("writing_sessions")
    .select("id, chapter_outline_id, status")
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .in("status", [...WRITABLE_SESSION_STATUSES])
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("writing_sessions select for AI generation failed");
    throw AppError.internal("Failed to load writing session");
  }
  if (!data) {
    throw AppError.conflict("Active writing session required", { code: "INVALID_STATE" });
  }

  const session = data as { id: string; chapter_outline_id: string };
  if (beatRow.chapter_outline_id !== session.chapter_outline_id) {
    throw AppError.conflict("Beat does not belong to the active writing session chapter");
  }

  return session.id;
}

async function buildIdempotentSuccessResult(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  attemptId: string,
  outputEntityId: string,
  creditCost: number,
): Promise<GenerateProseBeatResult> {
  const [version, creditBalance, attempt] = await Promise.all([
    getProseVersionForOwner(bindings, ownerId, projectId, outputEntityId),
    getCreditBalanceForUser(bindings, ownerId),
    getGenerationAttemptById(bindings, attemptId),
  ]);

  if (!attempt) {
    throw AppError.internal("Generation attempt missing for idempotent replay");
  }

  return {
    version,
    generationAttempt: toGenerationAttemptSafeSummary(attempt),
    creditBalance,
    creditCost,
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
    generationType: typeof GENERATION_TYPES.prose_beat;
    idempotencyKey: string;
    correlationId: string;
    err: unknown;
  },
): Promise<never> {
  const appErr =
    input.err instanceof AppError
      ? input.err
      : new AppError("AI_PROVIDER_ERROR", "AI generation failed", 502);

  try {
    await refundCreditsForAttempt(bindings, {
      userId: input.userId,
      projectId: input.projectId,
      attemptId: input.attemptId,
      amount: input.amount,
      reason: CREDIT_LEDGER_REASONS.generationRefund,
      generationType: input.generationType,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
    });
  } catch (refundErr) {
    console.error("credit refund after provider failure failed");
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

export async function generateProseBeatForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  rawBody: unknown,
): Promise<GenerateProseBeatResult> {
  if (!isAiGenerationEnabled(bindings)) {
    throw new AppError("AI_DISABLED", "AI generation is disabled", 503);
  }

  const body = parseGenerateProseBeatBody(rawBody);
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
      return buildIdempotentSuccessResult(
        bindings,
        ownerId,
        projectId,
        existing.id,
        existing.outputEntityId,
        existing.creditCost,
      );
    }
    if (
      existing.status === GENERATION_STATUSES.pending ||
      existing.status === GENERATION_STATUSES.running
    ) {
      throw new AppError(
        "GENERATION_IN_PROGRESS",
        "A generation attempt is already in progress for this idempotency key",
        409,
      );
    }
    if (existing.status === GENERATION_STATUSES.failed) {
      throw new AppError(
        "GENERATION_FAILED",
        "Previous generation attempt failed for this idempotency key",
        422,
        { generationAttempt: toGenerationAttemptSafeSummary(existing) },
      );
    }
  }

  const beatRow = await getOwnedBeatRow(bindings, ownerId, projectId, body.beatId);
  if (beatRow.chapter_outline_id !== body.chapterOutlineId) {
    throw AppError.conflict("beatId does not belong to chapterOutlineId");
  }

  const sessionId = await resolveWritableSession(
    bindings,
    ownerId,
    projectId,
    body.chapterOutlineId,
    beatRow,
    body.writingSessionId,
  );

  const packetResult = await buildContextPacketForOwner(bindings, ownerId, projectId, {
    chapterOutlineId: body.chapterOutlineId,
    beatId: body.beatId,
  });

  const promptResult = await buildProseBeatPrompt(
    bindings,
    projectId,
    packetResult.packetLogId,
    beatRow,
    body.instruction,
  );

  const creditCost = getCreditCostForGeneration({
    generationType: GENERATION_TYPES.prose_beat,
    qualityMode: body.qualityMode,
  });

  const correlationId = generateCorrelationId();
  let attempt = await createGenerationAttempt(bindings, {
    projectId,
    userId: ownerId,
    chapterOutlineId: body.chapterOutlineId,
    beatId: body.beatId,
    writingSessionId: sessionId,
    idempotencyKey: body.idempotencyKey,
    creditCost,
    promptHash: promptResult.promptHash,
    contextPacketLogId: packetResult.packetLogId,
    qualityMode: body.qualityMode,
    correlationId,
  });

  let debited = false;
  try {
    await debitCreditsForAttempt(bindings, {
      userId: ownerId,
      projectId,
      attemptId: attempt.id,
      amount: creditCost,
      reason: CREDIT_LEDGER_REASONS.generationDebit,
      generationType: GENERATION_TYPES.prose_beat,
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
      generationType: GENERATION_TYPES.prose_beat,
      qualityMode: body.qualityMode,
      promptHash: promptResult.promptHash,
      promptMessages: promptResult.promptMessages,
      metadata: { beatNumber: beatRow.beat_number },
    });
  } catch (err) {
    if (debited) {
      await handleProviderFailure(bindings, {
        attemptId: attempt.id,
        userId: ownerId,
        projectId,
        amount: creditCost,
        generationType: GENERATION_TYPES.prose_beat,
        idempotencyKey: body.idempotencyKey,
        correlationId,
        err,
      });
    }
    throw err;
  }

  let saved;
  try {
    saved = await saveAiGeneratedProseVersionForOwner(
      bindings,
      ownerId,
      projectId,
      body.beatId,
      {
        proseText: providerResult.text,
        contextPacketLogId: packetResult.packetLogId,
      },
    );
  } catch (err) {
    if (debited) {
      await handleProviderFailure(bindings, {
        attemptId: attempt.id,
        userId: ownerId,
        projectId,
        amount: creditCost,
        generationType: GENERATION_TYPES.prose_beat,
        idempotencyKey: body.idempotencyKey,
        correlationId,
        err,
      });
    }
    throw err;
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
  });

  await writeAiOutputPersistedAudit(bindings, {
    userId: ownerId,
    projectId,
    attemptId: attempt.id,
    versionId: saved.version.id,
    beatId: body.beatId,
    correlationId,
  });

  const creditBalance = await getCreditBalanceForUser(bindings, ownerId);

  return {
    version: saved.version,
    generationAttempt: toGenerationAttemptSafeSummary(attempt),
    creditBalance,
    creditCost,
    idempotentReplay: false,
  };
}