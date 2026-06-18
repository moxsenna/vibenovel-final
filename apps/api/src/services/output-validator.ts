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
  /** Fact phrases POV must not assert as known (character-knowledge gate). */
  povForbiddenFactTexts?: string[];
  retentionHookKeywords?: string[];
  styleToneHint?: string | null;
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
const MIN_POV_FACT_PHRASE_CHARS = 14;

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

const USER_FACING_LABEL_BY_CHECK_KEY: Record<string, string> = {
  no_empty_output: "Teks kosong",
  no_future_reveal_leak: "Rahasia belum bocor",
  no_raw_context_fields: "Tidak ada data internal",
  no_provider_or_model_names: "Tidak ada data internal",
  pov_character_knowledge: "Pengetahuan POV konsisten",
  beat_requirement_coverage: "Cerita nyambung",
  safe_mobile_prose_length: "Format enak dibaca di HP",
  retention_unlock_hook: "Ending cukup kuat",
  style_voice_consistency: "Suara cerita konsisten",
};

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

/** Plain-language labels for UI (`docs/09`). */
export function buildUserFacingValidationLabels(
  checks: OutputValidationCheck[],
): { label: string; status: "pass" | "warn" | "fail" }[] {
  const seen = new Set<string>();
  const labels: { label: string; status: "pass" | "warn" | "fail" }[] = [];

  for (const check of checks) {
    const label = USER_FACING_LABEL_BY_CHECK_KEY[check.key];
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const status: "pass" | "warn" | "fail" = check.passed
      ? "pass"
      : check.severity === "blocked"
        ? "fail"
        : "warn";
    labels.push({ label, status });
  }

  return labels;
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

  const povForbidden = (input.povForbiddenFactTexts ?? [])
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length >= MIN_POV_FACT_PHRASE_CHARS);
  const leakedPovFact = povForbidden.find((phrase) => includesConcept(trimmed, phrase));
  addCheck(
    checks,
    "pov_character_knowledge",
    !leakedPovFact,
    "blocked",
    leakedPovFact
      ? "Output states canon the POV character does not know yet."
      : "POV character knowledge respected.",
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


  const retentionKeywords = (input.retentionHookKeywords ?? [])
    .map((k) => k.trim())
    .filter((k) => k.length >= 4);
  const retentionApplies = trimmed.length >= 120 && retentionKeywords.length > 0;
  const retentionHit =
    !retentionApplies ||
    retentionKeywords.some((keyword) => includesConcept(trimmed, keyword));
  addCheck(
    checks,
    "retention_unlock_hook",
    retentionHit,
    "warning",
    retentionApplies && !retentionHit
      ? "Closing prose may be weak vs chapter hook target."
      : "Retention hook cues present or not required.",
  );

  const toneHint = input.styleToneHint?.trim() ?? "";
  const styleApplies = toneHint.length >= 4;
  const styleHit = !styleApplies || includesConcept(trimmed, toneHint);
  addCheck(
    checks,
    "style_voice_consistency",
    styleHit,
    "warning",
    styleApplies && !styleHit
      ? "Prose may drift from foundation tone guidance."
      : "Style/tone guidance respected or not set.",
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
  const failedChecks = report.checks.filter((check) => !check.passed);
  throw new AppError(
    "AI_OUTPUT_UNSAFE",
    "AI output failed safety validation",
    422,
    {
      severity: report.severity,
      checks: failedChecks,
      userFacingLabels: buildUserFacingValidationLabels(report.checks),
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
        userFacingLabels: buildUserFacingValidationLabels(input.report.checks),
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