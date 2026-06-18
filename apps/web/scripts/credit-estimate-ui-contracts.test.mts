import assert from "node:assert/strict";
import { WRITER_QUALITY_MODES } from "@vibenovel/shared";
import {
  formatProseBeatActionCostLabel,
  formatProseRewriteActionCostLabel,
  formatPublishCopyCreditCostLabel,
  getProseBeatCreditCost,
  getProseRewriteCreditCost,
  getPublishCopyCreditCost,
  resolveDisplayedCreditCost,
} from "../src/services/ai-credit-display.ts";
import { buildCreditEstimatePath } from "../src/services/credit-estimate.ts";

assert.equal(
  getProseBeatCreditCost(WRITER_QUALITY_MODES.seimbang, 777),
  777,
  "server prose-beat estimate must override the offline fallback",
);
assert.equal(
  getProseRewriteCreditCost(WRITER_QUALITY_MODES.seimbang, 666),
  666,
  "server prose-rewrite estimate must override the offline fallback",
);
assert.equal(
  getPublishCopyCreditCost(WRITER_QUALITY_MODES.seimbang, 555),
  555,
  "server publish estimate must override the offline fallback",
);

assert.equal(
  getProseBeatCreditCost(WRITER_QUALITY_MODES.seimbang),
  1_500,
  "the v2 local value remains an offline fallback",
);
assert.equal(
  formatProseBeatActionCostLabel(WRITER_QUALITY_MODES.hemat, 321),
  "Biaya Tulis Beat dengan AI: 321 kredit",
);
assert.equal(
  formatProseRewriteActionCostLabel(WRITER_QUALITY_MODES.hemat, 222),
  "Biaya rewrite: 222 kredit",
);
assert.equal(
  formatPublishCopyCreditCostLabel(WRITER_QUALITY_MODES.hemat, 111),
  "Biaya: 111 kredit",
);
assert.equal(
  buildCreditEstimatePath("prose_beat", WRITER_QUALITY_MODES.terbaik),
  "/api/credits/estimate?feature=prose_beat&qualityMode=terbaik",
);
assert.equal(
  buildCreditEstimatePath("intake_chat_reply"),
  "/api/credits/estimate?feature=intake_chat_reply",
);
assert.equal(resolveDisplayedCreditCost(1000, 3), 1000);
assert.equal(resolveDisplayedCreditCost(null, 3), 3);

console.log("PASS frontend server-authoritative credit estimate contracts");
