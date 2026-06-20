import {
  CHARACTER_KNOWLEDGE_STATUSES,
  PLANNED_REVEAL_STATUSES,
  type CharacterKnowledge,
  type CharacterKnowledgeStatus,
  type Fact,
  type JsonObject,
  type PovKnowledgeFactSummary,
  type PovKnowledgeSnapshot,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapCharacterKnowledgeRow,
  type CharacterKnowledgeRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";

const CHARACTER_KNOWLEDGE_SELECT =
  "id, project_id, character_id, fact_id, knowledge_status, confidence, learned_at_chapter, learned_from, metadata, created_at, updated_at";

const ACTIVE_REVEAL_STATUSES = new Set<string>([
  PLANNED_REVEAL_STATUSES.planned,
  PLANNED_REVEAL_STATUSES.armed,
  PLANNED_REVEAL_STATUSES.revealed,
  PLANNED_REVEAL_STATUSES.delayed,
]);

const KNOWLEDGE_STATUS_SET = new Set<string>(Object.values(CHARACTER_KNOWLEDGE_STATUSES));

export interface PovKnowledgeFactInput {
  characterId: string;
  factId: string;
  knowledgeStatus: CharacterKnowledgeStatus | string;
  confidence: number | null;
  learnedAtChapter: number | null;
  learnedFrom: string | null;
}

export interface BuildPovKnowledgeSnapshotInput {
  povCharacterId: string | null;
  facts: Pick<Fact, "id" | "text">[];
  knowledgeRows: PovKnowledgeFactInput[];
  futureRevealFactIds: ReadonlySet<string>;
}

export interface PlannedRevealFactRef {
  related_fact_id?: string | null;
  relatedFactId?: string | null;
  forbidden_before_chapter?: number | null;
  forbiddenBeforeChapter?: number | null;
  status?: string | null;
}

export interface UpsertCharacterKnowledgeInput {
  characterId: string;
  factId: string;
  knowledgeStatus: CharacterKnowledgeStatus | string;
  confidence?: number | null;
  learnedAtChapter?: number | null;
  learnedFrom?: string | null;
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

function normalizeKnowledgeStatus(status: string): CharacterKnowledgeStatus {
  if (KNOWLEDGE_STATUS_SET.has(status)) {
    return status as CharacterKnowledgeStatus;
  }
  throw AppError.badRequest("Invalid character knowledge status");
}

function normalizeConfidence(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw AppError.badRequest("confidence must be between 0 and 1");
  }
  return value;
}

function normalizeChapterNumber(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 1) {
    throw AppError.badRequest("learnedAtChapter must be a positive integer");
  }
  return value;
}

function factSummary(
  fact: Pick<Fact, "id" | "text">,
  row: PovKnowledgeFactInput,
): PovKnowledgeFactSummary {
  return {
    factId: fact.id,
    text: fact.text,
    confidence: row.confidence,
    learnedAtChapter: row.learnedAtChapter,
    learnedFrom: row.learnedFrom,
  };
}

export function collectFutureRevealFactIds(
  reveals: PlannedRevealFactRef[],
  currentChapterNumber: number,
): Set<string> {
  const factIds = new Set<string>();
  for (const reveal of reveals) {
    const status = reveal.status ?? "";
    if (status && !ACTIVE_REVEAL_STATUSES.has(status)) continue;

    const factId = reveal.related_fact_id ?? reveal.relatedFactId ?? null;
    const forbiddenBefore =
      reveal.forbidden_before_chapter ?? reveal.forbiddenBeforeChapter ?? null;
    if (factId && forbiddenBefore !== null && forbiddenBefore > currentChapterNumber) {
      factIds.add(factId);
    }
  }
  return factIds;
}

export function buildPovKnowledgeSnapshot(
  input: BuildPovKnowledgeSnapshotInput,
): PovKnowledgeSnapshot {
  const empty: PovKnowledgeSnapshot = {
    characterId: input.povCharacterId,
    knownFacts: [],
    suspectedFacts: [],
    partialFacts: [],
    falseBeliefs: [],
    unknownFactCount: 0,
  };

  if (!input.povCharacterId) {
    return { ...empty, characterId: null };
  }

  const rowsByFactId = new Map<string, PovKnowledgeFactInput>();
  for (const row of input.knowledgeRows) {
    if (row.characterId === input.povCharacterId) {
      rowsByFactId.set(row.factId, row);
    }
  }

  for (const fact of input.facts) {
    if (input.futureRevealFactIds.has(fact.id)) continue;

    const row = rowsByFactId.get(fact.id);
    const status = row?.knowledgeStatus ?? CHARACTER_KNOWLEDGE_STATUSES.unknown;

    if (!row || status === CHARACTER_KNOWLEDGE_STATUSES.unknown) {
      empty.unknownFactCount += 1;
      continue;
    }

    if (status === CHARACTER_KNOWLEDGE_STATUSES.knows) {
      empty.knownFacts.push(factSummary(fact, row));
      continue;
    }

    if (status === CHARACTER_KNOWLEDGE_STATUSES.suspects) {
      empty.suspectedFacts.push(factSummary(fact, row));
      continue;
    }

    if (status === CHARACTER_KNOWLEDGE_STATUSES.partially_knows) {
      empty.partialFacts.push(factSummary(fact, row));
      continue;
    }

    if (status === CHARACTER_KNOWLEDGE_STATUSES.misbelieves) {
      empty.falseBeliefs.push(factSummary(fact, row));
    }
  }

  return empty;
}

export async function listCharacterKnowledgeForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  characterId?: string | null,
): Promise<CharacterKnowledge[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  let query = admin
    .from("character_knowledge")
    .select(CHARACTER_KNOWLEDGE_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (characterId) {
    query = query.eq("character_id", characterId);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return [];
    console.error("character_knowledge select failed");
    throw AppError.internal("Failed to load character knowledge");
  }

  return ((data ?? []) as CharacterKnowledgeRow[]).map(mapCharacterKnowledgeRow);
}

export async function upsertCharacterKnowledgeForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  input: UpsertCharacterKnowledgeInput,
): Promise<CharacterKnowledge> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const characterId = input.characterId.trim();
  const factId = input.factId.trim();
  if (!characterId || !factId) {
    throw AppError.badRequest("characterId and factId are required");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("character_knowledge")
    .upsert(
      {
        project_id: projectId,
        character_id: characterId,
        fact_id: factId,
        knowledge_status: normalizeKnowledgeStatus(input.knowledgeStatus),
        confidence: normalizeConfidence(input.confidence),
        learned_at_chapter: normalizeChapterNumber(input.learnedAtChapter),
        learned_from: input.learnedFrom?.trim() || null,
        metadata: parseJsonObject(input.metadata),
      },
      { onConflict: "character_id,fact_id" },
    )
    .select(CHARACTER_KNOWLEDGE_SELECT)
    .single();

  if (error || !data) {
    console.error("character_knowledge upsert failed");
    throw AppError.internal("Failed to save character knowledge");
  }

  return mapCharacterKnowledgeRow(data as CharacterKnowledgeRow);
}
