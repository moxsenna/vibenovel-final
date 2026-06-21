import {
  CHAPTER_SUMMARY_ITEM_TYPES,
  TIMELINE_EVENT_SOURCES,
  type ChapterSummaryItem,
  type TimelineEvent,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import {
  mapTimelineEventRow,
  type ChapterSummaryRow,
  type TimelineEventRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { getOwnedProjectRow } from "./project.js";

const TIMELINE_SELECT =
  "id, project_id, chapter_outline_id, chapter_summary_id, chapter_number, relative_order, event, involved_character_ids, location_id, consequences, source, metadata, created_at, updated_at";

const EVENT_TEXT_MAX = 600;
const CONSEQUENCE_MAX = 300;
const MAX_CONSEQUENCES = 6;
const MAX_INVOLVED = 12;

/** Default cap of past timeline lines injected into the writer Context Packet. */
export const MAX_PACKET_TIMELINE_LINES = 12;

function truncate(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export interface TimelineEventDraft {
  event: string;
  involvedCharacterIds: string[];
  consequences: string[];
}

/**
 * Pure: derive a single chapter-close timeline event from an approved summary
 * and its items. Returns null when the summary has no usable synopsis/title.
 *
 * No future/planner truth is read here — only the chapter's own approved facts.
 */
export interface TimelineSummaryInput {
  synopsis: string;
  title: string;
  endingHook: string | null;
}

export type TimelineItemInput = Pick<
  ChapterSummaryItem,
  "itemType" | "title" | "body" | "relatedCharacterId"
>;

export function buildTimelineEventDraftFromSummary(
  summary: TimelineSummaryInput,
  items: TimelineItemInput[],
): TimelineEventDraft | null {
  const eventText = (summary.synopsis?.trim() || summary.title?.trim() || "").trim();
  if (eventText.length < 3) return null;

  const involved = new Set<string>();
  const consequences: string[] = [];

  for (const item of items) {
    if (item.relatedCharacterId) involved.add(item.relatedCharacterId);

    if (
      item.itemType === CHAPTER_SUMMARY_ITEM_TYPES.open_loop_opened ||
      item.itemType === CHAPTER_SUMMARY_ITEM_TYPES.open_loop_paid_off ||
      item.itemType === CHAPTER_SUMMARY_ITEM_TYPES.relationship_change
    ) {
      const body = (item.body?.trim() || item.title?.trim() || "").trim();
      if (body.length >= 3 && consequences.length < MAX_CONSEQUENCES) {
        consequences.push(truncate(body, CONSEQUENCE_MAX));
      }
    }
  }

  const endingHook = summary.endingHook?.trim();
  if (endingHook && consequences.length < MAX_CONSEQUENCES) {
    consequences.push(truncate(endingHook, CONSEQUENCE_MAX));
  }

  return {
    event: truncate(eventText, EVENT_TEXT_MAX),
    involvedCharacterIds: [...involved].slice(0, MAX_INVOLVED),
    consequences,
  };
}

/**
 * Pure: render past/current timeline events into safe one-line strings for the
 * writer Context Packet. Strictly excludes events at/after the current chapter so
 * no future continuity can leak into prose generation.
 */
export function buildPastTimelineSummaries(
  events: Array<Pick<TimelineEvent, "chapterNumber" | "event">>,
  currentChapterNumber: number,
  max: number = MAX_PACKET_TIMELINE_LINES,
): string[] {
  return events
    .filter((e) => e.chapterNumber < currentChapterNumber)
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .slice(-max)
    .map((e) => `Bab ${e.chapterNumber}: ${e.event}`);
}

/**
 * Idempotent chapter-close materialization. Replaces any existing `chapter_close`
 * event for the chapter (one per project+chapter via partial unique index), so
 * re-approving a summary does not duplicate timeline rows. Best-effort: callers
 * wrap this so a timeline failure never blocks summary approval.
 */
export async function materializeChapterCloseTimelineEvent(
  bindings: AppBindings,
  projectId: string,
  summary: Pick<
    ChapterSummaryRow,
    "id" | "chapter_outline_id" | "chapter_number" | "synopsis" | "title" | "ending_hook"
  >,
  items: ChapterSummaryItem[],
): Promise<TimelineEvent | null> {
  const draft = buildTimelineEventDraftFromSummary(
    { synopsis: summary.synopsis, title: summary.title, endingHook: summary.ending_hook },
    items,
  );
  if (!draft) return null;

  const admin = createServiceRoleClient(bindings);

  const { error: deleteError } = await admin
    .from("timeline_events")
    .delete()
    .eq("project_id", projectId)
    .eq("chapter_number", summary.chapter_number)
    .eq("source", TIMELINE_EVENT_SOURCES.chapter_close);

  if (deleteError) {
    console.error("timeline_events delete (idempotent close) failed");
    throw AppError.internal("Failed to refresh timeline event");
  }

  const { data, error } = await admin
    .from("timeline_events")
    .insert({
      project_id: projectId,
      chapter_outline_id: summary.chapter_outline_id,
      chapter_summary_id: summary.id,
      chapter_number: summary.chapter_number,
      relative_order: summary.chapter_number,
      event: draft.event,
      involved_character_ids: draft.involvedCharacterIds,
      consequences: draft.consequences,
      source: TIMELINE_EVENT_SOURCES.chapter_close,
      metadata: { generator: "timeline_chapter_close_v1" },
    })
    .select(TIMELINE_SELECT)
    .single();

  if (error || !data) {
    console.error("timeline_events insert (chapter close) failed");
    throw AppError.internal("Failed to create timeline event");
  }

  return mapTimelineEventRow(data as TimelineEventRow);
}

/** Owner-scoped timeline list, ordered chronologically (Advanced Mode inspector). */
export async function listTimelineEventsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<TimelineEvent[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("timeline_events")
    .select(TIMELINE_SELECT)
    .eq("project_id", projectId)
    .order("relative_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("timeline_events select for owner failed");
    throw AppError.internal("Failed to load timeline events");
  }

  return ((data ?? []) as TimelineEventRow[]).map(mapTimelineEventRow);
}
