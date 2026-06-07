import {
  CHAPTER_EMOTIONS,
  CHAPTER_SUMMARY_ITEM_SEVERITIES,
  CHAPTER_SUMMARY_ITEM_TYPES,
  CHAPTER_SUMMARY_STATUSES,
  type ChapterSummaryItemSeverity,
  type ChapterSummaryItemType,
  type SummarySafetyFlags,
} from "@vibenovel/shared";
import type { SummaryGenerationSnapshot } from "./summary-snapshot.js";
import { assertProseTextsSafeForSummary, assertSummaryTextSafe } from "./summary-safety.js";

export const SUMMARY_GENERATOR_VERSION = "summary_stub_v1";

const SYNOPSIS_MAX = 800;
const ENDING_HOOK_MAX = 300;
const EMOTION_LABELS: Record<string, string> = {
  [CHAPTER_EMOTIONS.hurt]: "Luka dan kepedihan mendalam",
  [CHAPTER_EMOTIONS.tense]: "Ketegangan meningkat",
  [CHAPTER_EMOTIONS.angry]: "Amarah dan konfrontasi",
  [CHAPTER_EMOTIONS.hopeful]: "Harapan mulai muncul",
  [CHAPTER_EMOTIONS.satisfying]: "Kepuasan emosional",
  [CHAPTER_EMOTIONS.curious]: "Rasa penasaran bertambah",
  [CHAPTER_EMOTIONS.anxious]: "Kecemasan dan ketidakpastian",
  [CHAPTER_EMOTIONS.triumphant]: "Kemenangan kecil atau keberanian",
};

export interface GeneratedSummaryItemDraft {
  itemType: ChapterSummaryItemType;
  severity: ChapterSummaryItemSeverity;
  title: string;
  body: string;
  sortOrder: number;
  relatedCharacterId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface GeneratedChapterSummaryDraft {
  synopsis: string;
  miniVictory: string | null;
  emotionalOutcome: string | null;
  endingHook: string | null;
  wordCount: number;
  currentProseVersionIds: string[];
  safetyFlags: SummarySafetyFlags;
  status: typeof CHAPTER_SUMMARY_STATUSES.generated;
  items: GeneratedSummaryItemDraft[];
  metadata: Record<string, unknown>;
}

function truncate(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return match ? match[0].trim() : truncate(trimmed, 200);
}

function buildSynopsis(snapshot: SummaryGenerationSnapshot): string {
  const sentences: string[] = [];
  let totalWords = 0;

  for (const { beat, currentProse } of snapshot.beatProse) {
    if (currentProse?.prose_text) {
      const sentence = firstSentence(currentProse.prose_text);
      if (sentence) sentences.push(sentence);
      totalWords += currentProse.word_count ?? 0;
    } else if (beat.summary) {
      sentences.push(firstSentence(beat.summary));
    }
  }

  if (totalWords > 100 && sentences.length > 0) {
    return truncate(sentences.join(" "), SYNOPSIS_MAX);
  }

  const outlineSummary = snapshot.chapterOutline.summary?.trim();
  if (outlineSummary) {
    return truncate(outlineSummary, SYNOPSIS_MAX);
  }

  return truncate(sentences.join(" ") || "Ringkasan bab belum tersedia.", SYNOPSIS_MAX);
}

function buildEndingHook(snapshot: SummaryGenerationSnapshot): string | null {
  const proseBeats = snapshot.beatProse.filter((bp) => bp.currentProse?.prose_text);
  if (proseBeats.length > 0) {
    const last = proseBeats[proseBeats.length - 1]!;
    const text = last.currentProse!.prose_text.trim();
    const tail = text.length > ENDING_HOOK_MAX ? text.slice(-ENDING_HOOK_MAX) : text;
    const sentence = firstSentence(tail) || truncate(tail, ENDING_HOOK_MAX);
    if (sentence) return truncate(sentence, ENDING_HOOK_MAX);
  }

  const hook = snapshot.chapterOutline.endingHook?.trim();
  return hook ? truncate(hook, ENDING_HOOK_MAX) : null;
}

function buildEmotionalOutcome(snapshot: SummaryGenerationSnapshot): string | null {
  const direction = snapshot.chapterOutline.emotionalDirection;
  if (!direction) return null;
  return EMOTION_LABELS[direction] ?? direction;
}

function buildMiniVictory(snapshot: SummaryGenerationSnapshot): string | null {
  const fromOutline = snapshot.chapterOutline.miniVictory?.trim();
  if (fromOutline) return truncate(fromOutline, 300);

  for (const { beat } of snapshot.beatProse) {
    const hint = beat.mustInclude.find((m) => m.trim().length > 0);
    if (hint) return truncate(hint, 300);
  }
  return null;
}

function buildItems(
  snapshot: SummaryGenerationSnapshot,
  draft: Pick<
    GeneratedChapterSummaryDraft,
    "synopsis" | "miniVictory" | "emotionalOutcome" | "endingHook" | "wordCount" | "safetyFlags"
  >,
): GeneratedSummaryItemDraft[] {
  const items: GeneratedSummaryItemDraft[] = [];
  let order = 0;

  items.push({
    itemType: CHAPTER_SUMMARY_ITEM_TYPES.synopsis,
    severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
    title: "Intisari Bab",
    body: draft.synopsis,
    sortOrder: order++,
  });

  if (draft.miniVictory) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.mini_victory,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: "Mini Victory",
      body: draft.miniVictory,
      sortOrder: order++,
    });
  }

  if (draft.emotionalOutcome) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.emotional_outcome,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: "Hasil Emosional",
      body: draft.emotionalOutcome,
      sortOrder: order++,
    });
  }

  if (draft.endingHook) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.ending_hook,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: "Hook Penutup",
      body: draft.endingHook,
      sortOrder: order++,
    });
  }

  const beatCount = snapshot.beatProse.length;
  const proseBeatCount = snapshot.beatProse.filter((bp) => bp.currentProse).length;
  items.push({
    itemType: CHAPTER_SUMMARY_ITEM_TYPES.continuity_note,
    severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
    title: "Catatan Kontinuitas",
    body: `Bab ${snapshot.chapterOutline.chapterNumber}: ${proseBeatCount}/${beatCount} adegan memiliki naskah, total ${draft.wordCount} kata. Ringkasan stub — tinjau sebelum setujui.`,
    sortOrder: order++,
  });

  const mustIncludeHint = snapshot.beatProse
    .flatMap((bp) => bp.beat.mustInclude)
    .find((m) => m.trim().length > 8);
  if (mustIncludeHint) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.new_fact_candidate,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.warning,
      title: "Kandidat Fakta (Usulan)",
      body: `Beat contract menyebut: ${truncate(mustIncludeHint, 200)}. Belum masuk canon — proposal di Task 6.3.`,
      sortOrder: order++,
      metadata: { proposalDeferred: true, source: "beat_must_include" },
    });
  }

  if (draft.safetyFlags.stubGenerator) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.safety_flag,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: "Generator Stub",
      body: "Ringkasan dibuat deterministik dari naskah + outline — bukan AI production.",
      sortOrder: order++,
    });
  }

  return items;
}

export function generateChapterSummaryStub(
  snapshot: SummaryGenerationSnapshot,
): GeneratedChapterSummaryDraft {
  const proseTexts = snapshot.beatProse
    .map((bp) => bp.currentProse?.prose_text ?? "")
    .filter((t) => t.trim().length > 0);

  assertProseTextsSafeForSummary(proseTexts);

  const currentProseVersionIds = snapshot.beatProse
    .map((bp) => bp.currentProse?.id)
    .filter((id): id is string => Boolean(id));

  const wordCount = snapshot.beatProse.reduce(
    (sum, bp) => sum + (bp.currentProse?.word_count ?? 0),
    0,
  );

  const synopsis = buildSynopsis(snapshot);
  const miniVictory = buildMiniVictory(snapshot);
  const emotionalOutcome = buildEmotionalOutcome(snapshot);
  const endingHook = buildEndingHook(snapshot);

  assertSummaryTextSafe(synopsis);
  if (miniVictory) assertSummaryTextSafe(miniVictory);
  if (emotionalOutcome) assertSummaryTextSafe(emotionalOutcome);
  if (endingHook) assertSummaryTextSafe(endingHook);

  const safetyFlags: SummarySafetyFlags = {
    stubGenerator: true,
    uncertainExtraction: false,
  };

  const partial = {
    synopsis,
    miniVictory,
    emotionalOutcome,
    endingHook,
    wordCount,
    safetyFlags,
  };

  const items = buildItems(snapshot, partial);

  for (const item of items) {
    assertSummaryTextSafe(item.body);
    assertSummaryTextSafe(item.title);
  }

  return {
    ...partial,
    currentProseVersionIds,
    status: CHAPTER_SUMMARY_STATUSES.generated,
    items,
    metadata: {
      generatorVersion: SUMMARY_GENERATOR_VERSION,
      beatCount: snapshot.beatProse.length,
      proseBeatCount: snapshot.beatProse.filter((bp) => bp.currentProse).length,
    },
  };
}