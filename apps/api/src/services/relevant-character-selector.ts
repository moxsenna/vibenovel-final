import type { CharacterSafeSummary } from "@vibenovel/shared";

/** Selection policy: max 8 characters for packet inclusion. */
const MAX_RELEVANT_CHARACTERS = 8;

export function selectRelevantCharacters(input: {
  povCharacterId: string | null;
  mainCharacterIds: string[];
  beatSummaryTokens: string[];
  beatDirectionTokens: string[];
  mustIncludeTokens: string[];
  allCharacters: CharacterSafeSummary[];
  speechLinks?: Array<{ characterAId: string | null; characterBId: string | null }>;
}): CharacterSafeSummary[] {
  const { povCharacterId, mainCharacterIds, beatSummaryTokens, allCharacters } = input;
  const characterById = new Map(allCharacters.map((character) => [character.id, character]));
  const selected = new Set<string>();
  const result: CharacterSafeSummary[] = [];

  function append(characterId: string | null | undefined): void {
    if (!characterId || selected.size >= MAX_RELEVANT_CHARACTERS) return;
    const character = characterById.get(characterId);
    if (!character || selected.has(characterId)) return;
    selected.add(characterId);
    result.push(character);
  }

  // 1. POV character (if any)
  append(povCharacterId);

  // 2. Main/protagonist characters
  for (const id of mainCharacterIds) {
    append(id);
  }

  // 3. Characters mentioned in beat text
  const mentionTokens = [
    ...beatSummaryTokens,
    ...(input.beatDirectionTokens ?? []),
    ...(input.mustIncludeTokens ?? []),
  ].map((t) => t.toLowerCase().trim());

  for (const ch of allCharacters) {
    if (selected.size >= MAX_RELEVANT_CHARACTERS) break;
    if (selected.has(ch.id)) continue;
    const nameLower = ch.name.toLowerCase();
    if (mentionTokens.some((t) => nameLower.includes(t) || t.includes(nameLower))) {
      append(ch.id);
    }
  }

  // 4. Characters connected by a speech rule to an already selected character.
  for (const link of input.speechLinks ?? []) {
    if (selected.size >= MAX_RELEVANT_CHARACTERS) break;
    if (link.characterAId && selected.has(link.characterAId)) append(link.characterBId);
    if (link.characterBId && selected.has(link.characterBId)) append(link.characterAId);
  }

  // 5. Fill remaining with other characters
  for (const ch of allCharacters) {
    if (selected.size >= MAX_RELEVANT_CHARACTERS) break;
    append(ch.id);
  }

  return result;
}
