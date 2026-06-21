import type { Fact, PovKnowledgeSnapshot } from "@vibenovel/shared";

const MIN_FACT_PHRASE_CHARS = 14;
const MAX_FORBIDDEN_PHRASES = 48;

function collectKnownFactIds(pov: PovKnowledgeSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const entry of [
    ...pov.knownFacts,
    ...pov.suspectedFacts,
    ...pov.partialFacts,
    ...pov.falseBeliefs,
  ]) {
    if (entry.factId) ids.add(entry.factId);
  }
  return ids;
}

/**
 * Fact texts the active POV must not state as certain knowledge (unknown to character).
 * Used by output validator — complements reveal-gate forbidden concepts.
 */
export function collectPovForbiddenFactTexts(
  allFacts: Pick<Fact, "id" | "text">[],
  povKnowledge: PovKnowledgeSnapshot | null | undefined,
): string[] {
  if (!povKnowledge?.characterId) return [];

  const knownIds = collectKnownFactIds(povKnowledge);
  const phrases: string[] = [];

  for (const fact of allFacts) {
    if (knownIds.has(fact.id)) continue;
    const text = typeof fact.text === "string" ? fact.text.trim() : "";
    if (text.length < MIN_FACT_PHRASE_CHARS) continue;
    phrases.push(text);
    if (phrases.length >= MAX_FORBIDDEN_PHRASES) break;
  }

  return phrases;
}