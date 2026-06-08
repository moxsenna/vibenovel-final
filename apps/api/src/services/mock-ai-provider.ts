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
    const requested = Array.isArray(input.metadata?.requestedFields)
      ? (input.metadata!.requestedFields as string[])
      : Object.values([
          "teaser",
          "caption",
          "readerQuestion",
          "shortSynopsis",
          "nextChapterTeaser",
        ]);
    const payload: Record<string, string> = {};
    for (const field of requested) {
      switch (field) {
        case "teaser":
          payload.teaser = `Hook singkat tanpa spoiler besar. [mock-publish:${hashPrefix}]`;
          break;
        case "caption":
          payload.caption =
            `Caption siap KBM — drama keluarga yang menggoda tanpa overclaim. [mock-publish:${hashPrefix}]`;
          break;
        case "readerQuestion":
          payload.readerQuestion = "Apa rahasia yang belum terungkap di bab ini?";
          break;
        case "shortSynopsis":
          payload.shortSynopsis =
            "Sinopsis singkat yang menegaskan konflik inti tanpa membocorkan twist besar.";
          break;
        case "nextChapterTeaser":
          payload.nextChapterTeaser = "Esok pagi, sebuah pesan mengubah segalanya.";
          break;
        default:
          break;
      }
    }
    return JSON.stringify(payload);
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