import {
  FACT_IMPORTANCE,
  OPEN_LOOP_STATUSES,
  OUTLINE_PLAN_STATUSES,
  PLANNED_REVEAL_STATUSES,
  REVEAL_RISK_LEVELS,
  type FactImportance,
  type OpenLoop,
  type OpenLoopStatus,
  type PlannedRevealStatus,
  type RevealRiskLevel,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapOpenLoopRow,
  mapPlannedRevealPublic,
  type OpenLoopRow,
  type PlannedRevealPublic,
  type PlannedRevealRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";

const PLAN_SELECT = "id, project_id, status";

interface OutlinePlanRefRow {
  id: string;
  project_id: string;
  status: string;
}

const LOOP_SELECT =
  "id, project_id, outline_plan_id, opened_in_chapter_outline_id, payoff_chapter_outline_id, question, reader_facing_hint, status, importance, metadata, created_at, updated_at";

const REVEAL_SELECT =
  "id, project_id, outline_plan_id, planned_chapter_outline_id, related_fact_id, related_proposal_id, title, planning_truth, reader_facing_hint, forbidden_before_chapter, status, risk_level, metadata, created_at, updated_at";

const LOOP_STATUS_SET = new Set<string>(Object.values(OPEN_LOOP_STATUSES));
const REVEAL_STATUS_SET = new Set<string>(Object.values(PLANNED_REVEAL_STATUSES));
const RISK_LEVEL_SET = new Set<string>(Object.values(REVEAL_RISK_LEVELS));
const IMPORTANCE_SET = new Set<string>(Object.values(FACT_IMPORTANCE));

const FORBIDDEN_BODY_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "outlinePlanId",
  "outline_plan_id",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
]);

const PROSE_FORBIDDEN_KEYS = new Set([
  "chapterText",
  "chapter_text",
  "prose",
  "body",
  "chapterBody",
  "chapter_body",
  "fullOutline",
  "full_outline",
  "outlineDump",
  "outline_dump",
  "full_prompt",
  "fullPrompt",
  "beatText",
  "beat_text",
  "sceneText",
  "scene_text",
]);

const QUESTION_MAX = 500;
const HINT_MAX = 1000;
const TITLE_MAX = 200;
const TRUTH_MAX = 4000;
const METADATA_MAX_BYTES = 4096;

export interface ListOpenLoopsQuery {
  status?: string;
}

export interface ListPlannedRevealsQuery {
  status?: string;
  riskLevel?: string;
}

async function fetchOutlinePlanRow(
  bindings: AppBindings,
  projectId: string,
): Promise<OutlinePlanRefRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("outline_plans")
    .select(PLAN_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("outline_plans select for tracking failed");
    throw AppError.internal("Failed to load outline plan");
  }
  return data as OutlinePlanRefRow | null;
}

function requireOutlinePlan(plan: OutlinePlanRefRow | null): OutlinePlanRefRow {
  if (!plan) {
    throw AppError.notFound("Outline plan not found");
  }
  return plan;
}

function assertNoForbiddenKeys(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_BODY_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be set in request body`);
    }
    if (PROSE_FORBIDDEN_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" is not allowed`);
    }
  }
}

function assertNonEmptyText(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== "string") {
    throw AppError.badRequest(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${field} cannot be empty`);
  }
  if (trimmed.length > maxLen) {
    throw AppError.badRequest(`${field} must be at most ${maxLen} characters`);
  }
  return trimmed;
}

function assertOptionalText(
  value: unknown,
  field: string,
  maxLen: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw AppError.badRequest(`${field} must be a string or null`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) {
    throw AppError.badRequest(`${field} must be at most ${maxLen} characters`);
  }
  return trimmed;
}

function assertOptionalUuid(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) {
    throw AppError.badRequest(`${field} must be a UUID string or null`);
  }
  return value.trim();
}

function assertLightMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw AppError.badRequest("metadata must be a JSON object");
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length > 20) {
    throw AppError.badRequest("metadata must have at most 20 keys");
  }
  const serialized = JSON.stringify(obj);
  if (serialized.length > METADATA_MAX_BYTES) {
    throw AppError.badRequest("metadata is too large");
  }
  for (const key of keys) {
    if (PROSE_FORBIDDEN_KEYS.has(key) || key === "planningTruth" || key === "planning_truth") {
      throw AppError.badRequest(`metadata key "${key}" is not allowed`);
    }
  }
  return obj;
}

function assertPlanEditable(plan: OutlinePlanRefRow): void {
  if (plan.status === OUTLINE_PLAN_STATUSES.locked) {
    throw AppError.conflict("Outline plan is locked; tracking items cannot be modified", {
      missing: ["outline_unlocked"],
    });
  }
}

async function assertChapterOutlineInPlan(
  bindings: AppBindings,
  projectId: string,
  planId: string,
  chapterOutlineId: string,
  fieldName: string,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_outlines")
    .select("id")
    .eq("id", chapterOutlineId)
    .eq("project_id", projectId)
    .eq("outline_plan_id", planId)
    .maybeSingle();

  if (error) {
    console.error("chapter_outlines ref validation failed");
    throw AppError.internal("Failed to validate chapter reference");
  }
  if (!data) {
    throw AppError.notFound(`${fieldName} does not belong to this outline plan`);
  }
}

async function assertFactInProject(
  bindings: AppBindings,
  projectId: string,
  factId: string,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("facts")
    .select("id")
    .eq("id", factId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("facts ref validation failed");
    throw AppError.internal("Failed to validate fact reference");
  }
  if (!data) {
    throw AppError.notFound("relatedFactId does not belong to this project");
  }
}

async function assertProposalInProject(
  bindings: AppBindings,
  projectId: string,
  proposalId: string,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("ai_proposals")
    .select("id")
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("ai_proposals ref validation failed");
    throw AppError.internal("Failed to validate proposal reference");
  }
  if (!data) {
    throw AppError.notFound("relatedProposalId does not belong to this project");
  }
}

async function getOwnedOpenLoopRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  loopId: string,
): Promise<{ loop: OpenLoopRow; plan: OutlinePlanRefRow }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const plan = await fetchOutlinePlanRow(bindings, projectId);
  if (!plan) {
    throw AppError.notFound("Open loop not found");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("open_loops")
    .select(LOOP_SELECT)
    .eq("id", loopId)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .maybeSingle();

  if (error) {
    console.error("open_loops select by id failed");
    throw AppError.internal("Failed to load open loop");
  }
  if (!data) {
    throw AppError.notFound("Open loop not found");
  }

  return { loop: data as OpenLoopRow, plan };
}

async function getOwnedPlannedRevealRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  revealId: string,
): Promise<{ reveal: PlannedRevealRow; plan: OutlinePlanRefRow }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const plan = await fetchOutlinePlanRow(bindings, projectId);
  if (!plan) {
    throw AppError.notFound("Planned reveal not found");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("planned_reveals")
    .select(REVEAL_SELECT)
    .eq("id", revealId)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .maybeSingle();

  if (error) {
    console.error("planned_reveals select by id failed");
    throw AppError.internal("Failed to load planned reveal");
  }
  if (!data) {
    throw AppError.notFound("Planned reveal not found");
  }

  return { reveal: data as PlannedRevealRow, plan };
}

// --- Open loops ---

export async function listOpenLoopsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  query: ListOpenLoopsQuery = {},
): Promise<OpenLoop[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const plan = await fetchOutlinePlanRow(bindings, projectId);
  if (!plan) {
    return [];
  }

  const admin = createServiceRoleClient(bindings);
  let dbQuery = admin
    .from("open_loops")
    .select(LOOP_SELECT)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .order("created_at", { ascending: true });

  if (query.status) {
    if (!LOOP_STATUS_SET.has(query.status)) {
      throw AppError.badRequest("status filter is invalid");
    }
    dbQuery = dbQuery.eq("status", query.status);
  }

  const { data, error } = await dbQuery;
  if (error) {
    console.error("open_loops list failed");
    throw AppError.internal("Failed to list open loops");
  }

  return ((data ?? []) as OpenLoopRow[]).map(mapOpenLoopRow);
}

export async function createOpenLoopForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<OpenLoop> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  assertNoForbiddenKeys(body);

  await getOwnedProjectRow(bindings, ownerId, projectId);
  const plan = requireOutlinePlan(await fetchOutlinePlanRow(bindings, projectId));
  assertPlanEditable(plan);

  if (body.question === undefined) {
    throw AppError.badRequest("question is required");
  }
  const question = assertNonEmptyText(body.question, "question", QUESTION_MAX);

  const readerFacingHint = assertOptionalText(body.readerFacingHint, "readerFacingHint", HINT_MAX);
  const openedInChapterOutlineId = assertOptionalUuid(
    body.openedInChapterOutlineId,
    "openedInChapterOutlineId",
  );
  const payoffChapterOutlineId = assertOptionalUuid(
    body.payoffChapterOutlineId,
    "payoffChapterOutlineId",
  );

  if (openedInChapterOutlineId) {
    await assertChapterOutlineInPlan(
      bindings,
      projectId,
      plan.id,
      openedInChapterOutlineId,
      "openedInChapterOutlineId",
    );
  }
  if (payoffChapterOutlineId) {
    await assertChapterOutlineInPlan(
      bindings,
      projectId,
      plan.id,
      payoffChapterOutlineId,
      "payoffChapterOutlineId",
    );
  }

  let status: OpenLoopStatus = OPEN_LOOP_STATUSES.opened;
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !LOOP_STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
    status = body.status as OpenLoopStatus;
  }

  let importance: FactImportance = FACT_IMPORTANCE.major;
  if (body.importance !== undefined) {
    if (typeof body.importance !== "string" || !IMPORTANCE_SET.has(body.importance)) {
      throw AppError.badRequest("importance is invalid");
    }
    importance = body.importance as FactImportance;
  }

  const metadata = assertLightMetadata(body.metadata) ?? {};

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("open_loops")
    .insert({
      project_id: projectId,
      outline_plan_id: plan.id,
      question,
      reader_facing_hint: readerFacingHint ?? null,
      opened_in_chapter_outline_id: openedInChapterOutlineId ?? null,
      payoff_chapter_outline_id: payoffChapterOutlineId ?? null,
      status,
      importance,
      metadata,
    })
    .select(LOOP_SELECT)
    .single();

  if (error || !data) {
    console.error("open_loops insert failed");
    throw AppError.internal("Failed to create open loop");
  }

  return mapOpenLoopRow(data as OpenLoopRow);
}

export async function updateOpenLoopForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  loopId: string,
  raw: unknown,
): Promise<OpenLoop> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  assertNoForbiddenKeys(body);

  if (Object.keys(body).length === 0) {
    throw AppError.badRequest("No updatable fields provided");
  }

  const { loop: beforeRow, plan } = await getOwnedOpenLoopRow(
    bindings,
    ownerId,
    projectId,
    loopId,
  );
  assertPlanEditable(plan);

  const updates: Record<string, unknown> = {};

  if (body.question !== undefined) {
    updates.question = assertNonEmptyText(body.question, "question", QUESTION_MAX);
  }
  if (body.readerFacingHint !== undefined) {
    updates.reader_facing_hint = assertOptionalText(
      body.readerFacingHint,
      "readerFacingHint",
      HINT_MAX,
    );
  }
  if (body.openedInChapterOutlineId !== undefined) {
    const ref = assertOptionalUuid(body.openedInChapterOutlineId, "openedInChapterOutlineId");
    if (ref) {
      await assertChapterOutlineInPlan(
        bindings,
        projectId,
        plan.id,
        ref,
        "openedInChapterOutlineId",
      );
    }
    updates.opened_in_chapter_outline_id = ref;
  }
  if (body.payoffChapterOutlineId !== undefined) {
    const ref = assertOptionalUuid(body.payoffChapterOutlineId, "payoffChapterOutlineId");
    if (ref) {
      await assertChapterOutlineInPlan(
        bindings,
        projectId,
        plan.id,
        ref,
        "payoffChapterOutlineId",
      );
    }
    updates.payoff_chapter_outline_id = ref;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !LOOP_STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
    updates.status = body.status as OpenLoopStatus;
  }
  if (body.importance !== undefined) {
    if (typeof body.importance !== "string" || !IMPORTANCE_SET.has(body.importance)) {
      throw AppError.badRequest("importance is invalid");
    }
    updates.importance = body.importance as FactImportance;
  }
  if (body.metadata !== undefined) {
    updates.metadata = assertLightMetadata(body.metadata) ?? {};
  }

  if (Object.keys(updates).length === 0) {
    throw AppError.badRequest("No valid updatable fields provided");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("open_loops")
    .update(updates)
    .eq("id", beforeRow.id)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .select(LOOP_SELECT)
    .single();

  if (error || !data) {
    console.error("open_loops update failed");
    throw AppError.internal("Failed to update open loop");
  }

  return mapOpenLoopRow(data as OpenLoopRow);
}

export async function dropOpenLoopForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  loopId: string,
): Promise<OpenLoop> {
  const { loop: beforeRow, plan } = await getOwnedOpenLoopRow(
    bindings,
    ownerId,
    projectId,
    loopId,
  );
  assertPlanEditable(plan);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("open_loops")
    .update({ status: OPEN_LOOP_STATUSES.dropped })
    .eq("id", beforeRow.id)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .select(LOOP_SELECT)
    .single();

  if (error || !data) {
    console.error("open_loops soft delete failed");
    throw AppError.internal("Failed to drop open loop");
  }

  return mapOpenLoopRow(data as OpenLoopRow);
}

// --- Planned reveals ---

export async function listPlannedRevealsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  query: ListPlannedRevealsQuery = {},
): Promise<{ reveals: PlannedRevealPublic[]; planningTruthRedacted: true }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const plan = await fetchOutlinePlanRow(bindings, projectId);
  if (!plan) {
    return { reveals: [], planningTruthRedacted: true };
  }

  const admin = createServiceRoleClient(bindings);
  let dbQuery = admin
    .from("planned_reveals")
    .select(REVEAL_SELECT)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .order("created_at", { ascending: true });

  if (query.status) {
    if (!REVEAL_STATUS_SET.has(query.status)) {
      throw AppError.badRequest("status filter is invalid");
    }
    dbQuery = dbQuery.eq("status", query.status);
  }

  if (query.riskLevel) {
    if (!RISK_LEVEL_SET.has(query.riskLevel)) {
      throw AppError.badRequest("riskLevel filter is invalid");
    }
    dbQuery = dbQuery.eq("risk_level", query.riskLevel);
  }

  const { data, error } = await dbQuery;
  if (error) {
    console.error("planned_reveals list failed");
    throw AppError.internal("Failed to list planned reveals");
  }

  return {
    reveals: ((data ?? []) as PlannedRevealRow[]).map(mapPlannedRevealPublic),
    planningTruthRedacted: true,
  };
}

export async function createPlannedRevealForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<PlannedRevealPublic> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  assertNoForbiddenKeys(body);

  await getOwnedProjectRow(bindings, ownerId, projectId);
  const plan = requireOutlinePlan(await fetchOutlinePlanRow(bindings, projectId));
  assertPlanEditable(plan);

  if (body.title === undefined) {
    throw AppError.badRequest("title is required");
  }
  if (body.planningTruth === undefined) {
    throw AppError.badRequest("planningTruth is required");
  }

  const title = assertNonEmptyText(body.title, "title", TITLE_MAX);
  const planningTruth = assertNonEmptyText(body.planningTruth, "planningTruth", TRUTH_MAX);
  const readerFacingHint = assertOptionalText(body.readerFacingHint, "readerFacingHint", HINT_MAX);
  const plannedChapterOutlineId = assertOptionalUuid(
    body.plannedChapterOutlineId,
    "plannedChapterOutlineId",
  );

  if (plannedChapterOutlineId) {
    await assertChapterOutlineInPlan(
      bindings,
      projectId,
      plan.id,
      plannedChapterOutlineId,
      "plannedChapterOutlineId",
    );
  }

  const relatedFactId = assertOptionalUuid(body.relatedFactId, "relatedFactId");
  if (relatedFactId) {
    await assertFactInProject(bindings, projectId, relatedFactId);
  }

  const relatedProposalId = assertOptionalUuid(body.relatedProposalId, "relatedProposalId");
  if (relatedProposalId) {
    await assertProposalInProject(bindings, projectId, relatedProposalId);
  }

  let forbiddenBeforeChapter: number | null = null;
  if (body.forbiddenBeforeChapter !== undefined) {
    if (body.forbiddenBeforeChapter === null) {
      forbiddenBeforeChapter = null;
    } else if (
      typeof body.forbiddenBeforeChapter !== "number" ||
      !Number.isInteger(body.forbiddenBeforeChapter) ||
      body.forbiddenBeforeChapter <= 0
    ) {
      throw AppError.badRequest("forbiddenBeforeChapter must be a positive integer");
    } else {
      forbiddenBeforeChapter = body.forbiddenBeforeChapter;
    }
  }

  let status: PlannedRevealStatus = PLANNED_REVEAL_STATUSES.planned;
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !REVEAL_STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
    status = body.status as PlannedRevealStatus;
  }

  let riskLevel: RevealRiskLevel = REVEAL_RISK_LEVELS.medium;
  if (body.riskLevel !== undefined) {
    if (typeof body.riskLevel !== "string" || !RISK_LEVEL_SET.has(body.riskLevel)) {
      throw AppError.badRequest("riskLevel is invalid");
    }
    riskLevel = body.riskLevel as RevealRiskLevel;
  }

  const metadata = assertLightMetadata(body.metadata) ?? {};

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("planned_reveals")
    .insert({
      project_id: projectId,
      outline_plan_id: plan.id,
      title,
      planning_truth: planningTruth,
      reader_facing_hint: readerFacingHint ?? null,
      planned_chapter_outline_id: plannedChapterOutlineId ?? null,
      related_fact_id: relatedFactId ?? null,
      related_proposal_id: relatedProposalId ?? null,
      forbidden_before_chapter: forbiddenBeforeChapter,
      status,
      risk_level: riskLevel,
      metadata,
    })
    .select(REVEAL_SELECT)
    .single();

  if (error || !data) {
    console.error("planned_reveals insert failed");
    throw AppError.internal("Failed to create planned reveal");
  }

  return mapPlannedRevealPublic(data as PlannedRevealRow);
}

export async function updatePlannedRevealForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  revealId: string,
  raw: unknown,
): Promise<PlannedRevealPublic> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  assertNoForbiddenKeys(body);

  if (Object.keys(body).length === 0) {
    throw AppError.badRequest("No updatable fields provided");
  }

  const { reveal: beforeRow, plan } = await getOwnedPlannedRevealRow(
    bindings,
    ownerId,
    projectId,
    revealId,
  );
  assertPlanEditable(plan);

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    updates.title = assertNonEmptyText(body.title, "title", TITLE_MAX);
  }
  if (body.planningTruth !== undefined) {
    updates.planning_truth = assertNonEmptyText(body.planningTruth, "planningTruth", TRUTH_MAX);
  }
  if (body.readerFacingHint !== undefined) {
    updates.reader_facing_hint = assertOptionalText(
      body.readerFacingHint,
      "readerFacingHint",
      HINT_MAX,
    );
  }
  if (body.plannedChapterOutlineId !== undefined) {
    const ref = assertOptionalUuid(body.plannedChapterOutlineId, "plannedChapterOutlineId");
    if (ref) {
      await assertChapterOutlineInPlan(
        bindings,
        projectId,
        plan.id,
        ref,
        "plannedChapterOutlineId",
      );
    }
    updates.planned_chapter_outline_id = ref;
  }
  if (body.relatedFactId !== undefined) {
    const ref = assertOptionalUuid(body.relatedFactId, "relatedFactId");
    if (ref) {
      await assertFactInProject(bindings, projectId, ref);
    }
    updates.related_fact_id = ref;
  }
  if (body.relatedProposalId !== undefined) {
    const ref = assertOptionalUuid(body.relatedProposalId, "relatedProposalId");
    if (ref) {
      await assertProposalInProject(bindings, projectId, ref);
    }
    updates.related_proposal_id = ref;
  }
  if (body.forbiddenBeforeChapter !== undefined) {
    if (body.forbiddenBeforeChapter === null) {
      updates.forbidden_before_chapter = null;
    } else if (
      typeof body.forbiddenBeforeChapter !== "number" ||
      !Number.isInteger(body.forbiddenBeforeChapter) ||
      body.forbiddenBeforeChapter <= 0
    ) {
      throw AppError.badRequest("forbiddenBeforeChapter must be a positive integer");
    } else {
      updates.forbidden_before_chapter = body.forbiddenBeforeChapter;
    }
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !REVEAL_STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
    updates.status = body.status as PlannedRevealStatus;
  }
  if (body.riskLevel !== undefined) {
    if (typeof body.riskLevel !== "string" || !RISK_LEVEL_SET.has(body.riskLevel)) {
      throw AppError.badRequest("riskLevel is invalid");
    }
    updates.risk_level = body.riskLevel as RevealRiskLevel;
  }
  if (body.metadata !== undefined) {
    updates.metadata = assertLightMetadata(body.metadata) ?? {};
  }

  if (Object.keys(updates).length === 0) {
    throw AppError.badRequest("No valid updatable fields provided");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("planned_reveals")
    .update(updates)
    .eq("id", beforeRow.id)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .select(REVEAL_SELECT)
    .single();

  if (error || !data) {
    console.error("planned_reveals update failed");
    throw AppError.internal("Failed to update planned reveal");
  }

  return mapPlannedRevealPublic(data as PlannedRevealRow);
}

export async function cancelPlannedRevealForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  revealId: string,
): Promise<PlannedRevealPublic> {
  const { reveal: beforeRow, plan } = await getOwnedPlannedRevealRow(
    bindings,
    ownerId,
    projectId,
    revealId,
  );
  assertPlanEditable(plan);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("planned_reveals")
    .update({ status: PLANNED_REVEAL_STATUSES.cancelled })
    .eq("id", beforeRow.id)
    .eq("project_id", projectId)
    .eq("outline_plan_id", plan.id)
    .select(REVEAL_SELECT)
    .single();

  if (error || !data) {
    console.error("planned_reveals soft delete failed");
    throw AppError.internal("Failed to cancel planned reveal");
  }

  return mapPlannedRevealPublic(data as PlannedRevealRow);
}