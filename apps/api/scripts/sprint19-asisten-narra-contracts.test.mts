import assert from "node:assert/strict";
import {
  FOUNDATION_READINESS_LEVELS,
  INTAKE_PHASES,
  LOCK_READINESS_MIN_SCORE,
  REFINE_READINESS_MIN_SCORE,
} from "@vibenovel/shared";

assert.equal(INTAKE_PHASES.foundation_refinement, "foundation_refinement");
assert.equal(FOUNDATION_READINESS_LEVELS.siap_dimatangkan, "siap_dimatangkan");
assert.equal(FOUNDATION_READINESS_LEVELS.sangat_siap, "sangat_siap");
assert.equal(REFINE_READINESS_MIN_SCORE, 75);
assert.equal(LOCK_READINESS_MIN_SCORE, 85);

console.log("PASS Sprint 19 Asisten Narra contracts");
