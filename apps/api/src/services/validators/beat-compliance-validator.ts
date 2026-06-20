export interface BeatComplianceFinding {
  type: "blocked" | "warning";
  validator: string;
  message: string;
}

export function validateBeatCompliance(
  prose: string,
  mustInclude: string[],
  mustNotInclude: string[],
): BeatComplianceFinding[] {
  const findings: BeatComplianceFinding[] = [];
  for (const item of mustInclude) {
    if (!prose.toLowerCase().includes(item.toLowerCase())) {
      findings.push({
        type: "warning",
        validator: "beat-compliance",
        message: `Missing must-include: "${item}"`,
      });
    }
  }
  for (const item of mustNotInclude) {
    if (prose.toLowerCase().includes(item.toLowerCase())) {
      findings.push({
        type: "blocked",
        validator: "beat-compliance",
        message: `Contains must-not-include: "${item}"`,
      });
    }
  }
  return findings;
}
