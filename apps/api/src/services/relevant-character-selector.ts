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
}): CharacterSafeSummary[] {
  const { povCharacterId, mainCharacterIds, beatSummaryTokens, allCharacters } = input;
  const selected = new Set<string>();
  const result: CharacterSafeSummary[] = [];

  // 1. POV character (if any)
  if (povCharacterId) selected.add(povCharacterId);

  // 2. Main/protagonist characters
  for (const id of mainCharacterIds) {
    if (selected.size >= MAX_RELEVANT_CHARACTERS) break;
    if (!selected.has(id)) selected.add(id);
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
      selected.add(ch.id);
    }
  }

  // 4. Fill remaining with other characters
  for (const ch of allCharacters) {
    if (selected.size >= MAX_RELEVANT_CHARACTERS) break;
    if (!selected.has(ch.id)) selected.add(ch.id);
  }

  // Build result in original order
  const selectedSet = selected;
  for (const ch of allCharacters) {
    if (selectedSet.has(ch.id)) {
      result.push(ch);
    }
  }

  return result;
}
