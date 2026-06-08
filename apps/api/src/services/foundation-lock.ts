import {
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
  STORY_CONCEPT_STATUSES,
  WORKFLOW_PHASES,
  type Character,
  type Fact,
  type StoryFoundation,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapCharacterRow,
  mapFactRow,
  mapFoundationRow,
  mapSpeechRuleResponse,
  type AiProposalRow,
  type CharacterRow,
  type FoundationRow,
  type SpeechRuleResponse,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";
import { generateCorrelationId, snapshotFoundationLock } from "./audit-snapshot.js";
import { listCharactersForOwner } from "./character.js";
import { listFactsForOwner } from "./fact.js";
import {
  getFoundationLockReadinessForOwner,
  getFoundationReadinessForOwner,
  type FoundationReadinessResult,
} from "./foundation-readiness.js";
import { FOUNDATION_FLOW_PROPOSAL_TYPES } from "./foundation-proposal.js";
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

const FOUNDATION_PAYLOAD_FIELDS = new Set([
  "premise",
  "mainConflict",
  "readerPromise",
  "genre",
  "tone",
  "targetReader",
  "styleTags",
]);

const BLOCKED_PAYLOAD_KEYS = new Set([
  "full_prompt",
  "raw_prompt",
  "prose",
  "chapter_text",
  "raw_output",
  "model_output",
  "generator",
  "batchId",
  "conceptId",
  "conceptTitle",
]);

export interface LockFoundationResult {
  foundation: StoryFoundation;
  readiness: FoundationReadinessResult;
  promoted: {
    characters: Character[];
    facts: Fact[];
    speechRules: SpeechRuleResponse[];
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

function trimText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
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
    console.error("story_foundations select lock failed");
    throw AppError.internal("Failed to load foundation");
  }
  return (data as FoundationRow | null) ?? null;
}

async function loadAcceptedProposals(
  bindings: AppBindings,
  projectId: string,
): Promise<AiProposalRow[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("ai_proposals")
    .select(PROPOSAL_SELECT)
    .eq("project_id", projectId)
    .eq("status", AI_PROPOSAL_STATUSES.accepted)
    .in("proposal_type", [...FOUNDATION_FLOW_PROPOSAL_TYPES]);

  if (error) {
    console.error("ai_proposals select accepted lock failed");
    throw AppError.internal("Failed to load accepted proposals");
  }
  return (data ?? []) as AiProposalRow[];
}

function isForbiddenPromotionType(proposal: AiProposalRow): boolean {
  if (proposal.proposal_type === AI_PROPOSAL_TYPES.secret) return true;
  if (proposal.proposal_type === AI_PROPOSAL_TYPES.reveal) return true;
  if (proposal.proposal_type === AI_PROPOSAL_TYPES.chapter_delta) return true;
  if (proposal.proposal_type === AI_PROPOSAL_TYPES.fact) {
    const payload = parsePayload(proposal.payload);
    if (payload.category === FACT_CATEGORIES.secret) return true;
    if (typeof payload.highRiskCategory === "string") {
      if (
        HIGH_RISK_FACT_CATEGORY_LIST.includes(
          payload.highRiskCategory as (typeof HIGH_RISK_FACT_CATEGORY_LIST)[number],
        )
      ) {
        return true;
      }
    }
    if (proposal.risk_level === "high" && payload.category === FACT_CATEGORIES.secret) {
      return true;
    }
  }
  return false;
}

function validateFoundationPayload(
  proposal: AiProposalRow,
): Record<string, unknown> | null {
  const raw = parsePayload(proposal.payload);
  const cleaned: Record<string, unknown> = {};

  for (const key of Object.keys(raw)) {
    if (BLOCKED_PAYLOAD_KEYS.has(key)) continue;
    if (!FOUNDATION_PAYLOAD_FIELDS.has(key)) continue;
    cleaned[key] = raw[key];
  }

  if (Object.keys(cleaned).length === 0) {
    throw AppError.conflict("Accepted foundation proposal has no promotable fields", {
      proposalId: proposal.id,
      proposalType: proposal.proposal_type,
    });
  }

  return cleaned;
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
    throw AppError.conflict("Accepted character proposal missing valid name", {
      proposalId: proposal.id,
    });
  }
  const role =
    typeof payload.role === "string" && ROLE_SET.has(payload.role)
      ? payload.role
      : CHARACTER_ROLES.other;
  const description = trimText(payload.description, DESCRIPTION_MAX_LENGTH) ?? "";
  const importance =
    typeof payload.importance === "string" && ["main", "supporting", "minor"].includes(payload.importance)
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
  if (isForbiddenPromotionType(proposal)) {
    throw AppError.conflict("Secret or high-risk fact proposals cannot be promoted to facts", {
      proposalId: proposal.id,
      proposalType: proposal.proposal_type,
    });
  }

  const payload = parsePayload(proposal.payload);
  const text = trimText(payload.content ?? payload.text, FACT_TEXT_MAX);
  if (!text) {
    throw AppError.conflict("Accepted fact proposal missing valid content", {
      proposalId: proposal.id,
    });
  }
  if (typeof payload.category !== "string" || !CATEGORY_SET.has(payload.category)) {
    throw AppError.conflict("Accepted fact proposal has invalid category", {
      proposalId: proposal.id,
    });
  }
  if (payload.category === FACT_CATEGORIES.secret) {
    throw AppError.conflict("Secret category facts cannot be promoted during lock", {
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

  const relationshipLabel =
    trimText(payload.relationshipLabel, LABEL_MAX_LENGTH) ??
    (() => {
      const a = trimText(payload.characterAName, NAME_MAX_LENGTH);
      const b = trimText(payload.characterBName, NAME_MAX_LENGTH);
      if (a && b) return `${a} ↔ ${b}`.slice(0, LABEL_MAX_LENGTH);
      return null;
    })();

  if (!relationshipLabel) {
    throw AppError.conflict("Accepted speech rule proposal missing relationship label", {
      proposalId: proposal.id,
    });
  }

  let ruleText = trimText(payload.ruleText, RULE_TEXT_MAX);
  if (!ruleText) {
    const addressTerm =
      trimText(payload.addressTerm, 200) ?? trimText(payload.panggilan, 200);
    const speechStyle =
      trimText(payload.speechStyle, 500) ?? trimText(payload.gayaBicara, 500);
    if (addressTerm && speechStyle) {
      ruleText = `Panggilan: ${addressTerm}. Gaya bicara: ${speechStyle}`.slice(0, RULE_TEXT_MAX);
    } else if (addressTerm || speechStyle) {
      ruleText = (addressTerm ?? speechStyle)!.slice(0, RULE_TEXT_MAX);
    }
  }
  if (!ruleText) {
    throw AppError.conflict("Accepted speech rule proposal missing rule text", {
      proposalId: proposal.id,
    });
  }

  let examples: string[] | null = null;
  if (Array.isArray(payload.examples)) {
    examples = payload.examples
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  return {
    relationshipLabel,
    ruleText,
    examples,
    characterAName: trimText(payload.characterAName, NAME_MAX_LENGTH),
    characterBName: trimText(payload.characterBName, NAME_MAX_LENGTH),
  };
}

function validateStylePayload(proposal: AiProposalRow): {
  tone: string | null;
  styleTags: string[] | null;
} {
  const payload = parsePayload(proposal.payload);
  const tone = trimText(payload.tone, SHORT_TEXT_MAX);
  let styleTags: string[] | null = null;
  if (Array.isArray(payload.styleTags)) {
    styleTags = payload.styleTags
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (!tone && (!styleTags || styleTags.length === 0)) {
    throw AppError.conflict("Accepted style proposal has no tone or styleTags", {
      proposalId: proposal.id,
    });
  }
  return { tone, styleTags };
}

function validateAllAcceptedProposals(proposals: AiProposalRow[]): void {
  const errors: { proposalId: string; reason: string }[] = [];

  for (const proposal of proposals) {
    if (proposal.status !== AI_PROPOSAL_STATUSES.accepted) continue;
    if (!PROMOTABLE_TYPES.has(proposal.proposal_type)) continue;
    if (isForbiddenPromotionType(proposal)) continue;

    try {
      switch (proposal.proposal_type) {
        case AI_PROPOSAL_TYPES.foundation:
          validateFoundationPayload(proposal);
          break;
        case AI_PROPOSAL_TYPES.character:
          validateCharacterPayload(proposal);
          break;
        case AI_PROPOSAL_TYPES.fact:
          validateFactPayload(proposal);
          break;
        case AI_PROPOSAL_TYPES.relationship_speech_rule:
          validateSpeechRulePayload(proposal);
          break;
        case AI_PROPOSAL_TYPES.style:
          validateStylePayload(proposal);
          break;
      }
    } catch (err) {
      if (err instanceof AppError && err.details) {
        errors.push({
          proposalId: proposal.id,
          reason: err.message,
        });
      } else {
        throw err;
      }
    }
  }

  if (errors.length > 0) {
    throw AppError.conflict("One or more accepted proposals failed validation", {
      invalidProposals: errors,
    });
  }
}

interface LockPreconditionContext {
  foundation: FoundationRow | null;
  characters: Character[];
  facts: Fact[];
  acceptedProposals: AiProposalRow[];
  conceptSelected: boolean;
}

function acceptedFoundationField(
  proposals: AiProposalRow[],
  field: string,
): boolean {
  return proposals.some((p) => {
    if (p.proposal_type !== AI_PROPOSAL_TYPES.foundation) return false;
    const val = parsePayload(p.payload)[field];
    return typeof val === "string" && val.trim().length > 0;
  });
}

function acceptedStyleTone(proposals: AiProposalRow[]): boolean {
  return proposals.some((p) => {
    if (p.proposal_type !== AI_PROPOSAL_TYPES.style) return false;
    const payload = parsePayload(p.payload);
    return (
      (typeof payload.tone === "string" && payload.tone.trim().length > 0) ||
      (Array.isArray(payload.styleTags) && payload.styleTags.length > 0)
    );
  });
}

function countPromotableFacts(
  facts: Fact[],
  proposals: AiProposalRow[],
): number {
  const acceptedFacts = proposals.filter(
    (p) => p.proposal_type === AI_PROPOSAL_TYPES.fact && !isForbiddenPromotionType(p),
  );
  return facts.length + acceptedFacts.length;
}

function assertLockPreconditions(
  readiness: FoundationReadinessResult,
  ctx: LockPreconditionContext,
): void {
  if (ctx.foundation?.is_locked) {
    throw AppError.conflict("Foundation is already locked");
  }

  if (!ctx.conceptSelected) {
    throw AppError.conflict("Selected concept is required before lock", {
      readinessScore: readiness.readinessScore,
      missing: ["Concept terpilih"],
      failedChecks: ["selected_concept"],
    });
  }

  const failedChecks: string[] = [];
  const missing: string[] = [];

  if (readiness.readinessScore < 75) {
    failedChecks.push("readiness_score");
    missing.push(`Readiness score ${readiness.readinessScore} < 75`);
  }

  if (!readiness.canLock) {
    failedChecks.push("can_lock");
  }

  const f = ctx.foundation;
  const ap = ctx.acceptedProposals;

  const premiseOk =
    hasText(f?.premise) || acceptedFoundationField(ap, "premise");
  if (!premiseOk) {
    failedChecks.push("premise");
    missing.push("Premise / pitch");
  }

  const conflictOk =
    hasText(f?.main_conflict) || acceptedFoundationField(ap, "mainConflict");
  if (!conflictOk) {
    failedChecks.push("main_conflict");
    missing.push("Konflik utama");
  }

  const promiseOk =
    hasText(f?.reader_promise) || acceptedFoundationField(ap, "readerPromise");
  if (!promiseOk) {
    failedChecks.push("reader_promise");
    missing.push("Janji pembaca");
  }

  const protagonistCanon = ctx.characters.some((c) => c.role === "protagonist");
  const protagonistAccepted = ap.some((p) => {
    if (p.proposal_type !== AI_PROPOSAL_TYPES.character) return false;
    return parsePayload(p.payload).role === CHARACTER_ROLES.protagonist;
  });
  if (!protagonistCanon && !protagonistAccepted) {
    failedChecks.push("protagonist");
    missing.push("Tokoh utama");
  }

  const factCount = countPromotableFacts(ctx.facts, ap);
  if (factCount < 2) {
    failedChecks.push("facts");
    missing.push("Minimal 2 fakta (confirmed atau accepted proposal)");
  }

  const targetOk =
    hasText(f?.target_reader) || acceptedFoundationField(ap, "targetReader");
  if (!targetOk) {
    failedChecks.push("target_reader");
    missing.push("Target pembaca");
  }

  const genreOk = hasText(f?.genre) || acceptedFoundationField(ap, "genre");
  const toneOk =
    hasText(f?.tone) ||
    acceptedFoundationField(ap, "tone") ||
    acceptedStyleTone(ap);
  if (!genreOk || !toneOk) {
    failedChecks.push("genre_tone");
    missing.push("Genre & tone");
  }

  if (failedChecks.length > 0) {
    throw AppError.conflict("Foundation is not ready to lock", {
      readinessScore: readiness.readinessScore,
      canLock: readiness.canLock,
      missing,
      failedChecks,
    });
  }
}

async function promoteCharacters(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposals: AiProposalRow[],
  existingByName: Map<string, CharacterRow>,
): Promise<{ characters: Character[]; nameToId: Map<string, string>; promotedIds: string[] }> {
  const admin = createServiceRoleClient(bindings);
  const promoted: Character[] = [];
  const promotedIds: string[] = [];
  const nameToId = new Map<string, string>();

  for (const row of existingByName.values()) {
    nameToId.set(row.name.toLowerCase(), row.id);
  }

  const characterProposals = proposals.filter(
    (p) => p.proposal_type === AI_PROPOSAL_TYPES.character && !p.result_character_id,
  );

  for (const proposal of characterProposals) {
    const validated = validateCharacterPayload(proposal);
    const nameKey = validated.name.toLowerCase();
    const existing = existingByName.get(nameKey);

    if (existing) {
      const { data, error } = await admin
        .from("characters")
        .update({
          role: validated.role,
          description: validated.description,
          importance: validated.importance,
          source: CHARACTER_SOURCES.accepted_proposal,
        })
        .eq("id", existing.id)
        .eq("project_id", projectId)
        .select(CHARACTER_SELECT)
        .single();

      if (error || !data) {
        console.error("characters promote update failed");
        throw AppError.internal("Failed to promote character from proposal");
      }

      const row = data as CharacterRow;
      nameToId.set(nameKey, row.id);
      promoted.push(mapCharacterRow(row));
      promotedIds.push(proposal.id);

      await admin
        .from("ai_proposals")
        .update({ result_character_id: row.id })
        .eq("id", proposal.id);

      await writeAuditLog(bindings, {
        userId: ownerId,
        projectId,
        action: "character_created",
        entityType: "character",
        entityId: row.id,
        metadata: {
          name: row.name,
          role: row.role,
          promotedFromProposalId: proposal.id,
        },
      });
    } else {
      const { data, error } = await admin
        .from("characters")
        .insert({
          project_id: projectId,
          name: validated.name,
          role_label: "",
          role: validated.role,
          description: validated.description,
          importance: validated.importance,
          status: CHARACTER_STATUSES.active,
          source: CHARACTER_SOURCES.accepted_proposal,
          sort_order: 0,
        })
        .select(CHARACTER_SELECT)
        .single();

      if (error || !data) {
        console.error("characters promote insert failed");
        throw AppError.internal("Failed to promote character from proposal");
      }

      const row = data as CharacterRow;
      existingByName.set(nameKey, row);
      nameToId.set(nameKey, row.id);
      promoted.push(mapCharacterRow(row));
      promotedIds.push(proposal.id);

      await admin
        .from("ai_proposals")
        .update({ result_character_id: row.id })
        .eq("id", proposal.id);

      await writeAuditLog(bindings, {
        userId: ownerId,
        projectId,
        action: "character_created",
        entityType: "character",
        entityId: row.id,
        metadata: {
          name: row.name,
          role: row.role,
          promotedFromProposalId: proposal.id,
        },
      });
    }
  }

  return { characters: promoted, nameToId, promotedIds };
}

async function promoteFacts(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposals: AiProposalRow[],
): Promise<{ facts: Fact[]; promotedIds: string[] }> {
  const admin = createServiceRoleClient(bindings);
  const promoted: Fact[] = [];
  const promotedIds: string[] = [];

  const factProposals = proposals.filter(
    (p) =>
      p.proposal_type === AI_PROPOSAL_TYPES.fact &&
      !p.result_fact_id &&
      !isForbiddenPromotionType(p),
  );

  for (const proposal of factProposals) {
    const validated = validateFactPayload(proposal);

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
      console.error("facts promote insert failed");
      throw AppError.internal("Failed to promote fact from proposal");
    }

    const row = data as import("../lib/mappers.js").FactRow;
    promoted.push(mapFactRow(row));
    promotedIds.push(proposal.id);

    await admin.from("ai_proposals").update({ result_fact_id: row.id }).eq("id", proposal.id);

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
      },
    });
  }

  return { facts: promoted, promotedIds };
}

async function promoteSpeechRules(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  proposals: AiProposalRow[],
  nameToId: Map<string, string>,
): Promise<{ speechRules: SpeechRuleResponse[]; promotedIds: string[] }> {
  const admin = createServiceRoleClient(bindings);
  const promoted: SpeechRuleResponse[] = [];
  const promotedIds: string[] = [];

  const ruleProposals = proposals.filter(
    (p) => p.proposal_type === AI_PROPOSAL_TYPES.relationship_speech_rule,
  );

  for (const proposal of ruleProposals) {
    const validated = validateSpeechRulePayload(proposal);

    const charAId = validated.characterAName
      ? (nameToId.get(validated.characterAName.toLowerCase()) ?? null)
      : null;
    const charBId = validated.characterBName
      ? (nameToId.get(validated.characterBName.toLowerCase()) ?? null)
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
      console.error("speech_rules promote insert failed");
      throw AppError.internal("Failed to promote speech rule from proposal");
    }

    const row = data as import("../lib/mappers.js").SpeechRuleRow;
    promoted.push(mapSpeechRuleResponse(row));
    promotedIds.push(proposal.id);

    await writeAuditLog(bindings, {
      userId: ownerId,
      projectId,
      action: "speech_rule_created",
      entityType: "relationship_speech_rule",
      entityId: row.id,
      metadata: {
        relationshipLabel: row.relationship_label,
        promotedFromProposalId: proposal.id,
      },
    });
  }

  return { speechRules: promoted, promotedIds };
}

function mergeFoundationUpdates(
  foundation: FoundationRow | null,
  proposals: AiProposalRow[],
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const current = foundation;

  const foundationProposals = proposals.filter(
    (p) => p.proposal_type === AI_PROPOSAL_TYPES.foundation,
  );
  const styleProposals = proposals.filter((p) => p.proposal_type === AI_PROPOSAL_TYPES.style);

  for (const proposal of foundationProposals) {
    const payload = validateFoundationPayload(proposal);
    if (!payload) continue;

    if (!hasText(current?.premise) && payload.premise !== undefined) {
      const v = trimText(payload.premise, TEXT_MAX_LENGTH);
      if (v) updates.premise = v;
    }
    if (!hasText(current?.main_conflict) && payload.mainConflict !== undefined) {
      const v = trimText(payload.mainConflict, TEXT_MAX_LENGTH);
      if (v) updates.main_conflict = v;
    }
    if (!hasText(current?.reader_promise) && payload.readerPromise !== undefined) {
      const v = trimText(payload.readerPromise, TEXT_MAX_LENGTH);
      if (v) updates.reader_promise = v;
    }
    if (!hasText(current?.genre) && payload.genre !== undefined) {
      const v = trimText(payload.genre, SHORT_TEXT_MAX);
      if (v) updates.genre = v;
    }
    if (!hasText(current?.tone) && payload.tone !== undefined) {
      const v = trimText(payload.tone, SHORT_TEXT_MAX);
      if (v) updates.tone = v;
    }
    if (!hasText(current?.target_reader) && payload.targetReader !== undefined) {
      const v = trimText(payload.targetReader, SHORT_TEXT_MAX);
      if (v) updates.target_reader = v;
    }
    const existingTags = Array.isArray(current?.style_tags) ? (current!.style_tags as string[]) : [];
    if (existingTags.length === 0 && payload.styleTags !== undefined && Array.isArray(payload.styleTags)) {
      const tags = payload.styleTags
        .filter((item): item is string => typeof item === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20);
      if (tags.length > 0) updates.style_tags = tags;
    }
  }

  for (const proposal of styleProposals) {
    const { tone, styleTags } = validateStylePayload(proposal);
    if (!hasText(current?.tone) && !updates.tone && tone) {
      updates.tone = tone;
    }
    const existingTags =
      Array.isArray(updates.style_tags) ? (updates.style_tags as string[]) :
      Array.isArray(current?.style_tags) ? (current!.style_tags as string[]) : [];
    if (existingTags.length === 0 && styleTags && styleTags.length > 0) {
      updates.style_tags = styleTags;
    }
  }

  return updates;
}

export async function lockFoundationForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<LockFoundationResult> {
  const projectRow = await getOwnedProjectRow(bindings, ownerId, projectId);

  if (!projectRow.selected_concept_id) {
    throw AppError.conflict("Selected concept is required before lock");
  }

  const admin = createServiceRoleClient(bindings);
  const { data: conceptData, error: conceptError } = await admin
    .from("story_concepts")
    .select("id, status")
    .eq("id", projectRow.selected_concept_id)
    .eq("project_id", projectId)
    .maybeSingle();

  if (conceptError) {
    console.error("story_concepts select lock failed");
    throw AppError.internal("Failed to load selected concept");
  }
  if (!conceptData || conceptData.status !== STORY_CONCEPT_STATUSES.selected) {
    throw AppError.conflict("Selected concept is required before lock", {
      failedChecks: ["selected_concept"],
    });
  }

  const foundation = await loadFoundationRow(bindings, projectId);
  if (foundation?.is_locked) {
    throw AppError.conflict("Foundation is already locked");
  }

  const [characters, facts, acceptedProposals, readiness] = await Promise.all([
    listCharactersForOwner(bindings, ownerId, projectId, false),
    listFactsForOwner(bindings, ownerId, projectId, false),
    loadAcceptedProposals(bindings, projectId),
    getFoundationLockReadinessForOwner(bindings, ownerId, projectId),
  ]);

  assertLockPreconditions(readiness, {
    foundation,
    characters,
    facts,
    acceptedProposals,
    conceptSelected: true,
  });

  validateAllAcceptedProposals(acceptedProposals);

  const correlationId = generateCorrelationId();

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "foundation_lock_started",
    entityType: "story_foundation",
    entityId: foundation?.id,
    metadata: {
      correlationId,
      task: "foundation_lock",
      readinessScore: readiness.readinessScore,
      canLock: readiness.canLock,
      acceptedProposalCount: acceptedProposals.length,
    },
  });

  const existingByName = new Map<string, CharacterRow>();
  for (const ch of characters) {
    existingByName.set(ch.name.toLowerCase(), {
      id: ch.id,
      project_id: ch.projectId,
      name: ch.name,
      role_label: ch.roleLabel,
      role: ch.role,
      description: ch.description,
      importance: ch.importance,
      status: ch.status,
      source: ch.source,
      sort_order: ch.sortOrder,
      created_at: ch.createdAt,
      updated_at: ch.updatedAt,
    });
  }

  const foundationMerge = mergeFoundationUpdates(foundation, acceptedProposals);

  let afterFoundation: FoundationRow;
  let promotedProposalIds: string[] = [];
  let charResult: Awaited<ReturnType<typeof promoteCharacters>>;
  let factResult: Awaited<ReturnType<typeof promoteFacts>>;
  let ruleResult: Awaited<ReturnType<typeof promoteSpeechRules>>;

  try {
    charResult = await promoteCharacters(
      bindings,
      ownerId,
      projectId,
      acceptedProposals,
      existingByName,
    );

    factResult = await promoteFacts(bindings, ownerId, projectId, acceptedProposals);

    ruleResult = await promoteSpeechRules(
      bindings,
      ownerId,
      projectId,
      acceptedProposals,
      charResult.nameToId,
    );

    promotedProposalIds = [
      ...charResult.promotedIds,
      ...factResult.promotedIds,
      ...ruleResult.promotedIds,
      ...acceptedProposals
        .filter(
          (p) =>
            p.proposal_type === AI_PROPOSAL_TYPES.foundation ||
            p.proposal_type === AI_PROPOSAL_TYPES.style,
        )
        .map((p) => p.id),
    ];

    const now = new Date().toISOString();
    const lockUpdates: Record<string, unknown> = {
      ...foundationMerge,
      is_locked: true,
      locked_at: now,
      status: FOUNDATION_STATUSES.locked,
      readiness_percent: Math.max(readiness.readinessScore, 75),
      readiness_status: FOUNDATION_READINESS_LEVELS.siap_dikunci,
    };

    if (foundation) {
      const { data, error } = await admin
        .from("story_foundations")
        .update(lockUpdates)
        .eq("project_id", projectId)
        .eq("is_locked", false)
        .select(FOUNDATION_SELECT)
        .single();

      if (error || !data) {
        console.error("story_foundations lock update failed");
        throw AppError.internal("Failed to lock foundation");
      }
      afterFoundation = data as FoundationRow;
    } else {
      const { data, error } = await admin
        .from("story_foundations")
        .insert({
          project_id: projectId,
          premise: (lockUpdates.premise as string) ?? "",
          main_conflict: (lockUpdates.main_conflict as string) ?? "",
          reader_promise: (lockUpdates.reader_promise as string) ?? "",
          tone: (lockUpdates.tone as string | undefined) ?? null,
          genre: (lockUpdates.genre as string | undefined) ?? null,
          target_reader: (lockUpdates.target_reader as string | undefined) ?? null,
          style_tags: (lockUpdates.style_tags as string[] | undefined) ?? [],
          is_locked: true,
          locked_at: now,
          status: FOUNDATION_STATUSES.locked,
          readiness_percent: Math.max(readiness.readinessScore, 75),
          readiness_status: FOUNDATION_READINESS_LEVELS.siap_dikunci,
        })
        .select(FOUNDATION_SELECT)
        .single();

      if (error || !data) {
        console.error("story_foundations lock insert failed");
        throw AppError.internal("Failed to lock foundation");
      }
      afterFoundation = data as FoundationRow;
    }

    const { error: phaseError } = await admin
      .from("projects")
      .update({
        workflow_phase: WORKFLOW_PHASES.foundation_locked,
        last_edited_at: now,
      })
      .eq("id", projectId)
      .eq("owner_id", ownerId);

    if (phaseError) {
      console.error("projects workflow_phase lock update failed");
      throw AppError.internal("Failed to update project workflow phase");
    }

    const lockSnapshots = snapshotFoundationLock(
      foundation
        ? {
            isLocked: foundation.is_locked,
            status: foundation.status,
            readinessPercent: foundation.readiness_percent,
          }
        : null,
      {
        isLocked: afterFoundation.is_locked,
        status: afterFoundation.status,
        readinessPercent: afterFoundation.readiness_percent,
      },
    );

    await writeAuditLog(bindings, {
      userId: ownerId,
      projectId,
      action: "foundation_locked",
      entityType: "story_foundation",
      entityId: afterFoundation.id,
      metadata: {
        correlationId,
        task: "foundation_lock",
        promotedProposalIds,
        promotedCounts: {
          characters: charResult.promotedIds.length,
          facts: factResult.promotedIds.length,
          speechRules: ruleResult.promotedIds.length,
        },
        readinessScore: readiness.readinessScore,
        canLock: readiness.canLock,
        lockedAt: now,
      },
      beforeData: lockSnapshots.beforeData,
      afterData: {
        ...lockSnapshots.afterData,
        workflowPhase: WORKFLOW_PHASES.foundation_locked,
      },
    });
  } catch (err) {
    const errorCode = err instanceof AppError ? err.code : "internal_error";
    await writeAuditLog(bindings, {
      userId: ownerId,
      projectId,
      action: "foundation_lock_failed",
      entityType: "story_foundation",
      entityId: foundation?.id,
      metadata: {
        correlationId,
        task: "foundation_lock",
        errorCode,
        readinessScore: readiness.readinessScore,
      },
    });
    throw err;
  }

  const finalReadiness = await getFoundationReadinessForOwner(bindings, ownerId, projectId);

  return {
    foundation: mapFoundationRow(afterFoundation),
    readiness: finalReadiness,
    promoted: {
      characters: charResult.characters,
      facts: factResult.facts,
      speechRules: ruleResult.speechRules,
    },
  };
}