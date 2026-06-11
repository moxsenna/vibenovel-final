import type { GenerationType, JsonObject, WriterQualityMode } from "@vibenovel/shared";

/** Provider boundary — never expose raw provider HTTP body to callers. */
export type AiProviderId = "openrouter" | "mock";

export type AiProviderErrorCode =
  | "AI_DISABLED"
  | "AI_NOT_CONFIGURED"
  | "AI_PROVIDER_ERROR"
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_RATE_LIMITED"
  | "AI_OUTPUT_EMPTY"
  | "AI_OUTPUT_UNSAFE";

export type MockAiProviderMode = "success" | "fail_provider" | "unsafe_output";

export interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ResolvedModelConfig {
  provider: AiProviderId;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  temperature: number;
}

export interface ModelRouterResolveInput {
  generationType: GenerationType;
  qualityMode: WriterQualityMode;
}

export interface ModelRouterGenerateInput {
  generationType: GenerationType;
  qualityMode: WriterQualityMode;
  /** SHA-256 of canonical prompt — safe to log; never log raw prompt. */
  promptHash: string;
  promptMessages?: PromptMessage[];
  promptText?: string;
  /** Lowers the resolved cap only (client-safe budget tightening). */
  maxOutputTokens?: number;
  /**
   * Server-only: replaces the resolved cap (may raise it, clamped to a hard
   * ceiling). For trusted internal callers whose payload needs more headroom
   * than the generation-type alias allows (e.g. multi-object JSON concept gen).
   * Never plumb from client request bodies.
   */
  maxOutputTokensOverride?: number;
  temperature?: number;
  /** Redacted metadata only — no packet_json, planningTruth, or prose. */
  metadata?: JsonObject;
}

export interface ModelRouterGenerateResult {
  text: string;
  provider: AiProviderId;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  finishReason?: string;
  promptHash: string;
}