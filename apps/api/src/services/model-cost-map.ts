/**
 * Internal approximate provider cost map — NOT used for user credit billing.
 * Unknown models return null without throwing. Re-verify pricing when allowlist changes.
 */

export interface ModelCostConfig {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}

export type CostEstimateReason =
  | "missing_tokens"
  | "model_not_in_cost_map"
  | "invalid_tokens";

export interface CalculateEstimatedCostInput {
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

export interface CalculateEstimatedCostResult {
  estimatedCostUsd: number | null;
  reason?: CostEstimateReason;
  approximate: boolean;
  pricingUnit: "per_1m_tokens";
  costModel?: string;
}

/**
 * Allowlisted model pricing (USD per 1M tokens).
 * Verified 2026-06-08: https://openrouter.ai/google/gemini-2.5-flash
 *   Input $0.30/M, Output $2.50/M
 */
const MODEL_COST_MAP: Readonly<Record<string, ModelCostConfig>> = {
  "google/gemini-3.1-flash-lite": {
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
  },
  "qwen/qwen3.7-plus": {
    inputUsdPer1M: 0.32,
    outputUsdPer1M: 1.28,
  },
  "minimax/minimax-m3": {
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 1.2,
  },
  "deepseek/deepseek-v4-flash": {
    inputUsdPer1M: 0.09,
    outputUsdPer1M: 0.18,
  },
  "google/gemini-2.5-flash": {
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
  },
  "mistralai/mistral-large-2512": {
    inputUsdPer1M: 0.5,
    outputUsdPer1M: 1.5,
  },
  "anthropic/claude-opus-4.8": {
    inputUsdPer1M: 5,
    outputUsdPer1M: 25,
  },
  "openai/gpt-5.2": {
    inputUsdPer1M: 1.75,
    outputUsdPer1M: 14,
  },
  "google/gemini-2.5-flash:free": {
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
  },
  "google/gemma-4-31b-it:free": {
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
  },
  "google/gemma-2-9b-it:free": {
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
  },
  "openrouter/free": {
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
  },
  "meta-llama/llama-3-8b-instruct:free": {
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
  },
  "qwen/qwen-2.5-coder-32b-instruct:free": {
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
  },
};

export function getModelCostConfig(model: string): ModelCostConfig | null {
  const trimmed = model.trim();
  if (!trimmed) return null;
  return MODEL_COST_MAP[trimmed] ?? null;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function calculateEstimatedCostUsd(
  input: CalculateEstimatedCostInput,
): CalculateEstimatedCostResult {
  const pricingUnit = "per_1m_tokens" as const;
  const model = input.model?.trim() ?? "";

  if (!model) {
    return {
      estimatedCostUsd: null,
      reason: "model_not_in_cost_map",
      approximate: true,
      pricingUnit,
    };
  }

  const config = getModelCostConfig(model);
  if (!config) {
    return {
      estimatedCostUsd: null,
      reason: "model_not_in_cost_map",
      approximate: true,
      pricingUnit,
      costModel: model,
    };
  }

  const inputTokens = input.inputTokens;
  const outputTokens = input.outputTokens;

  if (inputTokens == null || outputTokens == null) {
    return {
      estimatedCostUsd: null,
      reason: "missing_tokens",
      approximate: true,
      pricingUnit,
      costModel: model,
    };
  }

  if (
    !Number.isFinite(inputTokens) ||
    !Number.isFinite(outputTokens) ||
    inputTokens < 0 ||
    outputTokens < 0
  ) {
    return {
      estimatedCostUsd: null,
      reason: "invalid_tokens",
      approximate: true,
      pricingUnit,
      costModel: model,
    };
  }

  const estimatedCostUsd = roundUsd(
    (inputTokens / 1_000_000) * config.inputUsdPer1M +
      (outputTokens / 1_000_000) * config.outputUsdPer1M,
  );

  return {
    estimatedCostUsd,
    approximate: true,
    pricingUnit,
    costModel: model,
  };
}
