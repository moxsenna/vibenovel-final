import {
  OUTLINE_PLAN_STATUSES,
  WORKFLOW_PHASES,
  type ChapterOutline,
  type OpenLoop,
  type OutlinePlan,
} from "@vibenovel/shared";
import { isAiGenerationEnabled, isAiProviderMock, type AppBindings } from "../env.js";
import {
  mapChapterOutlineRow,
  mapOpenLoopRow,
  mapOutlinePlanRow,
  mapPlannedRevealPublic,
  type ChapterOutlineRow,
  type OpenLoopRow,
  type OutlinePlanRow,
  type PlannedRevealPublic,
  type PlannedRevealRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";
import {
  CHAPTER_STATUS_PLANNED,
  GENERATOR_MARKER,
  OUTLINE_PLAN_STATUS_GENERATED,
  generateOutlineDraft,
  generateOutlineDraftWithAi,
} from "./outline-generator.js";
import { loadOutlineCanonSnapshot } from "./outline-snapshot.js";
import { getOwnedProjectRow } from "./project.js";

const PLAN_SELECT =
  "id, project_id, status, season_label, arc_summary, retention_summary, target_chapter_count, planning_notes, metadata, locked_at, created_at, updated_at";

const CHAPTER_SELECT =
  "id, project_id, outline_plan_id, chapter_number, title, summary, purpose, chapter_function, emotional_direction, hook, ending_hook, mini_victory, pov_character_id, status, markers, metadata, created_at, updated_at";

const LOOP_SELECT =
  "id, project_id, outline_plan_id, opened_in_chapter_outline_id, payoff_chapter_outline_id, question, reader_facing_hint, status, importance, metadata, created_at, updated_at";

const REVEAL_SELECT =
  "id, project_id, outline_plan_id, planned_chapter_outline_id, related_fact_id, related_proposal_id, title, planning_truth, reader_facing_hint, forbidden_before_chapter, status, risk_level, metadata, created_at, updated_at";

const FORBIDDEN_BODY_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "outlinePlanId",
  "outline_plan_id",
  "planningTruth",
  "planning_truth",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
]);

const TARGET_CHAPTER_MIN = 1;
const TARGET_CHAPTER_MAX = 50;

export interface OutlineBundle {
  outlinePlan: OutlinePlan | null;
  chapterOutlines: ChapterOutline[];
  openLoops: OpenLoop[];
  plannedReveals: PlannedRevealPublic[];
  planningTruthRedacted: true;
}

export interface GenerateOutlineResult extends OutlineBundle {
  created: boolean;
  regenerated: boolean;
}

async function fetchOutlinePlanRow(
  bindings: AppBindings,
  projectId: string,
): Promise<OutlinePlanRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("outline_plans")
    .select(PLAN_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("outline_plans select failed");
    throw AppError.internal("Failed to load outline plan");
  }
  return data as OutlinePlanRow | null;
}

async function countChapterOutlines(
  bindings: AppBindings,
  planId: string,
): Promise<number> {
  const admin = createServiceRoleClient(bindings);
  const { count, error } = await admin
    .from("chapter_outlines")
    .select("id", { count: "exact", head: true })
    .eq("outline_plan_id", planId);

  if (error) {
    console.error("chapter_outlines count failed");
    throw AppError.internal("Failed to count chapter outlines");
  }
  return count ?? 0;
}

async function loadOutlineBundleRows(
  bindings: AppBindings,
  planRow: OutlinePlanRow | null,
): Promise<OutlineBundle> {
  if (!planRow) {
    return {
      outlinePlan: null,
      chapterOutlines: [],
      openLoops: [],
      plannedReveals: [],
      planningTruthRedacted: true,
    };
  }

  const admin = createServiceRoleClient(bindings);
  const planId = planRow.id;

  const [chaptersRes, loopsRes, revealsRes] = await Promise.all([
    admin
      .from("chapter_outlines")
      .select(CHAPTER_SELECT)
      .eq("outline_plan_id", planId)
      .order("chapter_number", { ascending: true }),
    admin.from("open_loops").select(LOOP_SELECT).eq("outline_plan_id", planId).order("created_at"),
    admin
      .from("planned_reveals")
      .select(REVEAL_SELECT)
      .eq("outline_plan_id", planId)
      .order("created_at"),
  ]);

  if (chaptersRes.error || loopsRes.error || revealsRes.error) {
    console.error("outline bundle load failed");
    throw AppError.internal("Failed to load outline bundle");
  }

  return {
    outlinePlan: mapOutlinePlanRow(planRow),
    chapterOutlines: ((chaptersRes.data ?? []) as ChapterOutlineRow[]).map(mapChapterOutlineRow),
    openLoops: ((loopsRes.data ?? []) as OpenLoopRow[]).map(mapOpenLoopRow),
    plannedReveals: ((revealsRes.data ?? []) as PlannedRevealRow[]).map(mapPlannedRevealPublic),
    planningTruthRedacted: true,
  };
}

export async function getOutlineBundleForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<OutlineBundle> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const planRow = await fetchOutlinePlanRow(bindings, projectId);
  return loadOutlineBundleRows(bindings, planRow);
}

function assertGenerateInput(raw: unknown): {
  targetChapterCount: number;
  regenerate: boolean;
  seasonLabel?: string;
  arcSummary?: string;
} {
  if (raw === undefined || raw === null) {
    return { targetChapterCount: 10, regenerate: false };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_BODY_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" is not allowed in request body`);
    }
  }

  let targetChapterCount = 10;
  if (body.targetChapterCount !== undefined) {
    if (
      typeof body.targetChapterCount !== "number" ||
      !Number.isInteger(body.targetChapterCount)
    ) {
      throw AppError.badRequest("targetChapterCount must be an integer");
    }
    if (
      body.targetChapterCount < TARGET_CHAPTER_MIN ||
      body.targetChapterCount > TARGET_CHAPTER_MAX
    ) {
      throw AppError.badRequest(
        `targetChapterCount must be between ${TARGET_CHAPTER_MIN} and ${TARGET_CHAPTER_MAX}`,
      );
    }
    targetChapterCount = body.targetChapterCount;
  }

  let regenerate = false;
  if (body.regenerate !== undefined) {
    if (typeof body.regenerate !== "boolean") {
      throw AppError.badRequest("regenerate must be a boolean");
    }
    regenerate = body.regenerate;
  }

  const seasonLabel =
    body.seasonLabel !== undefined
      ? typeof body.seasonLabel === "string"
        ? body.seasonLabel.trim().slice(0, 200) || undefined
        : (() => {
            throw AppError.badRequest("seasonLabel must be a string");
          })()
      : undefined;

  const arcSummary =
    body.arcSummary !== undefined
      ? typeof body.arcSummary === "string"
        ? body.arcSummary.trim().slice(0, 4000) || undefined
        : (() => {
            throw AppError.badRequest("arcSummary must be a string");
          })()
      : undefined;

  return { targetChapterCount, regenerate, seasonLabel, arcSummary };
}

async function deleteOutlineChildren(
  bindings: AppBindings,
  planId: string,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);

  const { error: loopsError } = await admin.from("open_loops").delete().eq("outline_plan_id", planId);
  if (loopsError) {
    console.error("open_loops delete failed");
    throw AppError.internal("Failed to clear open loops");
  }

  const { error: revealsError } = await admin
    .from("planned_reveals")
    .delete()
    .eq("outline_plan_id", planId);
  if (revealsError) {
    console.error("planned_reveals delete failed");
    throw AppError.internal("Failed to clear planned reveals");
  }

  const { error: chaptersError } = await admin
    .from("chapter_outlines")
    .delete()
    .eq("outline_plan_id", planId);
  if (chaptersError) {
    console.error("chapter_outlines delete failed");
    throw AppError.internal("Failed to clear chapter outlines");
  }
}

function findProtagonistId(snapshot: Awaited<ReturnType<typeof loadOutlineCanonSnapshot>>): string | null {
  const protagonist = snapshot.characters.find((c) => c.role === "protagonist");
  return protagonist?.id ?? snapshot.characters[0]?.id ?? null;
}

async function persistOutlineDraft(
  bindings: AppBindings,
  projectId: string,
  planId: string | null,
  snapshot: Awaited<ReturnType<typeof loadOutlineCanonSnapshot>>,
  draft: ReturnType<typeof generateOutlineDraft>,
): Promise<OutlinePlanRow> {
  const admin = createServiceRoleClient(bindings);
  const povCharacterId = findProtagonistId(snapshot);

  const planPayload = {
    project_id: projectId,
    status: OUTLINE_PLAN_STATUS_GENERATED,
    season_label: draft.seasonLabel,
    arc_summary: draft.arcSummary,
    retention_summary: draft.retentionSummary,
    target_chapter_count: draft.chapters.length,
    planning_notes: draft.planningNotes,
    metadata: {
      generator: GENERATOR_MARKER,
      conceptId: snapshot.concept.id,
      conceptTitle: snapshot.concept.title,
    },
  };

  let planRow: OutlinePlanRow;

  if (planId) {
    const { data, error } = await admin
      .from("outline_plans")
      .update(planPayload)
      .eq("id", planId)
      .select(PLAN_SELECT)
      .single();

    if (error || !data) {
      console.error("outline_plans update failed");
      throw AppError.internal("Failed to update outline plan");
    }
    planRow = data as OutlinePlanRow;
  } else {
    const { data, error } = await admin
      .from("outline_plans")
      .insert(planPayload)
      .select(PLAN_SELECT)
      .single();

    if (error || !data) {
      console.error("outline_plans insert failed");
      throw AppError.internal("Failed to create outline plan");
    }
    planRow = data as OutlinePlanRow;
  }

  const chapterRows = draft.chapters.map((ch) => ({
    project_id: projectId,
    outline_plan_id: planRow.id,
    chapter_number: ch.chapterNumber,
    title: ch.title,
    summary: ch.summary,
    purpose: ch.purpose,
    chapter_function: ch.chapterFunction,
    emotional_direction: ch.emotionalDirection,
    hook: ch.hook,
    ending_hook: ch.endingHook,
    mini_victory: ch.miniVictory,
    pov_character_id: povCharacterId,
    status: CHAPTER_STATUS_PLANNED,
    markers: ch.markers,
    metadata: { generator: GENERATOR_MARKER },
  }));

  const { data: insertedChapters, error: chapterError } = await admin
    .from("chapter_outlines")
    .insert(chapterRows)
    .select("id, chapter_number");

  if (chapterError || !insertedChapters) {
    console.error("chapter_outlines insert failed");
    throw AppError.internal("Failed to create chapter outlines");
  }

  const chapterIdByNumber = new Map<number, string>();
  for (const row of insertedChapters as Array<{ id: string; chapter_number: number }>) {
    chapterIdByNumber.set(row.chapter_number, row.id);
  }

  const loopRows = draft.openLoops.map((loop) => ({
    project_id: projectId,
    outline_plan_id: planRow.id,
    opened_in_chapter_outline_id:
      chapterIdByNumber.get(loop.openedChapterNumber) ?? null,
    payoff_chapter_outline_id:
      loop.payoffChapterNumber !== null
        ? (chapterIdByNumber.get(loop.payoffChapterNumber) ?? null)
        : null,
    question: loop.question,
    reader_facing_hint: loop.readerFacingHint,
    status: loop.status,
    importance: loop.importance,
    metadata: { generator: GENERATOR_MARKER },
  }));

  const { error: loopError } = await admin.from("open_loops").insert(loopRows);
  if (loopError) {
    console.error("open_loops insert failed");
    throw AppError.internal("Failed to create open loops");
  }

  const revealRows = draft.plannedReveals.map((reveal) => ({
    project_id: projectId,
    outline_plan_id: planRow.id,
    planned_chapter_outline_id:
      reveal.plannedChapterNumber !== null
        ? (chapterIdByNumber.get(reveal.plannedChapterNumber) ?? null)
        : null,
    related_fact_id: reveal.relatedFactId,
    related_proposal_id: reveal.relatedProposalId,
    title: reveal.title,
    planning_truth: reveal.planningTruth,
    reader_facing_hint: reveal.readerFacingHint,
    forbidden_before_chapter: reveal.forbiddenBeforeChapter,
    status: reveal.status,
    risk_level: reveal.riskLevel,
    metadata: { generator: GENERATOR_MARKER },
  }));

  const { error: revealError } = await admin.from("planned_reveals").insert(revealRows);
  if (revealError) {
    console.error("planned_reveals insert failed");
    throw AppError.internal("Failed to create planned reveals");
  }

  return planRow;
}

async function maybeAdvanceWorkflowPhase(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<void> {
  const project = await getOwnedProjectRow(bindings, ownerId, projectId);
  if (project.workflow_phase !== WORKFLOW_PHASES.foundation_locked) {
    return;
  }

  const admin = createServiceRoleClient(bindings);
  const { error } = await admin
    .from("projects")
    .update({
      workflow_phase: WORKFLOW_PHASES.outline,
      last_edited_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("owner_id", ownerId);

  if (error) {
    console.error("projects workflow_phase update failed");
    throw AppError.internal("Failed to update workflow phase");
  }

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "project_updated",
    entityType: "project",
    entityId: projectId,
    metadata: {
      changedFields: ["workflowPhase"],
      workflowPhase: WORKFLOW_PHASES.outline,
      reason: "outline_generated",
    },
  });
}

export async function generateOutlineForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<GenerateOutlineResult> {
  const input = assertGenerateInput(raw);
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const existingPlan = await fetchOutlinePlanRow(bindings, projectId);

  if (!input.regenerate && existingPlan) {
    const chapterCount = await countChapterOutlines(bindings, existingPlan.id);
    if (chapterCount > 0) {
      const bundle = await loadOutlineBundleRows(bindings, existingPlan);
      return { ...bundle, created: false, regenerated: false };
    }
  }

  if (input.regenerate && existingPlan?.status === OUTLINE_PLAN_STATUSES.locked) {
    throw AppError.conflict("Outline plan is locked; cannot regenerate", {
      missing: ["outline_unlocked"],
    });
  }

  const snapshot = await loadOutlineCanonSnapshot(bindings, ownerId, projectId);

  if (input.regenerate && existingPlan) {
    await deleteOutlineChildren(bindings, existingPlan.id);
  }

  // Real AI when generation is enabled and not in provider-mock mode; the
  // deterministic stub remains the honest AI-off/offline fallback.
  const useAi = isAiGenerationEnabled(bindings) && !isAiProviderMock(bindings);
  const draft = useAi
    ? await generateOutlineDraftWithAi(bindings, ownerId, projectId, snapshot, {
        targetChapterCount: input.targetChapterCount,
        seasonLabel: input.seasonLabel,
        arcSummary: input.arcSummary,
      })
    : generateOutlineDraft(snapshot, {
        targetChapterCount: input.targetChapterCount,
        seasonLabel: input.seasonLabel,
        arcSummary: input.arcSummary,
      });

  const planRow = await persistOutlineDraft(
    bindings,
    projectId,
    existingPlan?.id ?? null,
    snapshot,
    draft,
  );

  await maybeAdvanceWorkflowPhase(bindings, ownerId, projectId);

  const bundle = await loadOutlineBundleRows(bindings, planRow);
  return {
    ...bundle,
    created: !existingPlan,
    regenerated: Boolean(input.regenerate && existingPlan),
  };
}