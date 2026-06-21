import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_STYLE_RULES,
  normalizeOperationalStyleRules,
  styleRulesToPromptLines,
} from "../src/services/style-profile.js";

assert.equal(DEFAULT_STYLE_RULES.paragraphLength, "medium");
assert.equal(Object.keys(DEFAULT_STYLE_RULES).length, 9);

const normalized = normalizeOperationalStyleRules({
  paragraphLength: "short",
  averageSentenceWords: 12.345,
  dialogueDensity: "high",
  narrationStyle: ["close POV"],
  forbiddenStyle: ["head hopping"],
  signatureMoves: ["short ending"],
  expositionTolerance: "low",
  metaphorDensity: "low",
  endingRhythm: ["cliffhanger"],
  ignored: "not persisted",
});
assert.equal(normalized.averageSentenceWords, 12.35);
assert.equal(normalized.paragraphLength, "short");
assert.deepEqual(normalized.forbiddenStyle, ["head hopping"]);
assert.match(styleRulesToPromptLines(normalized).join("\n"), /Forbidden style: head hopping/);

const migration = readFileSync(
  "../../supabase/migrations/00025_style_profile_voice_feedback.sql",
  "utf8",
);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.style_profiles/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /style_feedback_events_insert_owner/);
assert.match(migration, /parent_version_id/);

console.log("PASS style profile schema and operational rule contracts");
