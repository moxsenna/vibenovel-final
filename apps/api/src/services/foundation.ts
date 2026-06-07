import {
  FOUNDATION_READINESS_LEVELS,
  FOUNDATION_STATUSES,
  type Character,
  type Fact,
  type StoryFoundation,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapFoundationRow, type FoundationRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { listCharactersForOwner } from "./character.js";
import { listFactsForOwner } from "./fact.js";
import { writeAuditLog } from "./audit.js";
import { getOwnedProjectRow } from "./project.js";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

const STATUS_SET = new Set<string>(Object.values(FOUNDATION_STATUSES));
const READINESS_SET = new Set<string>(Object.values(FOUNDATION_READINESS_LEVELS));

const FORBIDDEN_PUT_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
  "lockedAt",
  "locked_at",
]);

const TEXT_MAX_LENGTH = 8000;
const SHORT_TEXT_MAX = 500;

const CORE_LOCKED_FIELDS = new Set([
  "premise",
  "mainConflict",
  "readerPromise",
  "storySecretsPreview",
  "genre",
  "tone",
  "targetReader",
  "styleTags",
]);

const DEFAULT_FOUNDATION_ROW = {
  premise: "",
  main_conflict: "",
  reader_promise: "",
  readiness_percent: 0,
  readiness_status: FOUNDATION_READINESS_LEVELS.belum_siap,
  status: FOUNDATION_STATUSES.draft,
  is_locked: false,
  style_tags: [] as string[],
} as const;

export interface FoundationBundle {
  foundation: StoryFoundation;
  characters: Character[];
  facts: Fact[];
}

function foundationSnapshot(row: FoundationRow): Record<string, unknown> {
  return {
    premise: row.premise,
    mainConflict: row.main_conflict,
    readinessPercent: row.readiness_percent,
    readinessStatus: row.readiness_status,
    status: row.status,
    isLocked: row.is_locked,
  };
}

function assertOptionalText(value: unknown, fieldName: string, maxLen: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw AppError.badRequest(`${fieldName} must be a string or null`);
  return value.trim().slice(0, maxLen);
}

function assertStyleTags(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw AppError.badRequest("styleTags must be an array of strings");
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
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
    console.error("story_foundations select failed");
    throw AppError.internal("Failed to load foundation");
  }
  return data as FoundationRow | null;
}

async function createDefaultFoundationRow(
  bindings: AppBindings,
  projectId: string,
): Promise<FoundationRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_foundations")
    .insert({
      project_id: projectId,
      ...DEFAULT_FOUNDATION_ROW,
    })
    .select(FOUNDATION_SELECT)
    .single();

  if (error || !data) {
    console.error("story_foundations default insert failed");
    throw AppError.internal("Failed to create foundation");
  }
  return data as FoundationRow;
}

async function getOrCreateFoundationRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<FoundationRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const existing = await fetchFoundationRow(bindings, projectId);
  if (existing) return existing;
  return createDefaultFoundationRow(bindings, projectId);
}

export async function getFoundationBundleForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<FoundationBundle> {
  const row = await getOrCreateFoundationRow(bindings, ownerId, projectId);
  const [characters, facts] = await Promise.all([
    listCharactersForOwner(bindings, ownerId, projectId, false),
    listFactsForOwner(bindings, ownerId, projectId, false),
  ]);

  return {
    foundation: mapFoundationRow(row),
    characters,
    facts,
  };
}

export async function upsertFoundationForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<StoryFoundation> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_PUT_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be updated`);
    }
  }
  if (Object.keys(body).length === 0) {
    throw AppError.badRequest("No updatable fields provided");
  }

  await getOwnedProjectRow(bindings, ownerId, projectId);
  const existingBefore = await fetchFoundationRow(bindings, projectId);
  const isNew = !existingBefore;
  const beforeRow = existingBefore ?? (await createDefaultFoundationRow(bindings, projectId));

  if (beforeRow.is_locked) {
    const unlocking = body.isLocked === false;
    const touchesCore = Object.keys(body).some((key) => CORE_LOCKED_FIELDS.has(key));
    if (touchesCore && !unlocking) {
      throw AppError.badRequest("Foundation is locked; unlock before editing core fields");
    }
  }

  const updates: Record<string, unknown> = {};
  const changedFields: string[] = [];
  let lockRequested = false;
  let unlockRequested = false;

  if (body.premise !== undefined) {
    const v = assertOptionalText(body.premise, "premise", TEXT_MAX_LENGTH);
    if (v !== undefined) {
      updates.premise = v ?? "";
      changedFields.push("premise");
    }
  }
  if (body.mainConflict !== undefined) {
    const v = assertOptionalText(body.mainConflict, "mainConflict", TEXT_MAX_LENGTH);
    if (v !== undefined) {
      updates.main_conflict = v ?? "";
      changedFields.push("mainConflict");
    }
  }
  if (body.readerPromise !== undefined) {
    const v = assertOptionalText(body.readerPromise, "readerPromise", TEXT_MAX_LENGTH);
    if (v !== undefined) {
      updates.reader_promise = v ?? "";
      changedFields.push("readerPromise");
    }
  }
  if (body.tone !== undefined) {
    updates.tone = assertOptionalText(body.tone, "tone", SHORT_TEXT_MAX);
    changedFields.push("tone");
  }
  if (body.genre !== undefined) {
    updates.genre = assertOptionalText(body.genre, "genre", SHORT_TEXT_MAX);
    changedFields.push("genre");
  }
  if (body.targetReader !== undefined) {
    updates.target_reader = assertOptionalText(body.targetReader, "targetReader", SHORT_TEXT_MAX);
    changedFields.push("targetReader");
  }
  if (body.storySecretsPreview !== undefined) {
    updates.story_secrets_preview = assertOptionalText(
      body.storySecretsPreview,
      "storySecretsPreview",
      TEXT_MAX_LENGTH,
    );
    changedFields.push("storySecretsPreview");
  }
  if (body.styleTags !== undefined) {
    updates.style_tags = assertStyleTags(body.styleTags);
    changedFields.push("styleTags");
  }

  const readinessPercent = body.readinessPercent ?? body.readinessScore;
  if (readinessPercent !== undefined) {
    if (typeof readinessPercent !== "number" || !Number.isInteger(readinessPercent)) {
      throw AppError.badRequest("readinessPercent must be an integer");
    }
    if (readinessPercent < 0 || readinessPercent > 100) {
      throw AppError.badRequest("readinessPercent must be between 0 and 100");
    }
    updates.readiness_percent = readinessPercent;
    changedFields.push("readinessPercent");
  }

  const readinessStatus = body.readinessStatus ?? body.readinessLevel;
  if (readinessStatus !== undefined) {
    if (typeof readinessStatus !== "string" || !READINESS_SET.has(readinessStatus)) {
      throw AppError.badRequest("readinessStatus is invalid");
    }
    updates.readiness_status = readinessStatus;
    changedFields.push("readinessStatus");
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
    updates.status = body.status;
    changedFields.push("status");
  }

  if (body.isLocked !== undefined) {
    if (typeof body.isLocked !== "boolean") {
      throw AppError.badRequest("isLocked must be a boolean");
    }
    if (body.isLocked && !beforeRow.is_locked) {
      lockRequested = true;
      updates.is_locked = true;
      updates.locked_at = new Date().toISOString();
      updates.status = FOUNDATION_STATUSES.locked;
      changedFields.push("isLocked", "status");
    } else if (!body.isLocked && beforeRow.is_locked) {
      unlockRequested = true;
      updates.is_locked = false;
      updates.locked_at = null;
      if (updates.status === undefined) {
        updates.status = FOUNDATION_STATUSES.draft;
      }
      changedFields.push("isLocked");
    }
  }

  if (body.workingTitle !== undefined || body.title !== undefined) {
    const titleRaw = body.workingTitle ?? body.title;
    if (typeof titleRaw !== "string") throw AppError.badRequest("workingTitle must be a string");
    const title = titleRaw.trim();
    if (!title) throw AppError.badRequest("workingTitle cannot be empty");
    const admin = createServiceRoleClient(bindings);
    const { error } = await admin
      .from("projects")
      .update({ title: title.slice(0, 120), last_edited_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("owner_id", ownerId);
    if (error) {
      console.error("projects title update failed");
      throw AppError.internal("Failed to update working title");
    }
    changedFields.push("workingTitle");
  }

  const admin = createServiceRoleClient(bindings);
  let afterRow = beforeRow;

  if (Object.keys(updates).length > 0) {
    const { data, error } = await admin
      .from("story_foundations")
      .update(updates)
      .eq("project_id", projectId)
      .select(FOUNDATION_SELECT)
      .single();

    if (error || !data) {
      console.error("story_foundations update failed");
      throw AppError.internal("Failed to update foundation");
    }
    afterRow = data as FoundationRow;
  }

  const auditAction = lockRequested
    ? "foundation_locked"
    : isNew
      ? "foundation_created"
      : "foundation_updated";

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: auditAction,
    entityType: "story_foundation",
    entityId: afterRow.id,
    metadata: {
      changedFields,
      ...(unlockRequested ? { unlocked: true } : {}),
    },
    beforeData: foundationSnapshot(beforeRow),
    afterData: foundationSnapshot(afterRow),
  });

  return mapFoundationRow(afterRow);
}