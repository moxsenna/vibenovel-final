import assert from "node:assert/strict";
import {
  buildProseRepairInstructionFromReport,
  createRepairPlan,
  shouldContinueRepair,
} from "../src/services/safe-repair.js";

const legacyPlan = createRepairPlan(
  { passed: false, blocked: ["blocked"], warnings: [] },
  0,
);
assert.equal(legacyPlan.maxRetries, 2);
assert.equal(shouldContinueRepair(0), true);
assert.equal(shouldContinueRepair(2), false);

const instruction = buildProseRepairInstructionFromReport({
  allowed: false,
  severity: "blocked",
  outputText: "generated prose",
  checks: [
    {
      key: "no_future_reveal_leak",
      passed: false,
      severity: "blocked",
      message: "Output mentions a future reveal.",
    },
    {
      key: "semantic_scene_boundary",
      passed: false,
      severity: "blocked",
      message: "Adegan melompat ke hari berikutnya.",
    },
    {
      key: "pov_character_knowledge",
      passed: false,
      severity: "blocked",
      message: "POV knows an unavailable fact.",
    },
  ],
});
assert.match(instruction, /hapus atau kaburkan/i);
assert.match(instruction, /batas beat/i);
assert.match(instruction, /pengetahuan karakter/i);
assert.doesNotMatch(instruction, /planning_truth|safety_envelope/i);

console.log("PASS story-safe targeted repair instructions");
