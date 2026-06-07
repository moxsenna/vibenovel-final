import {
  CHAPTER_SUMMARY_STATUSES,
  type ChapterSummary,
  type ChapterSummaryItem,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapChapterSummaryItemRow,
  mapChapterSummaryRow,
  type ChapterSummaryItemRow,
  type ChapterSummaryRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";
import {
  generateChapterSummaryStub,
  SUMMARY_GENERATOR_VERSION,
} from "./chapter-summary-generator.js";
import { loadSummaryGenerationSnapshot } from "./summary-snapshot.js";

const SUMMARY_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, current_prose_version_ids, status, chapter_number, title, synopsis, mini_victory, emotional_outcome, ending_hook, word_count, summary_version, is_current, safety_flags, metadata, approved_at, created_at, updated_at";

const ITEM_SELECT =
  "id, project_id, chapter_summary_id, item_type, severity, title, body, related_character_id, related_fact_id, related_open_loop_id, related_reveal_id, metadata, sort_order, created_at, updated_at";

export interface ChapterSummaryListEntry extends ChapterSummary {
  itemCount: number;
}

export interface ChapterSummaryDetail {
  summary: ChapterSummary;
  items: ChapterSummaryItem[];
}

export interface GenerateChapterSummaryResult extends ChapterSummaryDetail {
  created: boolean;
}

export interface ListSummariesQuery {
  chapterOutlineId?: string;
  status?: string;
}

const SUMMARY_STATUS_SET = new Set<string>(Object.values(CHAPTER_SUMMARY_STATUSES));

async function getOwnedSummaryRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
): Promise<ChapterSummaryRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_summaries")
    .select(SUMMARY_SELECT)
    .eq("id", summaryId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("chapter_summaries select by id failed");
    throw AppError.internal("Failed to load chapter summary");
  }
  if (!data) {
    throw AppError.notFound("Chapter summary not found");
  }
  return data as ChapterSummaryRow;
}

async function fetchItemsForSummary(
  bindings: AppBindings,
  projectId: string,
  summaryId: string,
): Promise<ChapterSummaryItem[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_summary_items")
    .select(ITEM_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_summary_id", summaryId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("chapter_summary_items select failed");
    throw AppError.internal("Failed to load chapter summary items");
  }

  return ((data ?? []) as ChapterSummaryItemRow[]).map(mapChapterSummaryItemRow);
}

async function countItemsForSummary(
  bindings: AppBindings,
  projectId: string,
  summaryId: string,
): Promise<number> {
  const admin = createServiceRoleClient(bindings);
  const { count, error } = await admin
    .from("chapter_summary_items")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("chapter_summary_id", summaryId);

  if (error) {
    console.error("chapter_summary_items count failed");
    throw AppError.internal("Failed to count chapter summary items");
  }
  return count ?? 0;
}

async function fetchCurrentSummaryRow(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<ChapterSummaryRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_summaries")
    .select(SUMMARY_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    console.error("chapter_summaries select current failed");
    throw AppError.internal("Failed to load current chapter summary");
  }
  return data as ChapterSummaryRow | null;
}

export async function listSummariesForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  query: ListSummariesQuery,
): Promise<ChapterSummaryListEntry[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  let dbQuery = admin
    .from("chapter_summaries")
    .select(SUMMARY_SELECT)
    .eq("project_id", projectId)
    .order("chapter_number", { ascending: true })
    .order("summary_version", { ascending: false });

  if (query.chapterOutlineId) {
    dbQuery = dbQuery.eq("chapter_outline_id", query.chapterOutlineId);
  }

  if (query.status) {
    if (!SUMMARY_STATUS_SET.has(query.status)) {
      throw AppError.badRequest("status filter is invalid");
    }
    dbQuery = dbQuery.eq("status", query.status);
  } else {
    dbQuery = dbQuery.eq("is_current", true);
  }

  const { data, error } = await dbQuery;
  if (error) {
    console.error("chapter_summaries list failed");
    throw AppError.internal("Failed to list chapter summaries");
  }

  const rows = (data ?? []) as ChapterSummaryRow[];
  const entries: ChapterSummaryListEntry[] = [];

  for (const row of rows) {
    const itemCount = await countItemsForSummary(bindings, projectId, row.id);
    entries.push({
      ...mapChapterSummaryRow(row),
      itemCount,
    });
  }

  return entries;
}

export async function getSummaryDetailForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
): Promise<ChapterSummaryDetail> {
  const row = await getOwnedSummaryRow(bindings, ownerId, projectId, summaryId);
  const items = await fetchItemsForSummary(bindings, projectId, summaryId);
  return {
    summary: mapChapterSummaryRow(row),
    items,
  };
}

export async function getSummaryByChapterForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  chapterOutlineId: string,
): Promise<ChapterSummaryDetail | null> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const row = await fetchCurrentSummaryRow(bindings, projectId, chapterOutlineId);
  if (!row) {
    return null;
  }

  const items = await fetchItemsForSummary(bindings, projectId, row.id);
  return {
    summary: mapChapterSummaryRow(row),
    items,
  };
}

export async function generateChapterSummaryForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<GenerateChapterSummaryResult> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  const chapterOutlineId = body.chapterOutlineId;
  if (typeof chapterOutlineId !== "string" || !chapterOutlineId.trim()) {
    throw AppError.badRequest("chapterOutlineId is required");
  }

  let writingSessionId: string | undefined;
  if (body.writingSessionId !== undefined && body.writingSessionId !== null) {
    if (typeof body.writingSessionId !== "string" || !body.writingSessionId.trim()) {
      throw AppError.badRequest("writingSessionId must be a non-empty string");
    }
    writingSessionId = body.writingSessionId.trim();
  }

  const regenerate = body.regenerate === true;

  await getOwnedProjectRow(bindings, ownerId, projectId);

  const existing = await fetchCurrentSummaryRow(bindings, projectId, chapterOutlineId.trim());

  if (existing && !regenerate) {
    const items = await fetchItemsForSummary(bindings, projectId, existing.id);
    return {
      summary: mapChapterSummaryRow(existing),
      items,
      created: false,
    };
  }

  if (existing?.status === CHAPTER_SUMMARY_STATUSES.approved && regenerate) {
    throw AppError.conflict("Cannot regenerate an approved chapter summary", {
      missing: ["summary_approved"],
    });
  }

  const snapshot = await loadSummaryGenerationSnapshot(
    bindings,
    ownerId,
    projectId,
    chapterOutlineId.trim(),
    writingSessionId,
  );

  const draft = generateChapterSummaryStub(snapshot);
  const admin = createServiceRoleClient(bindings);

  let nextVersion = 1;
  if (regenerate && existing) {
    const { data: maxRow, error: maxError } = await admin
      .from("chapter_summaries")
      .select("summary_version")
      .eq("chapter_outline_id", chapterOutlineId.trim())
      .order("summary_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      console.error("chapter_summaries max version lookup failed");
      throw AppError.internal("Failed to generate chapter summary");
    }
    nextVersion =
      maxRow !== null ? ((maxRow as { summary_version: number }).summary_version + 1) : 1;

    const { error: supersedeError } = await admin
      .from("chapter_summaries")
      .update({
        is_current: false,
        status: CHAPTER_SUMMARY_STATUSES.superseded,
      })
      .eq("project_id", projectId)
      .eq("chapter_outline_id", chapterOutlineId.trim())
      .eq("is_current", true);

    if (supersedeError) {
      console.error("chapter_summaries supersede failed");
      throw AppError.internal("Failed to generate chapter summary");
    }
  }

  const { data: inserted, error: insertError } = await admin
    .from("chapter_summaries")
    .insert({
      project_id: projectId,
      chapter_outline_id: chapterOutlineId.trim(),
      writing_session_id: snapshot.writingSession.id,
      current_prose_version_ids: draft.currentProseVersionIds,
      status: draft.status,
      chapter_number: snapshot.chapterOutline.chapterNumber,
      title: snapshot.chapterOutline.title,
      synopsis: draft.synopsis,
      mini_victory: draft.miniVictory,
      emotional_outcome: draft.emotionalOutcome,
      ending_hook: draft.endingHook,
      word_count: draft.wordCount,
      summary_version: nextVersion,
      is_current: true,
      safety_flags: draft.safetyFlags,
      metadata: {
        ...draft.metadata,
        generatorVersion: SUMMARY_GENERATOR_VERSION,
      },
    })
    .select(SUMMARY_SELECT)
    .single();

  if (insertError || !inserted) {
    console.error("chapter_summaries insert failed");
    throw AppError.internal("Failed to generate chapter summary");
  }

  const summaryRow = inserted as ChapterSummaryRow;

  const itemRows = draft.items.map((item) => ({
    project_id: projectId,
    chapter_summary_id: summaryRow.id,
    item_type: item.itemType,
    severity: item.severity,
    title: item.title,
    body: item.body,
    related_character_id: item.relatedCharacterId ?? null,
    metadata: item.metadata ?? {},
    sort_order: item.sortOrder,
  }));

  const { error: itemsError } = await admin.from("chapter_summary_items").insert(itemRows);
  if (itemsError) {
    console.error("chapter_summary_items insert failed");
    throw AppError.internal("Failed to generate chapter summary");
  }

  const items = await fetchItemsForSummary(bindings, projectId, summaryRow.id);
  return {
    summary: mapChapterSummaryRow(summaryRow),
    items,
    created: true,
  };
}