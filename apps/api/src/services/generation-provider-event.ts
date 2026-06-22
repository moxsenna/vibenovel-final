import type {
  GenerationProviderEvent,
  GenerationProviderEventOutcome,
  GenerationProviderEventRole,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";

const EVENT_SELECT =
  "id, generation_attempt_id, sequence_number, route_role, provider, logical_model, provider_model_id, retry_number, outcome, error_category, error_code_safe, provider_http_status, latency_ms, input_tokens, output_tokens, estimated_cost_usd, created_at";

export interface ProviderEventInsertInput {
  generationAttemptId: string;
  sequenceNumber: number;
  routeRole: GenerationProviderEventRole;
  provider: string;
  logicalModel: string;
  providerModelId: string;
  retryNumber: number;
  outcome: GenerationProviderEventOutcome;
  errorCategory?: string | null;
  errorCodeSafe?: string | null;
  providerHttpStatus?: number | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
}

/**
 * Single in-memory sequence owned by the complete generation attempt. Repair
 * loops and repeated router calls for the same attempt share one of these so
 * sequence numbers never reset. There is no database sequence allocator.
 */
export interface ProviderEventSequence {
  current: number;
}

export function createProviderEventSequence(): ProviderEventSequence {
  return { current: 0 };
}

export function nextProviderEventSequence(
  sequence: ProviderEventSequence,
): number {
  sequence.current += 1;
  return sequence.current;
}

export function buildSafeProviderEventInsert(
  input: ProviderEventInsertInput,
): Record<string, unknown> {
  return {
    generation_attempt_id: input.generationAttemptId,
    sequence_number: input.sequenceNumber,
    route_role: input.routeRole,
    provider: input.provider,
    logical_model: input.logicalModel,
    provider_model_id: input.providerModelId,
    retry_number: input.retryNumber,
    outcome: input.outcome,
    error_category: input.errorCategory ?? null,
    error_code_safe: input.errorCodeSafe ?? null,
    provider_http_status: input.providerHttpStatus ?? null,
    latency_ms: input.latencyMs ?? null,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    estimated_cost_usd: input.estimatedCostUsd ?? null,
  };
}

export function sanitizeProviderEventError(input: {
  code: string;
  message: string;
  providerHttpStatus?: number | null;
}) {
  const category: GenerationProviderEventOutcome =
    input.code === "AI_PROVIDER_TIMEOUT"
      ? "timeout"
      : input.code === "AI_PROVIDER_RATE_LIMITED"
        ? "rate_limited"
        : input.code === "AI_OUTPUT_EMPTY"
          ? "empty_output"
          : input.code === "AI_OUTPUT_UNSAFE"
            ? "unsafe_output"
            : input.code === "GENERATION_FAILED"
              ? "invalid_output"
              : "provider_error";
  return {
    errorCategory: category,
    errorCodeSafe: input.code,
    providerHttpStatus: input.providerHttpStatus ?? null,
  };
}

export async function createGenerationProviderEvent(
  bindings: AppBindings,
  input: ProviderEventInsertInput,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { error } = await admin
    .from("generation_provider_events")
    .insert(buildSafeProviderEventInsert(input));
  if (error) {
    console.error("generation provider event insert failed", error.code ?? "");
    throw AppError.internal("Failed to record provider event");
  }
}

export async function listGenerationProviderEvents(
  bindings: AppBindings,
  generationAttemptId: string,
): Promise<GenerationProviderEvent[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("generation_provider_events")
    .select(EVENT_SELECT)
    .eq("generation_attempt_id", generationAttemptId)
    .order("sequence_number", { ascending: true });
  if (error) throw AppError.internal("Failed to load provider events");
  return (data ?? []).map(
    (row): GenerationProviderEvent => ({
      id: row.id,
      generationAttemptId: row.generation_attempt_id,
      sequenceNumber: row.sequence_number,
      routeRole: row.route_role as GenerationProviderEventRole,
      provider: row.provider,
      logicalModel: row.logical_model,
      providerModelId: row.provider_model_id,
      retryNumber: row.retry_number,
      outcome: row.outcome as GenerationProviderEventOutcome,
      errorCategory: row.error_category,
      errorCodeSafe: row.error_code_safe,
      providerHttpStatus: row.provider_http_status,
      latencyMs: row.latency_ms,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      estimatedCostUsd:
        row.estimated_cost_usd === null ? null : Number(row.estimated_cost_usd),
      createdAt: row.created_at,
    }),
  );
}
