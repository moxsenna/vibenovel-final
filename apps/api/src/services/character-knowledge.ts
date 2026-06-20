import type { CharacterKnowledgeConstraint } from "@vibenovel/shared";

/* ------------------------------------------------------------------ */
/*  Knowledge status constants — self-contained (not in shared enums)  */
/* ------------------------------------------------------------------ */

export const KNOWLEDGE_STATUSES = {
  unknown: "unknown",
  knows: "knows",
  suspects: "suspects",
  partially_knows: "partially_knows",
  misbelieves: "misbelieves",
} as const;

export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[keyof typeof KNOWLEDGE_STATUSES];

const KNOWLEDGE_STATUS_TO_ALLOWED_MODE: Record<string, CharacterKnowledgeConstraint["allowedMode"]> = {
  [KNOWLEDGE_STATUSES.knows]: "certain",
  [KNOWLEDGE_STATUSES.partially_knows]: "partial",
  [KNOWLEDGE_STATUSES.suspects]: "suspicion",
  [KNOWLEDGE_STATUSES.misbelieves]: "false_belief",
};

/* ------------------------------------------------------------------ */
/*  Constraint compiler                                                */
/* ------------------------------------------------------------------ */

/**
 * Build knowledge constraints for a character.
 * 
 * - `knows` → certain (may be stated as fact)
 * - `partially_knows` → partial (only partial info)
 * - `suspects` → suspicion (not certainty)
 * - `misbelieves` → false_belief (character's false belief, not canon)
 * - Unknown facts → forbidden (must not appear in writer output)
 */
export function buildKnowledgeConstraints(
  characterId: string,
  knowledgeRows: Array<{ fact_id: string; knowledge_status: string }>,
  allFacts: Array<{ id: string; text: string }>,
): CharacterKnowledgeConstraint[] {
  const constraints: CharacterKnowledgeConstraint[] = [];
  const knownFactIds = new Set<string>();

  for (const row of knowledgeRows) {
    knownFactIds.add(row.fact_id);
    const fact = allFacts.find((f) => f.id === row.fact_id);
    if (!fact) continue;
    const allowedMode = KNOWLEDGE_STATUS_TO_ALLOWED_MODE[row.knowledge_status] ?? "forbidden";
    constraints.push({ characterId, factId: row.fact_id, factText: fact.text, allowedMode });
  }

  for (const fact of allFacts) {
    if (!knownFactIds.has(fact.id)) {
      constraints.push({ characterId, factId: fact.id, factText: fact.text, allowedMode: "forbidden" });
    }
  }

  return constraints;
}

/**
 * Categorize knowledge rows into POV snapshot groups.
 */
export function categorizeKnowledge(
  knowledgeRows: Array<{ fact_id: string; knowledge_status: string; fact_text?: string }>,
): { knownIds: string[]; suspectedIds: string[]; partialIds: string[]; falseBeliefIds: string[] } {
  const knownIds: string[] = [];
  const suspectedIds: string[] = [];
  const partialIds: string[] = [];
  const falseBeliefIds: string[] = [];

  for (const row of knowledgeRows) {
    switch (row.knowledge_status) {
      case KNOWLEDGE_STATUSES.knows: knownIds.push(row.fact_id); break;
      case KNOWLEDGE_STATUSES.suspects: suspectedIds.push(row.fact_id); break;
      case KNOWLEDGE_STATUSES.partially_knows: partialIds.push(row.fact_id); break;
      case KNOWLEDGE_STATUSES.misbelieves: falseBeliefIds.push(row.fact_id); break;
    }
  }

  return { knownIds, suspectedIds, partialIds, falseBeliefIds };
}
