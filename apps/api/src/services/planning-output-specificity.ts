import { AppError } from "../errors.js";

const TEMPLATE_NAME_PATTERN = /\b(Nadira|Arman|Siska)\b/i;
const MAX_SCAN_DEPTH = 12;

function collectText(value: unknown, depth = 0): string[] {
  if (depth > MAX_SCAN_DEPTH) return [];
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectText(item, depth + 1));
  }
  return Object.values(value as Record<string, unknown>).flatMap((item) =>
    collectText(item, depth + 1),
  );
}

export function assertPlanningOutputSpecificToProject(
  value: unknown,
  outputLabel: string,
): void {
  const text = collectText(value).join("\n");
  if (!TEMPLATE_NAME_PATTERN.test(text)) return;
  throw new AppError(
    "GENERATION_FAILED",
    `AI mengembalikan ${outputLabel} yang masih memakai nama template. Coba lagi.`,
    502,
  );
}
