import { AppError } from "../errors.js";

export type AiLiveProviderId = "openrouter" | "tokenrouter";
export type AiModality = "text" | "embedding";
export type AiVerificationStatus =
  | "verified"
  | "documented"
  | "missing"
  | "incompatible";

export interface AiModelCapabilities {
  textGeneration: boolean;
  structuredJson: boolean;
  reasoning: boolean;
  streaming: boolean;
  embedding: boolean;
}

export interface AiDeploymentPricing {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}

export interface AiModelDeployment {
  modelId: string;
  contextWindow: number;
  applicationContextLimit: number;
  pricing: AiDeploymentPricing;
  pricingKind: "catalog" | "temporary_promotion";
  promotionEndsOn?: string;
  verifiedAt: string;
  verificationSource: string;
  verificationStatus: AiVerificationStatus;
  supportedParameters: readonly string[];
  outputNormalization: {
    stripThinkTags: boolean;
  };
}

export interface AiModelDefinition {
  modality: AiModality;
  capabilities: AiModelCapabilities;
  embeddingDimensions?: number;
  deployments: Partial<Record<AiLiveProviderId, AiModelDeployment>>;
}

/**
 * Single source of truth for logical models and their provider deployments.
 *
 * Logical keys identify a stable model *family*, never a role (roles live in
 * `ai-routing-policy.ts`) and never a specific release. Upgrading a version
 * within the same family changes only the deployment `modelId` and its
 * verification snapshot. Replacing the family itself is an explicit
 * routing-policy change.
 *
 * OpenRouter pricing is copied from the 19 June 2026 verification snapshot in
 * `docs/audit/20-credit-v2-model-verification-2026-06-19.md` and is diffed by
 * `ai-model-registry-contracts.test.mts`.
 */
export const AI_MODEL_REGISTRY = {
  gemini_flash_lite: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "google/gemini-3.1-flash-lite",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0.25, outputUsdPer1M: 1.5 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  qwen_plus: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "qwen/qwen3.7-plus",
        contextWindow: 1_000_000,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0.32, outputUsdPer1M: 1.28 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  minimax_text: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "minimax/minimax-m3",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0.3, outputUsdPer1M: 1.2 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: true },
      },
      tokenrouter: {
        modelId: "MiniMax-M3",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0, outputUsdPer1M: 0 },
        pricingKind: "temporary_promotion",
        promotionEndsOn: "2026-06-22",
        verifiedAt: "2026-06-21T00:00:00.000Z",
        verificationSource:
          "TokenRouter MiniMax-M3 model page supplied by operator",
        verificationStatus: "documented",
        supportedParameters: ["max_tokens", "temperature"],
        outputNormalization: { stripThinkTags: true },
      },
    },
  },
  deepseek_flash: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "deepseek/deepseek-v4-flash",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0.09, outputUsdPer1M: 0.18 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  gemini_flash: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "google/gemini-2.5-flash",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0.3, outputUsdPer1M: 2.5 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  mistral_large: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: false,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "mistralai/mistral-large-2512",
        contextWindow: 262_144,
        applicationContextLimit: 120_000,
        pricing: { inputUsdPer1M: 0.5, outputUsdPer1M: 1.5 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  claude_opus: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "anthropic/claude-opus-4.6",
        contextWindow: 1_000_000,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 5, outputUsdPer1M: 25 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  gemini_pro: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "google/gemini-3.1-pro-preview",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 2, outputUsdPer1M: 12 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  openai_embedding_small: {
    modality: "embedding",
    capabilities: {
      textGeneration: false,
      structuredJson: false,
      reasoning: false,
      streaming: false,
      embedding: true,
    },
    embeddingDimensions: 1536,
    deployments: {
      openrouter: {
        modelId: "openai/text-embedding-3-small",
        contextWindow: 8_191,
        applicationContextLimit: 8_000,
        pricing: { inputUsdPer1M: 0.02, outputUsdPer1M: 0 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-21T00:00:00.000Z",
        verificationSource: "existing Sprint 18 production embedding contract",
        verificationStatus: "verified",
        supportedParameters: ["encoding_format"],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
} as const satisfies Record<string, AiModelDefinition>;

export type AiLogicalModelKey = keyof typeof AI_MODEL_REGISTRY;

export function isAiLogicalModelKey(
  value: unknown,
): value is AiLogicalModelKey {
  return typeof value === "string" && value in AI_MODEL_REGISTRY;
}

export function getAiModel(key: AiLogicalModelKey): AiModelDefinition {
  return AI_MODEL_REGISTRY[key];
}

export function getAiModelDeployment(
  key: AiLogicalModelKey,
  provider: AiLiveProviderId,
): AiModelDeployment {
  // Read through the widened `AiModelDefinition` view so indexing by the
  // provider union is well-typed; the narrow `as const` registry type only
  // exposes the providers each model actually declares.
  const deployment = getAiModel(key).deployments[provider];
  if (!deployment) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      `Model ${key} has no ${provider} deployment`,
      503,
    );
  }
  return deployment;
}

export function getDeploymentCost(
  key: AiLogicalModelKey,
  provider: AiLiveProviderId,
): AiDeploymentPricing {
  return getAiModelDeployment(key, provider).pricing;
}
