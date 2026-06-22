export type UserFacingValidationStatus = "pass" | "warn" | "fail";

export interface UserFacingValidationLabel {
  label: string;
  status: UserFacingValidationStatus;
}

function isLabelRow(value: unknown): value is UserFacingValidationLabel {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.label === "string" &&
    (row.status === "pass" || row.status === "warn" || row.status === "fail")
  );
}

export function parseUserFacingValidationLabels(
  details: unknown,
): UserFacingValidationLabel[] {
  if (typeof details !== "object" || details === null) return [];
  const raw = (details as { userFacingLabels?: unknown }).userFacingLabels;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isLabelRow);
}

export function formatUserFacingValidationSummary(
  labels: UserFacingValidationLabel[],
): string | null {
  if (labels.length === 0) return null;
  const parts = labels.map((row) => {
    const icon = row.status === "pass" ? "✅" : row.status === "warn" ? "⚠️" : "❌";
    return `${icon} ${row.label}`;
  });
  return parts.join(" · ");
}

export function formatAiOutputUnsafeMessage(
  details: unknown,
  fallback: string,
): string {
  const summary = formatUserFacingValidationSummary(
    parseUserFacingValidationLabels(details),
  );
  if (!summary) return fallback;
  return `${fallback} ${summary}`;
}