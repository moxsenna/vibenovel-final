import assert from "node:assert/strict";
import { createFixturePacket } from "./fixtures/long-serial-30-chapters-fixture.data.js";
import { styleRulesToPromptLines } from "../src/services/style-profile.js";
import { serializeContext } from "../src/services/writer-context-serializer.js";
import { validateStyle } from "../src/services/validators/style-validator.js";

const rules = {
  paragraphLength: "short" as const,
  averageSentenceWords: 12,
  dialogueDensity: "high" as const,
  narrationStyle: ["close emotional POV"],
  forbiddenStyle: ["encyclopedic exposition"],
  signatureMoves: ["compressed closing paragraph"],
  expositionTolerance: "low" as const,
  metaphorDensity: "low" as const,
  endingRhythm: ["short cliffhanger"],
};
const packet = createFixturePacket(5);
packet.continuity.styleRules = styleRulesToPromptLines(rules);
const serialized = serializeContext(packet, "conservative").text;
assert.match(serialized, /Paragraph length target: short/);
assert.match(serialized, /Forbidden style: encyclopedic exposition/);

const findings = validateStyle(
  "This passage uses encyclopedic exposition to explain everything.",
  rules,
);
assert.ok(findings.some((finding) => finding.type === "blocked"));

console.log("PASS operational voice lock serialization and validation");
