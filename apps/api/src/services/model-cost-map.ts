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
  "google/gemini-2.5-flash": {
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
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