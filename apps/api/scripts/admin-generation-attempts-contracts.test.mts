import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adminOps = readFileSync("src/services/admin-ops.ts", "utf8");
assert.match(adminOps, /listGenerationProviderEvents/);
assert.match(adminOps, /providerEvents/);
assert.match(adminOps, /logicalModel/);
assert.match(adminOps, /routingPolicyVersion/);
assert.match(adminOps, /fallbackUsed/);
assert.doesNotMatch(adminOps, /rawPrompt|rawResponse|reasoningText/);
const attemptSelect = adminOps.match(
  /const ATTEMPT_SELECT =\s*"([^"]+)"/,
)?.[1];
assert.ok(attemptSelect, "ATTEMPT_SELECT must be a static safe column list");
for (const column of [
  "logical_model",
  "routing_policy_version",
  "fallback_used",
  "retry_count",
  "provider_latency_ms",
]) {
  assert.equal(
    attemptSelect.split(/,\s*/).includes(column),
    true,
    `admin attempt queries must select ${column}`,
  );
}

const adminRoutes = readFileSync("src/routes/admin.ts", "utf8");
assert.match(adminRoutes, /generation-attempts\/:attemptId/);

console.log("PASS admin generation attempt diagnostics contracts");
