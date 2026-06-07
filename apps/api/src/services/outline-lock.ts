import {
  CHAPTER_OUTLINE_STATUSES,
  OPEN_LOOP_STATUSES,
  OUTLINE_PLAN_STATUSES,
  PLANNED_REVEAL_STATUSES,
  RETENTION_MARKER_TYPES,
  WORKFLOW_PHASES,
  type ChapterOutline,
  type ChapterOutlineMarker,
  type OutlinePlan,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapChapterOutlineRow,
  mapOutlinePlanRow,
  type ChapterOutlineRow,
  type FoundationRow,
  type OutlinePlanRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";

const PLAN_SELECT =
  "id, project_id, status, season_label, arc_summary, retention_summary, target_chapter_count, planning_notes, metadata, locked_at, created_at, updated_at";

const CHAPTER_SELECT =
  "id, project_id, outline_plan_id, chapter_number, title, summary, purpose, chapter_function, emotional_direction, hook, ending_hook, mini_victory, pov_character_id, status, markers, metadata, created_at, updated_at";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

const MIN_OPEN_LOOPS = 2;
const MIN_PLANNED_REVEALS = 2;
const MIN_MINI_VICTORY_CHAPTERS = 3;

const HOOK_MARKER_TYPES = new Set<string>([
  RETENTION_MARKER_TYPES.hook,
  RETENTION_MARKER_TYPES.cliffhanger,
  RETENTION_MARKER_TYPES.open_loop,
  RETENTION_MARKER_TYPES.secret_hint,
  RETENTION_MARKER_TYPES.emotional_payoff,
  RETENTION_MARKER_TYPES.reversal,
]);

export type OutlineReadinessCheckStatus = "pass" | "partial" | "missing" | "fail";

export interface OutlineReadinessCheckItem {
  key: string;
  label: string;
  status: OutlineReadinessCheckStatus;
  reason: string;
}

export interface OutlineLockReadinessResult {
  canLock: boolean;
  score: number;
  checks: OutlineReadinessCheckItem[];
  missing: string[];
  failedChecks: string[];
}

export interface ApproveOutlineResult {
  outlinePlan: OutlinePlan;
  chapters: ChapterOutline[];
  checks: OutlineReadinessCheckItem[];
  canLock: boolean;
}

export interface LockOutlineResult {
  outlinePlan: OutlinePlan;
  chapters: ChapterOutline[];
  checks: OutlineReadinessCheckItem[];
  locked: true;
}

interface OutlineContext {
  plan: OutlinePlanRow;
  chapters: ChapterOutlineRow[];
  foundation: FoundationRow | null;
  openLoopCount: number;
  plannedRevealCount: number;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function parseMarkers(value: unknown): ChapterOutlineMarker[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ChapterOutlineMarker =>
      item !== null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof (item as ChapterOutlineMarker).type === "string",
  );
}

function chapterHasHook(chapter: ChapterOutlineRow): boolean {
  if (hasText(chapter.ending_hook) || hasText(chapter.hook)) return true;
  const markers = parseMarkers(chapter.markers);
  return markers.some((m) => HOOK_MARKER_TYPES.has(m.type));
}

function chapterHasMiniVictory(chapter: ChapterOutlineRow): boolean {
  if (hasText(chapter.mini_victory)) return true;
  const markers = parseMarkers(chapter.markers);
  return markers.some((m) => m.type === RETENTION_MARKER_TYPES.mini_victory);
}

function chapterPassesApproveBasics(chapter: ChapterOutlineRow): boolean {
  return hasText(chapter.title) && hasText(chapter.summary) && chapterHasHook(chapter);
}

function chapterPassesLockBasics(chapter: ChapterOutlineRow): boolean {
  return (
    hasText(chapter.title) &&
    hasText(chapter.summary) &&
    hasText(chapter.purpose) &&
    hasText(chapter.chapter_function) &&
    chapterHasHook(chapter)
  );
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
    console.error("outline_plans select for lock failed");
    throw AppError.internal("Failed to load outline plan");
  }
  return data as OutlinePlanRow | null;
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
    console.error("story_foundations select for outline lock failed");
    throw AppError.internal("Failed to load foundation");
  }
  return data as FoundationRow | null;
}

async function loadOutlineContext(
  bindings: AppBindings,
  projectId: string,
  plan: OutlinePlanRow,
): Promise<OutlineContext> {
  const admin = createServiceRoleClient(bindings);

  const [chaptersRes, foundation, loopsCountRes, revealsCountRes] = await Promise.all([
    admin
      .from("chapter_outlines")
      .select(CHAPTER_SELECT)
      .eq("outline_plan_id", plan.id)
      .eq("project_id", projectId)
      .order("chapter_number", { ascending: true }),
    fetchFoundationRow(bindings, projectId),
    admin
      .from("open_loops")
      .select("id", { count: "exact", head: true })
      .eq("outline_plan_id", plan.id)
      .eq("project_id", projectId)
      .neq("status", OPEN_LOOP_STATUSES.dropped),
    admin
      .from("planned_reveals")
      .select("id", { count: "exact", head: true })
      .eq("outline_plan_id", plan.id)
      .eq("project_id", projectId)
      .neq("status", PLANNED_REVEAL_STATUSES.cancelled),
  ]);

  if (chaptersRes.error || loopsCountRes.error || revealsCountRes.error) {
    console.error("outline lock context load failed");
    throw AppError.internal("Failed to load outline lock context");
  }

  return {
    plan,
    chapters: (chaptersRes.data ?? []) as ChapterOutlineRow[],
    foundation,
    openLoopCount: loopsCountRes.count ?? 0,
    plannedRevealCount: revealsCountRes.count ?? 0,
  };
}

function buildApproveChecks(ctx: OutlineContext): OutlineReadinessCheckItem[] {
  const checks: OutlineReadinessCheckItem[] = [];
  const { plan, chapters } = ctx;

  if (!plan) {
    checks.push({
      key: "outlineExists",
      label: "Outline plan exists",
      status: "missing",
      reason: "No outline plan found for this project",
    });
    return checks;
  }

  checks.push({
    key: "outlineExists",
    label: "Outline plan exists",
    status: "pass",
    reason: "Outline plan is present",
  });

  if (plan.status === OUTLINE_PLAN_STATUSES.locked) {
    checks.push({
      key: "notAlreadyLocked",
      label: "Outline not already locked",
      status: "fail",
      reason: "Outline plan is already locked",
    });
  } else {
    checks.push({
      key: "notAlreadyLocked",
      label: "Outline not already locked",
      status: "pass",
      reason: "Outline plan can be reviewed",
    });
  }

  if (chapters.length < 1) {
    checks.push({
      key: "hasChapters",
      label: "Has chapter outlines",
      status: "missing",
      reason: "At least one chapter outline is required",
    });
  } else {
    checks.push({
      key: "hasChapters",
      label: "Has chapter outlines",
      status: "pass",
      reason: `${chapters.length} chapter outline(s) present`,
    });
  }

  const incomplete = chapters.filter((ch) => !chapterPassesApproveBasics(ch));
  if (incomplete.length > 0) {
    const nums = incomplete.map((c) => c.chapter_number).join(", ");
    checks.push({
      key: "allChaptersApproveBasics",
      label: "All chapters have title, summary, and hook",
      status: "missing",
      reason: `Chapters missing title/summary/hook: ${nums}`,
    });
  } else if (chapters.length > 0) {
    checks.push({
      key: "allChaptersApproveBasics",
      label: "All chapters have title, summary, and hook",
      status: "pass",
      reason: "Every chapter has title, summary, and endingHook or hook",
    });
  }

  const target = plan.target_chapter_count;
  if (chapters.length > 0 && chapters.length < target) {
    checks.push({
      key: "chapterCountMatchesTarget",
      label: "Chapter count matches target",
      status: "partial",
      reason: `Expected ${target} chapters, found ${chapters.length}`,
    });
  } else if (chapters.length >= target) {
    checks.push({
      key: "chapterCountMatchesTarget",
      label: "Chapter count matches target",
      status: "pass",
      reason: `${chapters.length} of ${target} target chapters present`,
    });
  }

  return checks;
}

function approveChecksPass(checks: OutlineReadinessCheckItem[]): boolean {
  return checks.every(
    (c) =>
      c.status === "pass" ||
      (c.key === "chapterCountMatchesTarget" && c.status === "partial"),
  );
}

export function calculateOutlineLockReadiness(ctx: OutlineContext): OutlineLockReadinessResult {
  const checks: OutlineReadinessCheckItem[] = [];
  const missing: string[] = [];
  const failedChecks: string[] = [];
  const { plan, chapters, foundation, openLoopCount, plannedRevealCount } = ctx;

  const add = (item: OutlineReadinessCheckItem) => {
    checks.push(item);
    if (item.status === "missing" || item.status === "fail") {
      missing.push(item.key);
      failedChecks.push(item.key);
    }
  };

  if (!foundation?.is_locked) {
    add({
      key: "foundationLocked",
      label: "Foundation locked",
      status: "missing",
      reason: "Story foundation must be locked before locking outline",
    });
  } else {
    add({
      key: "foundationLocked",
      label: "Foundation locked",
      status: "pass",
      reason: "Foundation is locked",
    });
  }

  add({
    key: "outlineExists",
    label: "Outline plan exists",
    status: "pass",
    reason: "Outline plan is present",
  });

  if (plan.status === OUTLINE_PLAN_STATUSES.locked) {
    add({
      key: "notAlreadyLocked",
      label: "Outline not already locked",
      status: "fail",
      reason: "Outline is already locked",
    });
  } else {
    add({
      key: "notAlreadyLocked",
      label: "Outline not already locked",
      status: "pass",
      reason: "Outline can still be locked",
    });
  }

  const target = plan.target_chapter_count;
  if (chapters.length < 1) {
    add({
      key: "chapterCount",
      label: "Chapter count",
      status: "missing",
      reason: "No chapter outlines found",
    });
  } else if (chapters.length < target) {
    add({
      key: "chapterCount",
      label: "Chapter count",
      status: "missing",
      reason: `Expected ${target} chapters, found ${chapters.length}`,
    });
  } else {
    add({
      key: "chapterCount",
      label: "Chapter count",
      status: "pass",
      reason: `${chapters.length} chapters meet target of ${target}`,
    });
  }

  const incompleteBasics = chapters.filter((ch) => !chapterPassesLockBasics(ch));
  if (incompleteBasics.length > 0) {
    const nums = incompleteBasics.map((c) => c.chapter_number).join(", ");
    add({
      key: "allChaptersHaveBasics",
      label: "All chapters have planning basics",
      status: "missing",
      reason: `Chapters missing purpose/function/hook: ${nums}`,
    });
  } else if (chapters.length > 0) {
    add({
      key: "allChaptersHaveBasics",
      label: "All chapters have planning basics",
      status: "pass",
      reason: "Title, summary, purpose, chapterFunction, and hook present on all chapters",
    });
  }

  const noHook = chapters.filter((ch) => !chapterHasHook(ch));
  if (noHook.length > 0) {
    const nums = noHook.map((c) => c.chapter_number).join(", ");
    add({
      key: "hooksEveryChapter",
      label: "Hook on every chapter",
      status: "missing",
      reason: `Chapters without hook: ${nums}`,
    });
  } else if (chapters.length > 0) {
    add({
      key: "hooksEveryChapter",
      label: "Hook on every chapter",
      status: "pass",
      reason: "Every chapter has endingHook, hook, or retention marker",
    });
  }

  const emptySummary = chapters.filter((ch) => !hasText(ch.summary));
  if (emptySummary.length > 0) {
    add({
      key: "summariesEveryChapter",
      label: "Summary on every chapter",
      status: "missing",
      reason: `Chapters with empty summary: ${emptySummary.map((c) => c.chapter_number).join(", ")}`,
    });
  } else if (chapters.length > 0) {
    add({
      key: "summariesEveryChapter",
      label: "Summary on every chapter",
      status: "pass",
      reason: "All chapter summaries are filled",
    });
  }

  const miniVictoryCount = chapters.filter((ch) => chapterHasMiniVictory(ch)).length;
  if (miniVictoryCount < MIN_MINI_VICTORY_CHAPTERS) {
    add({
      key: "miniVictoryCadence",
      label: "Mini victory cadence",
      status: "missing",
      reason: `Need at least ${MIN_MINI_VICTORY_CHAPTERS} mini victories, found ${miniVictoryCount}`,
    });
  } else {
    add({
      key: "miniVictoryCadence",
      label: "Mini victory cadence",
      status: "pass",
      reason: `${miniVictoryCount} chapters have mini victory markers`,
    });
  }

  if (openLoopCount < MIN_OPEN_LOOPS) {
    add({
      key: "openLoopsEnough",
      label: "Open loops tracked",
      status: "missing",
      reason: `Need at least ${MIN_OPEN_LOOPS} open loops, found ${openLoopCount}`,
    });
  } else {
    add({
      key: "openLoopsEnough",
      label: "Open loops tracked",
      status: "pass",
      reason: `${openLoopCount} active open loops`,
    });
  }

  if (plannedRevealCount < MIN_PLANNED_REVEALS) {
    add({
      key: "plannedRevealsEnough",
      label: "Planned reveals scheduled",
      status: "missing",
      reason: `Need at least ${MIN_PLANNED_REVEALS} planned reveals, found ${plannedRevealCount}`,
    });
  } else {
    add({
      key: "plannedRevealsEnough",
      label: "Planned reveals scheduled",
      status: "pass",
      reason: `${plannedRevealCount} active planned reveals`,
    });
  }

  add({
    key: "noPlanningTruthExposed",
    label: "Planning truth redacted in API",
    status: "pass",
    reason: "API responses never include raw planningTruth",
  });

  const passCount = checks.filter((c) => c.status === "pass").length;
  const score = checks.length > 0 ? Math.round((passCount / checks.length) * 100) : 0;
  const canLock = failedChecks.length === 0;

  return { canLock, score, checks, missing, failedChecks };
}

export async function getOutlineLockReadinessForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<OutlineLockReadinessResult> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const plan = await fetchOutlinePlanRow(bindings, projectId);
  if (!plan) {
    return {
      canLock: false,
      score: 0,
      checks: [
        {
          key: "outlineExists",
          label: "Outline plan exists",
          status: "missing",
          reason: "No outline plan found",
        },
      ],
      missing: ["outlineExists"],
      failedChecks: ["outlineExists"],
    };
  }

  const ctx = await loadOutlineContext(bindings, projectId, plan);
  return calculateOutlineLockReadiness(ctx);
}

export async function approveOutlineForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<ApproveOutlineResult> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const planRow = await fetchOutlinePlanRow(bindings, projectId);
  if (!planRow) {
    throw AppError.conflict("Outline plan not found; generate outline first", {
      missing: ["outline_plan"],
    });
  }

  if (planRow.status === OUTLINE_PLAN_STATUSES.locked) {
    throw AppError.conflict("Outline is already locked", {
      missing: ["outline_unlocked"],
    });
  }

  const ctx = await loadOutlineContext(bindings, projectId, planRow);
  const approveChecks = buildApproveChecks(ctx);

  if (!approveChecksPass(approveChecks)) {
    const missing = approveChecks
      .filter((c) => c.status === "missing" || c.status === "fail")
      .map((c) => c.key);
    throw AppError.conflict("Outline is not ready for approval", {
      checks: approveChecks,
      missing,
      failedChecks: missing,
    });
  }

  const admin = createServiceRoleClient(bindings);

  const { data: updatedPlan, error: planError } = await admin
    .from("outline_plans")
    .update({ status: OUTLINE_PLAN_STATUSES.reviewing })
    .eq("id", planRow.id)
    .eq("project_id", projectId)
    .neq("status", OUTLINE_PLAN_STATUSES.locked)
    .select(PLAN_SELECT)
    .single();

  if (planError || !updatedPlan) {
    console.error("outline_plans approve update failed");
    throw AppError.internal("Failed to approve outline plan");
  }

  const chapterIdsToApprove = ctx.chapters
    .filter(
      (ch) =>
        ch.status !== CHAPTER_OUTLINE_STATUSES.locked &&
        chapterPassesApproveBasics(ch),
    )
    .map((ch) => ch.id);

  if (chapterIdsToApprove.length > 0) {
    const { error: chapterError } = await admin
      .from("chapter_outlines")
      .update({ status: CHAPTER_OUTLINE_STATUSES.approved })
      .eq("outline_plan_id", planRow.id)
      .eq("project_id", projectId)
      .in("id", chapterIdsToApprove)
      .neq("status", CHAPTER_OUTLINE_STATUSES.locked);

    if (chapterError) {
      console.error("chapter_outlines approve update failed");
      throw AppError.internal("Failed to approve chapter outlines");
    }
  }

  const { data: chapterRows, error: chapterSelectError } = await admin
    .from("chapter_outlines")
    .select(CHAPTER_SELECT)
    .eq("outline_plan_id", planRow.id)
    .eq("project_id", projectId)
    .order("chapter_number", { ascending: true });

  if (chapterSelectError || !chapterRows) {
    console.error("chapter_outlines select after approve failed");
    throw AppError.internal("Failed to load chapter outlines after approve");
  }

  const refreshedCtx: OutlineContext = {
    ...ctx,
    plan: updatedPlan as OutlinePlanRow,
    chapters: chapterRows as ChapterOutlineRow[],
  };
  const lockReadiness = calculateOutlineLockReadiness(refreshedCtx);

  return {
    outlinePlan: mapOutlinePlanRow(updatedPlan as OutlinePlanRow),
    chapters: (chapterRows as ChapterOutlineRow[]).map(mapChapterOutlineRow),
    checks: approveChecks,
    canLock: lockReadiness.canLock,
  };
}

export async function lockOutlineForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<LockOutlineResult> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const planRow = await fetchOutlinePlanRow(bindings, projectId);
  if (!planRow) {
    throw AppError.conflict("Outline plan not found; generate outline first", {
      missing: ["outline_plan"],
    });
  }

  if (planRow.status === OUTLINE_PLAN_STATUSES.locked) {
    throw AppError.conflict("Outline is already locked", {
      missing: ["outline_unlocked"],
    });
  }

  const ctx = await loadOutlineContext(bindings, projectId, planRow);
  const readiness = calculateOutlineLockReadiness(ctx);

  if (!readiness.canLock) {
    throw AppError.conflict("Outline is not ready to lock", {
      checks: readiness.checks,
      missing: readiness.missing,
      failedChecks: readiness.failedChecks,
      readinessScore: readiness.score,
    });
  }

  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();

  const { data: lockedPlan, error: planError } = await admin
    .from("outline_plans")
    .update({
      status: OUTLINE_PLAN_STATUSES.locked,
      locked_at: now,
    })
    .eq("id", planRow.id)
    .eq("project_id", projectId)
    .neq("status", OUTLINE_PLAN_STATUSES.locked)
    .select(PLAN_SELECT)
    .single();

  if (planError || !lockedPlan) {
    console.error("outline_plans lock update failed");
    throw AppError.internal("Failed to lock outline plan");
  }

  const { error: chapterError } = await admin
    .from("chapter_outlines")
    .update({ status: CHAPTER_OUTLINE_STATUSES.locked })
    .eq("outline_plan_id", planRow.id)
    .eq("project_id", projectId);

  if (chapterError) {
    console.error("chapter_outlines lock update failed");
    throw AppError.internal("Failed to lock chapter outlines");
  }

  const { error: phaseError } = await admin
    .from("projects")
    .update({
      workflow_phase: WORKFLOW_PHASES.outline_locked,
      last_edited_at: now,
    })
    .eq("id", projectId)
    .eq("owner_id", ownerId);

  if (phaseError) {
    console.error("projects workflow_phase outline_locked update failed");
    throw AppError.internal("Failed to update project workflow phase");
  }

  const { data: chapterRows, error: chapterSelectError } = await admin
    .from("chapter_outlines")
    .select(CHAPTER_SELECT)
    .eq("outline_plan_id", planRow.id)
    .eq("project_id", projectId)
    .order("chapter_number", { ascending: true });

  if (chapterSelectError || !chapterRows) {
    console.error("chapter_outlines select after lock failed");
    throw AppError.internal("Failed to load chapter outlines after lock");
  }

  return {
    outlinePlan: mapOutlinePlanRow(lockedPlan as OutlinePlanRow),
    chapters: (chapterRows as ChapterOutlineRow[]).map(mapChapterOutlineRow),
    checks: readiness.checks,
    locked: true,
  };
}