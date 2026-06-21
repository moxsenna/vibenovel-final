/**
 * Preceding Prose Context — contract tests.
 *
 * Verifikasi selection logic, truncation, dan safety untuk preceding prose tail.
 *
 * Run: npm run test:preceding-prose-context -w @vibenovel/api
 */
import assert from "node:assert/strict";
import {
  selectPrecedingProseTailFromRows,
  takeLastCodePoints,
} from "../src/services/preceding-prose-context.js";
import { assertProseTextSafe } from "../src/services/prose-text-safety.js";
import type { WriterPrecedingProseTail } from "@vibenovel/shared";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    if (e instanceof assert.AssertionError) {
      console.log(`      ${e.message}`);
    } else {
      console.error(`      ${e}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  1. Unicode truncation to 900 code points                           */
/* ------------------------------------------------------------------ */

test("takeLastCodePoints returns last n code points", () => {
  const text = "abcdefghij";
  assert.equal(takeLastCodePoints(text, 3), "hij");
});

test("takeLastCodePoints handles Unicode multi-byte characters", () => {
  const text = "abc😀def";
  assert.equal(takeLastCodePoints(text, 3), "def");
});

test("takeLastCodePoints returns full text when shorter than limit", () => {
  const text = "short";
  assert.equal(takeLastCodePoints(text, 900), "short");
});

test("takeLastCodePoints handles empty string", () => {
  assert.equal(takeLastCodePoints("", 900), "");
});

test("takeLastCodePoints handles surrogate pairs correctly", () => {
  const emoji = "😀😁😂🤣😃";
  const result = takeLastCodePoints(emoji, 3);
  // Should return 3 Unicode code points (not 6 UTF-16 code units)
  assert.equal(Array.from(result).length, 3);
  assert.equal(result, "😂🤣😃");
});

/* ------------------------------------------------------------------ */
/*  2. WriterPrecedingProseTail type                                   */
/* ------------------------------------------------------------------ */

test("WriterPrecedingProseTail has correct shape", () => {
  const tail: WriterPrecedingProseTail = {
    text: "She walked through the door.",
    sourceChapterNumber: 4,
    sourceBeatId: "beat-2",
    sourceVersionId: "ver-123",
    sourceType: "same_chapter_previous_beat",
  };
  assert.equal(tail.sourceType, "same_chapter_previous_beat");
  assert.equal(tail.sourceChapterNumber, 4);
  assert.equal(tail.text, "She walked through the door.");
});

const proseRows = [
  {
    id: "v-current-1",
    proseText: "Beat one current.",
    isCurrent: true,
    chapterOutlineId: "chapter-5",
    chapterNumber: 5,
    beatId: "beat-5-1",
    beatNumber: 1,
  },
  {
    id: "v-current-2",
    proseText: "Beat two current.",
    isCurrent: true,
    chapterOutlineId: "chapter-5",
    chapterNumber: 5,
    beatId: "beat-5-2",
    beatNumber: 2,
  },
  {
    id: "v-old-2",
    proseText: "Beat two obsolete.",
    isCurrent: false,
    chapterOutlineId: "chapter-5",
    chapterNumber: 5,
    beatId: "beat-5-2",
    beatNumber: 2,
  },
  {
    id: "v-prev-last",
    proseText: "Previous chapter ending.",
    isCurrent: true,
    chapterOutlineId: "chapter-4",
    chapterNumber: 4,
    beatId: "beat-4-4",
    beatNumber: 4,
  },
];

test("same chapter selects the immediate previous beat current version", () => {
  const tail = selectPrecedingProseTailFromRows(proseRows, {
    currentChapterOutlineId: "chapter-5",
    currentChapterNumber: 5,
    previousChapterOutlineId: "chapter-4",
    previousChapterNumber: 4,
    currentBeatId: "beat-5-3",
    currentBeatNumber: 3,
  });
  assert.equal(tail?.sourceVersionId, "v-current-2");
  assert.equal(tail?.sourceType, "same_chapter_previous_beat");
  assert.equal(tail?.text, "Beat two current.");
});

test("first beat selects the last current beat from the previous chapter", () => {
  const tail = selectPrecedingProseTailFromRows(proseRows, {
    currentChapterOutlineId: "chapter-5",
    currentChapterNumber: 5,
    previousChapterOutlineId: "chapter-4",
    previousChapterNumber: 4,
    currentBeatId: "beat-5-1",
    currentBeatNumber: 1,
  });
  assert.equal(tail?.sourceVersionId, "v-prev-last");
  assert.equal(tail?.sourceType, "previous_chapter_last_beat");
});

test("missing immediate predecessor does not skip to an older beat", () => {
  const rowsWithoutBeatTwo = proseRows.filter((row) => row.beatNumber !== 2);
  const tail = selectPrecedingProseTailFromRows(rowsWithoutBeatTwo, {
    currentChapterOutlineId: "chapter-5",
    currentChapterNumber: 5,
    previousChapterOutlineId: "chapter-4",
    previousChapterNumber: 4,
    currentBeatId: "beat-5-3",
    currentBeatNumber: 3,
  });
  assert.equal(tail, null);
});

test("non-current prose versions are excluded", () => {
  const onlyObsolete = proseRows.filter((row) => row.id === "v-old-2");
  const tail = selectPrecedingProseTailFromRows(onlyObsolete, {
    currentChapterOutlineId: "chapter-5",
    currentChapterNumber: 5,
    previousChapterOutlineId: "chapter-4",
    previousChapterNumber: 4,
    currentBeatId: "beat-5-3",
    currentBeatNumber: 3,
  });
  assert.equal(tail, null);
});

test("first beat without previous chapter returns null", () => {
  const tail = selectPrecedingProseTailFromRows(proseRows, {
    currentChapterOutlineId: "chapter-1",
    currentChapterNumber: 1,
    previousChapterOutlineId: null,
    previousChapterNumber: null,
    currentBeatId: "beat-1-1",
    currentBeatNumber: 1,
  });
  assert.equal(tail, null);
});

/* ------------------------------------------------------------------ */
/*  3. Prose text safety — key-based, not value-based                  */
/* ------------------------------------------------------------------ */

test("natural prose containing model, provider, and token passes safety", () => {
  assert.doesNotThrow(() =>
    assertProseTextSafe(
      "Ia bekerja sebagai model. Provider listrik mengirim token baru malam itu.",
    ),
  );
});

test("structured internal packet dump fails prose safety", () => {
  assert.throws(() =>
    assertProseTextSafe(
      '{"packet_json":{"planning_truth":"rahasia"},"full_prompt":"internal"}',
    ),
  );
});

/* ------------------------------------------------------------------ */
/*  Summary                                                            */
/* ------------------------------------------------------------------ */

console.log(`\n=== Preceding Prose Context ===`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Truncation: 900 code points, safe surrogate pairs`);
console.log(`==================================\n`);

process.exit(failed > 0 ? 1 : 0);
