import type { CharacterKnowledgeConstraint } from "@vibenovel/shared";

export interface ValidationFinding {
  type: "blocked" | "warning";
  validator: string;
  message: string;
}

export function validateKnowledgeConstraint(
  prose: string,
  constraints: CharacterKnowledgeConstraint[],
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  for (const c of constraints) {
    if (
      c.allowedMode === "forbidden" &&
      prose.toLowerCase().includes(c.factText.toLowerCase())
    ) {
      findings.push({
        type: "blocked",
        validator: "knowledge-validator",
        message: `Prose asserts forbidden fact for character ${c.characterId}: "${c.factText}"`,
      });
    }
  }
  return findings;
}
