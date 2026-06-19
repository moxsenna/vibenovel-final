export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
export const OPENROUTER_REQUIRED_PARAMETERS = [
  "max_tokens",
  "temperature",
] as const;

export type OpenRouterVerificationStatus =
  | "VERIFIED"
  | "MISSING"
  | "INCOMPATIBLE";

export interface VerifiedOpenRouterModel {
  id: string;
  canonicalId: string;
  catalogMatch: "exact";
  contextLength: number;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  supportedParameters: readonly string[];
  verifiedAt: string;
  sourceUrl: string;
}

export interface OpenRouterCatalogModel {
  id: string;
  canonical_slug?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  supported_parameters?: string[];
}

export interface OpenRouterVerificationResult {
  requestedModelId: string;
  status: OpenRouterVerificationStatus;
  canonicalId: string | null;
  contextLength: number | null;
  inputUsdPer1M: number | null;
  outputUsdPer1M: number | null;
  supportedParameters: string[];
  missingRequiredParameters: string[];
  verifiedAt: string;
  sourceUrl: string;
  reason: string | null;
}

const VERIFIED_AT = "2026-06-19T10:25:48Z";

function verified(
  id: string,
  canonicalId: string,
  contextLength: number,
  inputUsdPer1M: number,
  outputUsdPer1M: number,
): VerifiedOpenRouterModel {
  return {
    id,
    canonicalId,
    catalogMatch: "exact",
    contextLength,
    inputUsdPer1M,
    outputUsdPer1M,
    supportedParameters: [...OPENROUTER_REQUIRED_PARAMETERS],
    verifiedAt: VERIFIED_AT,
    sourceUrl: OPENROUTER_MODELS_URL,
  };
}

export const VERIFIED_OPENROUTER_MODELS: Readonly<
  Record<string, VerifiedOpenRouterModel>
> = {
  "google/gemini-3.1-flash-lite": verified(
    "google/gemini-3.1-flash-lite",
    "google/gemini-3.1-flash-lite-20260507",
    1_048_576,
    0.25,
    1.5,
  ),
  "qwen/qwen3.7-plus": verified(
    "qwen/qwen3.7-plus",
    "qwen/qwen3.7-plus-20260602",
    1_000_000,
    0.32,
    1.28,
  ),
  "minimax/minimax-m3": verified(
    "minimax/minimax-m3",
    "minimax/minimax-m3-20260531",
    1_048_576,
    0.3,
    1.2,
  ),
  "deepseek/deepseek-v4-flash": verified(
    "deepseek/deepseek-v4-flash",
    "deepseek/deepseek-v4-flash-20260423",
    1_048_576,
    0.09,
    0.18,
  ),
  "google/gemini-2.5-flash": verified(
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash",
    1_048_576,
    0.3,
    2.5,
  ),
  "mistralai/mistral-large-2512": verified(
    "mistralai/mistral-large-2512",
    "mistralai/mistral-large-2512",
    262_144,
    0.5,
    1.5,
  ),
  "anthropic/claude-opus-4.6": verified(
    "anthropic/claude-opus-4.6",
    "anthropic/claude-4.6-opus-20260205",
    1_000_000,
    5,
    25,
  ),
  "google/gemini-3.1-pro-preview": verified(
    "google/gemini-3.1-pro-preview",
    "google/gemini-3.1-pro-preview-20260219",
    1_048_576,
    2,
    12,
  ),
  "google/gemma-4-31b-it:free": verified(
    "google/gemma-4-31b-it:free",
    "google/gemma-4-31b-it-20260402",
    262_144,
    0,
    0,
  ),
  "openrouter/free": verified(
    "openrouter/free",
    "openrouter/free",
    200_000,
    0,
    0,
  ),
  "anthropic/claude-3-haiku": verified(
    "anthropic/claude-3-haiku",
    "anthropic/claude-3-haiku",
    200_000,
    0.25,
    1.25,
  ),
};

export const REJECTED_OPENROUTER_MODEL_IDS = [
  "anthropic/claude-opus-4.8",
  "openai/gpt-5.2",
] as const;

export function getVerifiedOpenRouterModel(
  model: string,
): VerifiedOpenRouterModel | null {
  return VERIFIED_OPENROUTER_MODELS[model.trim()] ?? null;
}

function parsePerTokenPrice(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 1_000_000 * 1_000_000_000) / 1_000_000_000;
}

export async function fetchOpenRouterModelCatalog(options?: {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<OpenRouterCatalogModel[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = options?.apiKey?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetchImpl(OPENROUTER_MODELS_URL, { headers });
  if (!response.ok) {
    if (response.status === 401 && !apiKey) {
      throw new Error(
        "OpenRouter catalog requires authentication. Set OPENROUTER_API_KEY and retry.",
      );
    }
    throw new Error(
      `OpenRouter catalog request failed with HTTP ${response.status}`,
    );
  }

  const parsed = (await response.json()) as { data?: unknown };
  if (!Array.isArray(parsed.data)) {
    throw new Error("OpenRouter catalog response is missing data[]");
  }
  return parsed.data as OpenRouterCatalogModel[];
}

export function verifyOpenRouterModels(
  requestedModelIds: readonly string[],
  catalog: readonly OpenRouterCatalogModel[],
  verifiedAt = new Date().toISOString(),
): OpenRouterVerificationResult[] {
  const byId = new Map(catalog.map((model) => [model.id, model]));

  return requestedModelIds.map((requestedModelId) => {
    const model = byId.get(requestedModelId);
    if (!model) {
      return {
        requestedModelId,
        status: "MISSING",
        canonicalId: null,
        contextLength: null,
        inputUsdPer1M: null,
        outputUsdPer1M: null,
        supportedParameters: [],
        missingRequiredParameters: [...OPENROUTER_REQUIRED_PARAMETERS],
        verifiedAt,
        sourceUrl: OPENROUTER_MODELS_URL,
        reason: "No exact model id match in the OpenRouter catalog",
      };
    }

    const supportedParameters = Array.isArray(model.supported_parameters)
      ? [...model.supported_parameters].sort()
      : [];
    const missingRequiredParameters = OPENROUTER_REQUIRED_PARAMETERS.filter(
      (parameter) => !supportedParameters.includes(parameter),
    );
    const contextLength =
      typeof model.context_length === "number" &&
      Number.isInteger(model.context_length) &&
      model.context_length > 0
        ? model.context_length
        : null;
    const inputUsdPer1M = parsePerTokenPrice(model.pricing?.prompt);
    const outputUsdPer1M = parsePerTokenPrice(model.pricing?.completion);
    const compatible =
      missingRequiredParameters.length === 0 &&
      contextLength !== null &&
      inputUsdPer1M !== null &&
      outputUsdPer1M !== null;

    return {
      requestedModelId,
      status: compatible ? "VERIFIED" : "INCOMPATIBLE",
      canonicalId:
        typeof model.canonical_slug === "string" && model.canonical_slug
          ? model.canonical_slug
          : model.id,
      contextLength,
      inputUsdPer1M,
      outputUsdPer1M,
      supportedParameters,
      missingRequiredParameters,
      verifiedAt,
      sourceUrl: OPENROUTER_MODELS_URL,
      reason: compatible
        ? null
        : "Catalog record is missing required runtime capabilities or pricing",
    };
  });
}

export function getVerificationSnapshotDrift(
  result: OpenRouterVerificationResult,
): string[] {
  const snapshot = getVerifiedOpenRouterModel(result.requestedModelId);
  if (!snapshot) return ["missing_verified_snapshot"];
  if (result.status !== "VERIFIED") return [`status:${result.status}`];

  const drift: string[] = [];
  if (result.canonicalId !== snapshot.canonicalId) drift.push("canonicalId");
  if (result.contextLength !== snapshot.contextLength) drift.push("contextLength");
  if (result.inputUsdPer1M !== snapshot.inputUsdPer1M) {
    drift.push("inputUsdPer1M");
  }
  if (result.outputUsdPer1M !== snapshot.outputUsdPer1M) {
    drift.push("outputUsdPer1M");
  }
  return drift;
}
