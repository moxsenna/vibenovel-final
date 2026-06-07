import {
  FACT_CANON_STATUSES,
  FACT_CATEGORIES,
  FACT_IMPORTANCE,
  FACT_SOURCES,
  type Fact,
  type FactCategory,
  type FactImportance,
  type FactSource,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapFactRow, type FactRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";
import { getOwnedProjectRow } from "./project.js";

const FACT_SELECT =
  "id, project_id, text, category, importance, canon_status, is_locked, source, accepted_from_proposal_id, created_at, updated_at";

const CATEGORY_SET = new Set<string>(Object.values(FACT_CATEGORIES));
const IMPORTANCE_SET = new Set<string>(Object.values(FACT_IMPORTANCE));
const CANON_STATUS_SET = new Set<string>(Object.values(FACT_CANON_STATUSES));
const SOURCE_SET = new Set<string>(Object.values(FACT_SOURCES));

const MANUAL_FACT_SOURCES = new Set<string>([FACT_SOURCES.user, FACT_SOURCES.system]);

const AI_SOURCE_PATTERNS = [
  /^ai$/i,
  /^ai_/i,
  /ai_direct/i,
  /ai_chat/i,
  /ai_foundation/i,
  /ai_import/i,
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
  "acceptedFromProposalId",
  "accepted_from_proposal_id",
]);

const TEXT_MAX_LENGTH = 2000;

function assertFactText(value: unknown): string {
  if (typeof value !== "string") throw AppError.badRequest("text or content is required");
  const text = value;
  const trimmed = text.trim();
  if (!trimmed) throw AppError.badRequest("text or content is required");
  if (trimmed.length > TEXT_MAX_LENGTH) {
    throw AppError.badRequest(`text must be at most ${TEXT_MAX_LENGTH} characters`);
  }
  return trimmed;
}

function resolveFactText(body: Record<string, unknown>): string {
  if (body.text !== undefined) return assertFactText(body.text);
  if (body.content !== undefined) return assertFactText(body.content);
  throw AppError.badRequest("text or content is required");
}

function assertFactSource(source: unknown, forCreate: boolean): FactSource {
  if (source === undefined || source === null) {
    return FACT_SOURCES.user;
  }
  if (typeof source !== "string") throw AppError.badRequest("source must be a string");
  for (const pattern of AI_SOURCE_PATTERNS) {
    if (pattern.test(source)) {
      throw AppError.badRequest("AI-origin facts must go through ai_proposals first");
    }
  }
  if (!SOURCE_SET.has(source)) throw AppError.badRequest("source is invalid");
  if (forCreate && !MANUAL_FACT_SOURCES.has(source)) {
    throw AppError.badRequest("Only user or system source is allowed for manual fact creation");
  }
  return source as FactSource;
}

function factSnapshot(row: FactRow): Record<string, unknown> {
  return {
    text: row.text,
    category: row.category,
    importance: row.importance,
    canonStatus: row.canon_status,
    source: row.source,
    isLocked: row.is_locked,
  };
}

async function getOwnedFactRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  factId: string,
): Promise<FactRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("facts")
    .select(FACT_SELECT)
    .eq("id", factId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("facts select by id failed");
    throw AppError.internal("Failed to load fact");
  }
  if (!data) throw AppError.notFound("Fact not found");
  return data as FactRow;
}

export async function listFactsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  includeDeprecated = false,
): Promise<Fact[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  let query = admin
    .from("facts")
    .select(FACT_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (!includeDeprecated) {
    query = query.eq("canon_status", FACT_CANON_STATUSES.confirmed);
  }

  const { data, error } = await query;
  if (error) {
    console.error("facts list failed");
    throw AppError.internal("Failed to list facts");
  }
  return ((data ?? []) as FactRow[]).map(mapFactRow);
}

export async function createFactForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<Fact> {
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

  const text = resolveFactText(body);
  const source = assertFactSource(body.source, true);

  if (body.category === undefined) throw AppError.badRequest("category is required");
  if (typeof body.category !== "string" || !CATEGORY_SET.has(body.category)) {
    throw AppError.badRequest("category is invalid");
  }
  const category = body.category as FactCategory;

  if (body.importance !== undefined) {
    if (typeof body.importance !== "string" || !IMPORTANCE_SET.has(body.importance)) {
      throw AppError.badRequest("importance is invalid");
    }
  }
  const importance = (body.importance as FactImportance | undefined) ?? FACT_IMPORTANCE.minor;

  let isLocked = false;
  if (body.isLocked !== undefined) {
    if (typeof body.isLocked !== "boolean") throw AppError.badRequest("isLocked must be a boolean");
    isLocked = body.isLocked;
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("facts")
    .insert({
      project_id: projectId,
      text,
      category,
      importance,
      canon_status: FACT_CANON_STATUSES.confirmed,
      is_locked: isLocked,
      source,
    })
    .select(FACT_SELECT)
    .single();

  if (error || !data) {
    console.error("facts insert failed");
    throw AppError.internal("Failed to create fact");
  }

  const row = data as FactRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "fact_created",
    entityType: "fact",
    entityId: row.id,
    metadata: {
      category: row.category,
      source: row.source,
      importance: row.importance,
    },
  });

  return mapFactRow(row);
}

export async function updateFactForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  factId: string,
  raw: unknown,
): Promise<Fact> {
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

  const beforeRow = await getOwnedFactRow(bindings, ownerId, projectId, factId);

  if (beforeRow.canon_status === FACT_CANON_STATUSES.deprecated) {
    throw AppError.badRequest("Deprecated facts cannot be updated");
  }

  const updates: Record<string, unknown> = {};
  const changedFields: string[] = [];

  if (body.text !== undefined || body.content !== undefined) {
    updates.text = body.text !== undefined ? assertFactText(body.text) : assertFactText(body.content);
    changedFields.push("text");
  }
  if (body.category !== undefined) {
    if (typeof body.category !== "string" || !CATEGORY_SET.has(body.category)) {
      throw AppError.badRequest("category is invalid");
    }
    updates.category = body.category;
    changedFields.push("category");
  }
  if (body.importance !== undefined) {
    if (typeof body.importance !== "string" || !IMPORTANCE_SET.has(body.importance)) {
      throw AppError.badRequest("importance is invalid");
    }
    updates.importance = body.importance;
    changedFields.push("importance");
  }
  if (body.source !== undefined) {
    const source = assertFactSource(body.source, false);
    if (!MANUAL_FACT_SOURCES.has(source)) {
      throw AppError.badRequest("source cannot be changed to proposal-derived value via API");
    }
    updates.source = source;
    changedFields.push("source");
  }
  if (body.isLocked !== undefined) {
    if (typeof body.isLocked !== "boolean") throw AppError.badRequest("isLocked must be a boolean");
    updates.is_locked = body.isLocked;
    changedFields.push("isLocked");
  }
  if (body.canonStatus !== undefined) {
    if (typeof body.canonStatus !== "string" || !CANON_STATUS_SET.has(body.canonStatus)) {
      throw AppError.badRequest("canonStatus is invalid");
    }
    updates.canon_status = body.canonStatus;
    changedFields.push("canonStatus");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("facts")
    .update(updates)
    .eq("id", factId)
    .eq("project_id", projectId)
    .select(FACT_SELECT)
    .single();

  if (error || !data) {
    console.error("facts update failed");
    throw AppError.internal("Failed to update fact");
  }

  const afterRow = data as FactRow;
  const action = afterRow.canon_status === FACT_CANON_STATUSES.deprecated ? "fact_deprecated" : "fact_updated";

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action,
    entityType: "fact",
    entityId: factId,
    metadata: { changedFields },
    beforeData: factSnapshot(beforeRow),
    afterData: factSnapshot(afterRow),
  });

  return mapFactRow(afterRow);
}

/** Soft deprecate — sets canon_status deprecated, no hard delete. */
export async function deprecateFactForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  factId: string,
): Promise<Fact> {
  const beforeRow = await getOwnedFactRow(bindings, ownerId, projectId, factId);

  if (beforeRow.canon_status === FACT_CANON_STATUSES.deprecated) {
    return mapFactRow(beforeRow);
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("facts")
    .update({ canon_status: FACT_CANON_STATUSES.deprecated })
    .eq("id", factId)
    .eq("project_id", projectId)
    .select(FACT_SELECT)
    .single();

  if (error || !data) {
    console.error("facts deprecate failed");
    throw AppError.internal("Failed to deprecate fact");
  }

  const afterRow = data as FactRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "fact_deprecated",
    entityType: "fact",
    entityId: factId,
    metadata: { reason: "deprecate" },
    beforeData: factSnapshot(beforeRow),
    afterData: factSnapshot(afterRow),
  });

  return mapFactRow(afterRow);
}