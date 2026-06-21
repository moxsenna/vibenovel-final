import type {
  GenerationProviderEventOutcome,
  GenerationType,
  JsonObject,
  WriterQualityMode,
} from "@vibenovel/shared";
import type {
  AiLiveProviderId,
  AiLogicalModelKey,
} from "./ai-model-registry.js";
import type { ProviderEventSequence } from "./generation-provider-event.js";

/** Provider boundary — never expose raw provider HTTP body to callers. */
export type AiProviderId = AiLiveProviderId | "mock";

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
  logicalModel: AiLogicalModelKey;
  providerModelId: string;
  routeRole: "primary" | "fallback";
  maxOutputTokens: number;
  timeoutMs: number;
  temperature: number;
  primaryMaxRetries: number;
}

export interface ModelRouterResolveInput {
  generationType: GenerationType;
  qualityMode: WriterQualityMode;
}

export interface ModelRouterGenerateInput<TOutput = string> {
  generationAttemptId: string;
  /** Attempt-owned counter shared across retries, fallback, and repair loops. */
  providerEventSequence: ProviderEventSequence;
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
   * ceiling). Never plumb from client request bodies.
   */
  maxOutputTokensOverride?: number;
  temperature?: number;
  /** Redacted metadata only — no packet_json, planningTruth, or prose. */
  metadata?: JsonObject;
  /**
   * Engine-specific validator. Runs after safety normalization and is part of
   * the success boundary: a thrown AppError("GENERATION_FAILED") is retryable
   * and fallback-eligible. Defaults to returning the raw text.
   */
  validateOutput?: (text: string) => TOutput;
}

export interface ModelRouterGenerateResult<TOutput = string> {
  text: string;
  output: TOutput;
  provider: AiProviderId;
  logicalModel: AiLogicalModelKey;
  /** Raw provider model ID resolved from the registry. */
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  finishReason?: string;
  promptHash: string;
  routingPolicyVersion: string;
  fallbackUsed: boolean;
  retryCount: number;
  estimatedCostUsd: number;
}

export interface ProviderEventRecorderInput {
  generationAttemptId: string;
  sequenceNumber: number;
  routeRole: "primary" | "fallback";
  provider: string;
  logicalModel: string;
  providerModelId: string;
  retryNumber: number;
  outcome: GenerationProviderEventOutcome;
  errorCategory?: string | null;
  errorCodeSafe?: string | null;
  providerHttpStatus?: number | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
}
