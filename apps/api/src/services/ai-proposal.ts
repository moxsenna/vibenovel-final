import {
  AI_PROPOSAL_RISK_LEVELS,
  AI_PROPOSAL_SOURCES,
  AI_PROPOSAL_STATUSES,
  AI_PROPOSAL_TYPES,
  type AiProposalRiskLevel,
  type AiProposalSource,
  type AiProposalType,
  type JsonObject,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapAiProposalResponse,
  type AiProposalResponse,
  type AiProposalRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";
import { getOwnedProjectRow } from "./project.js";

const PROPOSAL_SELECT =
  "id, project_id, proposal_type, status, risk_level, source, title, payload, review_note, reviewed_at, reviewed_by, merged_into_id, result_fact_id, result_character_id, created_at, updated_at";

const TYPE_SET = new Set<string>(Object.values(AI_PROPOSAL_TYPES));
const STATUS_SET = new Set<string>(Object.values(AI_PROPOSAL_STATUSES));
const RISK_SET = new Set<string>(Object.values(AI_PROPOSAL_RISK_LEVELS));
const SOURCE_SET = new Set<string>(Object.values(AI_PROPOSAL_SOURCES));

const PROVIDER_SOURCE_PATTERNS = [
  /^openrouter$/i,
  /^gemini/i,
  /^gpt/i,
  /^claude/i,
  /^anthropic/i,
  /^llama/i,
  /^mistral/i,
  /^deepseek/i,
];

const FORBIDDEN_CREATE_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "status",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
  "reviewedAt",
  "reviewed_at",
  "reviewedBy",
  "reviewed_by",
  "mergedIntoId",
  "merged_into_id",
  "resultFactId",
  "result_fact_id",
  "resultCharacterId",
  "result_character_id",
]);

const FORBIDDEN_PATCH_KEYS = new Set([
  ...FORBIDDEN_CREATE_KEYS,
  "proposalType",
  "proposal_type",
  "type",
  "source",
]);

const TITLE_MAX_LENGTH = 200;
const SUMMARY_MAX_LENGTH = 500;
const PAYLOAD_MAX_BYTES = 8000;

const BLOCKED_PAYLOAD_KEYS = new Set([
  "full_prompt",
  "raw_prompt",
  "prose",
  "chapter_text",
  "raw_output",
  "model_output",
]);

function proposalSnapshot(row: AiProposalRow): Record<string, unknown> {
  return {
    proposalType: row.proposal_type,
    status: row.status,
    riskLevel: row.risk_level,
    title: row.title,
  };
}

function assertProposalSource(source: unknown): AiProposalSource {
  if (source === undefined || source === null) {
    return AI_PROPOSAL_SOURCES.user_manual;
  }
  if (typeof source !== "string") throw AppError.badRequest("source must be a string");
  for (const pattern of PROVIDER_SOURCE_PATTERNS) {
    if (pattern.test(source)) {
      throw AppError.badRequest("Raw provider or model names cannot be used as source");
    }
  }
  if (!SOURCE_SET.has(source)) throw AppError.badRequest("source is invalid");
  return source as AiProposalSource;
}

function assertTitle(title: unknown): string {
  if (typeof title !== "string") throw AppError.badRequest("title is required");
  const trimmed = title.trim();
  if (!trimmed) throw AppError.badRequest("title is required");
  if (trimmed.length > TITLE_MAX_LENGTH) {
    throw AppError.badRequest(`title must be at most ${TITLE_MAX_LENGTH} characters`);
  }
  return trimmed;
}

function assertOptionalSummary(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw AppError.badRequest("summary must be a string");
  return value.trim().slice(0, SUMMARY_MAX_LENGTH);
}

function assertPayloadObject(raw: unknown): JsonObject {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw AppError.badRequest("payload must be a JSON object");
  }
  const obj = raw as JsonObject;
  const serialized = JSON.stringify(obj);
  if (serialized.length > PAYLOAD_MAX_BYTES) {
    throw AppError.badRequest(`payload must be at most ${PAYLOAD_MAX_BYTES} characters`);
  }
  for (const key of Object.keys(obj)) {
    if (BLOCKED_PAYLOAD_KEYS.has(key)) {
      throw AppError.badRequest(`payload must not contain "${key}"`);
    }
    const val = obj[key];
    if (typeof val === "string" && val.length > 2000) {
      throw AppError.badRequest(`payload field "${key}" is too large`);
    }
  }
  return obj;
}

function buildPayloadFromBody(body: Record<string, unknown>): JsonObject {
  const base = assertPayloadObject(body.payload);
  const payload: JsonObject = { ...base };

  const summary = assertOptionalSummary(body.summary ?? body.description);
  if (summary) payload.summary = summary;

  if (body.metadata !== undefined) {
    if (typeof body.metadata !== "object" || body.metadata === null || Array.isArray(body.metadata)) {
      throw AppError.badRequest("metadata must be an object");
    }
    payload.metadata = body.metadata as JsonObject;
  }

  if (body.targetEntityType !== undefined) {
    if (typeof body.targetEntityType !== "string") {
      throw AppError.badRequest("targetEntityType must be a string");
    }
    payload.targetEntityType = body.targetEntityType;
  }

  if (body.targetEntityId !== undefined) {
    if (typeof body.targetEntityId !== "string") {
      throw AppError.badRequest("targetEntityId must be a string");
    }
    payload.targetEntityId = body.targetEntityId;
  }

  return assertPayloadObject(payload);
}

function resolveProposalType(body: Record<string, unknown>): AiProposalType {
  const raw = body.type ?? body.proposalType;
  if (typeof raw !== "string" || !TYPE_SET.has(raw)) {
    throw AppError.badRequest("type is invalid");
  }
  return raw as AiProposalType;
}

function assertProposedStatus(row: AiProposalRow): void {
  if (row.status !== AI_PROPOSAL_STATUSES.proposed) {
    throw AppError.conflict(`Proposal is already ${row.status} and cannot be modified`);
  }
}

async function getOwnedProposalRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposalId: string,
): Promise<AiProposalRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("ai_proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("ai_proposals select by id failed");
    throw AppError.internal("Failed to load proposal");
  }
  if (!data) throw AppError.notFound("Proposal not found");
  return data as AiProposalRow;
}

export interface ListProposalsQuery {
  status?: string;
  type?: string;
  riskLevel?: string;
  includeResolved?: boolean;
}

export async function listProposalsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  query: ListProposalsQuery,
): Promise<AiProposalResponse[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);

  let dbQuery = admin
    .from("ai_proposals")
    .select(PROPOSAL_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (query.status) {
    if (!STATUS_SET.has(query.status)) {
      throw AppError.badRequest("status filter is invalid");
    }
    dbQuery = dbQuery.eq("status", query.status);
  } else if (!query.includeResolved) {
    dbQuery = dbQuery.eq("status", AI_PROPOSAL_STATUSES.proposed);
  }

  if (query.type) {
    if (!TYPE_SET.has(query.type)) {
      throw AppError.badRequest("type filter is invalid");
    }
    dbQuery = dbQuery.eq("proposal_type", query.type);
  }

  if (query.riskLevel) {
    if (!RISK_SET.has(query.riskLevel)) {
      throw AppError.badRequest("riskLevel filter is invalid");
    }
    dbQuery = dbQuery.eq("risk_level", query.riskLevel);
  }

  const { data, error } = await dbQuery;
  if (error) {
    console.error("ai_proposals list failed");
    throw AppError.internal("Failed to list proposals");
  }

  return ((data ?? []) as AiProposalRow[]).map(mapAiProposalResponse);
}

export async function getProposalForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposalId: string,
): Promise<AiProposalResponse> {
  const row = await getOwnedProposalRow(bindings, ownerId, projectId, proposalId);
  return mapAiProposalResponse(row);
}

export async function createProposalForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<AiProposalResponse> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_CREATE_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be set on create`);
    }
  }

  await getOwnedProjectRow(bindings, ownerId, projectId);

  const proposalType = resolveProposalType(body);
  const title = assertTitle(body.title);
  const payload = buildPayloadFromBody(body);
  const source = assertProposalSource(body.source);

  let riskLevel: AiProposalRiskLevel = AI_PROPOSAL_RISK_LEVELS.low;
  if (body.riskLevel !== undefined) {
    if (typeof body.riskLevel !== "string" || !RISK_SET.has(body.riskLevel)) {
      throw AppError.badRequest("riskLevel is invalid");
    }
    riskLevel = body.riskLevel as AiProposalRiskLevel;
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("ai_proposals")
    .insert({
      project_id: projectId,
      proposal_type: proposalType,
      status: AI_PROPOSAL_STATUSES.proposed,
      risk_level: riskLevel,
      source,
      title,
      payload,
    })
    .select(PROPOSAL_SELECT)
    .single();

  if (error || !data) {
    console.error("ai_proposals insert failed");
    throw AppError.internal("Failed to create proposal");
  }

  const row = data as AiProposalRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "ai_proposal_created",
    entityType: "ai_proposal",
    entityId: row.id,
    metadata: {
      proposalType: row.proposal_type,
      riskLevel: row.risk_level,
      source: row.source,
    },
  });

  return mapAiProposalResponse(row);
}

export async function updateProposalForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposalId: string,
  raw: unknown,
): Promise<AiProposalResponse> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_PATCH_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be updated`);
    }
  }
  if (Object.keys(body).length === 0) {
    throw AppError.badRequest("No updatable fields provided");
  }

  const beforeRow = await getOwnedProposalRow(bindings, ownerId, projectId, proposalId);
  assertProposedStatus(beforeRow);

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    updates.title = assertTitle(body.title);
  }

  if (
    body.payload !== undefined ||
    body.summary !== undefined ||
    body.description !== undefined ||
    body.metadata !== undefined ||
    body.targetEntityType !== undefined ||
    body.targetEntityId !== undefined
  ) {
    const existingPayload =
      beforeRow.payload !== null &&
      typeof beforeRow.payload === "object" &&
      !Array.isArray(beforeRow.payload)
        ? { ...(beforeRow.payload as JsonObject) }
        : {};

    const mergedBody = {
      payload: body.payload !== undefined ? body.payload : existingPayload,
      summary: body.summary,
      description: body.description,
      metadata: body.metadata,
      targetEntityType: body.targetEntityType,
      targetEntityId: body.targetEntityId,
    };
    updates.payload = buildPayloadFromBody(mergedBody);
  }

  if (body.riskLevel !== undefined) {
    if (typeof body.riskLevel !== "string" || !RISK_SET.has(body.riskLevel)) {
      throw AppError.badRequest("riskLevel is invalid");
    }
    updates.risk_level = body.riskLevel;
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("ai_proposals")
    .update(updates)
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .eq("status", AI_PROPOSAL_STATUSES.proposed)
    .select(PROPOSAL_SELECT)
    .single();

  if (error || !data) {
    console.error("ai_proposals update failed");
    throw AppError.internal("Failed to update proposal");
  }

  const afterRow = data as AiProposalRow;
  return mapAiProposalResponse(afterRow);
}

export async function acceptProposalForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposalId: string,
): Promise<AiProposalResponse> {
  const beforeRow = await getOwnedProposalRow(bindings, ownerId, projectId, proposalId);
  assertProposedStatus(beforeRow);

  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("ai_proposals")
    .update({
      status: AI_PROPOSAL_STATUSES.accepted,
      reviewed_at: now,
      reviewed_by: ownerId,
    })
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .eq("status", AI_PROPOSAL_STATUSES.proposed)
    .select(PROPOSAL_SELECT)
    .single();

  if (error || !data) {
    console.error("ai_proposals accept failed");
    throw AppError.internal("Failed to accept proposal");
  }

  const afterRow = data as AiProposalRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "ai_proposal_accepted",
    entityType: "ai_proposal",
    entityId: proposalId,
    metadata: {
      proposalType: afterRow.proposal_type,
      riskLevel: afterRow.risk_level,
      note: "status_only_no_canon_promotion",
    },
    beforeData: proposalSnapshot(beforeRow),
    afterData: proposalSnapshot(afterRow),
  });

  return mapAiProposalResponse(afterRow);
}

export async function rejectProposalForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposalId: string,
  raw: unknown,
): Promise<AiProposalResponse> {
  const beforeRow = await getOwnedProposalRow(bindings, ownerId, projectId, proposalId);
  assertProposedStatus(beforeRow);

  let reason: string | null = null;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== "object" || Array.isArray(raw)) {
      throw AppError.badRequest("Request body must be a JSON object");
    }
    const body = raw as Record<string, unknown>;
    if (body.reason !== undefined) {
      if (typeof body.reason !== "string") throw AppError.badRequest("reason must be a string");
      reason = body.reason.trim().slice(0, SUMMARY_MAX_LENGTH) || null;
    }
  }

  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("ai_proposals")
    .update({
      status: AI_PROPOSAL_STATUSES.rejected,
      review_note: reason,
      reviewed_at: now,
      reviewed_by: ownerId,
    })
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .eq("status", AI_PROPOSAL_STATUSES.proposed)
    .select(PROPOSAL_SELECT)
    .single();

  if (error || !data) {
    console.error("ai_proposals reject failed");
    throw AppError.internal("Failed to reject proposal");
  }

  const afterRow = data as AiProposalRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "ai_proposal_rejected",
    entityType: "ai_proposal",
    entityId: proposalId,
    metadata: {
      proposalType: afterRow.proposal_type,
      riskLevel: afterRow.risk_level,
      ...(reason ? { reason } : {}),
    },
    beforeData: proposalSnapshot(beforeRow),
    afterData: proposalSnapshot(afterRow),
  });

  return mapAiProposalResponse(afterRow);
}

export async function mergeProposalForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposalId: string,
  raw: unknown,
): Promise<AiProposalResponse> {
  const beforeRow = await getOwnedProposalRow(bindings, ownerId, projectId, proposalId);
  assertProposedStatus(beforeRow);

  let targetProposalId: string | null = null;
  let mergeNote: string | null = null;
  let reason: string | null = null;

  if (raw !== undefined && raw !== null) {
    if (typeof raw !== "object" || Array.isArray(raw)) {
      throw AppError.badRequest("Request body must be a JSON object");
    }
    const body = raw as Record<string, unknown>;

    if (body.targetProposalId !== undefined) {
      if (typeof body.targetProposalId !== "string" || !body.targetProposalId) {
        throw AppError.badRequest("targetProposalId must be a non-empty string");
      }
      targetProposalId = body.targetProposalId;
      if (targetProposalId === proposalId) {
        throw AppError.badRequest("targetProposalId cannot be the same proposal");
      }
      await getOwnedProposalRow(bindings, ownerId, projectId, targetProposalId);
    }

    if (body.mergeNote !== undefined) {
      if (typeof body.mergeNote !== "string") throw AppError.badRequest("mergeNote must be a string");
      mergeNote = body.mergeNote.trim().slice(0, SUMMARY_MAX_LENGTH) || null;
    }

    if (body.reason !== undefined) {
      if (typeof body.reason !== "string") throw AppError.badRequest("reason must be a string");
      reason = body.reason.trim().slice(0, SUMMARY_MAX_LENGTH) || null;
    }
  }

  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("ai_proposals")
    .update({
      status: AI_PROPOSAL_STATUSES.merged,
      merged_into_id: targetProposalId,
      review_note: mergeNote ?? reason,
      reviewed_at: now,
      reviewed_by: ownerId,
    })
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .eq("status", AI_PROPOSAL_STATUSES.proposed)
    .select(PROPOSAL_SELECT)
    .single();

  if (error || !data) {
    console.error("ai_proposals merge failed");
    throw AppError.internal("Failed to merge proposal");
  }

  const afterRow = data as AiProposalRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "ai_proposal_merged",
    entityType: "ai_proposal",
    entityId: proposalId,
    metadata: {
      proposalType: afterRow.proposal_type,
      riskLevel: afterRow.risk_level,
      ...(targetProposalId ? { targetProposalId } : {}),
      ...(mergeNote ? { mergeNote } : {}),
      ...(reason ? { reason } : {}),
    },
    beforeData: proposalSnapshot(beforeRow),
    afterData: proposalSnapshot(afterRow),
  });

  return mapAiProposalResponse(afterRow);
}