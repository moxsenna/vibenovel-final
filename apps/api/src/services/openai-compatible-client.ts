import { AppError } from "../errors.js";
import type { AiLiveProviderId } from "./ai-model-registry.js";
import type { PromptMessage } from "./ai-generation-types.js";

export interface OpenAiCompatibleChatInput {
  provider: AiLiveProviderId;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  messages: PromptMessage[];
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
}

export interface OpenAiCompatibleChatResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
  latencyMs: number;
}

export function buildOpenAiCompatibleChatRequest(input: {
  modelId: string;
  messages: PromptMessage[];
  maxOutputTokens: number;
  temperature: number;
}) {
  return {
    model: input.modelId,
    messages: input.messages,
    max_tokens: input.maxOutputTokens,
    temperature: input.temperature,
    stream: false,
  };
}

function providerError(
  code: string,
  message: string,
  status: 429 | 502 | 504,
  providerHttpStatus?: number,
): AppError {
  return new AppError(code, message, status, {
    providerHttpStatus: providerHttpStatus ?? null,
  });
}

export async function callOpenAiCompatibleChat(
  input: OpenAiCompatibleChatInput,
  fetcher: typeof fetch = fetch,
): Promise<OpenAiCompatibleChatResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetcher(
      `${input.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://narraza.web.id",
          "X-Title": "Narraza API",
        },
        body: JSON.stringify(
          buildOpenAiCompatibleChatRequest({
            modelId: input.modelId,
            messages: input.messages,
            maxOutputTokens: input.maxOutputTokens,
            temperature: input.temperature,
          }),
        ),
        signal: controller.signal,
      },
    );

    if (response.status === 429) {
      throw providerError(
        "AI_PROVIDER_RATE_LIMITED",
        "AI provider rate limit exceeded",
        429,
        response.status,
      );
    }
    if (!response.ok) {
      throw providerError(
        "AI_PROVIDER_ERROR",
        "AI provider rejected the request",
        502,
        response.status,
      );
    }

    const parsed = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
      error?: unknown;
    };

    if (parsed.error) {
      throw providerError(
        "AI_PROVIDER_ERROR",
        "AI provider returned an error",
        502,
      );
    }
    const text = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      throw new AppError(
        "AI_OUTPUT_EMPTY",
        "AI provider returned empty output",
        422,
      );
    }
    return {
      text,
      inputTokens: parsed.usage?.prompt_tokens,
      outputTokens: parsed.usage?.completion_tokens,
      finishReason: parsed.choices?.[0]?.finish_reason,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw providerError(
        "AI_PROVIDER_TIMEOUT",
        "AI provider request timed out",
        504,
      );
    }
    if (error instanceof AppError) throw error;
    throw providerError("AI_PROVIDER_ERROR", "AI provider request failed", 502);
  } finally {
    clearTimeout(timeoutId);
  }
}
