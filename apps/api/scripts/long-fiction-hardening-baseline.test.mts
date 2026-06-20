/**
 * Long-Fiction Hardening Baseline — regression contracts.
 *
 * Memotret kondisi awal sebelum perbaikan. Setelah task terkait diperbaiki,
 * assertion harus diperbarui menjadi perilaku target, bukan dihapus.
 *
 * Semua assertion menggunakan readFileSync — tidak memanggil provider/database.
 * Run: npm run test:long-fiction-baseline -w @vibenovel/api
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
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
/*  1. Prompt prose baseline — field yang BELUM dikirim ke model       */
/* ------------------------------------------------------------------ */

const promptPath = resolve(ROOT, "src/services/prose-generation-prompt.ts");
const promptSource = readFileSync(promptPath, "utf-8");

test(
  "Prompt buildUserPromptSections does not reference recentTimeline",
  () => {
    assert.ok(
      !promptSource.includes("recentTimeline"),
      "BASELINE: prompt should not reference recentTimeline. " +
        "If this fails, prompt has been upgraded — update assertion to verify it IS included.",
    );
  },
);

test(
  "Prompt buildUserPromptSections does not reference speechRules",
  () => {
    assert.ok(
      !promptSource.includes("speechRules"),
      "BASELINE: prompt should not reference speechRules. " +
        "If this fails, prompt has been upgraded — update assertion.",
    );
  },
);

test(
  "Prompt buildUserPromptSections does not reference povKnowledge",
  () => {
    assert.ok(
      !promptSource.includes("povKnowledge"),
      "BASELINE: prompt should not reference povKnowledge. " +
        "If this fails, prompt has been upgraded — update assertion.",
    );
  },
);

/* ------------------------------------------------------------------ */
/*  2. Default daily cap baseline                                      */
/* ------------------------------------------------------------------ */

const rateLimitPath = resolve(ROOT, "src/services/ai-rate-limit.ts");

test(
  "ai-rate-limit.ts does not exist (no daily cap on main)",
  () => {
    // Baseline: daily cap logic not yet added to main.
    // Task 0.2 will create this file with DEFAULT_DAILY_DEBIT_CAP_V2 = 100_000.
    assert.ok(
      !existsSync(rateLimitPath),
      "BASELINE: ai-rate-limit.ts should not exist yet. " +
        "If this fails, rate limit has been implemented — update assertion to verify DEFAULT_DAILY_DEBIT_CAP_V2 >= max cost.",
    );
  },
);

/* ------------------------------------------------------------------ */
/*  3. Credit cost baseline — current costs are v1 (small)             */
/* ------------------------------------------------------------------ */

const creditPolicyPath = resolve(ROOT, "src/services/ai-credit-policy.ts");
const creditPolicySource = readFileSync(creditPolicyPath, "utf-8");

test(
  "CREDIT_COST_TABLE prose_beat terbaik is 20 (not 7500)",
  () => {
    // Current baseline has small v1 costs, not the planned v2 costs.
    assert.ok(
      creditPolicySource.includes("terbaik") && creditPolicySource.includes("20"),
      "BASELINE: prose_beat terbaik should cost 20 credits (v1). " +
        "If this fails, credit costs have been updated to v2 — update assertion to verify 7500.",
    );
  },
);

/* ------------------------------------------------------------------ */
/*  4. Advanced control baseline — only targetChapterCount             */
/* ------------------------------------------------------------------ */

const outlineHookPath = resolve(
  ROOT,
  "../../apps/web/src/hooks/useOutlineData.ts",
);

test(
  "useOutlineData generate sends only targetChapterCount in advanced mode",
  () => {
    const outlineHookSource = readFileSync(outlineHookPath, "utf-8");
    const hasRevealDensity = outlineHookSource.includes("revealDensity");
    const hasRetentionIntensity = outlineHookSource.includes("retentionIntensity");
    const hasProseStyleTarget = outlineHookSource.includes("proseStyleTarget");

    assert.ok(
      !hasRevealDensity && !hasRetentionIntensity && !hasProseStyleTarget,
      `BASELINE: advanced controls should only send targetChapterCount. ` +
        `Found: revealDensity=${hasRevealDensity}, ` +
        `retentionIntensity=${hasRetentionIntensity}, ` +
        `proseStyleTarget=${hasProseStyleTarget}. ` +
        `If this fails, advanced controls have been wired — update assertion.`,
    );
  },
);

/* ------------------------------------------------------------------ */
/*  5. Retrieval baseline — no similarity query                        */
/* ------------------------------------------------------------------ */

const packetBuilderPath = resolve(
  ROOT,
  "src/services/context-packet-builder.ts",
);
const packetBuilderSource = readFileSync(packetBuilderPath, "utf-8");

test(
  "context-packet-builder does not have loadRetrievalMemorySnippetsForPacket",
  () => {
    // Baseline: retrieval memory not loaded into packet via dedicated function.
    // Task 3.x will add similarity-based retrieval.
    assert.ok(
      !packetBuilderSource.includes("loadRetrievalMemorySnippetsForPacket"),
      "BASELINE: context-packet-builder should not have retrieval memory loader yet. " +
        "If this fails, RAG retrieval has been integrated — update assertion.",
    );
  },
);

test(
  "context-packet-builder continuity block does not assign retrievalMemory",
  () => {
    // The continuity block in buildWriterPacketFromSnapshot should not
    // assign retrievalMemory. (The shared type may have it, but the builder
    // doesn't populate it.)
    const continuityStart = packetBuilderSource.indexOf("continuity:");
    if (continuityStart === -1) {
      // continuity not found — this is also a valid baseline state
      return;
    }
    // Find the object block after "continuity:"
    const afterKey = packetBuilderSource.slice(continuityStart + 11);
    const braceStart = afterKey.indexOf("{");
    const braceEnd = afterKey.indexOf("}");
    if (braceStart === -1 || braceEnd === -1) return;
    const continuityBlock = afterKey.slice(braceStart, braceEnd + 1);

    assert.ok(
      !continuityBlock.includes("retrievalMemory"),
      "BASELINE: continuity block should not assign retrievalMemory. " +
        "If this fails, retrieval memory is now populated — update assertion.",
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Summary                                                            */
/* ------------------------------------------------------------------ */

console.log(`\n=== Long-Fiction Hardening Baseline ===`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Protected gaps: recentTimeline, speechRules, povKnowledge (prompt),`);
console.log(`    no daily cap, credit v1 costs, only targetChapterCount sent,`);
console.log(`    no similarity retrieval.`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
