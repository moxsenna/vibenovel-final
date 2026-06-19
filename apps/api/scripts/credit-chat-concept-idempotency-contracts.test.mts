import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
} from "@vibenovel/shared";
import { generateWithMockProvider } from "../src/services/mock-ai-provider.ts";

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
  assert.doesNotMatch(
    source,
    /aiEnabled\s*&&\s*!useMock/,
    `${label} must keep mock-provider success inside paid-action orchestration`,
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

const mockConfig = {
  provider: "mock" as const,
  model: "mock/credit-v2-contract",
  maxOutputTokens: 3_000,
  timeoutMs: 1_000,
  temperature: 0.4,
};

const mockIntake = await generateWithMockProvider(
  {
    generationType: GENERATION_TYPES.intake_assistant,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    promptHash: "intake-credit-v2-contract",
  },
  mockConfig,
  "success",
);
assert.doesNotMatch(
  mockIntake.text,
  /^Mock output for /,
  "mock intake must return a user-facing assistant reply",
);

const mockConcepts = await generateWithMockProvider(
  {
    generationType: GENERATION_TYPES.concept_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    promptHash: "concept-credit-v2-contract",
  },
  mockConfig,
  "success",
);
const parsedMockConcepts = JSON.parse(mockConcepts.text) as unknown[];
assert.equal(
  parsedMockConcepts.length,
  3,
  "mock concept generation must return exactly three concepts",
);

console.log("PASS intake/concept paid-action idempotency contracts");
