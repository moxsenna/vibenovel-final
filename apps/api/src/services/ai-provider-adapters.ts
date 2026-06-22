import type { AppBindings } from "../env.js";
import {
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getTokenRouterApiKey,
  getTokenRouterBaseUrl,
} from "../env.js";
import { AppError } from "../errors.js";
import type { AiLiveProviderId } from "./ai-model-registry.js";
import {
  callOpenAiCompatibleChat,
  type OpenAiCompatibleChatInput,
  type OpenAiCompatibleChatResult,
} from "./openai-compatible-client.js";

export interface AiProviderRuntime {
  provider: AiLiveProviderId;
  baseUrl: string;
  apiKey?: string;
}

export function getProviderRuntime(
  bindings: AppBindings,
  provider: AiLiveProviderId,
): AiProviderRuntime {
  if (provider === "tokenrouter") {
    return {
      provider,
      baseUrl: getTokenRouterBaseUrl(bindings),
      apiKey: getTokenRouterApiKey(bindings),
    };
  }
  return {
    provider,
    baseUrl: getOpenRouterBaseUrl(bindings).replace(/\/$/, ""),
    apiKey: getOpenRouterApiKey(bindings),
  };
}

export function hasProviderCredential(
  bindings: AppBindings,
  provider: AiLiveProviderId,
): boolean {
  return Boolean(getProviderRuntime(bindings, provider).apiKey);
}

export async function callLiveProviderChat(
  bindings: AppBindings,
  input: Omit<OpenAiCompatibleChatInput, "baseUrl" | "apiKey">,
  fetcher: typeof fetch = fetch,
): Promise<OpenAiCompatibleChatResult> {
  const runtime = getProviderRuntime(bindings, input.provider);
  if (!runtime.apiKey) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      `${input.provider} API key is not configured`,
      503,
    );
  }
  return callOpenAiCompatibleChat(
    {
      ...input,
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
    },
    fetcher,
  );
}
