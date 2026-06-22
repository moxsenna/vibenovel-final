import {
  CHAPTER_SUMMARY_STATUSES,
  type ChapterBeat,
  type ChapterOutline,
  type Character,
  type Fact,
  type OpenLoop,
  type RelationshipSpeechRule,
  type TimelineEvent,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapChapterBeatRow,
  mapChapterSummaryRow,
  type ChapterOutlineRow,
  type ChapterSummaryRow,
  type FoundationRow,
  type OutlinePlanRow,
  type PlannedRevealSafeRow,
  type ProjectRow,
  type StoryConceptRow,
  type WritingSessionRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import {
  filterActiveOpenLoops,
  loadWriteContextSnapshot,
} from "./write-snapshot.js";
import { getOwnedWritingSessionRow } from "./write-session.js";

const SUMMARY_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, current_prose_version_ids, status, chapter_number, title, synopsis, mini_victory, emotional_outcome, ending_hook, word_count, summary_version, is_current, safety_flags, metadata, approved_at, created_at, updated_at";

const BEAT_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, beat_number, title, summary, direction, status, emotional_shift, must_include, must_not_include, word_target, stop_condition, sort_order, metadata, created_at, updated_at";

export interface PriorChapterSummaryEntry {
  chapterNumber: number;
  title: string;
  synopsis: string;
}

export interface BeatGenerationSnapshot {
  project: ProjectRow;
  foundation: FoundationRow;
  concept: StoryConceptRow;
  outlinePlan: OutlinePlanRow;
  currentChapter: ChapterOutline;
  writingSession: WritingSessionRow;
  characters: Character[];
  facts: Fact[];
  speechRules: RelationshipSpeechRule[];
  activeOpenLoops: OpenLoop[];
  safePlannedReveals: PlannedRevealSafeRow[];
  priorChapterSummaries: PriorChapterSummaryEntry[];
  pastTimelineEvents: TimelineEvent[];
  existingBeats: ChapterBeat[];
  chapterNumberByOutlineId: Map<string, number>;
}

function chapterOutlineToRow(ch: ChapterOutline): ChapterOutlineRow {
  return {
    id: ch.id,
    project_id: ch.projectId,
    outline_plan_id: ch.outlinePlanId,
    chapter_number: ch.chapterNumber,
    title: ch.title,
    summary: ch.summary,
    purpose: ch.purpose,
    chapter_function: ch.chapterFunction,
    emotional_direction: ch.emotionalDirection,
    hook: ch.hook,
    ending_hook: ch.endingHook,
    mini_victory: ch.miniVictory,
    pov_character_id: ch.povCharacterId,
    mini_arc_id: ch.miniArcId,
    status: ch.status,
    markers: ch.markers,
    metadata: ch.metadata,
    created_at: ch.createdAt,
    updated_at: ch.updatedAt,
  };
}

async function fetchPriorChapterSummaries(
  bindings: AppBindings,
  projectId: string,
  priorOutlineRows: ChapterOutlineRow[],
): Promise<PriorChapterSummaryEntry[]> {
  if (priorOutlineRows.length === 0) {
    return [];
  }

  const outlineIds = priorOutlineRows.map((row) => row.id);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_summaries")
    .select(SUMMARY_SELECT)
    .eq("project_id", projectId)
    .eq("is_current", true)
    .in("chapter_outline_id", outlineIds)
    .in("status", [
      CHAPTER_SUMMARY_STATUSES.generated,
      CHAPTER_SUMMARY_STATUSES.approved,
    ]);

  if (error) {
    console.error("chapter_summaries select for beat snapshot failed");
    throw AppError.internal("Failed to load prior chapter summaries");
  }

  const byOutlineId = new Map<string, ChapterSummaryRow>();
  for (const row of (data ?? []) as ChapterSummaryRow[]) {
    byOutlineId.set(row.chapter_outline_id, row);
  }

  const entries: PriorChapterSummaryEntry[] = [];
  for (const outline of priorOutlineRows) {
    const summaryRow = byOutlineId.get(outline.id);
    if (!summaryRow) {
      continue;
    }
    const summary = mapChapterSummaryRow(summaryRow);
    entries.push({
      chapterNumber: outline.chapter_number,
      title: summary.title,
      synopsis: summary.synopsis,
    });
  }
  return entries;
}

async function fetchExistingBeatsForChapter(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<ChapterBeat[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_beats")
    .select(BEAT_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("chapter_beats select for beat snapshot failed");
    throw AppError.internal("Failed to load existing beats");
  }

  return ((data ?? []) as Parameters<typeof mapChapterBeatRow>[0][]).map(mapChapterBeatRow);
}

export async function loadBeatGenerationSnapshot(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  sessionRow: WritingSessionRow,
): Promise<BeatGenerationSnapshot> {
  const writeSnapshot = await loadWriteContextSnapshot(bindings, ownerId, projectId, {
    chapterOutlineId: sessionRow.chapter_outline_id,
  });

  const priorOutlineRows = writeSnapshot.previousChapters.map(chapterOutlineToRow);

  const [priorChapterSummaries, existingBeats] = await Promise.all([
    fetchPriorChapterSummaries(bindings, projectId, priorOutlineRows),
    fetchExistingBeatsForChapter(bindings, projectId, sessionRow.chapter_outline_id),
  ]);

  const activeOpenLoops = filterActiveOpenLoops(
    writeSnapshot.openLoops,
    writeSnapshot.chapterNumberByOutlineId,
    writeSnapshot.currentChapter.chapterNumber,
  );

  return {
    project: writeSnapshot.project,
    foundation: writeSnapshot.foundation,
    concept: writeSnapshot.concept,
    outlinePlan: writeSnapshot.outlinePlan,
    currentChapter: writeSnapshot.currentChapter,
    writingSession: sessionRow,
    characters: writeSnapshot.characters,
    facts: writeSnapshot.facts,
    speechRules: writeSnapshot.speechRules,
    activeOpenLoops,
    safePlannedReveals: writeSnapshot.plannedReveals,
    priorChapterSummaries,
    pastTimelineEvents: writeSnapshot.pastTimelineEvents,
    existingBeats,
    chapterNumberByOutlineId: writeSnapshot.chapterNumberByOutlineId,
  };
}

export async function loadBeatGenerationSnapshotForSession(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  sessionId: string,
): Promise<BeatGenerationSnapshot> {
  const sessionRow = await getOwnedWritingSessionRow(bindings, ownerId, projectId, sessionId);
  return loadBeatGenerationSnapshot(bindings, ownerId, projectId, sessionRow);
}