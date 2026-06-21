import type { SemanticOutputJudgeResult } from "./semantic-output-judge.js";

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be a string array`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function score(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} must be between 0 and 1`);
  }
  return value;
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${field} must be boolean`);
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  return value.trim();
}

export function parseJudgeResponse(raw: unknown): SemanticOutputJudgeResult {
  const root = record(raw, "judge");
  const instruction = record(root.instructionCompliance, "instructionCompliance");
  const scene = record(root.sceneBoundary, "sceneBoundary");
  const continuity = record(root.continuity, "continuity");
  const knowledge = record(root.knowledge, "knowledge");
  const style = record(root.style, "style");

  if (!Array.isArray(knowledge.violations)) {
    throw new Error("knowledge.violations must be an array");
  }

  return {
    instructionCompliance: {
      score: score(instruction.score, "instructionCompliance.score"),
      missingRequirements: stringArray(
        instruction.missingRequirements,
        "instructionCompliance.missingRequirements",
      ),
    },
    sceneBoundary: {
      passed: bool(scene.passed, "sceneBoundary.passed"),
      jumpedAhead: bool(scene.jumpedAhead, "sceneBoundary.jumpedAhead"),
      reason: text(scene.reason, "sceneBoundary.reason"),
    },
    continuity: {
      passed: bool(continuity.passed, "continuity.passed"),
      contradictions: stringArray(
        continuity.contradictions,
        "continuity.contradictions",
      ),
    },
    knowledge: {
      passed: bool(knowledge.passed, "knowledge.passed"),
      violations: knowledge.violations.map((violation, index) => {
        const item = record(violation, `knowledge.violations[${index}]`);
        return {
          characterRef: text(item.characterRef, "characterRef"),
          factRef: text(item.factRef, "factRef"),
          reason: text(item.reason, "reason"),
        };
      }),
    },
    style: {
      score: score(style.score, "style.score"),
      driftReasons: stringArray(style.driftReasons, "style.driftReasons"),
    },
  };
}
