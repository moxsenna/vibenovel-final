export interface RetentionFinding {
  type: "warning";
  validator: string;
  message: string;
}

export function validateRetentionHook(
  prose: string,
  expectedKeywords: string[] = [],
): RetentionFinding[] {
  const normalized = prose.toLowerCase();
  const keywords = expectedKeywords
    .map((keyword) => keyword.trim().toLowerCase())
    .filter((keyword) => keyword.length >= 4);
  if (prose.trim().length < 120 || keywords.length === 0) return [];

  const ending = normalized.slice(-Math.max(120, Math.floor(normalized.length * 0.3)));
  if (keywords.some((keyword) => ending.includes(keyword))) return [];
  return [{
    type: "warning",
    validator: "retention-validator",
    message: "Closing prose may be weak against the configured hook target.",
  }];
}
