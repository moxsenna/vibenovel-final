import type { ValidationReport } from "./output-validator.js";

const MAX_REPAIR_RETRIES = 2;
const MAX_REPAIR_TOKEN_MULTIPLIER = 3;

export interface RepairPlan {
  retryCount: number;
  maxRetries: number;
  tokenBudgetMultiplier: number;
  instructions: string[];
}

/**
 * Build a repair instruction from validation findings.
 * Never sends forbidden truth or raw envelope data to the repair model.
 */
export function buildRepairInstructions(
  report: ValidationReport,
): string[] {
  const instructions: string[] = [];

  if (report.blocked.length > 0) {
    instructions.push("Fix the following issues:");
    for (const msg of report.blocked) {
      instructions.push(`- ${msg}`);
    }
  }

  if (report.warnings.length > 0) {
    instructions.push("Also consider:");
    for (const msg of report.warnings.slice(0, 3)) {
      instructions.push(`- ${msg}`);
    }
  }

  return instructions;
}

/**
 * Create a repair plan for a failed validation.
 */
export function createRepairPlan(
  report: ValidationReport,
  attemptNumber: number,
): RepairPlan {
  return {
    retryCount: attemptNumber,
    maxRetries: MAX_REPAIR_RETRIES,
    tokenBudgetMultiplier: MAX_REPAIR_TOKEN_MULTIPLIER,
    instructions: buildRepairInstructions(report),
  };
}

/**
 * Check if repair should continue after this attempt.
 */
export function shouldContinueRepair(attemptNumber: number): boolean {
  return attemptNumber < MAX_REPAIR_RETRIES;
}
