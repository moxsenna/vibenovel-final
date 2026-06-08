import { GENERATION_TYPES } from "@vibenovel/shared";
import { AppError } from "../errors.js";
import type {
  MockAiProviderMode,
  ModelRouterGenerateInput,
  ModelRouterGenerateResult,
  ResolvedModelConfig,
} from "./ai-generation-types.js";

const MOCK_PROSE_BEAT_TEMPLATE =
  "Dia menahan napas. Ruangan itu terasa lebih sempit dari biasanya, " +
  "seolah setiap kata yang belum terucap ikut menekan dadanya. " +
  "Langkahnya pelan menuju jendela — bukan untuk kabur, melainkan " +
  "untuk memastikan dunia di luar masih ada sebelum ia memilih kebenaran.";

function buildDeterministicProse(input: ModelRouterGenerateInput): string {
  const hashPrefix = input.promptHash.slice(0, 8);
  if (input.generationType === GENERATION_TYPES.prose_beat) {
    return `${MOCK_PROSE_BEAT_TEMPLATE}\n\n[mock:${hashPrefix}]`;
  }
  if (input.generationType === GENERATION_TYPES.prose_rewrite) {
    return `Versi yang lebih jernih dari adegan ini tetap mempertahankan fakta inti. [mock-rewrite:${hashPrefix}]`;
  }
  if (input.generationType === GENERATION_TYPES.publish_copy) {
    return `Caption siap KBM — hook singkat tanpa spoiler. [mock-publish:${hashPrefix}]`;
  }
  return `Mock output for ${input.generationType}. [mock:${hashPrefix}]`;
}

function estimateMockTokens(text: string): { input: number; output: number } {
  const words = text.split(/\s+/).filter(Boolean).length;
  return {
    input: Math.max(32, Math.floor(words * 0.6)),
    output: Math.max(16, words),
  };
}

/**
 * Deterministic local provider — no network. Used when AI_PROVIDER_MOCK=true.
 */
export async function generateWithMockProvider(
  input: ModelRouterGenerateInput,
  config: ResolvedModelConfig,
  mode: MockAiProviderMode,
): Promise<ModelRouterGenerateResult> {
  const started = Date.now();

  if (mode === "fail_provider") {
    throw new AppError(
      "AI_PROVIDER_ERROR",
      "Mock provider simulated a provider failure",
      502,
    );
  }

  const text =
    mode === "unsafe_output"
      ? "This output contains planningTruth leak marker for smoke testing."
      : buildDeterministicProse(input);

  const tokens = estimateMockTokens(text);

  return {
    text,
    provider: "mock",
    model: config.model,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    latencyMs: Date.now() - started,
    finishReason: "stop",
    promptHash: input.promptHash,
  };
}