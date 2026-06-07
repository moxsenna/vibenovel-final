import {
  SPEECH_RULE_SOURCES,
  SPEECH_RULE_STATUSES,
  type SpeechRuleSource,
  type SpeechRuleStatus,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapSpeechRuleResponse,
  type SpeechRuleResponse,
  type SpeechRuleRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";
import { getOwnedProjectRow } from "./project.js";

const RULE_SELECT =
  "id, project_id, relationship_label, character_a_id, character_b_id, rule_text, examples, status, source, created_at, updated_at";

const STATUS_SET = new Set<string>(Object.values(SPEECH_RULE_STATUSES));
const SOURCE_SET = new Set<string>(Object.values(SPEECH_RULE_SOURCES));

const MANUAL_SOURCES = new Set<string>([SPEECH_RULE_SOURCES.user]);

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

const LABEL_MAX_LENGTH = 120;
const RULE_TEXT_MAX_LENGTH = 2000;
const NAME_MAX_LENGTH = 80;

function ruleSnapshot(row: SpeechRuleRow): Record<string, unknown> {
  return {
    relationshipLabel: row.relationship_label,
    status: row.status,
    source: row.source,
    characterAId: row.character_a_id,
    characterBId: row.character_b_id,
  };
}

function assertSpeechRuleSource(source: unknown, forCreate: boolean): SpeechRuleSource {
  if (source === undefined || source === null) {
    return SPEECH_RULE_SOURCES.user;
  }
  if (typeof source !== "string") throw AppError.badRequest("source must be a string");
  for (const pattern of AI_SOURCE_PATTERNS) {
    if (pattern.test(source)) {
      throw AppError.badRequest("AI-origin speech rules must go through ai_proposals first");
    }
  }
  if (!SOURCE_SET.has(source)) throw AppError.badRequest("source is invalid");
  if (forCreate && !MANUAL_SOURCES.has(source)) {
    throw AppError.badRequest("Only user source is allowed for manual speech rule creation");
  }
  return source as SpeechRuleSource;
}

function parseExamples(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) throw AppError.badRequest("examples must be an array of strings");
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function resolveCharacterId(
  body: Record<string, unknown>,
  primary: string,
  alias: string,
): string | null | undefined {
  if (body[primary] !== undefined) {
    if (body[primary] === null) return null;
    if (typeof body[primary] !== "string" || !body[primary]) {
      throw AppError.badRequest(`${primary} must be a non-empty string or null`);
    }
    return body[primary] as string;
  }
  if (body[alias] !== undefined) {
    if (body[alias] === null) return null;
    if (typeof body[alias] !== "string" || !body[alias]) {
      throw AppError.badRequest(`${alias} must be a non-empty string or null`);
    }
    return body[alias] as string;
  }
  return undefined;
}

async function assertCharacterInProject(
  bindings: AppBindings,
  projectId: string,
  characterId: string,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("characters")
    .select("id")
    .eq("id", characterId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("characters ownership check failed");
    throw AppError.internal("Failed to validate character");
  }
  if (!data) {
    throw AppError.badRequest("Character does not belong to this project");
  }
}

async function fetchCharacterName(
  bindings: AppBindings,
  projectId: string,
  characterId: string,
): Promise<string> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("characters")
    .select("name")
    .eq("id", characterId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !data) {
    throw AppError.badRequest("Character does not belong to this project");
  }
  return data.name.trim();
}

async function resolveRelationshipLabel(
  bindings: AppBindings,
  projectId: string,
  body: Record<string, unknown>,
  charAId: string | null | undefined,
  charBId: string | null | undefined,
): Promise<string> {
  if (body.relationshipLabel !== undefined) {
    if (typeof body.relationshipLabel !== "string") {
      throw AppError.badRequest("relationshipLabel must be a string");
    }
    const trimmed = body.relationshipLabel.trim();
    if (!trimmed) throw AppError.badRequest("relationshipLabel cannot be empty");
    return trimmed.slice(0, LABEL_MAX_LENGTH);
  }

  const fromName =
    typeof body.fromCharacterName === "string" ? body.fromCharacterName.trim() : "";
  const toName = typeof body.toCharacterName === "string" ? body.toCharacterName.trim() : "";

  let nameA = fromName;
  let nameB = toName;

  if (charAId) nameA = await fetchCharacterName(bindings, projectId, charAId);
  if (charBId) nameB = await fetchCharacterName(bindings, projectId, charBId);

  if (nameA && nameB) {
    return `${nameA.slice(0, NAME_MAX_LENGTH)} ↔ ${nameB.slice(0, NAME_MAX_LENGTH)}`;
  }
  if (nameA || nameB) {
    return (nameA || nameB).slice(0, LABEL_MAX_LENGTH);
  }

  throw AppError.badRequest(
    "relationshipLabel or character pair (IDs or names) is required",
  );
}

function resolveRuleText(body: Record<string, unknown>): string {
  if (body.ruleText !== undefined) {
    if (typeof body.ruleText !== "string") throw AppError.badRequest("ruleText must be a string");
    const trimmed = body.ruleText.trim();
    if (!trimmed) throw AppError.badRequest("ruleText cannot be empty");
    return trimmed.slice(0, RULE_TEXT_MAX_LENGTH);
  }

  const addressTerm =
    (typeof body.addressTerm === "string" ? body.addressTerm.trim() : "") ||
    (typeof body.panggilan === "string" ? body.panggilan.trim() : "");
  const speechStyle =
    (typeof body.speechStyle === "string" ? body.speechStyle.trim() : "") ||
    (typeof body.gayaBicara === "string" ? body.gayaBicara.trim() : "");

  if (!addressTerm && !speechStyle) {
    throw AppError.badRequest("addressTerm or speechStyle (or ruleText) is required");
  }

  if (addressTerm && speechStyle) {
    return `Panggilan: ${addressTerm}. Gaya bicara: ${speechStyle}`.slice(0, RULE_TEXT_MAX_LENGTH);
  }
  return (addressTerm || speechStyle).slice(0, RULE_TEXT_MAX_LENGTH);
}

async function getOwnedSpeechRuleRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  ruleId: string,
): Promise<SpeechRuleRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("relationship_speech_rules")
    .select(RULE_SELECT)
    .eq("id", ruleId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("speech_rules select by id failed");
    throw AppError.internal("Failed to load speech rule");
  }
  if (!data) throw AppError.notFound("Speech rule not found");
  return data as SpeechRuleRow;
}

export async function listSpeechRulesForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  includeInactive = false,
): Promise<SpeechRuleResponse[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  let query = admin
    .from("relationship_speech_rules")
    .select(RULE_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (!includeInactive) {
    query = query.eq("status", SPEECH_RULE_STATUSES.active);
  }

  const { data, error } = await query;
  if (error) {
    console.error("speech_rules list failed");
    throw AppError.internal("Failed to list speech rules");
  }
  return ((data ?? []) as SpeechRuleRow[]).map(mapSpeechRuleResponse);
}

export async function createSpeechRuleForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<SpeechRuleResponse> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be set`);
    }
  }
  if (body.metadata !== undefined) {
    throw AppError.badRequest("metadata is not supported for speech rules");
  }

  await getOwnedProjectRow(bindings, ownerId, projectId);

  const charAId = resolveCharacterId(body, "characterAId", "fromCharacterId");
  const charBId = resolveCharacterId(body, "characterBId", "toCharacterId");

  if (charAId) await assertCharacterInProject(bindings, projectId, charAId);
  if (charBId) await assertCharacterInProject(bindings, projectId, charBId);

  const relationshipLabel = await resolveRelationshipLabel(
    bindings,
    projectId,
    body,
    charAId,
    charBId,
  );
  const ruleText = resolveRuleText(body);
  const source = assertSpeechRuleSource(body.source, true);

  let status: SpeechRuleStatus = SPEECH_RULE_STATUSES.active;
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
    status = body.status as SpeechRuleStatus;
  }

  const examples = parseExamples(body.examples);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("relationship_speech_rules")
    .insert({
      project_id: projectId,
      relationship_label: relationshipLabel,
      character_a_id: charAId ?? null,
      character_b_id: charBId ?? null,
      rule_text: ruleText,
      examples: examples ?? null,
      status,
      source,
    })
    .select(RULE_SELECT)
    .single();

  if (error || !data) {
    console.error("speech_rules insert failed");
    throw AppError.internal("Failed to create speech rule");
  }

  const row = data as SpeechRuleRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "speech_rule_created",
    entityType: "relationship_speech_rule",
    entityId: row.id,
    metadata: { relationshipLabel: row.relationship_label, status: row.status },
  });

  return mapSpeechRuleResponse(row);
}

export async function updateSpeechRuleForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  ruleId: string,
  raw: unknown,
): Promise<SpeechRuleResponse> {
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
  if (body.metadata !== undefined) {
    throw AppError.badRequest("metadata is not supported for speech rules");
  }

  const beforeRow = await getOwnedSpeechRuleRow(bindings, ownerId, projectId, ruleId);
  const updates: Record<string, unknown> = {};
  const changedFields: string[] = [];

  const charAId = resolveCharacterId(body, "characterAId", "fromCharacterId");
  const charBId = resolveCharacterId(body, "characterBId", "toCharacterId");

  if (charAId !== undefined) {
    if (charAId) await assertCharacterInProject(bindings, projectId, charAId);
    updates.character_a_id = charAId;
    changedFields.push("fromCharacterId");
  }
  if (charBId !== undefined) {
    if (charBId) await assertCharacterInProject(bindings, projectId, charBId);
    updates.character_b_id = charBId;
    changedFields.push("toCharacterId");
  }

  const needsLabel =
    body.relationshipLabel !== undefined ||
    body.fromCharacterName !== undefined ||
    body.toCharacterName !== undefined ||
    charAId !== undefined ||
    charBId !== undefined;

  if (needsLabel) {
    const mergedBody = { ...body };
    const effectiveA = charAId !== undefined ? charAId : beforeRow.character_a_id;
    const effectiveB = charBId !== undefined ? charBId : beforeRow.character_b_id;
    updates.relationship_label = await resolveRelationshipLabel(
      bindings,
      projectId,
      mergedBody,
      effectiveA,
      effectiveB,
    );
    changedFields.push("relationshipLabel");
  }

  const hasRuleTextInput =
    body.ruleText !== undefined ||
    body.addressTerm !== undefined ||
    body.panggilan !== undefined ||
    body.speechStyle !== undefined ||
    body.gayaBicara !== undefined;

  if (hasRuleTextInput) {
    updates.rule_text = resolveRuleText(body);
    changedFields.push("ruleText");
  }

  if (body.examples !== undefined) {
    updates.examples = parseExamples(body.examples);
    changedFields.push("examples");
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
    updates.status = body.status;
    changedFields.push("status");
  }

  if (body.source !== undefined) {
    const source = assertSpeechRuleSource(body.source, false);
    if (!MANUAL_SOURCES.has(source)) {
      throw AppError.badRequest("source cannot be changed to proposal-derived value via API");
    }
    updates.source = source;
    changedFields.push("source");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("relationship_speech_rules")
    .update(updates)
    .eq("id", ruleId)
    .eq("project_id", projectId)
    .select(RULE_SELECT)
    .single();

  if (error || !data) {
    console.error("speech_rules update failed");
    throw AppError.internal("Failed to update speech rule");
  }

  const afterRow = data as SpeechRuleRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "speech_rule_updated",
    entityType: "relationship_speech_rule",
    entityId: ruleId,
    metadata: { changedFields },
    beforeData: ruleSnapshot(beforeRow),
    afterData: ruleSnapshot(afterRow),
  });

  return mapSpeechRuleResponse(afterRow);
}

/** Soft deactivate — sets status deprecated. */
export async function deactivateSpeechRuleForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  ruleId: string,
): Promise<SpeechRuleResponse> {
  const beforeRow = await getOwnedSpeechRuleRow(bindings, ownerId, projectId, ruleId);

  if (beforeRow.status === SPEECH_RULE_STATUSES.deprecated) {
    return mapSpeechRuleResponse(beforeRow);
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("relationship_speech_rules")
    .update({ status: SPEECH_RULE_STATUSES.deprecated })
    .eq("id", ruleId)
    .eq("project_id", projectId)
    .select(RULE_SELECT)
    .single();

  if (error || !data) {
    console.error("speech_rules deactivate failed");
    throw AppError.internal("Failed to deactivate speech rule");
  }

  const afterRow = data as SpeechRuleRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "speech_rule_updated",
    entityType: "relationship_speech_rule",
    entityId: ruleId,
    metadata: { reason: "deactivate", changedFields: ["status"] },
    beforeData: ruleSnapshot(beforeRow),
    afterData: ruleSnapshot(afterRow),
  });

  return mapSpeechRuleResponse(afterRow);
}