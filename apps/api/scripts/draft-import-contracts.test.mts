import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AppError } from "../src/errors.ts";
import {
  extractDraftImportSignalsFromText,
  parseDraftImportBody,
  summarizeDraftContent,
} from "../src/services/draft-import.ts";

const draftText = `
Nadira menatap dapur mertuanya yang sempit. Suaminya pulang bersama perempuan lain,
sementara ibu mertua terus menghina Nadira sebagai menantu miskin yang tak pantas.
Draft ini ditulis untuk pembaca wanita KBM di HP: bab pendek, konflik keluarga tajam,
rahasia lama tentang anak yang disembunyikan, dan janji balas dendam elegan saat
Nadira akhirnya bangkit tanpa mengubah fakta canon apa pun.
`.trim();

const parsed = parseDraftImportBody({ content: draftText });
assert.equal(parsed.content, draftText);

assert.throws(
  () => parseDraftImportBody({ content: "terlalu pendek" }),
  (err: unknown) =>
    err instanceof AppError &&
    err.code === "BAD_REQUEST" &&
    err.message.includes("at least"),
);

const summary = await summarizeDraftContent(draftText);
assert.equal(summary.wordCount >= 50, true);
assert.equal(summary.excerptPreview.includes("Nadira menatap"), true);
assert.equal(summary.contentHash.length, 64);

const signals = extractDraftImportSignalsFromText(draftText);
const signalTypes = new Set(signals.map((signal) => signal.type));
assert.ok(signalTypes.has("genre"));
assert.ok(signalTypes.has("protagonist"));
assert.ok(signalTypes.has("core_conflict"));
assert.ok(signalTypes.has("reader_promise"));
assert.ok(signalTypes.has("target_reader"));
assert.ok(signalTypes.has("continuity_warning"));
assert.ok(signals.every((signal) => signal.metadata.source === "imported_draft"));

const migrationSql = readFileSync(
  "../../supabase/migrations/00013_sprint15_draft_import.sql",
  "utf8",
);
for (const required of [
  "draft_imports",
  "draft_import_signals",
  "content_hash",
  "excerpt_preview",
  "word_count",
]) {
  assert.match(migrationSql, new RegExp(required), `${required} must exist in migration`);
}

console.log("PASS Sprint 15 draft import contracts");
