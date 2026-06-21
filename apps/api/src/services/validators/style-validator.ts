export interface StyleFinding {
  type: "blocked" | "warning";
  validator: string;
  message: string;
}

export interface StyleValidationRules {
  paragraphLength?: "short" | "medium" | "long";
  dialogueDensity?: "low" | "medium" | "high";
  forbiddenStyle?: string[];
  expositionTolerance?: "low" | "medium" | "high";
}

export function validateStyle(
  prose: string,
  rules: StyleValidationRules = {},
): StyleFinding[] {
  const findings: StyleFinding[] = [];
  const normalized = prose.toLowerCase();

  for (const forbidden of rules.forbiddenStyle ?? []) {
    if (forbidden.trim() && normalized.includes(forbidden.trim().toLowerCase())) {
      findings.push({
        type: "blocked",
        validator: "style-validator",
        message: `Prose uses an explicitly forbidden style marker: "${forbidden}".`,
      });
    }
  }

  const paragraphs = prose.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
  const averageParagraphWords =
    paragraphs.length === 0
      ? 0
      : paragraphs.reduce(
          (sum, paragraph) => sum + paragraph.trim().split(/\s+/).length,
          0,
        ) / paragraphs.length;
  if (rules.paragraphLength === "short" && averageParagraphWords > 55) {
    findings.push({
      type: "warning",
      validator: "style-validator",
      message: "Average paragraph length is above the short-paragraph voice target.",
    });
  }

  const dialogueLines = prose
    .split(/\n/)
    .filter((line) => /^\s*[-"“]/.test(line)).length;
  const dialogueRatio = paragraphs.length > 0 ? dialogueLines / paragraphs.length : 0;
  if (rules.dialogueDensity === "high" && dialogueRatio < 0.25) {
    findings.push({
      type: "warning",
      validator: "style-validator",
      message: "Dialogue density is below the configured high-dialogue target.",
    });
  }

  return findings;
}
