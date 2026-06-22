/**
 * Writer Safety Envelope — contract tests.
 *
 * Memverifikasi bahwa:
 * - Safety Envelope terpisah dari Writer packet
 * - Forbidden phrases tidak bocor ke Writer/public preview
 * - Natural prose words (model, provider, token) tidak ditolak
 * - Envelope tetap tersimpan di server
 *
 * Run: npm run test:writer-safety-envelope -w @vibenovel/api
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { WriterContextPacket } from "@vibenovel/shared";
import type { WriterSafetyEnvelope } from "@vibenovel/shared";
import { buildWriterSafetyEnvelope } from "../src/services/writer-safety-envelope.js";
import { assertWriterPacketSafe } from "../src/services/context-packet-safety.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

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
/*  1. Safety Envelope does NOT leak into Writer packet                */
/* ------------------------------------------------------------------ */

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
    premiseSummary: "test",
    mainConflictSummary: "test",
    readerPromise: "test",
    tone: null,
    storySecretsPreview: null,
  },
  concept: {
    title: "test",
    shortPitch: "test",
    readerPromise: null,
  },
  canon: { characters: [], facts: [], speechRules: [] },
  currentChapter: {
    title: "Ch5",
    summary: "test",
    purpose: null,
    chapterFunction: "setup" as const,
    emotionalDirection: null,
    endingHook: null,
    miniVictory: null,
    hook: null,
    markers: [],
  },
  continuity: {
    previousChapterSummaries: [],
    openLoopsActive: [],
    unresolvedThreadLabels: [],
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

const envelope = buildWriterSafetyEnvelope({
  projectId: "p1",
  chapterOutlineId: "co1",
  chapterNumber: 5,
  beatId: null,
  futureRevealFactIds: ["fr1", "fr2"],
  forbiddenRevealPhrases: ["shadow council", "ancient mark"],
});

test(
  "Writer packet JSON does not contain planningTruth field",
  () => {
    assert.equal(
      JSON.stringify(minimalPacket).includes("planningTruth"),
      false,
    );
  },
);

test(
  "Writer packet JSON does not contain forbiddenRevealPhrases",
  () => {
    assert.equal(
      JSON.stringify(minimalPacket).includes("forbiddenRevealPhrases"),
      false,
    );
  },
);

test(
  "Safety Envelope contains forbiddenRevealPhrases",
  () => {
    assert.ok(envelope.forbiddenRevealPhrases.length > 0);
    assert.ok(envelope.forbiddenRevealPhrases.includes("shadow council"));
  },
);

test(
  "Safety Envelope has correct version",
  () => {
    assert.equal(envelope.version, "writer_safety_v1");
  },
);

/* ------------------------------------------------------------------ */
/*  2. Natural prose words pass safety (model, provider, token)        */
/* ------------------------------------------------------------------ */

test(
  "assertWriterPacketSafe allows natural prose containing 'model'",
  () => {
    const packet: WriterContextPacket = {
      ...minimalPacket,
      foundation: {
        ...minimalPacket.foundation,
        premiseSummary: "Ia bekerja sebagai model di agensi ternama.",
      },
    };
    assert.doesNotThrow(() =>
      assertWriterPacketSafe(packet, {
        currentChapterNumber: 5,
        futureChapterSummaries: [],
        futureChapterTitles: [],
      }),
    );
  },
);

test(
  "assertWriterPacketSafe allows natural prose containing 'provider'",
  () => {
    const packet: WriterContextPacket = {
      ...minimalPacket,
      foundation: {
        ...minimalPacket.foundation,
        premiseSummary: "Penyedia jasa atau provider lokal sangat membantu.",
      },
    };
    assert.doesNotThrow(() =>
      assertWriterPacketSafe(packet, {
        currentChapterNumber: 5,
        futureChapterSummaries: [],
        futureChapterTitles: [],
      }),
    );
  },
);

test(
  "assertWriterPacketSafe allows natural prose containing 'token'",
  () => {
    const packet: WriterContextPacket = {
      ...minimalPacket,
      foundation: {
        ...minimalPacket.foundation,
        premiseSummary: "Token listrik habis di malam hari.",
      },
    };
    assert.doesNotThrow(() =>
      assertWriterPacketSafe(packet, {
        currentChapterNumber: 5,
        futureChapterSummaries: [],
        futureChapterTitles: [],
      }),
    );
  },
);

/* ------------------------------------------------------------------ */
/*  3. Structured forbidden key still rejected                         */
/* ------------------------------------------------------------------ */

test(
  "assertWriterPacketSafe throws when packet has planningTruth key",
  () => {
    const badPacket = {
      ...minimalPacket,
      planningTruth: "the real secret",
    } as unknown as WriterContextPacket;

    assert.throws(() =>
      assertWriterPacketSafe(badPacket, {
        currentChapterNumber: 5,
        futureChapterSummaries: [],
        futureChapterTitles: [],
      }),
    );
  },
);

/* ------------------------------------------------------------------ */
/*  4. Source-level checks (readFileSync)                              */
/* ------------------------------------------------------------------ */

const safetyPath = resolve(ROOT, "src/services/context-packet-safety.ts");
const safetySource = readFileSync(safetyPath, "utf-8");

test(
  "context-packet-safety no longer uses regex FORBIDDEN_KEY_PATTERNS with model/provider/token",
  () => {
    // Should use Set-based key lookup, not regex patterns
    assert.ok(
      safetySource.includes("FORBIDDEN_KEYS = new Set"),
      "should use Set of forbidden keys",
    );
    // Should NOT have the old regex pattern for \bmodel\b
    assert.ok(
      !safetySource.includes("\\\\bmodel\\\\b"),
      "should NOT regex match 'model' in serialized JSON values",
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Summary                                                            */
/* ------------------------------------------------------------------ */

console.log(`\n=== Writer Safety Envelope Contracts ===`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Envelope: separate from Writer packet, server-only`);
console.log(`  Safety: recursive key walker, no prose false positives`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
