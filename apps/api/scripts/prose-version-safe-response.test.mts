import assert from "node:assert/strict";
import { mapChapterProseVersionRow } from "../src/lib/mappers.ts";

const mapped = mapChapterProseVersionRow({
  id: "prose-safe-response",
  project_id: "project-safe-response",
  chapter_beat_id: "beat-safe-response",
  version_number: 3,
  prose_text: "Kalimat aman untuk pembaca.",
  word_count: 5,
  source: "ai_generated",
  is_current: true,
  context_packet_log_id: "packet-safe-response",
  metadata: {
    rewriteMode: "tighten_pacing",
    sourceProseVersionId: "prose-v2",
    provider: "openrouter",
    model: "secret-model-id",
    token: "secret-token",
    full_prompt: "raw prompt must not leak",
    nested: {
      provider: "nested-provider",
      promptHash: "safe-hash",
      note: "safe nested note",
    },
  },
  created_at: "2026-06-15T00:00:00.000Z",
});

assert.deepEqual(mapped.metadata, {
  rewriteMode: "tighten_pacing",
  sourceProseVersionId: "prose-v2",
  nested: {
    promptHash: "safe-hash",
    note: "safe nested note",
  },
});

const serialized = JSON.stringify(mapped);
for (const forbidden of [
  "openrouter",
  "secret-model-id",
  "secret-token",
  "raw prompt must not leak",
  "nested-provider",
]) {
  assert.equal(
    serialized.includes(forbidden),
    false,
    `ChapterProseVersion response leaked ${forbidden}`,
  );
}

console.log("PASS prose version mapper returns safe response metadata only");
