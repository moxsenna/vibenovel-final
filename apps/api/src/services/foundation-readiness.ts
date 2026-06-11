import {
  FOUNDATION_READINESS_LEVELS,
  STORY_CONCEPT_STATUSES,
  type FoundationReadinessLevel,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import type { AiProposalRow, FoundationRow, ProjectRow, StoryConceptRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { listCharactersForOwner } from "./character.js";
import { listFactsForOwner } from "./fact.js";
import { FOUNDATION_FLOW_PROPOSAL_TYPES } from "./foundation-proposal.js";
import { getOwnedProjectRow } from "./project.js";
import { listSpeechRulesForOwner } from "./speech-rule.js";

const PROPOSAL_SELECT =
  "id, project_id, proposal_type, status, risk_level, source, title, payload, review_note, reviewed_at, reviewed_by, merged_into_id, result_fact_id, result_character_id, created_at, updated_at";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

const CONCEPT_SELECT =
  "id, project_id, title, short_pitch, reader_promise, core_conflict, genre, tone, target_reader, status, source, score, payload, created_at, updated_at";

const SIGNAL_SELECT =
  "id, project_id, session_id, type, label, value, confidence, status, source_message_id, metadata, created_at, updated_at";

export type ReadinessCheckStatus = "pass" | "partial" | "missing";

export interface ReadinessCheckItem {
  key: string;
  label: string;
  status: ReadinessCheckStatus;
  reason: string;
}

export interface FoundationReadinessResult {
  readinessScore: number;
  readinessLevel: FoundationReadinessLevel;
  canLock: boolean;
  checks: ReadinessCheckItem[];
  missing: string[];
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

function proposalHasField(
  proposals: AiProposalRow[],
  type: string,
  field: string,
): boolean {
  return proposals.some((p) => {
    if (p.proposal_type !== type) return false;
    const payload = parsePayload(p.payload);
    const val = payload[field];
    return typeof val === "string" && val.trim().length > 0;
  });
}

function countProposalsByType(proposals: AiProposalRow[], type: string): number {
  return proposals.filter((p) => p.proposal_type === type).length;
}

function levelFromScore(score: number): FoundationReadinessLevel {
  if (score >= 75) return FOUNDATION_READINESS_LEVELS.siap_dikunci;
  if (score >= 45) return FOUNDATION_READINESS_LEVELS.bisa_lanjut;
  return FOUNDATION_READINESS_LEVELS.belum_siap;
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
    console.error("story_foundations select readiness failed");
    throw AppError.internal("Failed to load foundation");
  }
  return (data as FoundationRow | null) ?? null;
}

async function loadSelectedConcept(
  bindings: AppBindings,
  projectRow: ProjectRow,
): Promise<StoryConceptRow | null> {
  if (!projectRow.selected_concept_id) return null;

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_concepts")
    .select(CONCEPT_SELECT)
    .eq("id", projectRow.selected_concept_id)
    .eq("project_id", projectRow.id)
    .maybeSingle();

  if (error) {
    console.error("story_concepts select readiness failed");
    throw AppError.internal("Failed to load selected concept");
  }
  return (data as StoryConceptRow | null) ?? null;
}

async function loadFoundationFlowProposals(
  bindings: AppBindings,
  projectId: string,
): Promise<AiProposalRow[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("ai_proposals")
    .select(PROPOSAL_SELECT)
    .eq("project_id", projectId)
    .in("proposal_type", [...FOUNDATION_FLOW_PROPOSAL_TYPES]);

  if (error) {
    console.error("ai_proposals select readiness failed");
    throw AppError.internal("Failed to load proposals for readiness");
  }
  return (data ?? []) as AiProposalRow[];
}

async function loadRelationshipHeavy(
  bindings: AppBindings,
  projectId: string,
): Promise<boolean> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("detected_signals")
    .select(SIGNAL_SELECT)
    .eq("project_id", projectId)
    .in("type", ["relationship_dynamic", "genre"]);

  if (error) return false;

  return ((data ?? []) as { label: string; value: string }[]).some((row) =>
    /rumah tangga|keluarga|istri|mertua/i.test(row.label + row.value),
  );
}

async function persistReadinessToFoundation(
  bindings: AppBindings,
  projectId: string,
  score: number,
  level: FoundationReadinessLevel,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const existing = await loadFoundationRow(bindings, projectId);

  if (existing) {
    await admin
      .from("story_foundations")
      .update({
        readiness_percent: score,
        readiness_status: level,
      })
      .eq("project_id", projectId);
    return;
  }

  await admin.from("story_foundations").insert({
    project_id: projectId,
    premise: "",
    main_conflict: "",
    reader_promise: "",
    readiness_percent: score,
    readiness_status: level,
    status: "draft",
    is_locked: false,
    style_tags: [],
  });
}

interface ReadinessComputeOptions {
  /** Proposal statuses counted toward readiness (display: proposed only; lock: proposed + accepted). */
  activeStatuses: Set<string>;
  /** When true, accepted-but-not-yet-canon items count as pass (lock gate). */
  acceptedCountsAsReady: boolean;
  persist: boolean;
}

function isPromotableFactProposal(row: AiProposalRow): boolean {
  if (row.proposal_type !== "fact") return false;
  const payload = parsePayload(row.payload);
  return payload.category !== "secret" && typeof payload.highRiskCategory !== "string";
}

function computeFoundationReadiness(
  foundation: FoundationRow | null,
  concept: StoryConceptRow | null,
  proposals: AiProposalRow[],
  characters: Awaited<ReturnType<typeof listCharactersForOwner>>,
  facts: Awaited<ReturnType<typeof listFactsForOwner>>,
  speechRules: Awaited<ReturnType<typeof listSpeechRulesForOwner>>,
  relationshipHeavy: boolean,
  options: ReadinessComputeOptions,
): FoundationReadinessResult {
  const activeProposals = proposals.filter((p) => options.activeStatuses.has(p.status));
  const checks: ReadinessCheckItem[] = [];
  let score = 0;
  const CORE_WEIGHT = 10;
  const SUPPORT_WEIGHT = 5;

  const conceptSelected =
    concept !== null && concept.status === STORY_CONCEPT_STATUSES.selected;
  checks.push({
    key: "selected_concept",
    label: "Concept terpilih",
    status: conceptSelected ? "pass" : "missing",
    reason: conceptSelected
      ? `Concept "${concept.title}" dipilih.`
      : "Belum ada concept dengan status selected.",
  });
  if (conceptSelected) score += CORE_WEIGHT;

  const premiseOk =
    hasText(foundation?.premise) ||
    proposalHasField(activeProposals, "foundation", "premise") ||
    hasText(concept?.short_pitch);
  checks.push({
    key: "premise",
    label: "Premise / pitch",
    status: premiseOk ? "pass" : "missing",
    reason: premiseOk
      ? "Premise tersedia di fondasi, proposal, atau concept."
      : "Premise belum terisi atau belum di-propose.",
  });
  if (premiseOk) score += CORE_WEIGHT;

  const conflictOk =
    hasText(foundation?.main_conflict) ||
    proposalHasField(activeProposals, "foundation", "mainConflict") ||
    hasText(concept?.core_conflict);
  checks.push({
    key: "main_conflict",
    label: "Konflik utama",
    status: conflictOk ? "pass" : "missing",
    reason: conflictOk
      ? "Konflik utama terdefinisi."
      : "Konflik utama belum terisi atau belum di-propose.",
  });
  if (conflictOk) score += CORE_WEIGHT;

  const promiseOk =
    hasText(foundation?.reader_promise) ||
    proposalHasField(activeProposals, "foundation", "readerPromise") ||
    hasText(concept?.reader_promise);
  checks.push({
    key: "reader_promise",
    label: "Janji pembaca",
    status: promiseOk ? "pass" : "missing",
    reason: promiseOk
      ? "Janji pembaca tersedia."
      : "Janji pembaca belum terisi atau belum di-propose.",
  });
  if (promiseOk) score += CORE_WEIGHT;

  const protagonistCanon = characters.some((c) => c.role === "protagonist");
  const protagonistProposed = activeProposals.some((p) => {
    if (p.proposal_type !== "character") return false;
    return parsePayload(p.payload).role === "protagonist";
  });
  const protagonistOk = protagonistCanon || protagonistProposed;
  const protagonistPass =
    protagonistCanon || (options.acceptedCountsAsReady && protagonistProposed);
  checks.push({
    key: "protagonist",
    label: "Tokoh utama",
    status: protagonistOk
      ? protagonistPass
        ? "pass"
        : "partial"
      : "missing",
    reason: protagonistOk
      ? protagonistCanon
        ? "Protagonist sudah di canon characters."
        : options.acceptedCountsAsReady
          ? "Protagonist siap dari accepted proposal."
          : "Protagonist di-propose — belum di-accept."
      : "Belum ada protagonist di characters atau proposal.",
  });
  if (protagonistOk) score += protagonistPass ? CORE_WEIGHT : CORE_WEIGHT - 3;

  const promotableFactProposals = activeProposals.filter(isPromotableFactProposal);
  const factCount = facts.length + promotableFactProposals.length;
  const factsOk = factCount >= 2;
  const factsPass = facts.length >= 2 || (options.acceptedCountsAsReady && factsOk);
  checks.push({
    key: "facts",
    label: "Minimal 2 fakta",
    status: factsOk ? (factsPass ? "pass" : "partial") : "missing",
    reason: factsOk
      ? `${facts.length} confirmed + ${promotableFactProposals.length} proposal siap promosi.`
      : "Butuh minimal 2 fakta (confirmed atau proposal siap promosi).",
  });
  if (factsOk) score += factsPass ? CORE_WEIGHT : CORE_WEIGHT - 3;

  const targetOk =
    hasText(foundation?.target_reader) ||
    proposalHasField(activeProposals, "foundation", "targetReader") ||
    hasText(concept?.target_reader);
  checks.push({
    key: "target_reader",
    label: "Target pembaca",
    status: targetOk ? "pass" : "missing",
    reason: targetOk ? "Target pembaca terdefinisi." : "Target pembaca belum ada.",
  });
  if (targetOk) score += SUPPORT_WEIGHT;

  const genreToneOk =
    (hasText(foundation?.genre) ||
      proposalHasField(activeProposals, "foundation", "genre") ||
      hasText(concept?.genre)) &&
    (hasText(foundation?.tone) ||
      proposalHasField(activeProposals, "foundation", "tone") ||
      hasText(concept?.tone) ||
      countProposalsByType(activeProposals, "style") > 0);
  checks.push({
    key: "genre_tone",
    label: "Genre & tone",
    status: genreToneOk ? "pass" : "missing",
    reason: genreToneOk
      ? "Genre dan tone/gaya tersedia."
      : "Genre atau tone belum lengkap.",
  });
  if (genreToneOk) score += SUPPORT_WEIGHT;

  const speechRuleOk =
    !relationshipHeavy ||
    speechRules.length > 0 ||
    countProposalsByType(activeProposals, "relationship_speech_rule") > 0;
  checks.push({
    key: "speech_rule",
    label: "Aturan bicara (jika drama keluarga)",
    status: relationshipHeavy
      ? speechRuleOk
        ? speechRules.length > 0
          ? "pass"
          : "partial"
        : "missing"
      : "pass",
    reason: relationshipHeavy
      ? speechRuleOk
        ? "Aturan bicara ada di canon atau proposal."
        : "Drama keluarga terdeteksi — butuh speech rule proposal/canon."
      : "Tidak wajib untuk cerita non-keluarga.",
  });
  if (speechRuleOk || !relationshipHeavy) score += relationshipHeavy ? SUPPORT_WEIGHT : 0;

  // Guard the real risk only: a high-risk secret written DIRECTLY into facts,
  // bypassing the proposal queue (source !== accepted_proposal). An *accepted*
  // high-risk proposal went through approval — the safe promotion path — so it
  // must not penalise readiness. The old extra clause
  // `secretProposals.every(p => p.status === "proposed")` made this check depend
  // on activeStatuses, so the display readiness (proposed-only) and the lock
  // readiness (proposed+accepted) diverged by 5 pts once a high-risk proposal was
  // accepted — the UI said "siap dikunci" but lock 409'd. Reveal-to-reader
  // protection is enforced downstream by the Reveal Gate / planned_reveals, not
  // by blocking foundation lock.
  const highRiskSecretsInFacts = facts.some(
    (f) => f.category === "secret" && f.source !== "accepted_proposal",
  );
  const secretGuardOk = !highRiskSecretsInFacts;
  checks.push({
    key: "secret_guard",
    label: "Rahasia high-risk tetap aman",
    status: secretGuardOk ? "pass" : "partial",
    reason: secretGuardOk
      ? "Tidak ada rahasia high-risk yang ditulis langsung ke facts."
      : "Rahasia high-risk harus lewat proposal/accept, bukan ditulis langsung ke facts.",
  });
  if (secretGuardOk) score += SUPPORT_WEIGHT;

  score = Math.min(100, Math.max(0, score));
  const readinessLevel = levelFromScore(score);

  const coreKeys = [
    "selected_concept",
    "premise",
    "main_conflict",
    "reader_promise",
    "protagonist",
    "facts",
  ];
  const coreComplete = coreKeys.every((key) => {
    const check = checks.find((c) => c.key === key);
    return check?.status === "pass" || check?.status === "partial";
  });

  const canLock = score >= 75 && coreComplete && conceptSelected;

  const missing = checks
    .filter((c) => c.status === "missing")
    .map((c) => c.label);

  return {
    readinessScore: score,
    readinessLevel,
    canLock,
    checks,
    missing,
  };
}

export async function getFoundationReadinessForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<FoundationReadinessResult> {
  const projectRow = await getOwnedProjectRow(bindings, ownerId, projectId);
  const [foundation, concept, proposals, characters, facts, speechRules, relationshipHeavy] =
    await Promise.all([
      loadFoundationRow(bindings, projectId),
      loadSelectedConcept(bindings, projectRow),
      loadFoundationFlowProposals(bindings, projectId),
      listCharactersForOwner(bindings, ownerId, projectId, false),
      listFactsForOwner(bindings, ownerId, projectId, false),
      listSpeechRulesForOwner(bindings, ownerId, projectId, false),
      loadRelationshipHeavy(bindings, projectId),
    ]);

  const result = computeFoundationReadiness(
    foundation,
    concept,
    proposals,
    characters,
    facts,
    speechRules,
    relationshipHeavy,
    {
      activeStatuses: new Set(["proposed"]),
      acceptedCountsAsReady: false,
      persist: true,
    },
  );

  await persistReadinessToFoundation(
    bindings,
    projectId,
    result.readinessScore,
    result.readinessLevel,
  );

  return result;
}

/** Lock gate readiness — counts accepted proposals as promotion-ready. */
export async function getFoundationLockReadinessForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<FoundationReadinessResult> {
  const projectRow = await getOwnedProjectRow(bindings, ownerId, projectId);
  const [foundation, concept, proposals, characters, facts, speechRules, relationshipHeavy] =
    await Promise.all([
      loadFoundationRow(bindings, projectId),
      loadSelectedConcept(bindings, projectRow),
      loadFoundationFlowProposals(bindings, projectId),
      listCharactersForOwner(bindings, ownerId, projectId, false),
      listFactsForOwner(bindings, ownerId, projectId, false),
      listSpeechRulesForOwner(bindings, ownerId, projectId, false),
      loadRelationshipHeavy(bindings, projectId),
    ]);

  return computeFoundationReadiness(
    foundation,
    concept,
    proposals,
    characters,
    facts,
    speechRules,
    relationshipHeavy,
    {
      activeStatuses: new Set(["proposed", "accepted"]),
      acceptedCountsAsReady: true,
      persist: false,
    },
  );
}