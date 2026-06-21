import assert from "node:assert/strict";
import {
  CHAPTER_EMOTIONS,
  CHAPTER_FUNCTIONS,
  CHAPTER_SUMMARY_ITEM_TYPES,
  RETENTION_MARKER_TYPES,
} from "@vibenovel/shared";
import {
  buildMiniArcDrafts,
  type ChapterDraft,
} from "../src/services/outline-generator.ts";
import {
  buildPastTimelineSummaries,
  buildTimelineEventDraftFromSummary,
  type TimelineItemInput,
} from "../src/services/timeline.ts";

// --- helpers ---------------------------------------------------------------

function chapter(n: number): ChapterDraft {
  return {
    chapterNumber: n,
    title: `Bab ${n}`,
    summary: `Ringkasan bab ${n}`,
    purpose: `Fungsi naratif bab ${n}`,
    chapterFunction: CHAPTER_FUNCTIONS.conflict,
    emotionalDirection: CHAPTER_EMOTIONS.tense,
    hook: `Hook ${n}`,
    endingHook: `Cliffhanger ${n}`,
    miniVictory: null,
    markers: [{ type: RETENTION_MARKER_TYPES.hook, label: "Hook" }],
  };
}

// --- 17.10: outline generator fills mini-arcs + links chapters to arc ------

{
  const chapters = Array.from({ length: 10 }, (_, i) => chapter(i + 1));
  const arcs = buildMiniArcDrafts(chapters);

  // 10 chapters / size 5 → exactly 2 contiguous arcs covering 1..10.
  assert.equal(arcs.length, 2, "10 chapters should produce 2 mini-arcs");
  assert.equal(arcs[0].startChapter, 1);
  assert.equal(arcs[0].endChapter, 5);
  assert.equal(arcs[1].startChapter, 6);
  assert.equal(arcs[1].endChapter, 10);
  assert.equal(arcs[0].arcNumber, 1);
  assert.equal(arcs[1].arcNumber, 2);

  // Every chapter falls into exactly one arc range (no gaps / overlaps).
  for (const ch of chapters) {
    const owning = arcs.filter(
      (a) => ch.chapterNumber >= a.startChapter && ch.chapterNumber <= a.endChapter,
    );
    assert.equal(owning.length, 1, `chapter ${ch.chapterNumber} must map to exactly one arc`);
  }

  // A short plan still yields one arc.
  assert.equal(buildMiniArcDrafts([chapter(1), chapter(2)]).length, 1);
  assert.equal(buildMiniArcDrafts([]).length, 0);
}

console.log("PASS 17.10 mini-arc grouping is contiguous and covers all chapters");

// --- 17.9 + 17.11: timeline is past/current only (no future leak) ----------

{
  const events = [
    { chapterNumber: 1, event: "Nadira melihat pesan terhapus." },
    { chapterNumber: 2, event: "Senyum akrab di acara keluarga." },
    { chapterNumber: 5, event: "Bukti kecil ditemukan di laci." },
    { chapterNumber: 7, event: "Siska datang ke rumah." }, // future relative to ch 5
  ];

  const past = buildPastTimelineSummaries(events, 5);
  assert.deepEqual(
    past,
    ["Bab 1: Nadira melihat pesan terhapus.", "Bab 2: Senyum akrab di acara keluarga."],
    "only events strictly before the current chapter are included",
  );

  // The current chapter's own event and any future event must never appear.
  assert.ok(
    !past.some((line) => line.startsWith("Bab 5") || line.startsWith("Bab 7")),
    "current/future timeline events must not leak into the writer packet",
  );

  // Cap is respected and keeps the most recent past events.
  const many = Array.from({ length: 20 }, (_, i) => ({
    chapterNumber: i + 1,
    event: `E${i + 1}`,
  }));
  const capped = buildPastTimelineSummaries(many, 20, 3);
  assert.equal(capped.length, 3);
  assert.deepEqual(capped, ["Bab 17: E17", "Bab 18: E18", "Bab 19: E19"]);
}

console.log("PASS 17.9/17.11 timeline summaries are past-only and capped");

// --- 17.4: chapter-close draft derivation ----------------------------------

{
  const items: TimelineItemInput[] = [
    {
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.character_change,
      title: "Nadira",
      body: "Nadira mulai mengamati.",
      relatedCharacterId: "11111111-1111-1111-1111-111111111111",
    },
    {
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.open_loop_opened,
      title: "Pertanyaan Siska",
      body: "Siapa Siska sebenarnya?",
      relatedCharacterId: null,
    },
  ];

  const draft = buildTimelineEventDraftFromSummary(
    { synopsis: "Nadira menemukan bukti pertama.", title: "Bab 6", endingHook: "Tanggal tak cocok." },
    items,
  );
  assert.ok(draft, "draft should be built from a valid summary");
  assert.equal(draft!.event, "Nadira menemukan bukti pertama.");
  assert.deepEqual(draft!.involvedCharacterIds, ["11111111-1111-1111-1111-111111111111"]);
  assert.ok(
    draft!.consequences.includes("Siapa Siska sebenarnya?"),
    "open-loop body becomes a consequence",
  );
  assert.ok(draft!.consequences.includes("Tanggal tak cocok."), "ending hook becomes a consequence");

  // Empty synopsis + empty title → no event.
  assert.equal(
    buildTimelineEventDraftFromSummary({ synopsis: "  ", title: "", endingHook: null }, []),
    null,
  );
}

console.log("PASS 17.4 chapter-close timeline draft derivation");
console.log("ALL PASS sprint17 timeline + mini-arc contracts");
