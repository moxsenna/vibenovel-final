import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AppError } from "../src/errors.ts";
import {
  assertAiOutputUsable,
  validateAiOutput,
} from "../src/services/output-validator.ts";
import {
  assertAiGenerationAllowed,
  type AiRateLimitSnapshot,
} from "../src/services/ai-rate-limit.ts";
import { extractForbiddenConcepts } from "../src/services/context-packet-safety.ts";
import { parseSafeRepairRequest } from "../src/services/safe-repair.ts";

const unsafe = validateAiOutput({
  outputText:
    "OpenRouter model context_packet_json says reveal_before_chapter: adik kandung muncul di bab 9.",
  forbiddenConcepts: ["adik kandung"],
  mustInclude: ["gerbang tua"],
});

assert.equal(unsafe.allowed, false);
assert.ok(unsafe.checks.some((check) => check.key === "no_future_reveal_leak" && !check.passed));
assert.ok(unsafe.checks.some((check) => check.key === "no_raw_context_fields" && !check.passed));
assert.ok(unsafe.checks.some((check) => check.key === "no_provider_or_model_names" && !check.passed));
assert.ok(unsafe.checks.some((check) => check.key === "beat_requirement_coverage" && !check.passed));

assert.throws(
  () => assertAiOutputUsable(unsafe),
  (err: unknown) =>
    err instanceof AppError &&
    err.code === "AI_OUTPUT_UNSAFE" &&
    err.status === 422 &&
    err.message === "AI output failed safety validation",
);

const safe = validateAiOutput({
  outputText:
    "Gerbang tua itu berderit pelan. Ia menahan napas, memilih bertanya tanpa membuka jawaban akhir.",
  forbiddenConcepts: ["adik kandung"],
  mustInclude: ["gerbang tua"],
  maxChars: 500,
});
assert.equal(safe.allowed, true);

const forbiddenConcepts = extractForbiddenConcepts(
  "Identitas dan hubungan Siska",
  "Pembaca hanya melihat nama dan gelagat akrab, bukan kebenaran penuh yang belum terbuka di bab awal.",
);
// Forbidden concepts must be distinctive multi-word phrases — never bare common
// words (which would block ordinary prose), and never words sourced from the
// safe reader-facing hint.
assert.ok(forbiddenConcepts.every((concept) => concept.includes(" ")));
assert.ok(forbiddenConcepts.includes("hubungan siska"));
assert.ok(!forbiddenConcepts.includes("hubungan"));
assert.ok(!forbiddenConcepts.includes("identitas"));
assert.ok(!forbiddenConcepts.includes("nama"));
assert.ok(
  !forbiddenConcepts.some((concept) => /pembaca|gelagat|akrab|kebenaran/.test(concept)),
);
// A common single word in prose must NOT trip the future-reveal leak check now.
const commonWordProse = validateAiOutput({
  outputText:
    "Sari menatap hubungan keluarganya yang retak sambil mengaduk masakan di dapur sempit.",
  forbiddenConcepts,
  mustInclude: [],
});
assert.equal(commonWordProse.allowed, true);
// A distinctive single long word from a one-word title is still kept solo.
assert.deepEqual(extractForbiddenConcepts("Pengkhianatan", null), ["pengkhianatan"]);

assert.throws(
  () => parseSafeRepairRequest({ outputText: safe.outputText }),
  (err: unknown) =>
    err instanceof AppError &&
    err.code === "BAD_REQUEST" &&
    err.message.includes("confirmation"),
);

const repair = parseSafeRepairRequest({
  outputText: unsafe.outputText,
  confirmation: "REPAIR_AI_OUTPUT",
  forbiddenConcepts: ["adik kandung"],
  mustInclude: ["gerbang tua"],
});
assert.equal(repair.validation.allowed, false);
assert.match(repair.repairInstruction, /Jangan tampilkan/i);
assert.match(repair.repairInstruction, /gerbang tua/i);

const baseLimit: AiRateLimitSnapshot = {
  dailyDebitedCredits: 15,
  dailyDebitCap: 20,
  recentFailureCount: 0,
  cooldownFailureThreshold: 3,
};

assert.doesNotThrow(() => assertAiGenerationAllowed(baseLimit, 5));
assert.throws(
  () => assertAiGenerationAllowed(baseLimit, 6),
  (err: unknown) =>
    err instanceof AppError &&
    err.code === "AI_DAILY_CAP_EXCEEDED" &&
    err.status === 429,
);
assert.throws(
  () =>
    assertAiGenerationAllowed({ ...baseLimit, recentFailureCount: 3 }, 1),
  (err: unknown) =>
    err instanceof AppError &&
    err.code === "AI_FAILURE_COOLDOWN" &&
    err.status === 429,
);

const migrationSql = readFileSync(
  "../../supabase/migrations/00012_sprint14_safety_validation.sql",
  "utf8",
);
for (const required of ["validation_reports", "ai_usage_daily_caps", "repair_status"]) {
  assert.match(migrationSql, new RegExp(required), `${required} must exist in migration`);
}

console.log("PASS Sprint 14 safety contracts");
