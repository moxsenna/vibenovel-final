import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  GENERATION_STATUSES,
  GENERATION_TYPES,
  PUBLISH_PACKAGE_STATUSES,
  WRITER_QUALITY_MODES,
  type CreditBalance,
  type WriterQualityMode,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { isAiGenerationEnabled } from "../env.js";
import { AppError } from "../errors.js";
import type { PublishPackageRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { writeAuditLog } from "./audit.js";
import { sanitizeAuditMetadata, generateCorrelationId } from "./audit-snapshot.js";
import { getCreditBalanceForUser } from "./credit.js";
import {
  CREDIT_LEDGER_REASONS,
  debitCreditsForAttempt,
  refundCreditsForAttempt,
} from "./credit-ledger.js";
import { getCreditCostForGeneration } from "./ai-credit-policy.js";
import { calculateEstimatedCostUsd } from "./model-cost-map.js";
import { generateWithModelRouter } from "./model-router.js";
import { getOwnedProjectRow } from "./project.js";
import {
  assertPublishUserTextSafe,
  assertPublishResponseSafe,
} from "./publish-safety.js";
import {
  buildPublishCopyAiPrompt,
  parsePublishCopyFields,
  PUBLISH_COPY_FIELD_LIMITS,
  type PublishCopyAiField,
} from "./publish-copy-ai-prompt.js";
import {
  createGenerationAttempt,
  getGenerationAttemptById,
  getGenerationAttemptByIdempotencyKey,
  markGenerationAttemptFailed,
  markGenerationAttemptRunning,
  markGenerationAttemptSucceeded,
  toGenerationAttemptSafeSummary,
  type GenerationAttemptCostEstimateMetadata,
  type GenerationAttemptSafeSummary,
} from "./generation-attempt.js";

const PACKAGE_SELECT =
  "id, project_id, chapter_outline_id, chapter_summary_id, chapter_number, chapter_title, status, package_version, is_current, display_title, teaser, short_synopsis, caption, reader_question, next_chapter_teaser, tags, genre, mobile_preview_excerpt, checklist_json, safety_flags, generator_version, exported_at, metadata, created_at, updated_at";

const IDEMPOTENCY_KEY_MAX = 120;
const INSTRUCTION_MAX = 500;

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

export type PublishCopySuggestions = Partial<
  Record<PublishCopyAiField, string>
>;

export interface ImprovePublishCopyInput {
  packageId: string;
  fields: PublishCopyAiField[];
  qualityMode: WriterQualityMode;
  idempotencyKey: string;
  instruction?: string;
}

export interface ImprovePublishCopyResult {
  suggestions: PublishCopySuggestions;
  generationAttempt: GenerationAttemptSafeSummary;
  creditBalance: CreditBalance | null;
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

export function parseImprovePublishCopyBody(raw: unknown): ImprovePublishCopyInput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;
  assertNoForbiddenBodyKeys(body);

  return {
    packageId: parseUuidField(body.packageId, "packageId"),
    fields: parsePublishCopyFields(body.fields),
    qualityMode: parseQualityMode(body.qualityMode),
    idempotencyKey: parseIdempotencyKey(body.idempotencyKey),
    instruction: parseOptionalInstruction(body.instruction),
  };
}

async function getOwnedPackageRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  packageId: string,
): Promise<PublishPackageRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("publish_packages")
    .select(PACKAGE_SELECT)
    .eq("id", packageId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("publish_packages select for copy AI failed");
    throw AppError.internal("Failed to load publish package");
  }
  if (!data) {
    throw AppError.notFound("Publish package not found");
  }
  return data as PublishPackageRow;
}

function assertPackageEditable(row: PublishPackageRow): void {
  if (row.status === PUBLISH_PACKAGE_STATUSES.exported) {
    throw AppError.conflict("Exported publish packages cannot be edited", {
      missing: ["exported_package_locked"],
    });
  }
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const attempts: string[] = [trimmed];

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    attempts.push(fence[1].trim());
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    attempts.push(trimmed.slice(start, end + 1));
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }

  throw new AppError(
    "AI_OUTPUT_UNSAFE",
    "Could not parse publish copy suggestions from model output",
    422,
  );
}

function sanitizeSuggestionValue(
  field: PublishCopyAiField,
  value: unknown,
): string {
  if (typeof value !== "string") {
    throw new AppError(
      "AI_OUTPUT_UNSAFE",
      `Model output for ${field} is not valid text`,
      422,
    );
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError(
      "AI_OUTPUT_UNSAFE",
      `Model output for ${field} is empty`,
      422,
    );
  }
  const max = PUBLISH_COPY_FIELD_LIMITS[field];
  const bounded = trimmed.length > max ? trimmed.slice(0, max).trim() : trimmed;
  if (!bounded) {
    throw new AppError(
      "AI_OUTPUT_UNSAFE",
      `Model output for ${field} is empty after trimming`,
      422,
    );
  }
  assertPublishUserTextSafe(bounded, field);
  return bounded;
}

export function parsePublishCopyModelOutput(
  rawText: string,
  requestedFields: PublishCopyAiField[],
): PublishCopySuggestions {
  const parsed = extractJsonObject(rawText);
  const suggestions: PublishCopySuggestions = {};

  for (const field of requestedFields) {
    if (!(field in parsed)) {
      throw new AppError(
        "AI_OUTPUT_UNSAFE",
        `Model output missing required field: ${field}`,
        422,
      );
    }
    suggestions[field] = sanitizeSuggestionValue(field, parsed[field]);
  }

  return suggestions;
}

export function suggestionsFromAttemptMetadata(
  metadata: Record<string, unknown> | null | undefined,
  requestedFields: PublishCopyAiField[],
): PublishCopySuggestions | null {
  const raw = metadata?.suggestions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const suggestions: PublishCopySuggestions = {};
  for (const field of requestedFields) {
    const value = obj[field];
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }
    suggestions[field] = value.trim();
  }
  return suggestions;
}

function sanitizeSuggestionsForMetadata(
  suggestions: PublishCopySuggestions,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(suggestions)) {
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
    }
  }
  return out;
}

async function writePublishCopySuggestionsAudit(
  bindings: AppBindings,
  input: {
    userId: string;
    projectId: string;
    attemptId: string;
    packageId: string;
    suggestedFields: PublishCopyAiField[];
    correlationId?: string;
  },
): Promise<void> {
  await writeAuditLog(bindings, {
    userId: input.userId,
    projectId: input.projectId,
    action: AUDIT_ACTIONS.ai_output_persisted,
    entityType: AUDIT_ENTITY_TYPES.generation_attempt,
    entityId: input.attemptId,
    metadata: sanitizeAuditMetadata({
      attemptId: input.attemptId,
      packageId: input.packageId,
      generationType: GENERATION_TYPES.publish_copy,
      suggestedFields: input.suggestedFields,
      correlationId: input.correlationId,
    }),
  });
}

async function buildIdempotentSuccessResult(
  bindings: AppBindings,
  ownerId: string,
  attemptId: string,
  requestedFields: PublishCopyAiField[],
): Promise<ImprovePublishCopyResult> {
  const [creditBalance, attempt] = await Promise.all([
    getCreditBalanceForUser(bindings, ownerId),
    getGenerationAttemptById(bindings, attemptId),
  ]);

  if (!attempt) {
    throw AppError.internal("Generation attempt missing for idempotent replay");
  }

  const suggestions = suggestionsFromAttemptMetadata(
    attempt.metadata as Record<string, unknown>,
    requestedFields,
  );
  if (!suggestions) {
    throw AppError.internal("Stored publish copy suggestions are unavailable");
  }

  return {
    suggestions,
    generationAttempt: toGenerationAttemptSafeSummary(attempt),
    creditBalance,
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
      : new AppError("AI_PROVIDER_ERROR", "AI publish copy improvement failed", 502);

  try {
    await refundCreditsForAttempt(bindings, {
      userId: input.userId,
      projectId: input.projectId,
      attemptId: input.attemptId,
      amount: input.amount,
      reason: CREDIT_LEDGER_REASONS.generationRefund,
      generationType: GENERATION_TYPES.publish_copy,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
    });
  } catch (refundErr) {
    console.error("credit refund after publish copy provider failure failed");
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

export async function improvePublishCopyForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  rawBody: unknown,
): Promise<ImprovePublishCopyResult> {
  if (!isAiGenerationEnabled(bindings)) {
    throw new AppError("AI_DISABLED", "AI generation is disabled", 503);
  }

  const body = parseImprovePublishCopyBody(rawBody);
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const existing = await getGenerationAttemptByIdempotencyKey(
    bindings,
    ownerId,
    body.idempotencyKey,
  );

  if (existing) {
    if (existing.status === GENERATION_STATUSES.succeeded) {
      return buildIdempotentSuccessResult(
        bindings,
        ownerId,
        existing.id,
        body.fields,
      );
    }
    if (
      existing.status === GENERATION_STATUSES.pending ||
      existing.status === GENERATION_STATUSES.running
    ) {
      throw new AppError(
        "GENERATION_IN_PROGRESS",
        "A publish copy attempt is already in progress for this idempotency key",
        409,
      );
    }
    if (existing.status === GENERATION_STATUSES.failed) {
      throw new AppError(
        "GENERATION_FAILED",
        "Previous publish copy attempt failed for this idempotency key",
        422,
        { generationAttempt: toGenerationAttemptSafeSummary(existing) },
      );
    }
  }

  const packageRow = await getOwnedPackageRow(
    bindings,
    ownerId,
    projectId,
    body.packageId,
  );
  assertPackageEditable(packageRow);

  const promptResult = await buildPublishCopyAiPrompt(
    bindings,
    projectId,
    packageRow,
    body.fields,
    body.instruction,
  );

  const creditCost = getCreditCostForGeneration({
    generationType: GENERATION_TYPES.publish_copy,
    qualityMode: body.qualityMode,
  });

  const correlationId = generateCorrelationId();
  let attempt = await createGenerationAttempt(bindings, {
    projectId,
    userId: ownerId,
    chapterOutlineId: packageRow.chapter_outline_id,
    beatId: null,
    writingSessionId: null,
    contextPacketLogId: null,
    generationType: GENERATION_TYPES.publish_copy,
    idempotencyKey: body.idempotencyKey,
    creditCost,
    promptHash: promptResult.promptHash,
    qualityMode: body.qualityMode,
    correlationId,
    metadata: {
      packageId: body.packageId,
      requestedFields: body.fields,
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
      generationType: GENERATION_TYPES.publish_copy,
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
      generationType: GENERATION_TYPES.publish_copy,
      qualityMode: body.qualityMode,
      promptHash: promptResult.promptHash,
      promptMessages: promptResult.promptMessages,
      temperature: 0.6,
      metadata: {
        packageId: body.packageId,
        requestedFields: body.fields,
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

  let suggestions: PublishCopySuggestions;
  try {
    suggestions = parsePublishCopyModelOutput(providerResult.text, body.fields);
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

  const responsePayload = {
    suggestions,
    generationAttempt: {
      id: attempt.id,
      generationType: GENERATION_TYPES.publish_copy,
    },
  };
  assertPublishResponseSafe(JSON.stringify(responsePayload));

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

  const suggestionsMetadata = sanitizeSuggestionsForMetadata(suggestions);

  attempt = await markGenerationAttemptSucceeded(bindings, {
    attemptId: attempt.id,
    userId: ownerId,
    projectId,
    provider: providerResult.provider,
    model: providerResult.model,
    inputTokens: providerResult.inputTokens,
    outputTokens: providerResult.outputTokens,
    outputEntityId: attempt.id,
    outputEntityType: AUDIT_ENTITY_TYPES.generation_attempt,
    correlationId,
    estimatedCostUsd,
    costEstimateMetadata,
    additionalMetadata: {
      packageId: body.packageId,
      requestedFields: body.fields,
      suggestions: suggestionsMetadata,
    },
  });

  await writePublishCopySuggestionsAudit(bindings, {
    userId: ownerId,
    projectId,
    attemptId: attempt.id,
    packageId: body.packageId,
    suggestedFields: body.fields,
    correlationId,
  });

  const creditBalance = await getCreditBalanceForUser(bindings, ownerId);

  return {
    suggestions,
    generationAttempt: toGenerationAttemptSafeSummary(attempt),
    creditBalance,
    idempotentReplay: false,
  };
}