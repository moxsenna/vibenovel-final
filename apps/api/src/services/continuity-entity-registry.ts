/**
 * Continuity Entity Registry — stable entity references for AI summary.
 * Model tidak mengembalikan raw UUID; gunakan ref tokens (C1, F1, L1, R1).
 */
export interface EntityRegistry {
  characters: Array<{ ref: string; id: string; name: string }>;
  facts: Array<{ ref: string; id: string; text: string }>;
  openLoops: Array<{ ref: string; id: string; question: string }>;
  reveals: Array<{ ref: string; id: string; title: string }>;
}

let charCounter = 0;
let factCounter = 0;
let loopCounter = 0;
let revealCounter = 0;

export function createEntityRegistry(): EntityRegistry {
  charCounter = 0;
  factCounter = 0;
  loopCounter = 0;
  revealCounter = 0;
  return { characters: [], facts: [], openLoops: [], reveals: [] };
}

export function registerCharacter(
  registry: EntityRegistry,
  id: string,
  name: string,
): string {
  const existing = registry.characters.find((c) => c.id === id);
  if (existing) return existing.ref;
  charCounter++;
  const ref = `C${charCounter}`;
  registry.characters.push({ ref, id, name });
  return ref;
}

export function registerFact(registry: EntityRegistry, id: string, text: string): string {
  const existing = registry.facts.find((f) => f.id === id);
  if (existing) return existing.ref;
  factCounter++;
  const ref = `F${factCounter}`;
  registry.facts.push({ ref, id, text });
  return ref;
}
