import {
  AI_PROPOSAL_RISK_LEVELS,
  AI_PROPOSAL_TYPES,
  CHAPTER_SUMMARY_PROPOSAL_STATUSES,
  FACT_CANON_STATUSES,
  FACT_CATEGORIES,
  FACT_IMPORTANCE,
  FACT_SOURCES,
  OPEN_LOOP_STATUSES,
  PLANNED_REVEAL_STATUSES,
  SPEECH_RULE_SOURCES,
  SPEECH_RULE_STATUSES,
  type JsonObject,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapPlannedRevealPublic,
  mapSpeechRuleResponse,
  type AiProposalRow,
  type CharacterRow,
  type FactRow,
  type OpenLoopRow,
  type PlannedRevealRow,
  type SpeechRuleRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { assertProposalPayloadSafe } from "./summary-safety.js";

const FACT_SELECT =
  "id, project_id, text, category, importance, canon_status, is_locked, source, accepted_from_proposal_id, created_at, updated_at";
const CHARACTER_SELECT =
  "id, project_id, name, role_label, role, description, importance, status, source, sort_order, created_at, updated_at";
const LOOP_SELECT =
  "id, project_id, outline_plan_id, opened_in_chapter_outline_id, payoff_chapter_outline_id, question, reader_facing_hint, status, importance, metadata, created_at, updated_at";
const REVEAL_SELECT =
  "id, project_id, outline_plan_id, planned_chapter_outline_id, related_fact_id, related_proposal_id, title, planning_truth, reader_facing_hint, forbidden_before_chapter, status, risk_level, metadata, created_at, updated_at";
const RULE_SELECT =
  "id, project_id, relationship_label, character_a_id, character_b_id, rule_text, examples, status, source, created_at, updated_at";

const CATEGORY_SET = new Set<string>(Object.values(FACT_CATEGORIES));

export interface PromotedEntity {
  entityType: string;
  entityId: string;
  created: boolean;
  summary?: JsonObject;
}

function parsePayload(proposal: AiProposalRow): JsonObject {
  if (
    proposal.payload !== null &&
    typeof proposal.payload === "object" &&
    !Array.isArray(proposal.payload)
  ) {
    return proposal.payload as JsonObject;
  }
  return {};
}

function resolveFactText(payload: JsonObject, title: string): string {
  const candidates = [payload.proposedFactText, payload.factText, payload.summary, title];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length >= 8) return c.trim();
  }
  throw AppError.badRequest("Proposal payload has no safe fact text for promotion");
}

function resolveCategory(payload: JsonObject): string {
  const raw = payload.category;
  if (typeof raw === "string" && CATEGORY_SET.has(raw)) return raw;
  return FACT_CATEGORIES.event;
}

async function promoteFact(
  bindings: AppBindings,
  projectId: string,
  proposal: AiProposalRow,
): Promise<PromotedEntity> {
  const payload = parsePayload(proposal);
  assertProposalPayloadSafe(payload);
  const text = resolveFactText(payload, proposal.title);

  const admin = createServiceRoleClient(bindings);
  const { data: existing, error: existingError } = await admin
    .from("facts")
    .select(FACT_SELECT)
    .eq("project_id", projectId)
    .eq("text", text)
    .eq("canon_status", FACT_CANON_STATUSES.confirmed)
    .maybeSingle();

  if (existingError) {
    console.error("facts duplicate lookup failed");
    throw AppError.internal("Failed to promote fact proposal");
  }
  if (existing) {
    const row = existing as FactRow;
    return {
      entityType: "fact",
      entityId: row.id,
      created: false,
      summary: { text: row.text, category: row.category },
    };
  }

  const importance =
    proposal.risk_level === AI_PROPOSAL_RISK_LEVELS.high
      ? FACT_IMPORTANCE.major
      : FACT_IMPORTANCE.minor;

  const { data, error } = await admin
    .from("facts")
    .insert({
      project_id: projectId,
      text,
      category: resolveCategory(payload),
      importance,
      canon_status: FACT_CANON_STATUSES.confirmed,
      is_locked: false,
      source: FACT_SOURCES.accepted_proposal,
      accepted_from_proposal_id: proposal.id,
    })
    .select(FACT_SELECT)
    .single();

  if (error || !data) {
    console.error("facts insert from proposal failed");
    throw AppError.internal("Failed to promote fact proposal");
  }

  const row = data as FactRow;
  return {
    entityType: "fact",
    entityId: row.id,
    created: true,
    summary: { text: row.text, category: row.category },
  };
}

async function promoteCharacterUpdate(
  bindings: AppBindings,
  projectId: string,
  proposal: AiProposalRow,
): Promise<PromotedEntity> {
  const payload = parsePayload(proposal);
  assertProposalPayloadSafe(payload);

  const characterId = payload.targetEntityId;
  const changeSummary = payload.changeSummary;
  if (typeof characterId !== "string" || !characterId.trim()) {
    throw AppError.conflict("Character update promotion requires targetEntityId", {
      missing: ["unsupported_promotion"],
    });
  }
  if (typeof changeSummary !== "string" || changeSummary.trim().length < 8) {
    throw AppError.conflict("Character update promotion requires safe changeSummary", {
      missing: ["unsupported_promotion"],
    });
  }

  const admin = createServiceRoleClient(bindings);
  const { data: charRow, error: charError } = await admin
    .from("characters")
    .select(CHARACTER_SELECT)
    .eq("id", characterId.trim())
    .eq("project_id", projectId)
    .maybeSingle();

  if (charError || !charRow) {
    throw AppError.notFound("Character not found for promotion");
  }

  const existing = (charRow as CharacterRow).description?.trim() ?? "";
  const note = changeSummary.trim().slice(0, 500);
  const appended = existing
    ? `${existing}\n\n[Proposal accepted]: ${note}`
    : `[Proposal accepted]: ${note}`;

  const { data, error } = await admin
    .from("characters")
    .update({ description: appended.slice(0, 2000) })
    .eq("id", characterId.trim())
    .eq("project_id", projectId)
    .select(CHARACTER_SELECT)
    .single();

  if (error || !data) {
    console.error("characters update from proposal failed");
    throw AppError.internal("Failed to promote character update");
  }

  const row = data as CharacterRow;
  return {
    entityType: "character",
    entityId: row.id,
    created: false,
    summary: { name: row.name, descriptionUpdated: true },
  };
}

async function promoteRelationshipUpdate(
  bindings: AppBindings,
  projectId: string,
  proposal: AiProposalRow,
): Promise<PromotedEntity> {
  const payload = parsePayload(proposal);
  assertProposalPayloadSafe(payload);

  const relationshipLabel = payload.relationshipLabel;
  const characterAId = payload.characterAId;
  const characterBId = payload.characterBId;
  const ruleText = payload.ruleText ?? payload.changeSummary;

  if (
    typeof relationshipLabel !== "string" ||
    typeof characterAId !== "string" ||
    typeof characterBId !== "string" ||
    typeof ruleText !== "string" ||
    !relationshipLabel.trim() ||
    !characterAId.trim() ||
    !characterBId.trim() ||
    ruleText.trim().length < 8
  ) {
    throw AppError.conflict("Relationship update promotion is not supported for this payload", {
      missing: ["unsupported_promotion"],
    });
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("relationship_speech_rules")
    .insert({
      project_id: projectId,
      relationship_label: relationshipLabel.trim().slice(0, 120),
      character_a_id: characterAId.trim(),
      character_b_id: characterBId.trim(),
      rule_text: ruleText.trim().slice(0, 2000),
      examples: null,
      status: SPEECH_RULE_STATUSES.active,
      source: SPEECH_RULE_SOURCES.accepted_proposal,
    })
    .select(RULE_SELECT)
    .single();

  if (error || !data) {
    console.error("relationship_speech_rules insert from proposal failed");
    throw AppError.internal("Failed to promote relationship update");
  }

  const row = data as SpeechRuleRow;
  const mapped = mapSpeechRuleResponse(row);
  return {
    entityType: "relationship_speech_rule",
    entityId: row.id,
    created: true,
    summary: {
      relationshipLabel: mapped.relationshipLabel,
      ruleText: mapped.ruleText,
    },
  };
}

async function fetchOutlinePlanId(
  bindings: AppBindings,
  projectId: string,
): Promise<string> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("outline_plans")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !data) {
    throw AppError.notFound("Outline plan not found for open loop promotion");
  }
  return (data as { id: string }).id;
}

async function promoteOpenLoopUpdate(
  bindings: AppBindings,
  projectId: string,
  proposal: AiProposalRow,
): Promise<PromotedEntity> {
  const payload = parsePayload(proposal);
  assertProposalPayloadSafe(payload);

  const suggestedStatus =
    typeof payload.suggestedStatus === "string" ? payload.suggestedStatus : "opened";
  const changeSummary =
    typeof payload.changeSummary === "string" ? payload.changeSummary.trim() : "";
  const targetEntityId =
    typeof payload.targetEntityId === "string" ? payload.targetEntityId.trim() : "";

  const admin = createServiceRoleClient(bindings);

  if (suggestedStatus === "paid_off") {
    if (!targetEntityId) {
      throw AppError.conflict("Open loop payoff requires targetEntityId", {
        missing: ["target_required"],
      });
    }

    const { data, error } = await admin
      .from("open_loops")
      .update({ status: OPEN_LOOP_STATUSES.paid_off })
      .eq("id", targetEntityId)
      .eq("project_id", projectId)
      .select(LOOP_SELECT)
      .single();

    if (error || !data) {
      throw AppError.notFound("Open loop not found for promotion");
    }

    const row = data as OpenLoopRow;
    return {
      entityType: "open_loop",
      entityId: row.id,
      created: false,
      summary: { question: row.question, status: row.status },
    };
  }

  if (changeSummary.length < 8) {
    throw AppError.badRequest("Open loop promotion requires safe changeSummary text");
  }

  const outlinePlanId = await fetchOutlinePlanId(bindings, projectId);
  const chapterOutlineId =
    typeof payload.chapterOutlineId === "string" ? payload.chapterOutlineId : null;

  const { data, error } = await admin
    .from("open_loops")
    .insert({
      project_id: projectId,
      outline_plan_id: outlinePlanId,
      question: changeSummary.slice(0, 500),
      reader_facing_hint: null,
      opened_in_chapter_outline_id: chapterOutlineId,
      payoff_chapter_outline_id: null,
      status: OPEN_LOOP_STATUSES.opened,
      importance: FACT_IMPORTANCE.major,
      metadata: { acceptedFromProposalId: proposal.id },
    })
    .select(LOOP_SELECT)
    .single();

  if (error || !data) {
    console.error("open_loops insert from proposal failed");
    throw AppError.internal("Failed to promote open loop update");
  }

  const row = data as OpenLoopRow;
  return {
    entityType: "open_loop",
    entityId: row.id,
    created: true,
    summary: { question: row.question, status: row.status },
  };
}

async function promoteRevealStatusUpdate(
  bindings: AppBindings,
  projectId: string,
  proposal: AiProposalRow,
  confirmHighRisk: boolean,
): Promise<PromotedEntity> {
  if (!confirmHighRisk) {
    throw AppError.conflict("High-risk reveal promotion requires confirmHighRisk=true", {
      missing: ["high_risk_manual_review_required"],
    });
  }

  const payload = parsePayload(proposal);
  assertProposalPayloadSafe(payload);

  const targetEntityId =
    typeof payload.targetEntityId === "string" ? payload.targetEntityId.trim() : "";
  if (!targetEntityId) {
    throw AppError.conflict("Reveal promotion requires targetEntityId", {
      missing: ["target_required"],
    });
  }

  const nextStatus =
    typeof payload.suggestedStatus === "string" &&
    Object.values(PLANNED_REVEAL_STATUSES).includes(
      payload.suggestedStatus as (typeof PLANNED_REVEAL_STATUSES)[keyof typeof PLANNED_REVEAL_STATUSES],
    )
      ? payload.suggestedStatus
      : PLANNED_REVEAL_STATUSES.revealed;

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("planned_reveals")
    .update({ status: nextStatus })
    .eq("id", targetEntityId)
    .eq("project_id", projectId)
    .select(REVEAL_SELECT)
    .single();

  if (error || !data) {
    throw AppError.notFound("Planned reveal not found for promotion");
  }

  const row = data as PlannedRevealRow;
  const mapped = mapPlannedRevealPublic(row);
  return {
    entityType: "planned_reveal",
    entityId: row.id,
    created: false,
    summary: { title: mapped.title, status: mapped.status },
  };
}

export async function promoteProposalToCanon(
  bindings: AppBindings,
  projectId: string,
  proposal: AiProposalRow,
  options: { confirmHighRisk?: boolean } = {},
): Promise<PromotedEntity> {
  switch (proposal.proposal_type) {
    case AI_PROPOSAL_TYPES.fact:
      return promoteFact(bindings, projectId, proposal);
    case AI_PROPOSAL_TYPES.character_update:
      return promoteCharacterUpdate(bindings, projectId, proposal);
    case AI_PROPOSAL_TYPES.relationship_update:
      return promoteRelationshipUpdate(bindings, projectId, proposal);
    case AI_PROPOSAL_TYPES.open_loop_update:
      return promoteOpenLoopUpdate(bindings, projectId, proposal);
    case AI_PROPOSAL_TYPES.reveal_status_update:
      return promoteRevealStatusUpdate(
        bindings,
        projectId,
        proposal,
        options.confirmHighRisk === true,
      );
    default:
      throw AppError.conflict(`Proposal type "${proposal.proposal_type}" cannot be promoted`, {
        missing: ["unsupported_promotion"],
      });
  }
}

export { CHAPTER_SUMMARY_PROPOSAL_STATUSES };