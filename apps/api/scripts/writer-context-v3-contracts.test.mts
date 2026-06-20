/**
 * Writer Context v3 — contract tests.
 *
 * Memverifikasi tipe baru, normalizer legacy, dan builder version.
 *
 * Run: npm run test:writer-context-v3 -w @vibenovel/api
 */
import assert from "node:assert/strict";
import type {
  WriterCanonFactSummary,
  WriterCharacterStateSummary,
  WriterCharacterSummaryV3,
  WriterKnowledgeSummary,
  WriterPrecedingProseTail,
  WriterContextPacket,
} from "@vibenovel/shared";
import {
  normalizeCanonFacts,
  isPacketV3,
} from "../src/services/writer-context-normalizer.js";

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
/*  1. Type structure — verify v3 types have expected shape            */
/* ------------------------------------------------------------------ */

test("WriterCanonFactSummary has expected fields", () => {
  const fact: WriterCanonFactSummary = {
    id: "f1",
    text: "test fact",
    category: "character",
    importance: "high",
  };
  assert.equal(fact.id, "f1");
  assert.equal(fact.text, "test fact");
  assert.equal(fact.category, "character");
  assert.equal(fact.importance, "high");
});

test("WriterCharacterStateSummary has expected fields", () => {
  const state: WriterCharacterStateSummary = {
    chapterNumber: 3,
    emotionalState: "sad",
    physicalState: "injured",
    currentGoal: "find help",
    locationLabel: "forest",
  };
  assert.equal(state.chapterNumber, 3);
  assert.equal(state.emotionalState, "sad");
  assert.equal(state.currentGoal, "find help");
});

test("WriterCharacterSummaryV3 has expected fields", () => {
  const char: WriterCharacterSummaryV3 = {
    id: "c1",
    name: "Nadira",
    roleLabel: "Protagonis",
    descriptionSummary: "A strong woman",
    state: null,
  };
  assert.equal(char.name, "Nadira");
});

test("WriterPrecedingProseTail has expected fields", () => {
  const tail: WriterPrecedingProseTail = {
    text: "She walked forward...",
    sourceChapterNumber: 4,
    sourceBeatId: "beat-1",
    sourceVersionId: "ver-1",
    sourceType: "previous_chapter_last_beat",
  };
  assert.equal(tail.sourceType, "previous_chapter_last_beat");
  assert.equal(tail.sourceChapterNumber, 4);
});

/* ------------------------------------------------------------------ */
/*  2. Normalizer — legacy string facts → structured                   */
/* ------------------------------------------------------------------ */

test("normalizeCanonFacts converts legacy string[] to WriterCanonFactSummary[]", () => {
  const legacyPacket = {
    canon: { facts: ["fact one", "fact two"] },
  } as unknown as WriterContextPacket;

  const normalized = normalizeCanonFacts(legacyPacket);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].id, "legacy:0");
  assert.equal(normalized[0].text, "fact one");
  assert.equal(normalized[0].category, "legacy");
  assert.equal(normalized[0].importance, "unknown");
  assert.equal(normalized[1].id, "legacy:1");
  assert.equal(normalized[1].text, "fact two");
});

test("normalizeCanonFacts returns empty array for empty facts", () => {
  const packet = { canon: { facts: [] } } as unknown as WriterContextPacket;
  assert.equal(normalizeCanonFacts(packet).length, 0);
});

test("normalizeCanonFacts passes through already-structured facts", () => {
  const structuredFacts: WriterCanonFactSummary[] = [
    { id: "f1", text: "structured", category: "plot", importance: "high" },
  ];
  const packet = {
    canon: { facts: structuredFacts },
  } as unknown as WriterContextPacket;

  const result = normalizeCanonFacts(packet);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "f1");
  assert.equal(result[0].category, "plot");
});

/* ------------------------------------------------------------------ */
/*  3. isPacketV3 detection                                            */
/* ------------------------------------------------------------------ */

test("isPacketV3 returns false for legacy string[] facts", () => {
  const packet = {
    canon: { facts: ["old fact"] },
  } as unknown as WriterContextPacket;
  assert.equal(isPacketV3(packet), false);
});

test("isPacketV3 returns true for empty facts", () => {
  const packet = { canon: { facts: [] } } as unknown as WriterContextPacket;
  assert.equal(isPacketV3(packet), true);
});

test("isPacketV3 returns true for structured facts", () => {
  const packet = {
    canon: {
      facts: [{ id: "f1", text: "structured", category: "x", importance: "y" }],
    },
  } as unknown as WriterContextPacket;
  assert.equal(isPacketV3(packet), true);
});

/* ------------------------------------------------------------------ */
/*  Summary                                                            */
/* ------------------------------------------------------------------ */

console.log(`\n=== Writer Context v3 Contracts ===`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Types: PovKnowledgeFactSummary, WriterCanonFactSummary,`);
console.log(`    WriterCharacterStateSummary, WriterCharacterSummaryV3,`);
console.log(`    WriterKnowledgeSummary, WriterPrecedingProseTail`);
console.log(`  Normalizer: legacy string[] → structured, pass-through`);
console.log(`====================================\n`);

process.exit(failed > 0 ? 1 : 0);
