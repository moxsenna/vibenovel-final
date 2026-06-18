#!/usr/bin/env node
/**
 * Sprint 12.0 — static + env policy: live AI on must not allow silent story stubs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_SERVICES = join(ROOT, "apps/api/src/services");

const MARKERS = [
  "beat_stub_deterministic",
  "summary_stub_v1",
  "outline_stub_deterministic",
  "foundation_stub_batch",
];

function parseTruthy(value) {
  if (!value?.trim()) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/** Mirrors apps/api/src/env.ts allowDeterministicStoryStubs */
function allowDeterministicStoryStubs(bindings) {
  return (
    parseTruthy(bindings.ALLOW_DETERMINISTIC_STORY_STUBS) ||
    parseTruthy(bindings.AI_PROVIDER_MOCK)
  );
}

function readService(name) {
  return readFileSync(join(API_SERVICES, name), "utf8");
}

function assertLiveAiBlocksBeatStub() {
  const live = {
    AI_GENERATION_ENABLED: "true",
    AI_PROVIDER_MOCK: "false",
  };
  assert.equal(
    allowDeterministicStoryStubs(live),
    false,
    "live AI without ALLOW_DETERMINISTIC_STORY_STUBS must not allow beat/summary stubs",
  );
  const allowed = {
    AI_GENERATION_ENABLED: "true",
    AI_PROVIDER_MOCK: "false",
    ALLOW_DETERMINISTIC_STORY_STUBS: "true",
  };
  assert.equal(allowDeterministicStoryStubs(allowed), true);
  assert.equal(
    allowDeterministicStoryStubs({
      AI_GENERATION_ENABLED: "true",
      AI_PROVIDER_MOCK: "true",
    }),
    true,
  );
}

function main() {
  console.log("smoke-no-production-stubs\n");

  for (const marker of MARKERS) {
    const hits = [];
    for (const file of [
      "chapter-beat.ts",
      "chapter-summary-generator.ts",
      "outline-generator.ts",
      "foundation-proposal.ts",
    ]) {
      if (readService(file).includes(marker)) hits.push(file);
    }
    console.log(`  marker "${marker}" in: ${hits.join(", ") || "(none)"}`);
  }

  assertLiveAiBlocksBeatStub();

  const beat = readService("chapter-beat.ts");
  assert.match(beat, /allowDeterministicStoryStubs/);
  assert.match(beat, /AI beat generation is unavailable/);

  const summary = readService("chapter-summary.ts");
  assert.match(summary, /allowDeterministicStoryStubs/);
  assert.match(summary, /AI chapter summary is unavailable/);

  console.log("\nPASS: production stub policy checks");
}

main();
