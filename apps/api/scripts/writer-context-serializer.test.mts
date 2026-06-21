/**
 * Writer Context Serializer — contract tests.
 *
 * Verifikasi budget profiles, truncation, env resolver, dan total caps.
 *
 * Run: npm run test:writer-context-serializer -w @vibenovel/api
 */
import assert from "node:assert/strict";
import type { WriterContextPacket } from "@vibenovel/shared";
import {
  WRITER_CONTEXT_PROFILE_BUDGETS,
  WRITER_CONTEXT_TOTAL_CHAR_CAP,
  serializeContext,
  resolveContextBudgetProfile,
} from "../src/services/writer-context-serializer.js";

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

function sumBudgets(profile: keyof typeof WRITER_CONTEXT_PROFILE_BUDGETS): number {
  const b = WRITER_CONTEXT_PROFILE_BUDGETS[profile];
  return Object.values(b).reduce((sum, v) => sum + v, 0);
}

const minimalPacket: WriterContextPacket = {
  meta: {
    projectId: "p1",
    chapterOutlineId: "co1",
    chapterNumber: 5,
    builderVersion: "context_packet_v3",
    packetHash: "abc",
    generatedAt: new Date().toISOString(),
  },
  foundation: {
    premiseSummary: "A story about resilience.",
    mainConflictSummary: "The protagonist fights against destiny.",
    readerPromise: "An emotional journey of self-discovery.",
    tone: "melancholic",
    storySecretsPreview: null,
  },
  concept: {
    title: "Test Story",
    shortPitch: "A test",
    readerPromise: null,
  },
  canon: {
    characters: [
      {
        id: "c1",
        name: "Nadira",
        roleLabel: "protagonist",
        descriptionSummary: "Pemimpin tim.",
        state: {
          chapterNumber: 4,
          emotionalState: "cemas",
          physicalState: "lengan terluka",
          currentGoal: "menemukan Rama",
          locationLabel: "stasiun",
        },
      },
    ],
    facts: [
      { id: "f1", text: "Nadira kidal.", category: "character", importance: "high" },
    ],
    speechRules: [],
  },
  currentChapter: {
    title: "The Awakening",
    summary: "Chapter begins with a revelation.",
    purpose: "Establish the new status quo",
    chapterFunction: "setup" as const,
    emotionalDirection: null,
    endingHook: null,
    miniVictory: null,
    hook: null,
    markers: [],
  },
  continuity: {
    previousChapterSummaries: ["In chapter 4, the hero discovered the truth."],
    openLoopsActive: [],
    unresolvedThreadLabels: [],
    recentTimeline: ["Bab 4: Nadira tiba di stasiun."],
    retrievalMemory: [
      {
        sourceRef: "draft:12",
        text: "Nadira selalu mengetuk meja saat gugup.",
        similarity: 0.91,
        readOnly: true,
        usage: "context_only",
        metadata: {},
      },
    ],
    povKnowledge: {
      characterId: "c1",
      knownFacts: [
        {
          factId: "f1",
          text: "Nadira kidal.",
          confidence: 1,
          learnedAtChapter: 1,
          learnedFrom: "canon",
        },
      ],
      suspectedFacts: [],
      partialFacts: [],
      falseBeliefs: [],
      unknownFactCount: 1,
    },
    knowledgeByCharacter: [
      {
        characterId: "c1",
        characterName: "Nadira",
        knownFacts: [
          {
            factId: "f1",
            text: "Nadira kidal.",
            confidence: 1,
            learnedAtChapter: 1,
            learnedFrom: "canon",
          },
        ],
        suspectedFacts: [],
        partialFacts: [],
        falseBeliefs: [],
      },
    ],
    precedingProseTail: {
      text: "Pintu kereta menutup tepat ketika Nadira berbalik.",
      sourceChapterNumber: 5,
      sourceBeatId: "beat-1",
      sourceVersionId: "version-1",
      sourceType: "same_chapter_previous_beat",
    },
    styleRules: ["Paragraf pendek.", "Dialog tajam."],
  },
  revealGate: {
    allowedBreadcrumbs: [],
    allowedReveals: [],
    forbiddenReveals: [],
    forbiddenConcepts: [],
  },
  emotionalTarget: { chapterEmotion: null, beatEmotionalShift: null },
  hookTarget: { chapterEndingHook: null, beatStopCondition: null },
  constraints: {
    mustInclude: [],
    mustNotInclude: [],
    wordTarget: null,
    mobileFormatRules: [],
  },
};

/* ------------------------------------------------------------------ */
/*  1. Budget tables                                                   */
/* ------------------------------------------------------------------ */

test("conservative budget sums to 17,800", () => {
  assert.equal(sumBudgets("conservative"), 17_800);
});

test("full budget sums to 35,100", () => {
  assert.equal(sumBudgets("full"), 35_100);
});

test("all budget values are positive", () => {
  for (const profile of ["conservative", "full"] as const) {
    const b = WRITER_CONTEXT_PROFILE_BUDGETS[profile];
    for (const [key, val] of Object.entries(b)) {
      assert.ok(
        val > 0,
        `${profile}.${key} should be positive, got ${val}`,
      );
    }
  }
});

/* ------------------------------------------------------------------ */
/*  2. Serializer respects total cap                                    */
/* ------------------------------------------------------------------ */

test("serializeContext conservative output ≤ 17,800 chars", () => {
  const result = serializeContext(minimalPacket, "conservative");
  assert.ok(
    result.text.length <= WRITER_CONTEXT_TOTAL_CHAR_CAP.conservative,
    `conservative output ${result.text.length} > ${WRITER_CONTEXT_TOTAL_CHAR_CAP.conservative}`,
  );
});

test("serializeContext full output ≤ 35,100 chars", () => {
  const result = serializeContext(minimalPacket, "full");
  assert.ok(
    result.text.length <= WRITER_CONTEXT_TOTAL_CHAR_CAP.full,
    `full output ${result.text.length} > ${WRITER_CONTEXT_TOTAL_CHAR_CAP.full}`,
  );
});

test("serializeContext produces non-empty text", () => {
  const result = serializeContext(minimalPacket, "conservative");
  assert.ok(result.text.length > 0);
});

test("serializeContext renders real state, knowledge, prose tail, retrieval, and style", () => {
  const result = serializeContext(minimalPacket, "conservative");
  assert.match(result.text, /lengan terluka/);
  assert.match(result.text, /Nadira kidal/);
  assert.match(result.text, /Pintu kereta menutup/);
  assert.match(result.text, /mengetuk meja saat gugup/);
  assert.match(result.text, /Dialog tajam/);
  assert.doesNotMatch(result.text, /not yet populated|No retrieval memory available/i);
});

/* ------------------------------------------------------------------ */
/*  3. Profile resolver                                                */
/* ------------------------------------------------------------------ */

test("resolveContextBudgetProfile returns conservative for undefined", () => {
  assert.equal(resolveContextBudgetProfile(undefined), "conservative");
});

test("resolveContextBudgetProfile returns conservative for blank", () => {
  assert.equal(resolveContextBudgetProfile(""), "conservative");
});

test("resolveContextBudgetProfile returns conservative for unknown value", () => {
  assert.equal(resolveContextBudgetProfile("invalid_profile"), "conservative");
});

test("resolveContextBudgetProfile returns full for 'full'", () => {
  assert.equal(resolveContextBudgetProfile("full"), "full");
});

/* ------------------------------------------------------------------ */
/*  Summary                                                            */
/* ------------------------------------------------------------------ */

console.log(`\n=== Writer Context Serializer ===`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Budgets: conservative=17,800, full=35,100`);
console.log(`==================================\n`);

process.exit(failed > 0 ? 1 : 0);
