import type { AppBindings } from "../env.js";
import { getOpenRouterApiKey, getOpenRouterBaseUrl } from "../env.js";
import { AppError } from "../errors.js";
import type {
  ModelRouterGenerateResult,
  PromptMessage,
  ResolvedModelConfig,
} from "./ai-generation-types.js";

interface OpenRouterChatRequest {
  model: string;
  messages: PromptMessage[];
  max_tokens: number;
  temperature: number;
}

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: OpenRouterUsage;
  error?: { message?: string; code?: number };
}

function buildMessages(
  promptMessages?: PromptMessage[],
  promptText?: string,
): PromptMessage[] {
  if (promptMessages?.length) return promptMessages;
  if (promptText?.trim()) {
    return [{ role: "user", content: promptText }];
  }
  return [];
}

function mapOpenRouterHttpError(status: number): AppError {
  if (status === 429) {
    return new AppError(
      "AI_PROVIDER_RATE_LIMITED",
      "AI provider rate limit exceeded",
      429,
    );
  }
  if (status >= 500) {
    return new AppError(
      "AI_PROVIDER_ERROR",
      "AI provider returned a server error",
      502,
    );
  }
  return new AppError(
    "AI_PROVIDER_ERROR",
    "AI provider rejected the request",
    502,
  );
}

function mapFetchError(err: unknown, timedOut: boolean): AppError {
  if (timedOut) {
    return new AppError(
      "AI_PROVIDER_TIMEOUT",
      "AI provider request timed out",
      504,
    );
  }
  if (err instanceof AppError) return err;
  return new AppError(
    "AI_PROVIDER_ERROR",
    "AI provider request failed",
    502,
  );
}

/**
 * OpenRouter-compatible chat completion — Worker-only, never logs API key or raw body.
 */
export async function callOpenRouterChatCompletion(
  bindings: AppBindings,
  config: ResolvedModelConfig,
  options: {
    promptHash: string;
    promptMessages?: PromptMessage[];
    promptText?: string;
  },
): Promise<ModelRouterGenerateResult> {
  const apiKey = getOpenRouterApiKey(bindings);
  if (!apiKey) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "OpenRouter API key is not configured",
      503,
    );
  }

  const messages = buildMessages(options.promptMessages, options.promptText);
  if (!messages.length) {
    throw new AppError("AI_OUTPUT_EMPTY", "Prompt payload is empty", 400);
  }

  const baseUrl = getOpenRouterBaseUrl(bindings).replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;
  const body: OpenRouterChatRequest = {
    model: config.model,
    messages,
    max_tokens: config.maxOutputTokens,
    temperature: config.temperature,
  };

  const started = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  let timedOut = false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vibenovel.local",
        "X-Title": "VibeNovel API",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw mapOpenRouterHttpError(response.status);
    }

    let parsed: OpenRouterChatResponse;
    try {
      parsed = (await response.json()) as OpenRouterChatResponse;
    } catch {
      throw new AppError(
        "AI_PROVIDER_ERROR",
        "AI provider returned an invalid response",
        502,
      );
    }

    if (parsed.error) {
      throw new AppError(
        "AI_PROVIDER_ERROR",
        "AI provider returned an error",
        502,
      );
    }

    const text = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      throw new AppError("AI_OUTPUT_EMPTY", "AI provider returned empty output", 422);
    }

    return {
      text,
      provider: "openrouter",
      model: config.model,
      inputTokens: parsed.usage?.prompt_tokens,
      outputTokens: parsed.usage?.completion_tokens,
      latencyMs: Date.now() - started,
      finishReason: parsed.choices?.[0]?.finish_reason,
      promptHash: options.promptHash,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      timedOut = true;
    }
    throw mapFetchError(err, timedOut);
  } finally {
    clearTimeout(timeoutId);
  }
}