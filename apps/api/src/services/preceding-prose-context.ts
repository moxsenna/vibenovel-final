/* ------------------------------------------------------------------ */
/*  Unicode-safe truncation                                            */
/* ------------------------------------------------------------------ */

/**
 * Take the last `count` Unicode code points from text.
 * Uses Array.from() to correctly handle surrogate pairs.
 */
export function takeLastCodePoints(text: string, count: number): string {
  const chars = Array.from(text);
  if (chars.length <= count) return text;
  return chars.slice(-count).join("");
}

/* ------------------------------------------------------------------ */
/*  Load preceding prose tail interface (DB queries require Supabase)  */
/* ------------------------------------------------------------------ */

export interface LoadPrecedingProseTailInput {
  projectId: string;
  currentChapterOutlineId: string;
  previousChapterOutlineId: string | null;
  previousChapterNumber: number | null;
  currentBeatId: string | null;
  currentBeatNumber: number | null;
  currentChapterNumber: number;
}

export interface PrecedingProseCandidateRow {
  id: string;
  proseText: string;
  isCurrent: boolean;
  chapterOutlineId: string;
  chapterNumber: number;
  beatId: string;
  beatNumber: number;
}

export type PrecedingProseSelectionInput = Omit<
  LoadPrecedingProseTailInput,
  "projectId"
>;

export function selectPrecedingProseTailFromRows(
  rows: PrecedingProseCandidateRow[],
  input: PrecedingProseSelectionInput,
): WriterPrecedingProseTail | null {
  if (!input.currentBeatId || input.currentBeatNumber === null) return null;

  const currentRows = rows.filter((row) => row.isCurrent);
  let selected: PrecedingProseCandidateRow | undefined;
  let sourceType: WriterPrecedingProseTail["sourceType"];

  if (input.currentBeatNumber > 1) {
    selected = currentRows.find(
      (row) =>
        row.chapterOutlineId === input.currentChapterOutlineId &&
        row.beatNumber === input.currentBeatNumber! - 1,
    );
    sourceType = "same_chapter_previous_beat";
  } else {
    if (!input.previousChapterOutlineId || input.previousChapterNumber === null) {
      return null;
    }
    selected = currentRows
      .filter((row) => row.chapterOutlineId === input.previousChapterOutlineId)
      .sort((left, right) => right.beatNumber - left.beatNumber)[0];
    sourceType = "previous_chapter_last_beat";
  }

  if (!selected) return null;
  return {
    text: takeLastCodePoints(selected.proseText, 900),
    sourceChapterNumber: selected.chapterNumber,
    sourceBeatId: selected.beatId,
    sourceVersionId: selected.id,
    sourceType,
  };
}

interface ProseVersionQueryRow {
  id: string;
  prose_text: string;
  is_current: boolean;
  chapter_beats:
    | {
        id: string;
        chapter_outline_id: string;
        beat_number: number;
        chapter_outlines:
          | { chapter_number: number }
          | Array<{ chapter_number: number }>;
      }
    | Array<{
        id: string;
        chapter_outline_id: string;
        beat_number: number;
        chapter_outlines:
          | { chapter_number: number }
          | Array<{ chapter_number: number }>;
      }>;
}

function firstValue<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

export async function loadPrecedingCurrentProseTail(
  bindings: AppBindings,
  input: LoadPrecedingProseTailInput,
): Promise<WriterPrecedingProseTail | null> {
  if (!input.currentBeatId || input.currentBeatNumber === null) return null;

  const chapterIds = [
    input.currentChapterOutlineId,
    input.previousChapterOutlineId,
  ].filter((value): value is string => Boolean(value));

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_prose_versions")
    .select(
      "id, prose_text, is_current, chapter_beats!inner(id, chapter_outline_id, beat_number, chapter_outlines!inner(chapter_number))",
    )
    .eq("project_id", input.projectId)
    .eq("is_current", true)
    .in("chapter_beats.chapter_outline_id", chapterIds);

  if (error) {
    console.error("preceding current prose select failed");
    throw AppError.internal("Failed to load preceding prose context");
  }

  const rows = ((data ?? []) as unknown as ProseVersionQueryRow[]).map((row) => {
    const beat = firstValue(row.chapter_beats);
    const chapter = firstValue(beat.chapter_outlines);
    return {
      id: row.id,
      proseText: row.prose_text,
      isCurrent: row.is_current,
      chapterOutlineId: beat.chapter_outline_id,
      chapterNumber: chapter.chapter_number,
      beatId: beat.id,
      beatNumber: beat.beat_number,
    };
  });

  return selectPrecedingProseTailFromRows(rows, input);
}
import type { WriterPrecedingProseTail } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";
