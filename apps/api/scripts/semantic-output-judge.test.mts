import assert from "node:assert/strict";
import { createFixturePacket } from "./fixtures/long-serial-30-chapters-fixture.data.js";
import {
  mergeSemanticJudgeIntoValidationReport,
  resolveSemanticJudgeMode,
  runSemanticOutputJudge,
} from "../src/services/semantic-output-judge.js";

assert.equal(resolveSemanticJudgeMode(undefined), "shadow");
assert.equal(resolveSemanticJudgeMode("invalid"), "shadow");
assert.equal(resolveSemanticJudgeMode("off"), "off");
assert.equal(resolveSemanticJudgeMode("enforce"), "enforce");

const deterministicReport = {
  allowed: true,
  severity: "info" as const,
  outputText: "Nadira menutup pintu.",
  checks: [],
};
const judgeJson = {
  instructionCompliance: { score: 0.5, missingRequirements: ["pedang"] },
  sceneBoundary: { passed: false, jumpedAhead: true, reason: "Melewati akhir beat." },
  continuity: { passed: false, contradictions: ["Luka mendadak hilang."] },
  knowledge: {
    passed: false,
    violations: [
      { characterRef: "Nadira", factRef: "f-1", reason: "Mengetahui fakta terlalu dini." },
    ],
  },
  style: { score: 0.6, driftReasons: ["Paragraf terlalu panjang."] },
};

const shadow = await runSemanticOutputJudge(
  {
    bindings: { SEMANTIC_JUDGE_MODE: "shadow" },
    prose: deterministicReport.outputText,
    writerPacket: createFixturePacket(5),
    deterministicReport,
  },
  {
    call: async (messages) => {
      assert.doesNotMatch(messages[1].content, /safety_envelope|planning_truth/i);
      return {
        text: JSON.stringify(judgeJson),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 12,
      };
    },
  },
);
assert.equal(shadow.called, true);
assert.equal(shadow.result.sceneBoundary.jumpedAhead, true);
assert.equal(
  mergeSemanticJudgeIntoValidationReport(deterministicReport, shadow).allowed,
  true,
  "shadow mode must not block",
);

const enforced = {
  ...shadow,
  mode: "enforce" as const,
};
const merged = mergeSemanticJudgeIntoValidationReport(deterministicReport, enforced);
assert.equal(merged.allowed, false);
assert.ok(merged.checks.some((check) => check.key === "semantic_scene_boundary"));

const unavailableShadow = await runSemanticOutputJudge({
  bindings: { SEMANTIC_JUDGE_MODE: "shadow" },
  prose: "test",
  writerPacket: createFixturePacket(5),
  deterministicReport,
});
assert.equal(unavailableShadow.called, false);
assert.match(unavailableShadow.warning ?? "", /not configured/i);

await assert.rejects(() =>
  runSemanticOutputJudge({
    bindings: { SEMANTIC_JUDGE_MODE: "enforce" },
    prose: "test",
    writerPacket: createFixturePacket(5),
    deterministicReport,
  }),
);

console.log("PASS semantic output judge rollout and enforcement");
