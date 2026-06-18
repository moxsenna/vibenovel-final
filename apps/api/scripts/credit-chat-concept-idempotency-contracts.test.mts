import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const intakeSource = readFileSync(
  new URL("../src/services/intake.ts", import.meta.url),
  "utf8",
);
const conceptSource = readFileSync(
  new URL("../src/services/concept.ts", import.meta.url),
  "utf8",
);
const intakeWebSource = readFileSync(
  new URL("../../web/src/hooks/useIntakeData.ts", import.meta.url),
  "utf8",
);
const conceptWebSource = readFileSync(
  new URL("../../web/src/hooks/useConceptsData.ts", import.meta.url),
  "utf8",
);

for (const [label, source] of [
  ["intake", intakeSource],
  ["concept", conceptSource],
] as const) {
  assert.match(
    source,
    /parsePaidActionIdempotencyKey\s*\(\s*body\.idempotencyKey/,
    `${label} must validate a client-supplied idempotency key`,
  );
  assert.match(
    source,
    /getGenerationAttemptByIdempotencyKey/,
    `${label} must detect a replay before creating another paid attempt`,
  );
  assert.doesNotMatch(
    source,
    /const idempotencyKey\s*=\s*`[^`]*\$\{crypto\.randomUUID\(\)\}/,
    `${label} must not replace the client retry key with a server-random key`,
  );
  assert.match(
    source,
    /idempotentReplay/,
    `${label} must report whether the successful result is a replay`,
  );
  assert.match(
    source,
    /creditCost/,
    `${label} must return the successful action cost for UI transparency`,
  );
}

assert.match(
  intakeWebSource,
  /idempotencyKey/,
  "intake web requests must send an idempotency key",
);
assert.match(
  conceptWebSource,
  /idempotencyKey/,
  "concept generation requests must send an idempotency key",
);

console.log("PASS intake/concept paid-action idempotency contracts");
