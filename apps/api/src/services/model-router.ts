import type { AppBindings } from "../env.js";
import {
  getAiProviderMockMode,
  isAiGenerationEnabled,
  isAiProviderMock,
} from "../env.js";
import { AppError } from "../errors.js";
import type {
  ModelRouterGenerateInput,
  ModelRouterGenerateResult,
  ModelRouterResolveInput,
  ProviderEventRecorderInput,
  PromptMessage,
} from "./ai-generation-types.js";
import {
  assertPromptSafeForProvider,
  assertProviderOutputSafe,
} from "./ai-prompt-safety.js";
import {
  getDeploymentCost,
  getAiModelDeployment,
  type AiLiveProviderId,
} from "./ai-model-registry.js";
import {
  AI_ROUTING_POLICY_VERSION,
  resolveGenerationRoute,
  type AiRouteTarget,
} from "./ai-routing-policy.js";
import {
  callLiveProviderChat,
  hasProviderCredential,
} from "./ai-provider-adapters.js";
import type {
  OpenAiCompatibleChatInput,
  OpenAiCompatibleChatResult,
} from "./openai-compatible-client.js";
import {
  createGenerationProviderEvent,
  nextProviderEventSequence,
  sanitizeProviderEventError,
} from "./generation-provider-event.js";
import { updateGenerationAttemptRoutingSummary } from "./generation-attempt.js";
import { generateWithMockProvider } from "./mock-ai-provider.js";

/** Hard upper bound for any server-side maxOutputTokensOverride. */
const MAX_OUTPUT_TOKENS_CEILING = 4000;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;

export type ProviderChatCallInput = Omit<
  OpenAiCompatibleChatInput,
  "baseUrl" | "apiKey"
>;

export interface ModelRouterDependencies {
  resolveRoute?: typeof resolveGenerationRoute;
  callProvider?: (
    input: ProviderChatCallInput,
  ) => Promise<OpenAiCompatibleChatResult>;
  recordEvent?: (input: ProviderEventRecorderInput) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
}

function buildMessages(
  input: Pick<ModelRouterGenerateInput, "promptMessages" | "promptText">,
): PromptMessage[] {
  if (input.promptMessages && input.promptMessages.length > 0) {
    return input.promptMessages;
  }
  if (input.promptText !== undefined) {
    return [{ role: "user", content: input.promptText }];
  }
  return [];
}

function resolveMaxOutputTokens(
  routeCap: number,
  input: Pick<
    ModelRouterGenerateInput,
    "maxOutputTokens" | "maxOutputTokensOverride"
  >,
): number {
  let cap = routeCap;
  if (input.maxOutputTokens !== undefined) {
    cap = Math.min(cap, Math.max(1, Math.floor(input.maxOutputTokens)));
  }
  if (input.maxOutputTokensOverride !== undefined) {
    cap = Math.min(
      MAX_OUTPUT_TOKENS_CEILING,
      Math.max(1, Math.floor(input.maxOutputTokensOverride)),
    );
  }
  return cap;
}

function resolveTemperature(routeTemp: number, requested?: number): number {
  if (requested === undefined) return routeTemp;
  return Math.min(1, Math.max(0, requested));
}

function isFallbackEligible(error: unknown): boolean {
  return (
    error instanceof AppError &&
    [
      "AI_PROVIDER_ERROR",
      "AI_PROVIDER_TIMEOUT",
      "AI_PROVIDER_RATE_LIMITED",
      "AI_OUTPUT_EMPTY",
      "GENERATION_FAILED",
    ].includes(error.code)
  );
}

function normalizeProviderText(text: string, stripThinkTags: boolean): string {
  if (!stripThinkTags) return text.trim();
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function providerHttpStatusOf(error: unknown): number | null {
  if (
    error instanceof AppError &&
    error.details &&
    typeof error.details === "object" &&
    "providerHttpStatus" in error.details
  ) {
    const value = (error.details as { providerHttpStatus?: unknown })
      .providerHttpStatus;
    return typeof value === "number" ? value : null;
  }
  return null;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function estimateLiveProviderCost(
  logicalModel: Parameters<typeof getDeploymentCost>[0],
  provider: AiLiveProviderId,
  inputTokens?: number,
  outputTokens?: number,
): number {
  if (inputTokens === undefined || outputTokens === undefined) return 0;
  const pricing = getDeploymentCost(logicalModel, provider);
  return roundUsd(
    (inputTokens / 1_000_000) * pricing.inputUsdPer1M +
      (outputTokens / 1_000_000) * pricing.outputUsdPer1M,
  );
}

async function backoff(
  sleep: (ms: number) => Promise<void>,
  attempt: number,
): Promise<void> {
  const expo = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * RETRY_BASE_DELAY_MS);
  await sleep(expo + jitter);
}

interface FailureSummary {
  provider: string;
  providerModelId: string;
  logicalModel: string;
  fallbackUsed: boolean;
  retryCount: number;
  providerLatencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd: number | null;
}

async function persistFailureSummary(
  bindings: AppBindings,
  attemptId: string,
  summary: FailureSummary | null,
): Promise<void> {
  if (!summary) return;
  try {
    await updateGenerationAttemptRoutingSummary(bindings, {
      attemptId,
      provider: summary.provider,
      providerModelId: summary.providerModelId,
      logicalModel: summary.logicalModel,
      routingPolicyVersion: AI_ROUTING_POLICY_VERSION,
      fallbackUsed: summary.fallbackUsed,
      retryCount: summary.retryCount,
      providerLatencyMs: summary.providerLatencyMs,
      inputTokens: summary.inputTokens,
      outputTokens: summary.outputTokens,
      estimatedCostUsd: summary.estimatedCostUsd,
    });
  } catch (error) {
    // Telemetry persistence must never mask the user-facing generation error.
    console.error(
      "failed to persist routing summary",
      error instanceof Error ? error.message : "",
    );
  }
}

/**
 * Preflight a route before any credit debit: resolve policy + registry and
 * confirm at least one declared target has a configured credential.
 */
export function assertGenerationRouteCallable(
  bindings: AppBindings,
  input: ModelRouterResolveInput,
): void {
  const route = resolveGenerationRoute(input.generationType, input.qualityMode);
  const targets = [route.primary, route.fallback].filter(
    (target): target is AiRouteTarget => target !== null,
  );
  // Validate every declared deployment exists in the registry.
  for (const target of targets) {
    getAiModelDeployment(target.model, target.provider);
  }
  if (
    !isAiProviderMock(bindings) &&
    !targets.some((target) => hasProviderCredential(bindings, target.provider))
  ) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "No configured credential for the selected AI route",
      503,
    );
  }
}

/**
 * Model router boundary for AI generation. Resolves routes through the typed
 * policy + registry, validates engine output as the success boundary, and
 * records one safe provider event per attempt or skipped target.
 */
export async function generateWithModelRouter<TOutput = string>(
  bindings: AppBindings,
  input: ModelRouterGenerateInput<TOutput>,
  dependencies: ModelRouterDependencies = {},
): Promise<ModelRouterGenerateResult<TOutput>> {
  if (!isAiGenerationEnabled(bindings)) {
    throw new AppError("AI_DISABLED", "AI generation is disabled", 503);
  }

  assertPromptSafeForProvider(input.promptMessages, input.promptText);

  const resolveRoute = dependencies.resolveRoute ?? resolveGenerationRoute;
  const recordEvent =
    dependencies.recordEvent ??
    (async (event: ProviderEventRecorderInput) => {
      await createGenerationProviderEvent(bindings, event);
    });
  const sleep =
    dependencies.sleep ??
    (async (ms: number) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  const callProvider =
    dependencies.callProvider ??
    ((callInput: ProviderChatCallInput) =>
      callLiveProviderChat(bindings, callInput));

  const route = resolveRoute(input.generationType, input.qualityMode);
  const messages = buildMessages(input);
  const maxOutputTokens = resolveMaxOutputTokens(route.maxOutputTokens, input);
  const temperature = resolveTemperature(route.temperature, input.temperature);
  const validate =
    input.validateOutput ?? ((text: string) => text as unknown as TOutput);
  const seq = () => nextProviderEventSequence(input.providerEventSequence);

  // Deterministic local mock path — no live credential required.
  if (isAiProviderMock(bindings)) {
    const logicalModel = route.primary.model;
    const providerModelId = `mock/${logicalModel}`;
    let raw: OpenAiCompatibleChatResult;
    try {
      raw = await generateWithMockProvider(
        {
          generationType: input.generationType,
          promptHash: input.promptHash,
          metadata: input.metadata,
        },
        getAiProviderMockMode(bindings),
      );
    } catch (error) {
      await recordEvent({
        generationAttemptId: input.generationAttemptId,
        sequenceNumber: seq(),
        routeRole: "primary",
        provider: "mock",
        logicalModel,
        providerModelId,
        retryNumber: 0,
        outcome: "provider_error",
        ...sanitizeProviderEventError({
          code: error instanceof AppError ? error.code : "AI_PROVIDER_ERROR",
          message: error instanceof Error ? error.message : "",
        }),
      });
      await persistFailureSummary(bindings, input.generationAttemptId, {
        provider: "mock",
        providerModelId,
        logicalModel,
        fallbackUsed: false,
        retryCount: 0,
        providerLatencyMs: 0,
        estimatedCostUsd: 0,
      });
      throw error;
    }
    const text = normalizeProviderText(raw.text, false);
    try {
      assertProviderOutputSafe(text);
      const output = validate(text);
      await recordEvent({
        generationAttemptId: input.generationAttemptId,
        sequenceNumber: seq(),
        routeRole: "primary",
        provider: "mock",
        logicalModel,
        providerModelId,
        retryNumber: 0,
        outcome: "succeeded",
        latencyMs: raw.latencyMs,
        inputTokens: raw.inputTokens ?? null,
        outputTokens: raw.outputTokens ?? null,
        estimatedCostUsd: 0,
      });
      return {
        text,
        output,
        provider: "mock",
        logicalModel,
        model: providerModelId,
        inputTokens: raw.inputTokens,
        outputTokens: raw.outputTokens,
        latencyMs: raw.latencyMs,
        finishReason: raw.finishReason,
        promptHash: input.promptHash,
        routingPolicyVersion: AI_ROUTING_POLICY_VERSION,
        fallbackUsed: false,
        retryCount: 0,
        estimatedCostUsd: 0,
      };
    } catch (error) {
      const code = error instanceof AppError ? error.code : "AI_PROVIDER_ERROR";
      await recordEvent({
        generationAttemptId: input.generationAttemptId,
        sequenceNumber: seq(),
        routeRole: "primary",
        provider: "mock",
        logicalModel,
        providerModelId,
        retryNumber: 0,
        ...sanitizeProviderEventError({
          code,
          message: error instanceof Error ? error.message : "",
        }),
        outcome: sanitizeProviderEventError({ code, message: "" }).errorCategory,
        latencyMs: raw.latencyMs,
      });
      await persistFailureSummary(bindings, input.generationAttemptId, {
        provider: "mock",
        providerModelId,
        logicalModel,
        fallbackUsed: false,
        retryCount: 0,
        providerLatencyMs: raw.latencyMs,
        estimatedCostUsd: 0,
      });
      throw error;
    }
  }

  // Live path: primary (with retries) then explicit fallback (no retry).
  const targets: Array<{
    target: AiRouteTarget;
    role: "primary" | "fallback";
    maxRetries: number;
  }> = [
    { target: route.primary, role: "primary", maxRetries: route.primaryMaxRetries },
  ];
  if (route.fallback) {
    targets.push({ target: route.fallback, role: "fallback", maxRetries: 0 });
  }

  let retryCount = 0;
  let lastError: unknown;
  let lastSummary: FailureSummary | null = null;

  for (const { target, role, maxRetries } of targets) {
    const deployment = getAiModelDeployment(target.model, target.provider);
    const fallbackUsed = role === "fallback";

    if (!hasProviderCredential(bindings, target.provider)) {
      await recordEvent({
        generationAttemptId: input.generationAttemptId,
        sequenceNumber: seq(),
        routeRole: role,
        provider: target.provider,
        logicalModel: target.model,
        providerModelId: deployment.modelId,
        retryNumber: 0,
        outcome: "credential_unavailable",
        errorCategory: "configuration_error",
        errorCodeSafe: "AI_NOT_CONFIGURED",
      });
      lastError = new AppError(
        "AI_NOT_CONFIGURED",
        `${target.provider} API key is not configured`,
        503,
      );
      lastSummary = {
        provider: target.provider,
        providerModelId: deployment.modelId,
        logicalModel: target.model,
        fallbackUsed,
        retryCount,
        providerLatencyMs: 0,
        estimatedCostUsd: null,
      };
      continue;
    }

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const retryNumber = attempt;
      let raw: OpenAiCompatibleChatResult | null = null;
      try {
        raw = await callProvider({
          provider: target.provider,
          modelId: deployment.modelId,
          messages,
          maxOutputTokens,
          temperature,
          timeoutMs: route.timeoutMs,
        });
        const cost = estimateLiveProviderCost(
          target.model,
          target.provider,
          raw.inputTokens,
          raw.outputTokens,
        );
        lastSummary = {
          provider: target.provider,
          providerModelId: deployment.modelId,
          logicalModel: target.model,
          fallbackUsed,
          retryCount,
          providerLatencyMs: raw.latencyMs,
          inputTokens: raw.inputTokens,
          outputTokens: raw.outputTokens,
          estimatedCostUsd: cost,
        };
        const text = normalizeProviderText(
          raw.text,
          deployment.outputNormalization.stripThinkTags,
        );
        assertProviderOutputSafe(text);
        const output = validate(text);

        await recordEvent({
          generationAttemptId: input.generationAttemptId,
          sequenceNumber: seq(),
          routeRole: role,
          provider: target.provider,
          logicalModel: target.model,
          providerModelId: deployment.modelId,
          retryNumber,
          outcome: "succeeded",
          latencyMs: raw.latencyMs,
          inputTokens: raw.inputTokens ?? null,
          outputTokens: raw.outputTokens ?? null,
          estimatedCostUsd: cost,
        });

        return {
          text,
          output,
          provider: target.provider,
          logicalModel: target.model,
          model: deployment.modelId,
          inputTokens: raw.inputTokens,
          outputTokens: raw.outputTokens,
          latencyMs: raw.latencyMs,
          finishReason: raw.finishReason,
          promptHash: input.promptHash,
          routingPolicyVersion: AI_ROUTING_POLICY_VERSION,
          fallbackUsed,
          retryCount,
          estimatedCostUsd: cost,
        };
      } catch (rawError) {
        // A validator may throw any error (e.g. JSON.parse). Treat non-AppError
        // failures as a fallback-eligible invalid output; preserve real
        // AppErrors so AI_OUTPUT_UNSAFE keeps its no-fallback semantics.
        const error =
          rawError instanceof AppError
            ? rawError
            : new AppError(
                "GENERATION_FAILED",
                "AI output failed validation",
                502,
              );
        lastError = error;
        const code = error.code;
        const sanitized = sanitizeProviderEventError({
          code,
          message: error instanceof Error ? error.message : "",
          providerHttpStatus: providerHttpStatusOf(error),
        });
        await recordEvent({
          generationAttemptId: input.generationAttemptId,
          sequenceNumber: seq(),
          routeRole: role,
          provider: target.provider,
          logicalModel: target.model,
          providerModelId: deployment.modelId,
          retryNumber,
          outcome: sanitized.errorCategory,
          errorCategory: sanitized.errorCategory,
          errorCodeSafe: sanitized.errorCodeSafe,
          providerHttpStatus: sanitized.providerHttpStatus,
          latencyMs: raw?.latencyMs ?? null,
          inputTokens: raw?.inputTokens ?? null,
          outputTokens: raw?.outputTokens ?? null,
        });

        if (!isFallbackEligible(error)) {
          // Unsafe / non-retryable: no retry, no fallback.
          await persistFailureSummary(
            bindings,
            input.generationAttemptId,
            lastSummary,
          );
          throw error;
        }

        if (attempt < maxRetries) {
          retryCount += 1;
          await backoff(sleep, attempt);
          continue;
        }
        // Retries for this target exhausted — move to the next target.
        break;
      }
    }
  }

  await persistFailureSummary(bindings, input.generationAttemptId, lastSummary);
  throw (
    lastError ??
    new AppError("AI_PROVIDER_ERROR", "AI generation failed", 502)
  );
}
