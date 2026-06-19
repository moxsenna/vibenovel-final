import {
  GENERATION_TYPES,
  type GenerationType,
  type WriterQualityMode,
} from "@vibenovel/shared";
import { AppError } from "../errors.js";
import {
  getFeatureKeyForGenerationType,
  type NarrazaAiFeature,
} from "./ai-credit-policy.js";

export interface ModelRouteCandidates {
  primary: string;
  fallback: string;
}

export const MODEL_ROUTING_VERSION = "v2";

export const FIXED_FEATURE_MODELS = {
  intake_chat_reply: {
    primary: "google/gemini-3.1-flash-lite",
    fallback: "qwen/qwen3.7-plus",
  },
  concept_generate_3: {
    primary: "qwen/qwen3.7-plus",
    fallback: "minimax/minimax-m3",
  },
  foundation_setup: {
    primary: "minimax/minimax-m3",
    fallback: "qwen/qwen3.7-plus",
  },
  draft_import_signal_extraction: {
    primary: "google/gemini-3.1-flash-lite",
    fallback: "deepseek/deepseek-v4-flash",
  },
  outline_10_chapters: {
    primary: "minimax/minimax-m3",
    fallback: "qwen/qwen3.7-plus",
  },
  chapter_beats_generate: {
    primary: "minimax/minimax-m3",
    fallback: "qwen/qwen3.7-plus",
  },
  summary_delta: {
    primary: "deepseek/deepseek-v4-flash",
    fallback: "google/gemini-3.1-flash-lite",
  },
  continuity_check_standalone: {
    primary: "deepseek/deepseek-v4-flash",
    fallback: "google/gemini-3.1-flash-lite",
  },
  publish_package: {
    primary: "qwen/qwen3.7-plus",
    fallback: "google/gemini-3.1-flash-lite",
  },
} as const satisfies Partial<
  Record<NarrazaAiFeature, ModelRouteCandidates>
>;

export const PROSE_MODELS = {
  hemat: {
    primary: "minimax/minimax-m3",
    fallback: "qwen/qwen3.7-plus",
  },
  seimbang: {
    primary: "google/gemini-2.5-flash",
    fallback: "mistralai/mistral-large-2512",
  },
  terbaik: {
    primary: "anthropic/claude-opus-4.6",
    fallback: "google/gemini-3.1-pro-preview",
  },
} as const satisfies Record<WriterQualityMode, ModelRouteCandidates>;

function isProseGenerationType(generationType: GenerationType): boolean {
  return (
    generationType === GENERATION_TYPES.prose_beat ||
    generationType === GENERATION_TYPES.prose_rewrite
  );
}

export function getModelCandidatesForGeneration(
  generationType: GenerationType,
  qualityMode: WriterQualityMode,
): ModelRouteCandidates {
  if (isProseGenerationType(generationType)) {
    return PROSE_MODELS[qualityMode];
  }

  const feature = getFeatureKeyForGenerationType(generationType);
  const route =
    FIXED_FEATURE_MODELS[feature as keyof typeof FIXED_FEATURE_MODELS];
  if (!route) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      `Model routing is not configured for feature: ${feature}`,
      503,
    );
  }
  return route;
}

export function isProseModelRoutingGenerationType(
  generationType: GenerationType,
): boolean {
  return isProseGenerationType(generationType);
}
