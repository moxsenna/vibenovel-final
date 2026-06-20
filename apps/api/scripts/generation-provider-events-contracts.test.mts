import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type {
  GenerationAttempt,
  GenerationProviderEvent,
} from "@vibenovel/shared";
import {
  buildSafeProviderEventInsert,
  createProviderEventSequence,
  nextProviderEventSequence,
  sanitizeProviderEventError,
} from "../src/services/generation-provider-event.ts";

const sql = readFileSync(
  "../../supabase/migrations/00022_ai_routing_provider_telemetry.sql",
  "utf8",
).toLowerCase();

for (const required of [
  "logical_model text",
  "routing_policy_version text",
  "fallback_used boolean",
  "retry_count integer",
  "provider_latency_ms integer",
  "create table public.generation_provider_events",
  "generation_attempt_id uuid",
  "sequence_number integer",
  "route_role text",
  "provider_model_id text",
  "provider_http_status integer",
  "estimated_cost_usd numeric",
  "enable row level security",
  "grant all on public.generation_provider_events to service_role",
]) {
  assert.match(sql, new RegExp(required.replace(/[()]/g, "\\$&")));
}

assert.doesNotMatch(
  sql,
  /grant select on public\.generation_provider_events to authenticated/,
);
assert.doesNotMatch(sql, /raw_prompt|raw_response|reasoning|generated_text/);

// Compile-time field-existence assertions only — never invoked, so no value
// is dereferenced at runtime under tsx type-stripping.
function _assertTelemetryTypes(
  attempt: GenerationAttempt,
  event: GenerationProviderEvent,
): void {
  void attempt.logicalModel;
  void attempt.routingPolicyVersion;
  void attempt.fallbackUsed;
  void event.providerModelId;
  void event.outcome;
}
void _assertTelemetryTypes;

assert.deepEqual(
  sanitizeProviderEventError({
    code: "AI_PROVIDER_ERROR",
    message: "Bearer sk-secret raw response: forbidden",
    providerHttpStatus: 502,
  }),
  {
    errorCategory: "provider_error",
    errorCodeSafe: "AI_PROVIDER_ERROR",
    providerHttpStatus: 502,
  },
);

const insert = buildSafeProviderEventInsert({
  generationAttemptId: "11111111-1111-1111-1111-111111111111",
  sequenceNumber: 1,
  routeRole: "primary",
  provider: "tokenrouter",
  logicalModel: "minimax_text",
  providerModelId: "MiniMax-M3",
  retryNumber: 0,
  outcome: "succeeded",
  latencyMs: 120,
  inputTokens: 10,
  outputTokens: 20,
  estimatedCostUsd: 0,
});

assert.equal(Object.hasOwn(insert, "prompt"), false);
assert.equal(Object.hasOwn(insert, "output"), false);
assert.equal(Object.hasOwn(insert, "raw_response"), false);

const sequence = createProviderEventSequence();
assert.deepEqual(
  [
    nextProviderEventSequence(sequence),
    nextProviderEventSequence(sequence),
    nextProviderEventSequence(sequence),
  ],
  [1, 2, 3],
);

console.log("PASS generation provider telemetry schema contracts");
