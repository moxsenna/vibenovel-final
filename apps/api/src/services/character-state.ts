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
import type { CharacterState, JsonObject } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapCharacterStateRow, type CharacterStateRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";

const CHARACTER_STATE_SELECT =
  "id, project_id, character_id, chapter_number, emotional_state, physical_state, current_goal, location_id, metadata, created_at, updated_at";

export interface UpsertCharacterStateInput {
  characterId: string;
  chapterNumber: number;
  emotionalState?: string | null;
  physicalState?: string | null;
  currentGoal?: string | null;
  locationId?: string | null;
  metadata?: JsonObject;
}

function parseJsonObject(value: unknown): JsonObject {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return e.code === "42P01" || e.message?.toLowerCase().includes("does not exist") === true;
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function assertPositiveChapterNumber(chapterNumber: number): void {
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
    throw AppError.badRequest("chapterNumber must be a positive integer");
  }
}

export async function listCharacterStatesForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  characterId?: string | null,
): Promise<CharacterState[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  let query = admin
    .from("character_states")
    .select(CHARACTER_STATE_SELECT)
    .eq("project_id", projectId)
    .order("chapter_number", { ascending: true });

  if (characterId) {
    query = query.eq("character_id", characterId);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return [];
    console.error("character_states select failed");
    throw AppError.internal("Failed to load character states");
  }

  return ((data ?? []) as CharacterStateRow[]).map(mapCharacterStateRow);
}

export async function getCharacterStateSnapshotForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  characterId: string,
  chapterNumber: number,
): Promise<CharacterState | null> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  assertPositiveChapterNumber(chapterNumber);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("character_states")
    .select(CHARACTER_STATE_SELECT)
    .eq("project_id", projectId)
    .eq("character_id", characterId)
    .lte("chapter_number", chapterNumber)
    .order("chapter_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) return null;
    console.error("character_states snapshot select failed");
    throw AppError.internal("Failed to load character state snapshot");
  }

  return data ? mapCharacterStateRow(data as CharacterStateRow) : null;
}

export async function upsertCharacterStateForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  input: UpsertCharacterStateInput,
): Promise<CharacterState> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  assertPositiveChapterNumber(input.chapterNumber);

  const characterId = input.characterId.trim();
  if (!characterId) {
    throw AppError.badRequest("characterId is required");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("character_states")
    .upsert(
      {
        project_id: projectId,
        character_id: characterId,
        chapter_number: input.chapterNumber,
        emotional_state: normalizeText(input.emotionalState),
        physical_state: normalizeText(input.physicalState),
        current_goal: normalizeText(input.currentGoal),
        location_id: normalizeText(input.locationId),
        metadata: parseJsonObject(input.metadata),
      },
      { onConflict: "character_id,chapter_number" },
    )
    .select(CHARACTER_STATE_SELECT)
    .single();

  if (error || !data) {
    console.error("character_states upsert failed");
    throw AppError.internal("Failed to save character state");
  }

  return mapCharacterStateRow(data as CharacterStateRow);
}
