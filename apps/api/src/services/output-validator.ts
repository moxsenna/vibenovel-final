import type { WriterSafetyEnvelope } from "@vibenovel/shared";
import { validateRevealLeak } from "./validators/reveal-validator.js";
import { validateBeatCompliance } from "./validators/beat-compliance-validator.js";
import { validateMobileReadability } from "./validators/mobile-readability-validator.js";

export interface ValidationReport {
  passed: boolean;
  blocked: string[];
  warnings: string[];
}

/**
 * Orchestrator — runs all deterministic validators against generated prose.
 */
export function validateProseOutput(
  prose: string,
  envelope: WriterSafetyEnvelope,
  mustInclude: string[],
  mustNotInclude: string[],
): ValidationReport {
  const blocked: string[] = [];
  const warnings: string[] = [];

  // Reveal leak check
  const revealFinding = validateRevealLeak(prose, envelope);
  if (revealFinding) {
    if (revealFinding.type === "blocked") blocked.push(revealFinding.message);
    else warnings.push(revealFinding.message);
  }

  // Beat compliance
  const complianceFindings = validateBeatCompliance(prose, mustInclude, mustNotInclude);
  for (const f of complianceFindings) {
    if (f.type === "blocked") blocked.push(f.message);
    else warnings.push(f.message);
  }

  // Mobile readability
  const mobileFindings = validateMobileReadability(prose);
  for (const f of mobileFindings) warnings.push(f.message);

  return {
    passed: blocked.length === 0,
    blocked,
    warnings,
  };
}
