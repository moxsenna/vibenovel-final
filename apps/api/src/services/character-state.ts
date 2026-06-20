import type { WriterCharacterStateSummary, WriterCharacterSummaryV3 } from "@vibenovel/shared";

/* ------------------------------------------------------------------ */
/*  State management                                                   */
/* ------------------------------------------------------------------ */

/**
 * Get the latest character state at or before a given chapter number.
 * In-memory implementation — requires caller to provide rows sorted by chapter_number DESC.
 */
export function getLatestStateAtChapter(
  stateRows: Array<{
    chapter_number: number;
    emotional_state: string | null;
    physical_state: string | null;
    current_goal: string | null;
    location_label?: string | null;
  }>,
  maxChapterNumber: number,
): WriterCharacterStateSummary | null {
  const valid = stateRows.filter((r) => r.chapter_number <= maxChapterNumber);
  if (valid.length === 0) return null;
  // Rows are assumed sorted by chapter_number DESC; take the first valid
  const latest = valid.reduce((a, b) => (a.chapter_number > b.chapter_number ? a : b));
  return {
    chapterNumber: latest.chapter_number,
    emotionalState: latest.emotional_state,
    physicalState: latest.physical_state,
    currentGoal: latest.current_goal,
    locationLabel: latest.location_label ?? null,
  };
}

/**
 * Build a WriterCharacterSummaryV3[] from character + state data.
 */
export function buildCharacterSummariesWithState(
  characters: Array<{ id: string; name: string; role_label?: string; description?: string }>,
  stateMap: Map<string, WriterCharacterStateSummary>,
): WriterCharacterSummaryV3[] {
  return characters.map((ch) => ({
    id: ch.id,
    name: ch.name,
    roleLabel: ch.role_label ?? "",
    descriptionSummary: (ch.description ?? "").slice(0, 300),
    state: stateMap.get(ch.id) ?? null,
  }));
}
