import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type GenerationType,
  type WriterQualityMode,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  getAiMaxRetries,
  getAiProviderMockMode,
  getDefaultAiModel,
  hasOpenRouterApiKey,
  isAiGenerationEnabled,
  isAiProviderMock,
} from "../env.js";
import { AppError } from "../errors.js";
import type {
  ModelRouterGenerateInput,
  ModelRouterGenerateResult,
  ModelRouterResolveInput,
  ResolvedModelConfig,
} from "./ai-generation-types.js";
import {
  assertPromptSafeForProvider,
  assertProviderOutputSafe,
} from "./ai-prompt-safety.js";
import { resolveQualityModeForGeneration } from "./ai-credit-policy.js";
import { generateWithMockProvider } from "./mock-ai-provider.js";
import {
  getModelCandidatesForGeneration,
  isProseModelRoutingGenerationType,
} from "./model-routing-v2.js";
import { callOpenRouterChatCompletion } from "./openrouter-client.js";

/** Hardcoded allowlist — client cannot pass arbitrary model ids. */
export const MODEL_ALLOWLIST = new Set([
  "google/gemini-3.1-flash-lite",
  "qwen/qwen3.7-plus",
  "minimax/minimax-m3",
  "deepseek/deepseek-v4-flash",
  "google/gemini-2.5-flash",
  "mistralai/mistral-large-2512",
  "anthropic/claude-opus-4.8",
  "openai/gpt-5.2",
  "google/gemma-4-31b-it:free",
  "openrouter/free",
  "anthropic/claude-3-haiku",
]);

const QUALITY_TIMEOUT_MS: Record<WriterQualityMode, number> = {
  [WRITER_QUALITY_MODES.hemat]: 30_000,
  [WRITER_QUALITY_MODES.seimbang]: 45_000,
  [WRITER_QUALITY_MODES.terbaik]: 60_000,
};

const QUALITY_MAX_OUTPUT_TOKENS: Record<WriterQualityMode, number> = {
  [WRITER_QUALITY_MODES.hemat]: 800,
  [WRITER_QUALITY_MODES.seimbang]: 1200,
  [WRITER_QUALITY_MODES.terbaik]: 2000,
};

const GENERATION_TYPE_TOKEN_CAP: Record<GenerationType, number> = {
  [GENERATION_TYPES.intake_assistant]: 800,
  [GENERATION_TYPES.concept_generation]: 3000,
  [GENERATION_TYPES.foundation_proposal]: 3000,
  [GENERATION_TYPES.draft_import_signal_extraction]: 1800,
  [GENERATION_TYPES.outline_generation]: 4000,
  [GENERATION_TYPES.beat_generation]: 3000,
  [GENERATION_TYPES.chapter_summary_generation]: 3000,
  [GENERATION_TYPES.continuity_delta]: 1500,
  [GENERATION_TYPES.prose_beat]: 2000,
  [GENERATION_TYPES.prose_rewrite]: 2000,
  [GENERATION_TYPES.publish_copy]: 800,
  [GENERATION_TYPES.summary_delta]: 1500,
};

const PLANNING_GENERATION_TYPES = new Set<GenerationType>([
  GENERATION_TYPES.intake_assistant,
  GENERATION_TYPES.concept_generation,
  GENERATION_TYPES.foundation_proposal,
  GENERATION_TYPES.draft_import_signal_extraction,
  GENERATION_TYPES.outline_generation,
  GENERATION_TYPES.beat_generation,
  GENERATION_TYPES.chapter_summary_generation,
  GENERATION_TYPES.continuity_delta,
]);

/** Hard upper bound for any server-side maxOutputTokensOverride. */
const MAX_OUTPUT_TOKENS_CEILING = 4000;

/**
 * Heavy structured planning generations (e.g. outline) need more wall-clock and
 * more attempts on slower/free models, which intermittently return empty or
 * non-JSON bodies. These tune resilience WITHOUT changing the configured model.
 */
const HEAVY_PLANNING_TOKEN_THRESHOLD = 3000;
const HEAVY_PLANNING_TIMEOUT_MS = 60_000;
const PLANNING_RETRY_FLOOR = 3;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;

function assertModelAllowlisted(model: string): string {
  const trimmed = model.trim();
  if (!MODEL_ALLOWLIST.has(trimmed)) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "Resolved model is not in the server allowlist",
      503,
    );
  }
  return trimmed;
}

function resolveModelFromEnv(
  bindings: AppBindings,
  qualityMode: WriterQualityMode,
): string | undefined {
  if (qualityMode === WRITER_QUALITY_MODES.hemat) {
    return bindings.AI_MODEL_HEMAT?.trim();
  }
  if (qualityMode === WRITER_QUALITY_MODES.seimbang) {
    return bindings.AI_MODEL_SEIMBANG?.trim();
  }
  return bindings.AI_MODEL_TERBAIK?.trim();
}

function pickAllowlistedModel(
  bindings: AppBindings,
  generationType: GenerationType,
  qualityMode: WriterQualityMode,
): string {
  if (isProseModelRoutingGenerationType(generationType)) {
    const envModel = resolveModelFromEnv(bindings, qualityMode);
    if (envModel && MODEL_ALLOWLIST.has(envModel)) {
      return envModel;
    }
  }

  const candidates = getModelCandidatesForGeneration(
    generationType,
    qualityMode,
  );
  if (MODEL_ALLOWLIST.has(candidates.primary)) {
    return candidates.primary;
  }
  if (MODEL_ALLOWLIST.has(candidates.fallback)) {
    return candidates.fallback;
  }

  const defaultModel = getDefaultAiModel(bindings);
  if (defaultModel && MODEL_ALLOWLIST.has(defaultModel)) {
    return defaultModel;
  }

  return assertModelAllowlisted(candidates.primary);
}

/**
 * Resolves provider + model from generation type and quality tier only.
 * Never accepts client-supplied model identifiers.
 */
export function resolveModelForGeneration(
  bindings: AppBindings,
  input: ModelRouterResolveInput,
): ResolvedModelConfig {
  const effectiveQualityMode = resolveQualityModeForGeneration(
    input.generationType,
    input.qualityMode,
  );
  const model = pickAllowlistedModel(
    bindings,
    input.generationType,
    effectiveQualityMode,
  );
  const qualityCap = QUALITY_MAX_OUTPUT_TOKENS[effectiveQualityMode];
  const typeCap = GENERATION_TYPE_TOKEN_CAP[input.generationType];
  const maxOutputTokens = PLANNING_GENERATION_TYPES.has(input.generationType)
    ? typeCap
    : Math.min(qualityCap, typeCap);

  const useMock = isAiProviderMock(bindings);

  const isHeavyPlanning =
    PLANNING_GENERATION_TYPES.has(input.generationType) &&
    typeCap >= HEAVY_PLANNING_TOKEN_THRESHOLD;
  const timeoutMs = isHeavyPlanning
    ? Math.max(
        QUALITY_TIMEOUT_MS[effectiveQualityMode],
        HEAVY_PLANNING_TIMEOUT_MS,
      )
    : QUALITY_TIMEOUT_MS[effectiveQualityMode];

  return {
    provider: useMock ? "mock" : "openrouter",
    model,
    maxOutputTokens,
    timeoutMs,
    temperature: 0.7,
  };
}

export function resolveFallbackModelForGeneration(
  bindings: AppBindings,
  input: ModelRouterResolveInput,
): ResolvedModelConfig | null {
  const primary = resolveModelForGeneration(bindings, input);
  const effectiveQualityMode = resolveQualityModeForGeneration(
    input.generationType,
    input.qualityMode,
  );
  const fallback = getModelCandidatesForGeneration(
    input.generationType,
    effectiveQualityMode,
  ).fallback;

  if (fallback === primary.model || !MODEL_ALLOWLIST.has(fallback)) {
    return null;
  }
  return { ...primary, model: fallback };
}

function applyInputOverrides(
  config: ResolvedModelConfig,
  input: ModelRouterGenerateInput,
): ResolvedModelConfig {
  const next = { ...config };
  if (input.maxOutputTokens !== undefined) {
    next.maxOutputTokens = Math.min(
      next.maxOutputTokens,
      Math.max(1, Math.floor(input.maxOutputTokens)),
    );
  }
  if (input.maxOutputTokensOverride !== undefined) {
    next.maxOutputTokens = Math.min(
      MAX_OUTPUT_TOKENS_CEILING,
      Math.max(1, Math.floor(input.maxOutputTokensOverride)),
    );
  }
  if (input.temperature !== undefined) {
    next.temperature = Math.min(1, Math.max(0, input.temperature));
  }
  return next;
}

function logGenerationEvent(
  event: "start" | "success" | "error",
  fields: Record<string, string | number | undefined>,
): void {
  const safeFields = { ...fields };
  console.info(`[model-router] ${event}`, JSON.stringify(safeFields));
}

function isRetryableProviderError(err: unknown): boolean {
  if (!(err instanceof AppError)) return false;
  return (
    err.code === "AI_PROVIDER_ERROR" ||
    err.code === "AI_PROVIDER_TIMEOUT" ||
    err.code === "AI_PROVIDER_RATE_LIMITED" ||
    // Free/slow models intermittently return empty content; treat as transient.
    err.code === "AI_OUTPUT_EMPTY"
  );
}

/** Exponential backoff with jitter between provider retries. */
async function delayBeforeRetry(attempt: number): Promise<void> {
  const expo = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * RETRY_BASE_DELAY_MS);
  await new Promise((resolve) => setTimeout(resolve, expo + jitter));
}

async function invokeProvider(
  bindings: AppBindings,
  input: ModelRouterGenerateInput,
  config: ResolvedModelConfig,
): Promise<ModelRouterGenerateResult> {
  if (config.provider === "mock") {
    return generateWithMockProvider(
      input,
      config,
      getAiProviderMockMode(bindings),
    );
  }

  if (!hasOpenRouterApiKey(bindings)) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "OpenRouter is not configured for live generation",
      503,
    );
  }

  // Heavy structured planning generations get a higher retry floor because
  // free/slow models fail transiently more often on large JSON payloads.
  const baseRetries = getAiMaxRetries(bindings);
  const maxRetries = PLANNING_GENERATION_TYPES.has(input.generationType)
    ? Math.max(baseRetries, PLANNING_RETRY_FLOOR)
    : baseRetries;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await callOpenRouterChatCompletion(bindings, config, {
        promptHash: input.promptHash,
        promptMessages: input.promptMessages,
        promptText: input.promptText,
      });
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isRetryableProviderError(err)) {
        await delayBeforeRetry(attempt);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

/**
 * Model router boundary for AI generation.
 * Disabled when AI_GENERATION_ENABLED=false. No DB writes, no credit mutation.
 */
export async function generateWithModelRouter(
  bindings: AppBindings,
  input: ModelRouterGenerateInput,
): Promise<ModelRouterGenerateResult> {
  if (!isAiGenerationEnabled(bindings)) {
    throw new AppError(
      "AI_DISABLED",
      "AI generation is disabled",
      503,
    );
  }

  assertPromptSafeForProvider(input.promptMessages, input.promptText);

  const baseConfig = resolveModelForGeneration(bindings, {
    generationType: input.generationType,
    qualityMode: input.qualityMode,
  });
  const config = applyInputOverrides(baseConfig, input);
  const fallbackBaseConfig = resolveFallbackModelForGeneration(bindings, {
    generationType: input.generationType,
    qualityMode: input.qualityMode,
  });
  const fallbackConfig = fallbackBaseConfig
    ? applyInputOverrides(fallbackBaseConfig, input)
    : null;

  logGenerationEvent("start", {
    generationType: input.generationType,
    qualityMode: input.qualityMode,
    provider: config.provider,
    model: config.model,
    promptHash: input.promptHash,
  });

  try {
    const result = await invokeProvider(bindings, input, config);
    assertProviderOutputSafe(result.text);

    logGenerationEvent("success", {
      generationType: input.generationType,
      provider: result.provider,
      model: result.model,
      promptHash: result.promptHash,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
    });

    return result;
  } catch (err) {
    if (
      fallbackConfig &&
      fallbackConfig.model !== config.model &&
      isRetryableProviderError(err)
    ) {
      logGenerationEvent("start", {
        generationType: input.generationType,
        qualityMode: input.qualityMode,
        provider: fallbackConfig.provider,
        model: fallbackConfig.model,
        promptHash: input.promptHash,
      });
      try {
        const fallbackResult = await invokeProvider(
          bindings,
          input,
          fallbackConfig,
        );
        assertProviderOutputSafe(fallbackResult.text);
        logGenerationEvent("success", {
          generationType: input.generationType,
          provider: fallbackResult.provider,
          model: fallbackResult.model,
          promptHash: fallbackResult.promptHash,
          inputTokens: fallbackResult.inputTokens,
          outputTokens: fallbackResult.outputTokens,
          latencyMs: fallbackResult.latencyMs,
        });
        return fallbackResult;
      } catch (fallbackErr) {
        err = fallbackErr;
      }
    }

    const code = err instanceof AppError ? err.code : "AI_PROVIDER_ERROR";
    logGenerationEvent("error", {
      generationType: input.generationType,
      provider: config.provider,
      model: config.model,
      promptHash: input.promptHash,
      error_code: code,
    });
    throw err;
  }
}
