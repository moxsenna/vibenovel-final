import assert from "node:assert/strict";
import { parseLenientJsonObject } from "../src/services/outline-generator.ts";

// Clean JSON object.
assert.deepEqual(parseLenientJsonObject('{"a":1}'), { a: 1 });

// Fenced JSON (```json … ```).
assert.deepEqual(parseLenientJsonObject('```json\n{"a":2}\n```'), { a: 2 });

// Bare fenced JSON (``` … ```).
assert.deepEqual(parseLenientJsonObject('```\n{"a":3}\n```'), { a: 3 });

// JSON wrapped in model prose — fall back to the outer { … } slice.
assert.deepEqual(
  parseLenientJsonObject('Tentu, ini outline-nya:\n{"seasonLabel":"x"}\nSemoga membantu!'),
  { seasonLabel: "x" },
);

// Arrays and non-objects are rejected (outline must be an object).
assert.equal(parseLenientJsonObject("[1,2,3]"), null);
assert.equal(parseLenientJsonObject("not json at all"), null);
assert.equal(parseLenientJsonObject(""), null);

console.log("PASS Phase 0 generation resilience (lenient JSON parse)");
