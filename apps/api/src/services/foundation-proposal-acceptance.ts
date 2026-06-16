import {
  AI_PROPOSAL_RISK_LEVELS,
  AI_PROPOSAL_STATUSES,
  AI_PROPOSAL_TYPES,
  CHARACTER_ROLES,
  CHARACTER_SOURCES,
  CHARACTER_STATUSES,
  FACT_CANON_STATUSES,
  FACT_CATEGORIES,
  FACT_IMPORTANCE,
  FACT_SOURCES,
  FOUNDATION_READINESS_LEVELS,
  FOUNDATION_STATUSES,
  HIGH_RISK_FACT_CATEGORY_LIST,
  SPEECH_RULE_SOURCES,
  SPEECH_RULE_STATUSES,
  type Character,
  type Fact,
  type StoryFoundation,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import {
  mapAiProposalResponse,
  mapCharacterRow,
  mapFactRow,
  mapFoundationRow,
  mapSpeechRuleResponse,
  type AiProposalResponse,
  type AiProposalRow,
  type CharacterRow,
  type FactRow,
  type FoundationRow,
  type SpeechRuleResponse,
  type SpeechRuleRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { writeAuditLog } from "./audit.js";
import {
  FOUNDATION_FLOW_PROPOSAL_TYPES,
  isFoundationReviewProposal,
} from "./foundation-proposal.js";
import {
  getFoundationReadinessForOwner,
  type FoundationReadinessResult,
} from "./foundation-readiness.js";
import { getOwnedProjectRow } from "./project.js";

const PROPOSAL_SELECT =
  "id, project_id, proposal_type, status, risk_level, source, title, payload, review_note, reviewed_at, reviewed_by, merged_into_id, result_fact_id, result_character_id, created_at, updated_at";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

const CHARACTER_SELECT =
  "id, project_id, name, role_label, role, description, importance, status, source, sort_order, created_at, updated_at";

const FACT_SELECT =
  "id, project_id, text, category, importance, canon_status, is_locked, source, accepted_from_proposal_id, created_at, updated_at";

const RULE_SELECT =
  "id, project_id, relationship_label, character_a_id, character_b_id, rule_text, examples, status, source, created_at, updated_at";

const PROMOTABLE_TYPES = new Set<string>([
  AI_PROPOSAL_TYPES.foundation,
  AI_PROPOSAL_TYPES.character,
  AI_PROPOSAL_TYPES.fact,
  AI_PROPOSAL_TYPES.relationship_speech_rule,
  AI_PROPOSAL_TYPES.style,
]);

const ROLE_SET = new Set<string>(Object.values(CHARACTER_ROLES));
const CATEGORY_SET = new Set<string>(Object.values(FACT_CATEGORIES));
const IMPORTANCE_SET = new Set<string>(Object.values(FACT_IMPORTANCE));

const TEXT_MAX_LENGTH = 8000;
const SHORT_TEXT_MAX = 500;
const NAME_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;
const FACT_TEXT_MAX = 2000;
const RULE_TEXT_MAX = 2000;
const LABEL_MAX_LENGTH = 120;
const GENERIC_IMPORT_TONE = "Diturunkan dari draft import";
const FOUNDATION_AI_BATCH_MARKER = "foundation_ai_batch";

export interface AcceptFoundationProposalResult {
  proposal: AiProposalResponse;
  foundation: StoryFoundation;
  readiness: FoundationReadinessResult;
  promoted: {
    characters: Character[];
    facts: Fact[];
    speechRules: SpeechRuleResponse[];
    foundationUpdated: boolean;
  };
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isGenericImportTone(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === GENERIC_IMPORT_TONE.toLowerCase();
}

function hasSpecificText(value: string | null | undefined): boolean {
  return hasText(value) && !isGenericImportTone(value);
}

function isGenericImportStyleTags(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const tags = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase());
  return tags.includes("imported_draft") || tags.includes(GENERIC_IMPORT_TONE.toLowerCase());
}

function trimText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function proposalSnapshot(row: AiProposalRow): Record<string, unknown> {
  return {
    proposalType: row.proposal_type,
    status: row.status,
    riskLevel: row.risk_level,
    title: row.title,
    resultFactId: row.result_fact_id,
    resultCharacterId: row.result_character_id,
  };
}

function isHighRiskCategory(value: unknown): boolean {
  return (
    typeof value === "string" &&
    HIGH_RISK_FACT_CATEGORY_LIST.includes(
      value as (typeof HIGH_RISK_FACT_CATEGORY_LIST)[number],
    )
  );
}

function isForbiddenFoundationPromotion(proposal: Pick<AiProposalRow, "proposal_type" | "risk_level" | "payload">): boolean {
  if (proposal.proposal_type === AI_PROPOSAL_TYPES.secret) return true;
  if (proposal.proposal_type === AI_PROPOSAL_TYPES.reveal) return true;
  if (proposal.proposal_type === AI_PROPOSAL_TYPES.chapter_delta) return true;

  if (proposal.proposal_type === AI_PROPOSAL_TYPES.fact) {
    const payload = parsePayload(proposal.payload);
    if (proposal.risk_level === AI_PROPOSAL_RISK_LEVELS.high) return true;
    if (payload.category === FACT_CATEGORIES.secret) return true;
    if (isHighRiskCategory(payload.highRiskCategory)) return true;
  }

  return false;
}

export function isFoundationProposalDirectlyPromotable(
  proposal: Pick<AiProposalRow, "proposal_type" | "risk_level" | "payload">,
): boolean {
  return (
    PROMOTABLE_TYPES.has(proposal.proposal_type) &&
    !isForbiddenFoundationPromotion(proposal)
  );
}

function assertPromotableFoundationProposal(proposal: AiProposalRow): void {
  if (!isFoundationProposalDirectlyPromotable(proposal)) {
    throw AppError.conflict(
      "High-risk or unsupported foundation proposals cannot be accepted directly",
      {
        proposalId: proposal.id,
        proposalType: proposal.proposal_type,
        riskLevel: proposal.risk_level,
      },
    );
  }
}

function validateCharacterPayload(proposal: AiProposalRow): {
  name: string;
  role: string;
  description: string;
  importance: string;
} {
  const payload = parsePayload(proposal.payload);
  const name = trimText(payload.name, NAME_MAX_LENGTH);
  if (!name) {
    throw AppError.conflict("Character proposal is missing a valid name", {
      proposalId: proposal.id,
    });
  }

  const role =
    typeof payload.role === "string" && ROLE_SET.has(payload.role)
      ? payload.role
      : CHARACTER_ROLES.other;
  const description = trimText(payload.description, DESCRIPTION_MAX_LENGTH) ?? "";
  const importance =
    typeof payload.importance === "string" &&
    ["main", "supporting", "minor"].includes(payload.importance)
      ? payload.importance
      : role === CHARACTER_ROLES.protagonist
        ? "main"
        : "supporting";

  return { name, role, description, importance };
}

function validateFactPayload(proposal: AiProposalRow): {
  text: string;
  category: string;
  importance: string;
} {
  const payload = parsePayload(proposal.payload);
  const text = trimText(payload.content ?? payload.text, FACT_TEXT_MAX);
  if (!text) {
    throw AppError.conflict("Fact proposal is missing valid content", {
      proposalId: proposal.id,
    });
  }
  if (typeof payload.category !== "string" || !CATEGORY_SET.has(payload.category)) {
    throw AppError.conflict("Fact proposal has an invalid category", {
      proposalId: proposal.id,
    });
  }
  if (payload.category === FACT_CATEGORIES.secret) {
    throw AppError.conflict("Secret facts cannot be promoted directly", {
      proposalId: proposal.id,
    });
  }

  const importance =
    typeof payload.importance === "string" && IMPORTANCE_SET.has(payload.importance)
      ? payload.importance
      : FACT_IMPORTANCE.minor;

  return { text, category: payload.category, importance };
}

function validateSpeechRulePayload(proposal: AiProposalRow): {
  relationshipLabel: string;
  ruleText: string;
  examples: string[] | null;
  characterAName: string | null;
  characterBName: string | null;
} {
  const payload = parsePayload(proposal.payload);
  const characterAName = trimText(payload.characterAName, NAME_MAX_LENGTH);
  const characterBName = trimText(payload.characterBName, NAME_MAX_LENGTH);
  const relationshipLabel =
    trimText(payload.relationshipLabel, LABEL_MAX_LENGTH) ??
    (characterAName && characterBName
      ? `${characterAName} - ${characterBName}`.slice(0, LABEL_MAX_LENGTH)
      : null);

  if (!relationshipLabel) {
    throw AppError.conflict("Speech-rule proposal is missing a relationship label", {
      proposalId: proposal.id,
    });
  }

  let ruleText = trimText(payload.ruleText, RULE_TEXT_MAX);
  if (!ruleText) {
    const addressTerm = trimText(payload.addressTerm ?? payload.panggilan, 200);
    const speechStyle = trimText(payload.speechStyle ?? payload.gayaBicara, 500);
    if (addressTerm && speechStyle) {
      ruleText = `Panggilan: ${addressTerm}. Gaya bicara: ${speechStyle}`.slice(
        0,
        RULE_TEXT_MAX,
      );
    } else {
      ruleText = addressTerm ?? speechStyle;
    }
  }
  if (!ruleText) {
    throw AppError.conflict("Speech-rule proposal is missing rule text", {
      proposalId: proposal.id,
    });
  }

  const examples = Array.isArray(payload.examples)
    ? payload.examples
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20)
    : null;

  return { relationshipLabel, ruleText, examples, characterAName, characterBName };
}

async function loadFoundationRow(
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
    console.error("story_foundations select foundation accept failed");
    throw AppError.internal("Failed to load foundation");
  }
  return (data as FoundationRow | null) ?? null;
}

async function ensureFoundationRow(
  bindings: AppBindings,
  projectId: string,
): Promise<FoundationRow> {
  const existing = await loadFoundationRow(bindings, projectId);
  if (existing) return existing;

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_foundations")
    .insert({
      project_id: projectId,
      premise: "",
      main_conflict: "",
      reader_promise: "",
      readiness_percent: 0,
      readiness_status: FOUNDATION_READINESS_LEVELS.belum_siap,
      status: FOUNDATION_STATUSES.draft,
      is_locked: false,
      style_tags: [],
    })
    .select(FOUNDATION_SELECT)
    .single();

  if (error || !data) {
    console.error("story_foundations insert foundation accept failed");
    throw AppError.internal("Failed to create foundation");
  }
  return data as FoundationRow;
}

async function loadProposalRow(
  bindings: AppBindings,
  projectId: string,
  proposalId: string,
): Promise<AiProposalRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("ai_proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("ai_proposals select foundation accept failed");
    throw AppError.internal("Failed to load proposal");
  }
  if (!data) throw AppError.notFound("Proposal not found");

  const row = data as AiProposalRow;
  if (
    !FOUNDATION_FLOW_PROPOSAL_TYPES.includes(
      row.proposal_type as (typeof FOUNDATION_FLOW_PROPOSAL_TYPES)[number],
    ) ||
    !isFoundationReviewProposal(row)
  ) {
    throw AppError.notFound("Foundation proposal not found");
  }
  return row;
}

async function markProposalAccepted(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposal: AiProposalRow,
): Promise<AiProposalRow> {
  if (proposal.status === AI_PROPOSAL_STATUSES.accepted) {
    return proposal;
  }
  if (proposal.status !== AI_PROPOSAL_STATUSES.proposed) {
    throw AppError.conflict(`Proposal is already ${proposal.status} and cannot be accepted`);
  }

  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("ai_proposals")
    .update({
      status: AI_PROPOSAL_STATUSES.accepted,
      reviewed_at: now,
      reviewed_by: ownerId,
    })
    .eq("id", proposal.id)
    .eq("project_id", projectId)
    .eq("status", AI_PROPOSAL_STATUSES.proposed)
    .select(PROPOSAL_SELECT)
    .single();

  if (error || !data) {
    console.error("ai_proposals accept foundation failed");
    throw AppError.internal("Failed to accept foundation proposal");
  }

  return data as AiProposalRow;
}

function buildFoundationUpdates(
  current: FoundationRow,
  proposal: AiProposalRow,
): Record<string, unknown> {
  const payload = parsePayload(proposal.payload);
  const updates: Record<string, unknown> = {};

  if (proposal.proposal_type === AI_PROPOSAL_TYPES.foundation) {
    if (!hasText(current.premise)) {
      const value = trimText(payload.premise, TEXT_MAX_LENGTH);
      if (value) updates.premise = value;
    }
    if (!hasText(current.main_conflict)) {
      const value = trimText(payload.mainConflict, TEXT_MAX_LENGTH);
      if (value) updates.main_conflict = value;
    }
    if (!hasText(current.reader_promise)) {
      const value = trimText(payload.readerPromise, TEXT_MAX_LENGTH);
      if (value) updates.reader_promise = value;
    }
    if (!hasText(current.genre)) {
      const value = trimText(payload.genre, SHORT_TEXT_MAX);
      if (value) updates.genre = value;
    }
    if (!hasText(current.tone)) {
      const value = trimText(payload.tone, SHORT_TEXT_MAX);
      if (value) updates.tone = value;
    }
    if (!hasText(current.target_reader)) {
      const value = trimText(payload.targetReader, SHORT_TEXT_MAX);
      if (value) updates.target_reader = value;
    }
  }

  if (proposal.proposal_type === AI_PROPOSAL_TYPES.style) {
    if (!hasSpecificText(current.tone)) {
      const value = trimText(payload.tone, SHORT_TEXT_MAX);
      if (value) updates.tone = value;
    }
  }

  const existingTags = Array.isArray(current.style_tags) ? current.style_tags : [];
  const canReplaceTags =
    existingTags.length === 0 ||
    (proposal.proposal_type === AI_PROPOSAL_TYPES.style &&
      (isGenericImportStyleTags(existingTags) ||
        payload.generator === FOUNDATION_AI_BATCH_MARKER));
  if (canReplaceTags && Array.isArray(payload.styleTags)) {
    const tags = payload.styleTags
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (tags.length > 0) updates.style_tags = tags;
  }

  return updates;
}

async function promoteFoundationFields(
  bindings: AppBindings,
  projectId: string,
  proposal: AiProposalRow,
): Promise<{ foundation: FoundationRow; updated: boolean }> {
  const admin = createServiceRoleClient(bindings);
  const current = await ensureFoundationRow(bindings, projectId);
  if (current.is_locked) throw AppError.conflict("Foundation is already locked");

  const updates = buildFoundationUpdates(current, proposal);
  if (Object.keys(updates).length === 0) {
    return { foundation: current, updated: false };
  }

  const { data, error } = await admin
    .from("story_foundations")
    .update({
      ...updates,
      status: FOUNDATION_STATUSES.draft,
    })
    .eq("project_id", projectId)
    .select(FOUNDATION_SELECT)
    .single();

  if (error || !data) {
    console.error("story_foundations promote proposal update failed");
    throw AppError.internal("Failed to promote foundation proposal");
  }

  return { foundation: data as FoundationRow, updated: true };
}

async function loadCharacterRows(
  bindings: AppBindings,
  projectId: string,
): Promise<CharacterRow[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("characters")
    .select(CHARACTER_SELECT)
    .eq("project_id", projectId);

  if (error) {
    console.error("characters select foundation accept failed");
    throw AppError.internal("Failed to load characters");
  }
  return (data ?? []) as CharacterRow[];
}

async function promoteCharacter(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposal: AiProposalRow,
): Promise<Character> {
  const admin = createServiceRoleClient(bindings);

  if (proposal.result_character_id) {
    const { data, error } = await admin
      .from("characters")
      .select(CHARACTER_SELECT)
      .eq("id", proposal.result_character_id)
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) {
      console.error("characters select result foundation accept failed");
      throw AppError.internal("Failed to load promoted character");
    }
    if (data) return mapCharacterRow(data as CharacterRow);
  }

  const validated = validateCharacterPayload(proposal);
  const nameKey = validated.name.toLowerCase();
  const existing = (await loadCharacterRows(bindings, projectId)).find(
    (row) => row.name.toLowerCase() === nameKey,
  );

  const write = existing
    ? admin
        .from("characters")
        .update({
          role: validated.role,
          description: validated.description,
          importance: validated.importance,
          source: CHARACTER_SOURCES.accepted_proposal,
        })
        .eq("id", existing.id)
        .eq("project_id", projectId)
    : admin.from("characters").insert({
        project_id: projectId,
        name: validated.name,
        role_label: "",
        role: validated.role,
        description: validated.description,
        importance: validated.importance,
        status: CHARACTER_STATUSES.active,
        source: CHARACTER_SOURCES.accepted_proposal,
        sort_order: 0,
      });

  const { data, error } = await write.select(CHARACTER_SELECT).single();
  if (error || !data) {
    console.error("characters promote foundation proposal failed");
    throw AppError.internal("Failed to promote character proposal");
  }

  const row = data as CharacterRow;
  await admin
    .from("ai_proposals")
    .update({ result_character_id: row.id })
    .eq("id", proposal.id)
    .eq("project_id", projectId);

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: existing ? "character_updated" : "character_created",
    entityType: "character",
    entityId: row.id,
    metadata: {
      name: row.name,
      role: row.role,
      promotedFromProposalId: proposal.id,
      promotionMode: "foundation_review_accept",
    },
  });

  return mapCharacterRow(row);
}

async function promoteFact(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposal: AiProposalRow,
): Promise<Fact> {
  const admin = createServiceRoleClient(bindings);

  if (proposal.result_fact_id) {
    const { data, error } = await admin
      .from("facts")
      .select(FACT_SELECT)
      .eq("id", proposal.result_fact_id)
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) {
      console.error("facts select result foundation accept failed");
      throw AppError.internal("Failed to load promoted fact");
    }
    if (data) return mapFactRow(data as FactRow);
  }

  const validated = validateFactPayload(proposal);
  const { data: existingFromProposal, error: existingFromProposalError } = await admin
    .from("facts")
    .select(FACT_SELECT)
    .eq("project_id", projectId)
    .eq("accepted_from_proposal_id", proposal.id)
    .maybeSingle();

  if (existingFromProposalError) {
    console.error("facts accepted_from_proposal lookup failed");
    throw AppError.internal("Failed to promote fact proposal");
  }
  if (existingFromProposal) return mapFactRow(existingFromProposal as FactRow);

  const { data: existingText, error: existingTextError } = await admin
    .from("facts")
    .select(FACT_SELECT)
    .eq("project_id", projectId)
    .eq("text", validated.text)
    .eq("canon_status", FACT_CANON_STATUSES.confirmed)
    .maybeSingle();

  if (existingTextError) {
    console.error("facts duplicate text lookup failed");
    throw AppError.internal("Failed to promote fact proposal");
  }
  if (existingText) {
    const row = existingText as FactRow;
    await admin
      .from("ai_proposals")
      .update({ result_fact_id: row.id })
      .eq("id", proposal.id)
      .eq("project_id", projectId);
    return mapFactRow(row);
  }

  const { data, error } = await admin
    .from("facts")
    .insert({
      project_id: projectId,
      text: validated.text,
      category: validated.category,
      importance: validated.importance,
      canon_status: FACT_CANON_STATUSES.confirmed,
      is_locked: false,
      source: FACT_SOURCES.accepted_proposal,
      accepted_from_proposal_id: proposal.id,
    })
    .select(FACT_SELECT)
    .single();

  if (error || !data) {
    console.error("facts promote foundation proposal failed");
    throw AppError.internal("Failed to promote fact proposal");
  }

  const row = data as FactRow;
  await admin
    .from("ai_proposals")
    .update({ result_fact_id: row.id })
    .eq("id", proposal.id)
    .eq("project_id", projectId);

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "fact_created",
    entityType: "fact",
    entityId: row.id,
    metadata: {
      category: row.category,
      source: row.source,
      promotedFromProposalId: proposal.id,
      promotionMode: "foundation_review_accept",
    },
  });

  return mapFactRow(row);
}

async function buildCharacterNameMap(
  bindings: AppBindings,
  projectId: string,
): Promise<Map<string, string>> {
  const rows = await loadCharacterRows(bindings, projectId);
  return new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));
}

async function promoteSpeechRule(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposal: AiProposalRow,
): Promise<SpeechRuleResponse> {
  const admin = createServiceRoleClient(bindings);
  const validated = validateSpeechRulePayload(proposal);

  const { data: existing, error: existingError } = await admin
    .from("relationship_speech_rules")
    .select(RULE_SELECT)
    .eq("project_id", projectId)
    .eq("relationship_label", validated.relationshipLabel)
    .eq("rule_text", validated.ruleText)
    .maybeSingle();

  if (existingError) {
    console.error("speech_rules duplicate lookup failed");
    throw AppError.internal("Failed to promote speech rule proposal");
  }
  if (existing) return mapSpeechRuleResponse(existing as SpeechRuleRow);

  const nameToId = await buildCharacterNameMap(bindings, projectId);
  const charAId = validated.characterAName
    ? nameToId.get(validated.characterAName.toLowerCase()) ?? null
    : null;
  const charBId = validated.characterBName
    ? nameToId.get(validated.characterBName.toLowerCase()) ?? null
    : null;

  const { data, error } = await admin
    .from("relationship_speech_rules")
    .insert({
      project_id: projectId,
      relationship_label: validated.relationshipLabel,
      character_a_id: charAId,
      character_b_id: charBId,
      rule_text: validated.ruleText,
      examples: validated.examples,
      status: SPEECH_RULE_STATUSES.active,
      source: SPEECH_RULE_SOURCES.accepted_proposal,
    })
    .select(RULE_SELECT)
    .single();

  if (error || !data) {
    console.error("speech_rules promote foundation proposal failed");
    throw AppError.internal("Failed to promote speech rule proposal");
  }

  const row = data as SpeechRuleRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "speech_rule_created",
    entityType: "relationship_speech_rule",
    entityId: row.id,
    metadata: {
      relationshipLabel: row.relationship_label,
      promotedFromProposalId: proposal.id,
      promotionMode: "foundation_review_accept",
    },
  });

  return mapSpeechRuleResponse(row);
}

async function reloadProposalRow(
  bindings: AppBindings,
  projectId: string,
  proposalId: string,
): Promise<AiProposalRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("ai_proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .single();

  if (error || !data) {
    console.error("ai_proposals reload foundation accept failed");
    throw AppError.internal("Failed to load accepted proposal");
  }
  return data as AiProposalRow;
}

export async function acceptFoundationProposalForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposalId: string,
): Promise<AcceptFoundationProposalResult> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const beforeRow = await loadProposalRow(bindings, projectId, proposalId);
  assertPromotableFoundationProposal(beforeRow);

  const acceptedRow = await markProposalAccepted(bindings, ownerId, projectId, beforeRow);
  const promoted: AcceptFoundationProposalResult["promoted"] = {
    characters: [],
    facts: [],
    speechRules: [],
    foundationUpdated: false,
  };

  if (
    acceptedRow.proposal_type === AI_PROPOSAL_TYPES.foundation ||
    acceptedRow.proposal_type === AI_PROPOSAL_TYPES.style
  ) {
    const result = await promoteFoundationFields(bindings, projectId, acceptedRow);
    promoted.foundationUpdated = result.updated;
  } else if (acceptedRow.proposal_type === AI_PROPOSAL_TYPES.character) {
    promoted.characters.push(
      await promoteCharacter(bindings, ownerId, projectId, acceptedRow),
    );
  } else if (acceptedRow.proposal_type === AI_PROPOSAL_TYPES.fact) {
    promoted.facts.push(await promoteFact(bindings, ownerId, projectId, acceptedRow));
  } else if (
    acceptedRow.proposal_type === AI_PROPOSAL_TYPES.relationship_speech_rule
  ) {
    promoted.speechRules.push(
      await promoteSpeechRule(bindings, ownerId, projectId, acceptedRow),
    );
  }

  const finalProposal = await reloadProposalRow(bindings, projectId, proposalId);
  const readiness = await getFoundationReadinessForOwner(bindings, ownerId, projectId);
  const finalFoundation = await ensureFoundationRow(bindings, projectId);

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "foundation_proposal_accepted",
    entityType: "ai_proposal",
    entityId: proposalId,
    metadata: {
      proposalType: finalProposal.proposal_type,
      riskLevel: finalProposal.risk_level,
      promotionMode: "foundation_review_accept",
      alreadyAccepted: beforeRow.status === AI_PROPOSAL_STATUSES.accepted,
      promotedCounts: {
        characters: promoted.characters.length,
        facts: promoted.facts.length,
        speechRules: promoted.speechRules.length,
        foundationUpdated: promoted.foundationUpdated ? 1 : 0,
      },
    },
    beforeData: proposalSnapshot(beforeRow),
    afterData: proposalSnapshot(finalProposal),
  });

  return {
    proposal: mapAiProposalResponse(finalProposal),
    foundation: mapFoundationRow(finalFoundation),
    readiness,
    promoted,
  };
}
