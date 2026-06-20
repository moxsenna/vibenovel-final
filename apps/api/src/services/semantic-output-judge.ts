export interface SemanticOutputJudgeResult {
  instructionCompliance: { score: number; missingRequirements: string[] };
  sceneBoundary: { passed: boolean; jumpedAhead: boolean; reason: string };
  continuity: { passed: boolean; contradictions: string[] };
  knowledge: { passed: boolean; violations: Array<{ characterRef: string; factRef: string; reason: string }> };
  style: { score: number; driftReasons: string[] };
}

export type SemanticJudgeMode = "off" | "shadow" | "enforce";

export function resolveSemanticJudgeMode(raw: string | undefined): SemanticJudgeMode {
  if (raw === "shadow") return "shadow";
  if (raw === "enforce") return "enforce";
  return "off";
}

export function createEmptyJudgeResult(): SemanticOutputJudgeResult {
  return {
    instructionCompliance: { score: 1, missingRequirements: [] },
    sceneBoundary: { passed: true, jumpedAhead: false, reason: "no judge call" },
    continuity: { passed: true, contradictions: [] },
    knowledge: { passed: true, violations: [] },
    style: { score: 1, driftReasons: [] },
  };
}
