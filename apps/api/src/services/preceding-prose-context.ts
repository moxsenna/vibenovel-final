import type { WriterPrecedingProseTail } from "@vibenovel/shared";

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

const PRECEDING_MAX_CODEPOINTS = 900;
