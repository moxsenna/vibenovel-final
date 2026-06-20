import type { WriterSafetyEnvelope } from "@vibenovel/shared";

export interface ValidationFinding {
  type: "blocked" | "warning";
  validator: string;
  message: string;
  detail?: string;
}

export function validateRevealLeak(
  prose: string,
  envelope: WriterSafetyEnvelope,
): ValidationFinding | null {
  for (const phrase of envelope.forbiddenRevealPhrases) {
    if (prose.toLowerCase().includes(phrase.toLowerCase())) {
      return {
        type: "blocked",
        validator: "reveal-validator",
        message: `Prose contains forbidden reveal phrase: "${phrase}"`,
      };
    }
  }
  return null;
}
