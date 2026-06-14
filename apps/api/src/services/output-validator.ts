import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";

export type ValidationSeverity = "info" | "warning" | "blocked";

export interface OutputValidationCheck {
  key: string;
  passed: boolean;
  severity: ValidationSeverity;
  message: string;
}

export interface OutputValidationReport {
  allowed: boolean;
  severity: ValidationSeverity;
  outputText: string;
  checks: OutputValidationCheck[];
}

export interface ValidateAiOutputInput {
  outputText: string;
  forbiddenConcepts?: string[];
  mustInclude?: string[];
  maxChars?: number;
}

export interface PersistValidationReportInput {
  projectId: string;
  userId: string;
  generationAttemptId?: string | null;
  report: OutputValidationReport;
  repairStatus?: "not_requested" | "requested" | "completed" | "failed";
}

const DEFAULT_MAX_OUTPUT_CHARS = 30_000;
const MOBILE_PARAGRAPH_MAX_CHARS = 1_200;

const RAW_CONTEXT_PATTERNS = [
  /context_packet/i,
  /contextPacket/i,
  /context_packet_json/i,
  /contextPacketJson/i,
  /planningTruth/i,
  /planning_truth/i,
  /promptMessages/i,
  /prompt_text/i,
  /full_prompt/i,
  /revealGate/i,
  /forbiddenReveals/i,
];

const PROVIDER_PATTERNS = [
  /openrouter/i,
  /anthropic/i,
  /claude[-\s]?\d/i,
  /gemini[-\s]?\d/i,
  /gemma[-\s]?\d/i,
  /\bmodel\s*[:=]/i,
  /\bprovider\s*[:=]/i,
  /\bsource\s*[:=]\s*(ai_generated|mock|openrouter)/i,
];

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function includesConcept(text: string, concept: string): boolean {
  const normalizedConcept = normalize(concept).toLowerCase();
  if (!normalizedConcept) return false;
  return normalize(text).toLowerCase().includes(normalizedConcept);
}

function addCheck(
  checks: OutputValidationCheck[],
  key: string,
  passed: boolean,
  severity: ValidationSeverity,
  message: string,
): void {
  checks.push({ key, passed, severity, message });
}

function worstSeverity(checks: OutputValidationCheck[]): ValidationSeverity {
  if (checks.some((check) => !check.passed && check.severity === "blocked")) {
    return "blocked";
  }
  if (checks.some((check) => !check.passed && check.severity === "warning")) {
    return "warning";
  }
  return "info";
}

export function validateAiOutput(input: ValidateAiOutputInput): OutputValidationReport {
  const outputText = typeof input.outputText === "string" ? input.outputText : "";
  const trimmed = outputText.trim();
  const checks: OutputValidationCheck[] = [];

  addCheck(
    checks,
    "no_empty_output",
    trimmed.length > 0,
    "blocked",
    "Output must not be empty.",
  );

  const forbiddenConcepts = (input.forbiddenConcepts ?? [])
    .map((concept) => concept.trim())
    .filter(Boolean);
  const leakedConcept = forbiddenConcepts.find((concept) => includesConcept(trimmed, concept));
  addCheck(
    checks,
    "no_future_reveal_leak",
    !leakedConcept,
    "blocked",
    leakedConcept
      ? "Output mentions a future reveal that is forbidden for this chapter."
      : "No future reveal leak detected.",
  );

  addCheck(
    checks,
    "no_raw_context_fields",
    !containsAny(trimmed, RAW_CONTEXT_PATTERNS),
    "blocked",
    "Output must not expose raw prompt or context packet fields.",
  );

  addCheck(
    checks,
    "no_provider_or_model_names",
    !containsAny(trimmed, PROVIDER_PATTERNS),
    "blocked",
    "Output must not mention provider, model, or internal source names.",
  );

  const mustInclude = (input.mustInclude ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const missing = mustInclude.filter((item) => !includesConcept(trimmed, item));
  addCheck(
    checks,
    "beat_requirement_coverage",
    missing.length === 0,
    "warning",
    missing.length > 0
      ? `Output misses required beat material: ${missing.join(", ")}.`
      : "Output covers required beat material.",
  );

  const maxChars = input.maxChars ?? DEFAULT_MAX_OUTPUT_CHARS;
  addCheck(
    checks,
    "safe_mobile_prose_length",
    trimmed.length <= maxChars &&
      trimmed
        .split(/\n{2,}/)
        .every((paragraph) => paragraph.trim().length <= MOBILE_PARAGRAPH_MAX_CHARS),
    "warning",
    "Output should stay within mobile-readable length bounds.",
  );

  const severity = worstSeverity(checks);
  return {
    allowed: !checks.some((check) => !check.passed && check.severity === "blocked"),
    severity,
    outputText: trimmed,
    checks,
  };
}

export function assertAiOutputUsable(report: OutputValidationReport): void {
  if (report.allowed) return;
  throw new AppError(
    "AI_OUTPUT_UNSAFE",
    "AI output failed safety validation",
    422,
    {
      severity: report.severity,
      checks: report.checks.filter((check) => !check.passed),
    },
  );
}

export async function persistValidationReportBestEffort(
  bindings: AppBindings,
  input: PersistValidationReportInput,
): Promise<void> {
  try {
    const admin = createServiceRoleClient(bindings);
    const { error } = await admin.from("validation_reports").insert({
      project_id: input.projectId,
      user_id: input.userId,
      generation_attempt_id: input.generationAttemptId ?? null,
      severity: input.report.severity,
      checks_json: {
        allowed: input.report.allowed,
        checks: input.report.checks,
      },
      repair_status: input.repairStatus ?? "not_requested",
    });
    if (error) {
      console.warn("validation_reports insert skipped:", error.message);
    }
  } catch (err) {
    console.warn(
      "validation_reports insert skipped:",
      err instanceof Error ? err.message : "unknown error",
    );
  }
}
