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