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
import { generateWithMockProvider } from "./mock-ai-provider.js";
import { callOpenRouterChatCompletion } from "./openrouter-client.js";

/** Hardcoded allowlist — client cannot pass arbitrary model ids. */
export const MODEL_ALLOWLIST = new Set([
  "google/gemma-2-9b-it",
  "google/gemini-flash-latest",
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-flash",
  "anthropic/claude-3-haiku",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-haiku-20240307",
  "anthropic/claude-3-5-sonnet-20240620",
]);

const QUALITY_DEFAULT_MODELS: Record<WriterQualityMode, string> = {
  [WRITER_QUALITY_MODES.hemat]: "google/gemma-2-9b-it",
  [WRITER_QUALITY_MODES.seimbang]: "anthropic/claude-3-haiku",
  [WRITER_QUALITY_MODES.terbaik]: "anthropic/claude-3.5-sonnet",
};

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
  [GENERATION_TYPES.prose_beat]: 2000,
  [GENERATION_TYPES.prose_rewrite]: 2000,
  [GENERATION_TYPES.publish_copy]: 800,
  [GENERATION_TYPES.summary_delta]: 1500,
};

/** Hard upper bound for any server-side maxOutputTokensOverride. */
const MAX_OUTPUT_TOKENS_CEILING = 4000;

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
  qualityMode: WriterQualityMode,
): string {
  const envModel = resolveModelFromEnv(bindings, qualityMode);
  if (envModel && MODEL_ALLOWLIST.has(envModel)) {
    return envModel;
  }

  const defaultModel = getDefaultAiModel(bindings);
  if (defaultModel && MODEL_ALLOWLIST.has(defaultModel)) {
    return defaultModel;
  }

  return assertModelAllowlisted(QUALITY_DEFAULT_MODELS[qualityMode]);
}

/**
 * Resolves provider + model from generation type and quality tier only.
 * Never accepts client-supplied model identifiers.
 */
export function resolveModelForGeneration(
  bindings: AppBindings,
  input: ModelRouterResolveInput,
): ResolvedModelConfig {
  const model = pickAllowlistedModel(bindings, input.qualityMode);
  const qualityCap = QUALITY_MAX_OUTPUT_TOKENS[input.qualityMode];
  const typeCap = GENERATION_TYPE_TOKEN_CAP[input.generationType];
  const maxOutputTokens = Math.min(qualityCap, typeCap);

  const useMock = isAiProviderMock(bindings);

  return {
    provider: useMock ? "mock" : "openrouter",
    model,
    maxOutputTokens,
    timeoutMs: QUALITY_TIMEOUT_MS[input.qualityMode],
    temperature: 0.7,
  };
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
    err.code === "AI_PROVIDER_RATE_LIMITED"
  );
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

  const maxRetries = getAiMaxRetries(bindings);
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