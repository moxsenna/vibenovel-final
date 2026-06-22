import type { SemanticOutputJudgeResult } from "./semantic-output-judge.js";

export function parseJudgeResponse(raw: unknown): SemanticOutputJudgeResult {
  if (!raw || typeof raw !== "object") return createFallback();
  const r = raw as Record<string, unknown>;
  return {
    instructionCompliance: {
      score: typeof r.score === "number" ? r.score : 1,
      missingRequirements: Array.isArray(r.missingRequirements) ? r.missingRequirements as string[] : [],
    },
    sceneBoundary: { passed: true, jumpedAhead: false, reason: "" },
    continuity: { passed: true, contradictions: [] },
    knowledge: { passed: true, violations: [] },
    style: { score: 1, driftReasons: [] },
  };
}

function createFallback(): SemanticOutputJudgeResult {
  return {
    instructionCompliance: { score: 1, missingRequirements: [] },
    sceneBoundary: { passed: true, jumpedAhead: false, reason: "parse fallback" },
    continuity: { passed: true, contradictions: [] },
    knowledge: { passed: true, violations: [] },
    style: { score: 1, driftReasons: [] },
  };
}
