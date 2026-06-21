import assert from "node:assert/strict";
import {
  createStyleFeedback,
  extractStyleEditMetrics,
} from "../src/services/style-feedback.js";

const source =
  "Seperti yang diketahui, Nadira berjalan perlahan sambil memikirkan seluruh peristiwa yang telah terjadi pada hari itu.\n\n" +
  "Ia menatap pintu yang tertutup rapat dan mencoba menjelaskan semuanya kepada dirinya sendiri.";
const edited = '"Pergi," kata Nadira.\n\nPintu tertutup.';
const metrics = extractStyleEditMetrics(source, edited);
assert.ok(metrics.paragraphWordDelta < 0);
assert.ok(metrics.sentenceWordDelta < 0);
assert.ok(metrics.dialogueDensityDelta > 0);
assert.ok(metrics.expositionMarkerDeletions > 0);
assert.ok(metrics.endingWordDelta < 0);
assert.doesNotMatch(JSON.stringify(metrics), /Nadira|Pintu tertutup/);

const event = createStyleFeedback({
  projectId: "p1",
  sourceVersionId: "v1",
  editedVersionId: "v2",
  feedbackType: "accepted_user_edit",
  appliedToProfileVersion: null,
});
assert.equal(event.feedbackType, "accepted_user_edit");

console.log("PASS accepted edit style feedback metrics");
