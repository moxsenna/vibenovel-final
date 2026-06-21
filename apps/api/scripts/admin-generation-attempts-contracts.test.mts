import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adminOps = readFileSync("src/services/admin-ops.ts", "utf8");
assert.match(adminOps, /listGenerationProviderEvents/);
assert.match(adminOps, /providerEvents/);
assert.match(adminOps, /logicalModel/);
assert.match(adminOps, /routingPolicyVersion/);
assert.match(adminOps, /fallbackUsed/);
assert.doesNotMatch(adminOps, /rawPrompt|rawResponse|reasoningText/);

const adminRoutes = readFileSync("src/routes/admin.ts", "utf8");
assert.match(adminRoutes, /generation-attempts\/:attemptId/);

console.log("PASS admin generation attempt diagnostics contracts");
