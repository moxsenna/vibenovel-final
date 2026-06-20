import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REQUIRED_SIGNAL_TYPES,
  buildIntakeExtractionInstructions,
  parseIntakeAiEnvelope,
} from "../src/services/intake-extraction.ts";

assert.equal(REQUIRED_SIGNAL_TYPES.length, 7);
assert.ok(REQUIRED_SIGNAL_TYPES.includes("genre"));

const envelopeJson = JSON.stringify({
  reply: "Halo penulis!",
  signals: [
    { type: "genre", label: "Sekolah Sihir", value: "sekolah sihir", confidence: 0.95 },
    { type: "invalid_type", label: "X", value: "y", confidence: 1 },
  ],
  readyForConcept: true,
});

const parsed = parseIntakeAiEnvelope(envelopeJson);
assert.ok(parsed);
assert.equal(parsed!.reply, "Halo penulis!");
assert.equal(parsed!.readyForConcept, true);
assert.equal(parsed!.signals.length, 1);
assert.equal(parsed!.signals[0]?.type, "genre");

const fenced = "```json\n" + envelopeJson + "\n```";
assert.ok(parseIntakeAiEnvelope(fenced));

const wrapped = "Some intro\n" + envelopeJson + "\n trailing";
assert.ok(parseIntakeAiEnvelope(wrapped));

assert.equal(parseIntakeAiEnvelope("not json at all"), null);

const instructions = buildIntakeExtractionInstructions(
  ["protagonist"],
  [{ type: "genre", label: "Fantasi Urban", value: "fantasi urban" }],
);
assert.match(instructions, /fantasi urban/);
assert.match(instructions, /protagonist/);
assert.match(instructions, /Maksimal ~4 kalimat/);
assert.match(instructions, /readyForConcept/);

const intakeTs = readFileSync("src/services/intake.ts", "utf8");
assert.doesNotMatch(intakeTs, /from "\.\/intake\.js"/);
assert.match(intakeTs, /parseIntakeAiEnvelope/);
assert.match(intakeTs, /row\.type === draft\.type/);
assert.match(intakeTs, /recomputeIntakeProgressFromExistingSignals/);
assert.match(intakeTs, /isAiGenerationEnabled\(bindings\)/);
assert.doesNotMatch(intakeTs, /row\.value\.trim\(\)\.toLowerCase\(\) === normalizedValue/);

const extractionTs = readFileSync("src/services/intake-extraction.ts", "utf8");
assert.doesNotMatch(extractionTs, /from "\.\/intake\.js"/);

console.log("PASS intake extraction contracts");