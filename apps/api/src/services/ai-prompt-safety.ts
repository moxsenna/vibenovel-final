import { AppError } from "../errors.js";
import type { PromptMessage } from "./ai-generation-types.js";

const PROMPT_FORBIDDEN_PATTERNS = [
  /planningTruth/i,
  /planning_truth/i,
  /packet_json/i,
  /packetJson/i,
  /context_packet/i,
  /contextPacket/i,
  /openrouter/i,
];

const PROMPT_MAX_CHARS = 120_000;

function collectPromptText(promptMessages?: PromptMessage[], promptText?: string): string {
  if (promptText?.trim()) return promptText;
  if (!promptMessages?.length) return "";
  return promptMessages.map((m) => m.content).join("\n");
}

/**
 * Validates prompt payload before provider call.
 * Never logs prompt content — callers must not log either.
 */
export function assertPromptSafeForProvider(
  promptMessages?: PromptMessage[],
  promptText?: string,
): void {
  const combined = collectPromptText(promptMessages, promptText);
  if (!combined.trim()) {
    throw new AppError("AI_OUTPUT_EMPTY", "Prompt payload is empty", 400);
  }
  if (combined.length > PROMPT_MAX_CHARS) {
    throw new AppError("BAD_REQUEST", "Prompt payload exceeds maximum size", 400);
  }
  for (const pattern of PROMPT_FORBIDDEN_PATTERNS) {
    if (pattern.test(combined)) {
      throw new AppError(
        "AI_OUTPUT_UNSAFE",
        "Prompt payload contains forbidden content",
        422,
      );
    }
  }
}

const OUTPUT_LEAKAGE_MARKERS = [
  "planningtruth",
  "planning_truth",
  "full_prompt",
  "context_packet",
  "packet_json",
  "openrouter",
];

/** Post-provider output scan — does not log text. */
export function assertProviderOutputSafe(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AppError("AI_OUTPUT_EMPTY", "Model returned empty output", 422);
  }
  const lower = trimmed.toLowerCase();
  for (const marker of OUTPUT_LEAKAGE_MARKERS) {
    if (lower.includes(marker)) {
      throw new AppError(
        "AI_OUTPUT_UNSAFE",
        "Model output failed safety checks",
        422,
      );
    }
  }
}