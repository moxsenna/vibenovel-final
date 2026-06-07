import { STORY_CONCEPT_STATUSES, type Character, type Fact, type RelationshipSpeechRule } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  type FoundationRow,
  type ProjectRow,
  type StoryConceptRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { listCharactersForOwner } from "./character.js";
import { listFactsForOwner } from "./fact.js";
import { getOwnedProjectRow } from "./project.js";
import { listSpeechRulesForOwner } from "./speech-rule.js";

const CONCEPT_SELECT =
  "id, project_id, title, short_pitch, reader_promise, core_conflict, genre, tone, target_reader, status, source, score, payload, created_at, updated_at";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

export interface OutlineCanonSnapshot {
  project: ProjectRow;
  concept: StoryConceptRow;
  foundation: FoundationRow;
  characters: Character[];
  facts: Fact[];
  speechRules: RelationshipSpeechRule[];
}

async function fetchFoundationRow(
  bindings: AppBindings,
  projectId: string,
): Promise<FoundationRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_foundations")
    .select(FOUNDATION_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("story_foundations select for outline failed");
    throw AppError.internal("Failed to load foundation");
  }
  return data as FoundationRow | null;
}

async function loadSelectedConcept(
  bindings: AppBindings,
  projectRow: ProjectRow,
): Promise<StoryConceptRow> {
  if (!projectRow.selected_concept_id) {
    throw AppError.badRequest("Select a story concept before generating outline");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_concepts")
    .select(CONCEPT_SELECT)
    .eq("id", projectRow.selected_concept_id)
    .eq("project_id", projectRow.id)
    .maybeSingle();

  if (error) {
    console.error("story_concepts select for outline failed");
    throw AppError.internal("Failed to load selected concept");
  }
  if (!data) {
    throw AppError.badRequest("Selected concept not found for this project");
  }

  const concept = data as StoryConceptRow;
  if (concept.status !== STORY_CONCEPT_STATUSES.selected) {
    throw AppError.badRequest("Selected concept must have status selected");
  }

  return concept;
}

export async function loadOutlineCanonSnapshot(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<OutlineCanonSnapshot> {
  const project = await getOwnedProjectRow(bindings, ownerId, projectId);
  const foundation = await fetchFoundationRow(bindings, projectId);

  if (!foundation?.is_locked) {
    throw AppError.conflict("Foundation must be locked before generating outline", {
      missing: ["foundation_locked"],
    });
  }

  const [concept, characters, facts, speechRules] = await Promise.all([
    loadSelectedConcept(bindings, project),
    listCharactersForOwner(bindings, ownerId, projectId, false),
    listFactsForOwner(bindings, ownerId, projectId, false),
    listSpeechRulesForOwner(bindings, ownerId, projectId, false),
  ]);

  return {
    project,
    concept,
    foundation,
    characters,
    facts,
    speechRules,
  };
}