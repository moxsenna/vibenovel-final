import {
  CHAPTER_SUMMARY_STATUSES,
  CHAPTER_WRITING_STATUSES,
  type PublishPackageSnapshot,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapChapterOutlineRow,
  type ChapterOutlineRow,
  type ChapterProseVersionRow,
  type ChapterSummaryRow,
  type ChapterWritingStateRow,
  type FoundationRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";
import { assertProseExcerptSafe } from "./publish-safety.js";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

const CHAPTER_SELECT =
  "id, project_id, outline_plan_id, chapter_number, title, summary, purpose, chapter_function, emotional_direction, hook, ending_hook, mini_victory, pov_character_id, status, markers, metadata, created_at, updated_at";

const SUMMARY_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, current_prose_version_ids, status, chapter_number, title, synopsis, mini_victory, emotional_outcome, ending_hook, word_count, summary_version, is_current, safety_flags, metadata, approved_at, created_at, updated_at";

const WRITING_STATE_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, status, word_count, last_saved_at, metadata, created_at, updated_at";

const PROSE_SELECT =
  "id, project_id, chapter_beat_id, version_number, prose_text, word_count, source, is_current, context_packet_log_id, metadata, created_at";

const BEAT_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, beat_number, title, summary, direction, status, emotional_shift, must_include, must_not_include, word_target, stop_condition, sort_order, metadata, created_at, updated_at";

const EXCERPT_MAX = 280;

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return match ? match[0].trim() : trimmed.slice(0, EXCERPT_MAX);
}

function truncate(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
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
    console.error("story_foundations select for publish snapshot failed");
    throw AppError.internal("Failed to load foundation");
  }
  return data as FoundationRow | null;
}

async function fetchChapterOutlineRow(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<ChapterOutlineRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_outlines")
    .select(CHAPTER_SELECT)
    .eq("project_id", projectId)
    .eq("id", chapterOutlineId)
    .maybeSingle();

  if (error) {
    console.error("chapter_outlines select for publish snapshot failed");
    throw AppError.internal("Failed to load chapter outline");
  }
  if (!data) {
    throw AppError.notFound("Chapter outline not found");
  }
  return data as ChapterOutlineRow;
}

async function fetchNextChapterOutlineRow(
  bindings: AppBindings,
  projectId: string,
  outlinePlanId: string,
  chapterNumber: number,
): Promise<ChapterOutlineRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_outlines")
    .select(CHAPTER_SELECT)
    .eq("project_id", projectId)
    .eq("outline_plan_id", outlinePlanId)
    .eq("chapter_number", chapterNumber + 1)
    .maybeSingle();

  if (error) {
    console.error("chapter_outlines select next chapter failed");
    throw AppError.internal("Failed to load next chapter outline");
  }
  return data as ChapterOutlineRow | null;
}

async function fetchApprovedSummaryRow(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
  chapterSummaryId?: string,
): Promise<ChapterSummaryRow> {
  const admin = createServiceRoleClient(bindings);
  let query = admin.from("chapter_summaries").select(SUMMARY_SELECT).eq("project_id", projectId);

  if (chapterSummaryId) {
    query = query.eq("id", chapterSummaryId);
  } else {
    query = query
      .eq("chapter_outline_id", chapterOutlineId)
      .eq("is_current", true)
      .eq("status", CHAPTER_SUMMARY_STATUSES.approved);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("chapter_summaries select for publish snapshot failed");
    throw AppError.internal("Failed to load chapter summary");
  }

  if (!data) {
    throw AppError.conflict("Approved chapter summary is required for publish package", {
      missing: ["summary_approved", "current_summary_required"],
    });
  }

  const row = data as ChapterSummaryRow;
  const missing: string[] = [];

  if (row.status !== CHAPTER_SUMMARY_STATUSES.approved) {
    missing.push("summary_approved");
  }
  if (!row.is_current) {
    missing.push("current_summary_required");
  }
  if (row.chapter_outline_id !== chapterOutlineId) {
    throw AppError.badRequest("chapterSummaryId does not match chapterOutlineId");
  }

  if (missing.length > 0) {
    throw AppError.conflict("Approved chapter summary is required for publish package", {
      missing: [...new Set(missing)],
    });
  }

  return row;
}

async function fetchWritingStateRow(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<ChapterWritingStateRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_writing_states")
    .select(WRITING_STATE_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .maybeSingle();

  if (error) {
    console.error("chapter_writing_states select for publish snapshot failed");
    throw AppError.internal("Failed to load chapter writing state");
  }

  if (!data || (data as ChapterWritingStateRow).status !== CHAPTER_WRITING_STATUSES.summarized) {
    throw AppError.conflict("Chapter must be summarized before publish package generation", {
      missing: ["chapter_summarized"],
    });
  }

  return data as ChapterWritingStateRow;
}

async function fetchProseExcerpts(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
  proseVersionIds: string[],
): Promise<{ excerpts: PublishPackageSnapshot["proseExcerpts"]; proseVersionIdsUsed: string[] }> {
  const admin = createServiceRoleClient(bindings);

  const { data: beatRows, error: beatsError } = await admin
    .from("chapter_beats")
    .select(BEAT_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .order("sort_order", { ascending: true })
    .order("beat_number", { ascending: true });

  if (beatsError) {
    console.error("chapter_beats select for publish snapshot failed");
    throw AppError.internal("Failed to load chapter beats");
  }

  const beats = beatRows ?? [];
  const beatIds = beats.map((b) => (b as { id: string }).id);

  let proseRows: ChapterProseVersionRow[] = [];
  if (beatIds.length > 0) {
    let proseQuery = admin
      .from("chapter_prose_versions")
      .select(PROSE_SELECT)
      .eq("project_id", projectId)
      .eq("is_current", true)
      .in("chapter_beat_id", beatIds);

    if (proseVersionIds.length > 0) {
      proseQuery = proseQuery.in("id", proseVersionIds);
    }

    const { data, error } = await proseQuery;
    if (error) {
      console.error("chapter_prose_versions select for publish snapshot failed");
      throw AppError.internal("Failed to load prose excerpts");
    }
    proseRows = (data ?? []) as ChapterProseVersionRow[];
  }

  const proseByBeat = new Map<string, ChapterProseVersionRow>();
  for (const row of proseRows) {
    proseByBeat.set(row.chapter_beat_id, row);
  }

  const excerpts: PublishPackageSnapshot["proseExcerpts"] = [];
  const proseVersionIdsUsed: string[] = [];

  for (const beat of beats) {
    const beatRow = beat as { id: string; beat_number: number };
    const prose = proseByBeat.get(beatRow.id);
    if (!prose?.prose_text?.trim()) continue;

    const sentence = truncate(firstSentence(prose.prose_text), EXCERPT_MAX);
    assertProseExcerptSafe(sentence);
    excerpts.push({
      beatNumber: beatRow.beat_number,
      firstSentence: sentence,
      wordCount: prose.word_count ?? 0,
    });
    proseVersionIdsUsed.push(prose.id);
  }

  return { excerpts, proseVersionIdsUsed };
}

export async function loadPublishGenerationSnapshot(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  chapterOutlineId: string,
  chapterSummaryId?: string,
): Promise<{ snapshot: PublishPackageSnapshot; proseVersionIdsUsed: string[] }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const [chapterRow, summaryRow, foundation] = await Promise.all([
    fetchChapterOutlineRow(bindings, projectId, chapterOutlineId),
    fetchApprovedSummaryRow(bindings, projectId, chapterOutlineId, chapterSummaryId),
    fetchFoundationRow(bindings, projectId),
  ]);

  await fetchWritingStateRow(bindings, projectId, chapterOutlineId);

  const nextChapterRow = await fetchNextChapterOutlineRow(
    bindings,
    projectId,
    chapterRow.outline_plan_id,
    chapterRow.chapter_number,
  );

  const { excerpts, proseVersionIdsUsed } = await fetchProseExcerpts(
    bindings,
    projectId,
    chapterOutlineId,
    summaryRow.current_prose_version_ids ?? [],
  );

  const nextMapped = nextChapterRow ? mapChapterOutlineRow(nextChapterRow) : null;

  const snapshot: PublishPackageSnapshot = {
    approvedSummaryId: summaryRow.id,
    chapterOutlineId: chapterRow.id,
    chapterNumber: summaryRow.chapter_number,
    chapterTitle: summaryRow.title || chapterRow.title,
    synopsis: summaryRow.synopsis,
    miniVictory: summaryRow.mini_victory,
    emotionalOutcome: summaryRow.emotional_outcome,
    endingHook: summaryRow.ending_hook,
    proseExcerpts: excerpts,
    nextChapterSlice: nextMapped
      ? {
          chapterNumber: nextMapped.chapterNumber,
          title: nextMapped.title,
          hook: nextMapped.hook,
          endingHook: nextMapped.endingHook,
        }
      : null,
    genre: foundation?.genre ?? null,
    styleTags: Array.isArray(foundation?.style_tags)
      ? (foundation!.style_tags as string[])
      : [],
  };

  return { snapshot, proseVersionIdsUsed };
}