import assert from "node:assert/strict";
import { validateAiOutput } from "../src/services/output-validator.js";

const report = validateAiOutput({
  outputText:
    "Nadira tahu Arman adalah ayah kandung Rama. secret council.\n\n" +
    "Narasi datar tanpa dialog. " +
    "kata ".repeat(170),
  forbiddenConcepts: ["secret council"],
  mustInclude: ["pedang"],
  povForbiddenFactTexts: ["Arman adalah ayah kandung Rama"],
  retentionHookKeywords: ["ancaman"],
  styleRules: {
    paragraphLength: "short",
    dialogueDensity: "high",
    forbiddenStyle: ["Narasi datar"],
  },
});

assert.equal(report.allowed, false);
assert.ok(report.checks.find((check) => check.key === "no_future_reveal_leak" && !check.passed));
assert.ok(report.checks.find((check) => check.key === "pov_character_knowledge" && !check.passed));
assert.ok(report.checks.find((check) => check.key === "beat_requirement_coverage" && !check.passed));
assert.ok(report.checks.find((check) => check.key === "safe_mobile_prose_length" && !check.passed));
assert.ok(report.checks.find((check) => check.key === "retention_unlock_hook" && !check.passed));
assert.ok(
  report.checks.find(
    (check) =>
      check.key === "style_voice_consistency" &&
      !check.passed &&
      check.severity === "blocked",
  ),
);

const safe = validateAiOutput({
  outputText: 'Nadira mengangkat pedang.\n\n"Berhenti!" serunya saat ancaman mendekat.',
  forbiddenConcepts: ["secret council"],
  mustInclude: ["pedang"],
  retentionHookKeywords: ["ancaman"],
  styleRules: { paragraphLength: "short" },
});
assert.equal(safe.allowed, true);

console.log("PASS focused output validator pipeline");
