import {
  CHARACTER_ROLES,
  CHARACTER_SOURCES,
  CHARACTER_STATUSES,
  type Character,
  type CharacterImportance,
  type CharacterRole,
  type CharacterSource,
  type CharacterStatus,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapCharacterRow, type CharacterRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";
import { getOwnedProjectRow } from "./project.js";

const CHARACTER_SELECT =
  "id, project_id, name, role_label, role, description, importance, status, source, sort_order, created_at, updated_at";

const ROLE_SET = new Set<string>(Object.values(CHARACTER_ROLES));
const STATUS_SET = new Set<string>(Object.values(CHARACTER_STATUSES));
const SOURCE_SET = new Set<string>(Object.values(CHARACTER_SOURCES));
const IMPORTANCE_SET = new Set<string>(["main", "supporting", "minor"]);

const MANUAL_CHARACTER_SOURCES = new Set<string>([CHARACTER_SOURCES.user]);

const AI_SOURCE_PATTERNS = [
  /^ai$/i,
  /^ai_/i,
  /ai_direct/i,
  /generated/i,
  /model/i,
  /openrouter/i,
  /gemini/i,
  /claude/i,
  /gpt/i,
];

const FORBIDDEN_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
]);

const NAME_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;
const ROLE_LABEL_MAX_LENGTH = 80;

function assertNonEmptyName(name: unknown): string {
  if (typeof name !== "string") throw AppError.badRequest("name must be a string");
  const trimmed = name.trim();
  if (!trimmed) throw AppError.badRequest("name is required");
  if (trimmed.length > NAME_MAX_LENGTH) {
    throw AppError.badRequest(`name must be at most ${NAME_MAX_LENGTH} characters`);
  }
  return trimmed;
}

function assertCharacterSource(source: unknown, forCreate: boolean): CharacterSource {
  if (source === undefined || source === null) {
    return CHARACTER_SOURCES.user;
  }
  if (typeof source !== "string") throw AppError.badRequest("source must be a string");
  for (const pattern of AI_SOURCE_PATTERNS) {
    if (pattern.test(source)) {
      throw AppError.badRequest("AI-origin characters must go through ai_proposals first");
    }
  }
  if (!SOURCE_SET.has(source)) throw AppError.badRequest("source is invalid");
  if (forCreate && !MANUAL_CHARACTER_SOURCES.has(source)) {
    throw AppError.badRequest("Only user source is allowed for manual character creation");
  }
  return source as CharacterSource;
}

function characterSnapshot(row: CharacterRow): Record<string, unknown> {
  return {
    name: row.name,
    role: row.role,
    status: row.status,
    importance: row.importance,
    source: row.source,
  };
}

async function getOwnedCharacterRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  characterId: string,
): Promise<CharacterRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("characters")
    .select(CHARACTER_SELECT)
    .eq("id", characterId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("characters select by id failed");
    throw AppError.internal("Failed to load character");
  }
  if (!data) throw AppError.notFound("Character not found");
  return data as CharacterRow;
}

export async function listCharactersForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  includeArchived = false,
): Promise<Character[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  let query = admin
    .from("characters")
    .select(CHARACTER_SELECT)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (!includeArchived) {
    query = query.eq("status", CHARACTER_STATUSES.active);
  }

  const { data, error } = await query;
  if (error) {
    console.error("characters list failed");
    throw AppError.internal("Failed to list characters");
  }
  return ((data ?? []) as CharacterRow[]).map(mapCharacterRow);
}

export async function createCharacterForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<Character> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be set`);
    }
  }

  await getOwnedProjectRow(bindings, ownerId, projectId);

  const name = assertNonEmptyName(body.name);
  const source = assertCharacterSource(body.source, true);

  if (body.role !== undefined) {
    if (typeof body.role !== "string" || !ROLE_SET.has(body.role)) {
      throw AppError.badRequest("role is invalid");
    }
  }
  const role = (body.role as CharacterRole | undefined) ?? CHARACTER_ROLES.other;

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
  }
  const status = (body.status as CharacterStatus | undefined) ?? CHARACTER_STATUSES.active;

  if (body.importance !== undefined) {
    if (typeof body.importance !== "string" || !IMPORTANCE_SET.has(body.importance)) {
      throw AppError.badRequest("importance is invalid");
    }
  }
  const importance = (body.importance as CharacterImportance | undefined) ?? "supporting";

  let roleLabel = "";
  if (body.roleLabel !== undefined) {
    if (typeof body.roleLabel !== "string") throw AppError.badRequest("roleLabel must be a string");
    roleLabel = body.roleLabel.trim().slice(0, ROLE_LABEL_MAX_LENGTH);
  }

  let description = "";
  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      throw AppError.badRequest("description must be a string");
    }
    description = body.description.trim().slice(0, DESCRIPTION_MAX_LENGTH);
  }

  let sortOrder = 0;
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== "number" || !Number.isInteger(body.sortOrder)) {
      throw AppError.badRequest("sortOrder must be an integer");
    }
    sortOrder = body.sortOrder;
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("characters")
    .insert({
      project_id: projectId,
      name,
      role_label: roleLabel,
      role,
      description,
      importance,
      status,
      source,
      sort_order: sortOrder,
    })
    .select(CHARACTER_SELECT)
    .single();

  if (error || !data) {
    console.error("characters insert failed");
    throw AppError.internal("Failed to create character");
  }

  const row = data as CharacterRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "character_created",
    entityType: "character",
    entityId: row.id,
    metadata: { name: row.name, role: row.role },
  });

  return mapCharacterRow(row);
}

export async function updateCharacterForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  characterId: string,
  raw: unknown,
): Promise<Character> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be updated`);
    }
  }
  if (Object.keys(body).length === 0) {
    throw AppError.badRequest("No updatable fields provided");
  }

  const beforeRow = await getOwnedCharacterRow(bindings, ownerId, projectId, characterId);
  const updates: Record<string, unknown> = {};
  const changedFields: string[] = [];

  if (body.name !== undefined) {
    updates.name = assertNonEmptyName(body.name);
    changedFields.push("name");
  }
  if (body.role !== undefined) {
    if (typeof body.role !== "string" || !ROLE_SET.has(body.role)) {
      throw AppError.badRequest("role is invalid");
    }
    updates.role = body.role;
    changedFields.push("role");
  }
  if (body.roleLabel !== undefined) {
    if (typeof body.roleLabel !== "string") throw AppError.badRequest("roleLabel must be a string");
    updates.role_label = body.roleLabel.trim().slice(0, ROLE_LABEL_MAX_LENGTH);
    changedFields.push("roleLabel");
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      throw AppError.badRequest("description must be a string");
    }
    updates.description = body.description.trim().slice(0, DESCRIPTION_MAX_LENGTH);
    changedFields.push("description");
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
    updates.status = body.status;
    changedFields.push("status");
  }
  if (body.importance !== undefined) {
    if (typeof body.importance !== "string" || !IMPORTANCE_SET.has(body.importance)) {
      throw AppError.badRequest("importance is invalid");
    }
    updates.importance = body.importance;
    changedFields.push("importance");
  }
  if (body.source !== undefined) {
    updates.source = assertCharacterSource(body.source, false);
    if (!MANUAL_CHARACTER_SOURCES.has(updates.source as string)) {
      throw AppError.badRequest("source cannot be changed to proposal-derived value via API");
    }
    changedFields.push("source");
  }
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== "number" || !Number.isInteger(body.sortOrder)) {
      throw AppError.badRequest("sortOrder must be an integer");
    }
    updates.sort_order = body.sortOrder;
    changedFields.push("sortOrder");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("characters")
    .update(updates)
    .eq("id", characterId)
    .eq("project_id", projectId)
    .select(CHARACTER_SELECT)
    .single();

  if (error || !data) {
    console.error("characters update failed");
    throw AppError.internal("Failed to update character");
  }

  const afterRow = data as CharacterRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "character_updated",
    entityType: "character",
    entityId: characterId,
    metadata: { changedFields },
    beforeData: characterSnapshot(beforeRow),
    afterData: characterSnapshot(afterRow),
  });

  return mapCharacterRow(afterRow);
}

/** Soft delete — sets status archived. */
export async function archiveCharacterForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  characterId: string,
): Promise<Character> {
  const beforeRow = await getOwnedCharacterRow(bindings, ownerId, projectId, characterId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("characters")
    .update({ status: CHARACTER_STATUSES.archived })
    .eq("id", characterId)
    .eq("project_id", projectId)
    .select(CHARACTER_SELECT)
    .single();

  if (error || !data) {
    console.error("characters archive failed");
    throw AppError.internal("Failed to archive character");
  }

  const afterRow = data as CharacterRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "character_updated",
    entityType: "character",
    entityId: characterId,
    metadata: { reason: "archive", changedFields: ["status"] },
    beforeData: characterSnapshot(beforeRow),
    afterData: characterSnapshot(afterRow),
  });

  return mapCharacterRow(afterRow);
}