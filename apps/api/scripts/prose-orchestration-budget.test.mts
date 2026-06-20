/**
 * Prose Orchestration Budget — contract test.
 *
 * Memastikan prose service menggunakan packet dari hasil build langsung
 * dan tidak membaca ulang context_packet_logs dari database.
 *
 * Run: npm run test:prose-orchestration-budget -w @vibenovel/api
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
/*  1. prose-beat-generation.ts uses buildProseBeatPromptFromPacket    */
/* ------------------------------------------------------------------ */

const beatGenPath = resolve(ROOT, "src/services/prose-beat-generation.ts");
const beatGenSource = readFileSync(beatGenPath, "utf-8");

test(
  "prose-beat-generation imports buildProseBeatPromptFromPacket (not buildProseBeatPrompt with DB re-read)",
  () => {
    assert.ok(
      beatGenSource.includes("buildProseBeatPromptFromPacket"),
      "should import buildProseBeatPromptFromPacket",
    );
    // Should NOT call the old function that re-reads from DB
    assert.ok(
      !beatGenSource.includes('buildProseBeatPrompt(bindings,'),
      "should NOT call buildProseBeatPrompt with bindings (DB re-read)",
    );
  },
);

/* ------------------------------------------------------------------ */
/*  2. prose-rewrite-generation.ts uses buildProseRewritePromptFromPacket */
/* ------------------------------------------------------------------ */

const rewriteGenPath = resolve(ROOT, "src/services/prose-rewrite-generation.ts");
const rewriteGenSource = readFileSync(rewriteGenPath, "utf-8");

test(
  "prose-rewrite-generation imports buildProseRewritePromptFromPacket (not buildProseRewritePrompt with DB re-read)",
  () => {
    assert.ok(
      rewriteGenSource.includes("buildProseRewritePromptFromPacket"),
      "should import buildProseRewritePromptFromPacket",
    );
    assert.ok(
      !rewriteGenSource.includes('buildProseRewritePrompt(bindings,'),
      "should NOT call buildProseRewritePrompt with bindings (DB re-read)",
    );
  },
);

/* ------------------------------------------------------------------ */
/*  3. packet from artifact is used directly (not reloaded)            */
/* ------------------------------------------------------------------ */

test(
  "prose-beat-generation references packetResult.packet (not packetLogId for prompt)",
  () => {
    const usesPacketDirectly = beatGenSource.includes("packetResult.packet");
    assert.ok(
      usesPacketDirectly,
      "prose-beat-generation should use packetResult.packet directly",
    );
  },
);

test(
  "prose-rewrite-generation references packetResult.packet (not packetLogId for prompt)",
  () => {
    const usesPacketDirectly = rewriteGenSource.includes("packetResult.packet");
    assert.ok(
      usesPacketDirectly,
      "prose-rewrite-generation should use packetResult.packet directly",
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Summary                                                            */
/* ------------------------------------------------------------------ */

console.log(`\n=== Prose Orchestration Budget ===`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Duplicate reads eliminated: prose-beat, prose-rewrite`);
console.log(`==================================\n`);

process.exit(failed > 0 ? 1 : 0);
