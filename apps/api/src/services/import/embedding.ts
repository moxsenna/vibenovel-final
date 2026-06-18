import type { AppBindings } from "../../env.js";
import { getAiTimeoutMs, getOpenRouterApiKey, getOpenRouterBaseUrl } from "../../env.js";
import { AppError } from "../../errors.js";
import type { DraftImportChunk } from "./chunking.js";

const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

export interface EmbeddingModelConfig {
  provider: "openrouter";
  model: string;
  dimensions: number;
}

export interface OpenRouterEmbeddingsRequest {
  model: string;
  input: string[];
  encoding_format: "float";
}

interface OpenRouterEmbeddingsResponse {
  data?: Array<{
    object?: string;
    index?: number;
    embedding?: unknown;
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: number | string };
}

export interface EmbeddingResult {
  provider: "openrouter";
  model: string;
  dimensions: number;
  embeddings: number[][];
  inputTokens?: number;
  totalTokens?: number;
}

export interface ProseEmbeddingInsertRow {
  project_id: string;
  owner_id: string;
  draft_import_id: string;
  import_job_id: string | null;
  source: "imported_draft";
  source_ref: string;
  chunk_index: number;
  chunk_text: string;
  chunk_hash: string;
  word_count: number;
  embedding: number[];
  embedding_provider: string;
  embedding_model: string;
  metadata: Record<string, unknown>;
}

export const EMBEDDING_MODEL_ALLOWLIST: ReadonlyMap<string, EmbeddingModelConfig> = new Map([
  [
    "openai/text-embedding-3-small",
    {
      provider: "openrouter",
      model: "openai/text-embedding-3-small",
      dimensions: 1536,
    },
  ],
]);

export function resolveEmbeddingModel(
  bindings: Pick<AppBindings, "AI_EMBEDDING_MODEL"> = {},
): EmbeddingModelConfig {
  const requested = bindings.AI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
  const config = EMBEDDING_MODEL_ALLOWLIST.get(requested);
  if (!config) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "Resolved embedding model is not in the server allowlist",
      503,
    );
  }
  return config;
}

export function buildOpenRouterEmbeddingsRequest(
  config: EmbeddingModelConfig,
  input: string[],
): OpenRouterEmbeddingsRequest {
  const normalized = input.map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw AppError.badRequest("Embedding input must contain at least one text chunk");
  }
  return {
    model: config.model,
    input: normalized,
    encoding_format: "float",
  };
}

function mapEmbeddingHttpError(status: number): AppError {
  if (status === 429) {
    return new AppError(
      "AI_PROVIDER_RATE_LIMITED",
      "Embedding provider rate limit exceeded",
      429,
    );
  }
  if (status >= 500) {
    return new AppError(
      "AI_PROVIDER_ERROR",
      "Embedding provider returned a server error",
      502,
    );
  }
  return new AppError(
    "AI_PROVIDER_ERROR",
    "Embedding provider rejected the request",
    502,
  );
}

function parseEmbeddingVector(value: unknown, dimensions: number): number[] {
  if (!Array.isArray(value)) {
    throw new AppError("AI_PROVIDER_ERROR", "Embedding provider returned invalid vectors", 502);
  }
  if (value.length !== dimensions) {
    throw new AppError(
      "AI_PROVIDER_ERROR",
      "Embedding provider returned vectors with unexpected dimensions",
      502,
    );
  }

  const vector = value.map((item) => Number(item));
  if (vector.some((item) => !Number.isFinite(item))) {
    throw new AppError("AI_PROVIDER_ERROR", "Embedding provider returned non-numeric vectors", 502);
  }
  return vector;
}

export function parseOpenRouterEmbeddingsResponse(
  raw: unknown,
  config: EmbeddingModelConfig,
  expectedCount: number,
): EmbeddingResult {
  if (typeof raw !== "object" || raw === null) {
    throw new AppError("AI_PROVIDER_ERROR", "Embedding provider returned invalid JSON", 502);
  }

  const parsed = raw as OpenRouterEmbeddingsResponse;
  if (parsed.error) {
    throw new AppError("AI_PROVIDER_ERROR", "Embedding provider returned an error", 502);
  }
  if (!Array.isArray(parsed.data) || parsed.data.length !== expectedCount) {
    throw new AppError(
      "AI_PROVIDER_ERROR",
      "Embedding provider returned an unexpected number of vectors",
      502,
    );
  }

  const sorted = [...parsed.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return {
    provider: config.provider,
    model: parsed.model?.trim() || config.model,
    dimensions: config.dimensions,
    embeddings: sorted.map((item) => parseEmbeddingVector(item.embedding, config.dimensions)),
    inputTokens: parsed.usage?.prompt_tokens,
    totalTokens: parsed.usage?.total_tokens,
  };
}

export async function embedTextsWithOpenRouter(
  bindings: AppBindings,
  input: string[],
  fetcher: typeof fetch = fetch,
): Promise<EmbeddingResult> {
  const apiKey = getOpenRouterApiKey(bindings);
  if (!apiKey) {
    throw new AppError("AI_NOT_CONFIGURED", "OpenRouter API key is not configured", 503);
  }

  const config = resolveEmbeddingModel(bindings);
  const request = buildOpenRouterEmbeddingsRequest(config, input);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getAiTimeoutMs(bindings));

  try {
    const response = await fetcher(`${getOpenRouterBaseUrl(bindings).replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://narraza.local",
        "X-Title": "Narraza API",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw mapEmbeddingHttpError(response.status);
    }

    return parseOpenRouterEmbeddingsResponse(
      await response.json(),
      config,
      request.input.length,
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AppError("AI_PROVIDER_TIMEOUT", "Embedding provider request timed out", 504);
    }
    if (err instanceof AppError) throw err;
    throw new AppError("AI_PROVIDER_ERROR", "Embedding provider request failed", 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildProseEmbeddingInsertRows(input: {
  ownerId: string;
  importJobId: string | null;
  chunks: DraftImportChunk[];
  embeddingResult: EmbeddingResult;
}): ProseEmbeddingInsertRow[] {
  if (input.chunks.length !== input.embeddingResult.embeddings.length) {
    throw new AppError(
      "AI_PROVIDER_ERROR",
      "Embedding count does not match chunk count",
      502,
    );
  }

  return input.chunks.map((chunk, index) => ({
    project_id: chunk.projectId,
    owner_id: input.ownerId,
    draft_import_id: chunk.draftImportId,
    import_job_id: input.importJobId,
    source: "imported_draft",
    source_ref: chunk.sourceRef,
    chunk_index: chunk.chunkIndex,
    chunk_text: chunk.chunkText,
    chunk_hash: chunk.chunkHash,
    word_count: chunk.wordCount,
    embedding: input.embeddingResult.embeddings[index],
    embedding_provider: input.embeddingResult.provider,
    embedding_model: input.embeddingResult.model,
    metadata: {
      ...chunk.metadata,
      dimensions: input.embeddingResult.dimensions,
      inputTokens: input.embeddingResult.inputTokens ?? null,
      totalTokens: input.embeddingResult.totalTokens ?? null,
    },
  }));
}
