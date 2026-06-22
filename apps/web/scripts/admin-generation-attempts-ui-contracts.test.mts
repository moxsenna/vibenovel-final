import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const list = readFileSync(
  "src/pages/admin/AdminGenerationAttemptsPage.tsx",
  "utf8",
);
const detail = readFileSync(
  "src/pages/admin/AdminGenerationAttemptDetailPage.tsx",
  "utf8",
);
const routes = readFileSync("src/routes/index.tsx", "utf8");

for (const label of ["Provider", "Logical model", "Fallback", "Latensi", "Biaya"]) {
  assert.match(list, new RegExp(label, "i"));
}

for (const label of [
  "Timeline provider",
  "Primary",
  "Fallback",
  "HTTP",
  "Retry",
  "Token",
  "Correlation",
]) {
  assert.match(detail, new RegExp(label, "i"));
}

assert.match(routes, /generation-attempts\/:attemptId/);
assert.doesNotMatch(detail, /raw prompt|raw response|reasoning content/i);

console.log("PASS admin generation attempts UI contracts");
