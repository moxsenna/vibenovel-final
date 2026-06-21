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
import { AppError } from "../errors.js";
import {
  validateAiOutput,
  type OutputValidationReport,
} from "./output-validator.js";

export interface SafeRepairRequest {
  outputText: string;
  confirmation: "REPAIR_AI_OUTPUT";
  forbiddenConcepts: string[];
  mustInclude: string[];
}

export interface SafeRepairPlan {
  outputText: string;
  validation: OutputValidationReport;
  repairInstruction: string;
}

function stringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw AppError.badRequest(`${fieldName} must be an array of strings`);
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function buildProseRepairInstruction(
  forbiddenConcepts: string[],
  mustInclude: string[],
): string {
  const repairLines = [
    "Tulis ulang output agar aman untuk pembaca.",
    "Jangan tampilkan raw prompt, context packet, provider, model, atau metadata internal.",
    "Jangan tampilkan future reveal yang belum boleh muncul.",
    "Jangan menambah fakta besar atau plot baru — perbaiki teks yang ada saja.",
  ];
  if (forbiddenConcepts.length > 0) {
    repairLines.push(`Jangan tampilkan: ${forbiddenConcepts.join(", ")}.`);
  }
  if (mustInclude.length > 0) {
    repairLines.push(`Tetap masukkan materi wajib: ${mustInclude.join(", ")}.`);
  }
  return repairLines.join(" ");
}

export function buildProseRepairInstructionFromReport(
  report: OutputValidationReport,
): string {
  const failed = report.checks.filter((check) => !check.passed);
  const lines = [
    "Tulis ulang output agar lolos pemeriksaan cerita tanpa menambah fakta besar baru.",
    "Pertahankan bagian yang sudah benar dan keluarkan hanya prosa revisi.",
  ];
  for (const check of failed) {
    if (check.key === "no_future_reveal_leak") {
      lines.push("- Hapus atau kaburkan span output yang membocorkan rahasia terlalu dini.");
    } else if (check.key === "pov_character_knowledge" || check.key === "semantic_knowledge") {
      lines.push("- Ubah pernyataan pengetahuan karakter yang belum sah menjadi ketidaktahuan, dugaan, atau informasi parsial.");
    } else if (check.key === "beat_requirement_coverage" || check.key === "semantic_instruction_compliance") {
      lines.push(`- Lengkapi materi beat yang hilang: ${check.message}`);
    } else if (check.key === "semantic_scene_boundary") {
      lines.push(`- Kembalikan adegan ke batas beat saat ini: ${check.message}`);
    } else if (check.key === "semantic_continuity") {
      lines.push(`- Perbaiki kontradiksi continuity: ${check.message}`);
    } else if (check.severity === "blocked") {
      lines.push(`- Perbaiki kegagalan wajib: ${check.message}`);
    }
  }
  return [...new Set(lines)].join("\n");
}

export function parseSafeRepairRequest(raw: unknown): SafeRepairPlan {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;

  if (body.confirmation !== "REPAIR_AI_OUTPUT") {
    throw AppError.badRequest(
      'confirmation must be "REPAIR_AI_OUTPUT" for explicit safe repair',
    );
  }
  if (typeof body.outputText !== "string" || !body.outputText.trim()) {
    throw AppError.badRequest("outputText is required");
  }

  const forbiddenConcepts = stringArray(body.forbiddenConcepts, "forbiddenConcepts");
  const mustInclude = stringArray(body.mustInclude, "mustInclude");
  const validation = validateAiOutput({
    outputText: body.outputText,
    forbiddenConcepts,
    mustInclude,
  });

  return {
    outputText: body.outputText.trim(),
    validation,
    repairInstruction: buildProseRepairInstruction(forbiddenConcepts, mustInclude),
  };
}

export async function buildSafeRepairPlanForOwner(
  _ownerId: string,
  _projectId: string,
  raw: unknown,
): Promise<SafeRepairPlan> {
  return parseSafeRepairRequest(raw);
}
