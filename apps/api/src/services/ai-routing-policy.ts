import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type GenerationType,
  type WriterQualityMode,
} from "@vibenovel/shared";
import { AppError } from "../errors.js";
import {
  AI_MODEL_REGISTRY,
  getAiModelDeployment,
  type AiLiveProviderId,
  type AiLogicalModelKey,
  type AiModelCapabilities,
} from "./ai-model-registry.js";

export const AI_ROUTING_POLICY_VERSION = "v3";

export type AiCapabilityRequirement = keyof AiModelCapabilities;

export interface AiRouteTarget {
  provider: AiLiveProviderId;
  model: AiLogicalModelKey;
}

export interface ResolvedAiRoute {
  routeKey: GenerationType | "embedding_import_rag";
  requires: readonly AiCapabilityRequirement[];
  primary: AiRouteTarget;
  fallback: AiRouteTarget | null;
  maxOutputTokens: number;
  timeoutMs: number;
  primaryMaxRetries: number;
  temperature: number;
}

interface FixedGenerationRoute extends Omit<ResolvedAiRoute, "routeKey"> {
  kind: "fixed";
}

interface TieredGenerationRoute {
  kind: "tiered";
  requires: readonly AiCapabilityRequirement[];
  tiers: Record<WriterQualityMode, Omit<ResolvedAiRoute, "routeKey" | "requires">>;
}

type GenerationRouteDefinition = FixedGenerationRoute | TieredGenerationRoute;

const TEXT_JSON = ["textGeneration", "structuredJson"] as const;
const TEXT_ONLY = ["textGeneration"] as const;

// `summary_delta` is a deprecated alias for `continuity_delta`. Both engine
// keys must reference the same canonical route object, never a duplicate.
const CONTINUITY_DELTA_ROUTE = {
  kind: "fixed",
  requires: TEXT_JSON,
  primary: { provider: "openrouter", model: "deepseek_flash" },
  fallback: { provider: "openrouter", model: "gemini_flash_lite" },
  maxOutputTokens: 1500,
  timeoutMs: 30_000,
  primaryMaxRetries: 1,
  temperature: 0.2,
} as const;

export const AI_GENERATION_ROUTING_POLICY = {
  [GENERATION_TYPES.intake_assistant]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "gemini_flash_lite" },
    fallback: { provider: "openrouter", model: "qwen_plus" },
    maxOutputTokens: 1500,
    timeoutMs: 30_000,
    primaryMaxRetries: 1,
    temperature: 0.7,
  },
  [GENERATION_TYPES.concept_generation]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "qwen_plus" },
    fallback: { provider: "openrouter", model: "minimax_text" },
    maxOutputTokens: 3000,
    timeoutMs: 60_000,
    primaryMaxRetries: 1,
    temperature: 0.4,
  },
  [GENERATION_TYPES.foundation_proposal]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "minimax_text" },
    fallback: { provider: "openrouter", model: "qwen_plus" },
    maxOutputTokens: 3000,
    timeoutMs: 60_000,
    primaryMaxRetries: 1,
    temperature: 0.4,
  },
  [GENERATION_TYPES.draft_import_signal_extraction]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "gemini_flash_lite" },
    fallback: { provider: "openrouter", model: "deepseek_flash" },
    maxOutputTokens: 1800,
    timeoutMs: 30_000,
    primaryMaxRetries: 1,
    temperature: 0.1,
  },
  [GENERATION_TYPES.outline_generation]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "minimax_text" },
    fallback: { provider: "openrouter", model: "qwen_plus" },
    maxOutputTokens: 4000,
    timeoutMs: 60_000,
    primaryMaxRetries: 1,
    temperature: 0.4,
  },
  [GENERATION_TYPES.beat_generation]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "minimax_text" },
    fallback: { provider: "openrouter", model: "qwen_plus" },
    maxOutputTokens: 3000,
    timeoutMs: 60_000,
    primaryMaxRetries: 1,
    temperature: 0.35,
  },
  [GENERATION_TYPES.chapter_summary_generation]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "deepseek_flash" },
    fallback: { provider: "openrouter", model: "gemini_flash_lite" },
    maxOutputTokens: 3000,
    timeoutMs: 60_000,
    primaryMaxRetries: 1,
    temperature: 0.35,
  },
  [GENERATION_TYPES.continuity_delta]: CONTINUITY_DELTA_ROUTE,
  [GENERATION_TYPES.summary_delta]: CONTINUITY_DELTA_ROUTE,
  [GENERATION_TYPES.prose_beat]: {
    kind: "tiered",
    requires: TEXT_ONLY,
    tiers: {
      [WRITER_QUALITY_MODES.hemat]: {
        primary: { provider: "openrouter", model: "minimax_text" },
        fallback: { provider: "openrouter", model: "qwen_plus" },
        maxOutputTokens: 800,
        timeoutMs: 30_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
      [WRITER_QUALITY_MODES.seimbang]: {
        primary: { provider: "openrouter", model: "gemini_flash" },
        fallback: { provider: "openrouter", model: "mistral_large" },
        maxOutputTokens: 1200,
        timeoutMs: 45_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
      [WRITER_QUALITY_MODES.terbaik]: {
        primary: { provider: "openrouter", model: "claude_opus" },
        fallback: { provider: "openrouter", model: "gemini_pro" },
        maxOutputTokens: 2000,
        timeoutMs: 60_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
    },
  },
  [GENERATION_TYPES.prose_rewrite]: {
    kind: "tiered",
    requires: TEXT_ONLY,
    tiers: {
      [WRITER_QUALITY_MODES.hemat]: {
        primary: { provider: "openrouter", model: "minimax_text" },
        fallback: { provider: "openrouter", model: "qwen_plus" },
        maxOutputTokens: 800,
        timeoutMs: 30_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
      [WRITER_QUALITY_MODES.seimbang]: {
        primary: { provider: "openrouter", model: "gemini_flash" },
        fallback: { provider: "openrouter", model: "mistral_large" },
        maxOutputTokens: 1200,
        timeoutMs: 45_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
      [WRITER_QUALITY_MODES.terbaik]: {
        primary: { provider: "openrouter", model: "claude_opus" },
        fallback: { provider: "openrouter", model: "gemini_pro" },
        maxOutputTokens: 2000,
        timeoutMs: 60_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
    },
  },
  [GENERATION_TYPES.publish_copy]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "qwen_plus" },
    fallback: { provider: "openrouter", model: "gemini_flash_lite" },
    maxOutputTokens: 800,
    timeoutMs: 30_000,
    primaryMaxRetries: 1,
    temperature: 0.4,
  },
} as const satisfies Record<GenerationType, GenerationRouteDefinition>;

export const AI_EMBEDDING_ROUTING_POLICY = {
  import_rag: {
    routeKey: "embedding_import_rag",
    requires: ["embedding"] as const,
    primary: { provider: "openrouter", model: "openai_embedding_small" },
    fallback: null,
    maxOutputTokens: 0,
    timeoutMs: 45_000,
    primaryMaxRetries: 1,
    temperature: 0,
  },
} as const;

export function resolveGenerationRoute(
  generationType: GenerationType,
  qualityMode: WriterQualityMode,
): ResolvedAiRoute {
  const definition = AI_GENERATION_ROUTING_POLICY[generationType];
  if (!definition) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      `No route for generation type ${generationType}`,
      503,
    );
  }
  if (definition.kind === "fixed") {
    const { kind: _kind, ...route } = definition;
    return { routeKey: generationType, ...route };
  }
  return {
    routeKey: generationType,
    requires: definition.requires,
    ...definition.tiers[qualityMode],
  };
}

export function getEmbeddingRoute(
  key: keyof typeof AI_EMBEDDING_ROUTING_POLICY,
): ResolvedAiRoute {
  return AI_EMBEDDING_ROUTING_POLICY[key];
}

function validateTarget(
  routeName: string,
  targetName: "primary" | "fallback",
  target: AiRouteTarget | null,
  requires: readonly AiCapabilityRequirement[],
): string[] {
  if (!target) return [];
  const model = AI_MODEL_REGISTRY[target.model];
  const deployment = getAiModelDeployment(target.model, target.provider);
  const errors: string[] = [];
  for (const capability of requires) {
    if (!model.capabilities[capability]) {
      errors.push(`${routeName}.${targetName} lacks ${capability}`);
    }
  }
  if (deployment.verificationStatus !== "verified") {
    errors.push(
      `${routeName}.${targetName} deployment is not verified: ${deployment.verificationStatus}`,
    );
  }
  if (
    model.modality === "text" &&
    !deployment.supportedParameters.includes("max_tokens")
  ) {
    errors.push(`${routeName}.${targetName} does not support max_tokens`);
  }
  return errors;
}

export function validateAiRoutingPolicy(): string[] {
  const errors: string[] = [];
  for (const generationType of Object.values(GENERATION_TYPES)) {
    const definition = AI_GENERATION_ROUTING_POLICY[generationType];
    if (!definition) {
      errors.push(`Missing route for ${generationType}`);
      continue;
    }
    const resolvedRoutes =
      definition.kind === "fixed"
        ? [resolveGenerationRoute(generationType, WRITER_QUALITY_MODES.hemat)]
        : Object.values(WRITER_QUALITY_MODES).map((qualityMode) =>
            resolveGenerationRoute(generationType, qualityMode),
          );
    for (const route of resolvedRoutes) {
      errors.push(
        ...validateTarget(
          String(route.routeKey),
          "primary",
          route.primary,
          route.requires,
        ),
      );
      errors.push(
        ...validateTarget(
          String(route.routeKey),
          "fallback",
          route.fallback,
          route.requires,
        ),
      );
      if (
        route.fallback &&
        route.primary.provider === route.fallback.provider &&
        route.primary.model === route.fallback.model
      ) {
        errors.push(`${route.routeKey} primary and fallback are identical`);
      }
    }
  }
  const embedding = getEmbeddingRoute("import_rag");
  errors.push(
    ...validateTarget(
      "embedding_import_rag",
      "primary",
      embedding.primary,
      embedding.requires,
    ),
  );
  return errors;
}

export function assertAiRoutingPolicyValid(): void {
  const errors = validateAiRoutingPolicy();
  if (errors.length > 0) {
    throw new Error(`Invalid AI routing policy: ${errors.join("; ")}`);
  }
}
