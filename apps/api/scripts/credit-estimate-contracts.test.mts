import assert from "node:assert/strict";
import { AppError } from "../src/errors.ts";
import { resolveCreditEstimate } from "../src/routes/credits.ts";

assert.deepEqual(
  resolveCreditEstimate({
    feature: "prose_beat",
    qualityMode: "seimbang",
  }),
  {
    feature: "prose_beat",
    qualityMode: "seimbang",
    creditCost: 1_500,
    creditPricingVersion: "v2",
  },
);

assert.deepEqual(
  resolveCreditEstimate({
    feature: "intake_chat_reply",
  }),
  {
    feature: "intake_chat_reply",
    qualityMode: null,
    creditCost: 100,
    creditPricingVersion: "v2",
  },
);

assert.throws(
  () =>
    resolveCreditEstimate({
      feature: "not-a-feature",
      qualityMode: "hemat",
    }),
  (error: unknown) =>
    error instanceof AppError &&
    error.code === "BAD_REQUEST" &&
    /feature/i.test(error.message),
);

assert.throws(
  () =>
    resolveCreditEstimate({
      feature: "prose_beat",
      qualityMode: "ultra",
    }),
  (error: unknown) =>
    error instanceof AppError &&
    error.code === "BAD_REQUEST" &&
    /qualityMode/i.test(error.message),
);

console.log("PASS credit estimate Phase 3 contracts");
