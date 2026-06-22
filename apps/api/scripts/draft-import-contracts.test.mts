import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GENERATION_TYPES, WRITER_QUALITY_MODES } from "@vibenovel/shared";
import type { AppBindings } from "../src/env.ts";
import { AppError } from "../src/errors.ts";
import type {
  ModelRouterGenerateInput,
  ModelRouterGenerateResult,
} from "../src/services/ai-generation-types.ts";
import {
  extractDraftImportSignalsFromText,
  isDuplicateDraftImportError,
  parseDraftImportBody,
  summarizeDraftContent,
} from "../src/services/draft-import.ts";
import {
  buildDraftImportSignalExtractionRouterInput,
  extractDraftImportSignalsAiFirst,
  parseDraftImportSignalExtractionOutput,
} from "../src/services/import/signal-extraction-ai.ts";
import { createProviderEventSequence } from "../src/services/generation-provider-event.ts";

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
assert.equal(signals.find((signal) => signal.type === "protagonist")?.value, "Nadira");
assert.ok(signalTypes.has("core_conflict"));
assert.ok(signalTypes.has("reader_promise"));
assert.ok(signalTypes.has("target_reader"));
assert.ok(signalTypes.has("continuity_warning"));
assert.ok(signals.every((signal) => signal.metadata.source === "imported_draft"));

const mysteryDraftText = `
BAB 1

Nara Prameswari menggenggam tiket tua tanpa tujuan yang ia temukan di kotak
warisan ibunya. Hujan turun di atap Stasiun Senja, membuat tulisan di tiket itu
semakin samar.

Raka menatap Pak Seno dengan wajah pucat. "Peron 3 sudah ditutup."

Pak Seno mencengkeram tongkatnya. Dari balik dinding arsip, suara rel mulai
bergetar.

Pelan. Lalu semakin keras.

Seolah ada kereta yang memang datang.

Seolah dua belas tahun tidak pernah berlalu.

Dan di dalam genggaman Nara, tabung film hitam itu terasa lebih berat
daripada seluruh masa lalunya. Ia mulai curiga kematian ayahnya bukan
kecelakaan, dan arsip tersembunyi itu menyimpan jawaban yang dulu ditutup
ibunya.

BAB 2

Nara kembali ke ruang administrasi lama sendirian. Raka mengikuti dari jauh,
dingin seperti biasa, tetapi ia tahu terlalu banyak tentang malam ketika kereta
terakhir meninggalkan stasiun.
`.trim();

const mysterySignals = extractDraftImportSignalsFromText(mysteryDraftText);
const mysteryProtagonist = mysterySignals.find((signal) => signal.type === "protagonist");
assert.equal(mysteryProtagonist?.value, "Nara");
assert.notEqual(mysteryProtagonist?.value, "BAB");
assert.equal(mysterySignals.find((signal) => signal.type === "genre")?.value, "misteri drama");
assert.match(
  mysterySignals.find((signal) => signal.type === "core_conflict")?.label ?? "",
  /arsip|kematian|masa lalu|misteri/i,
);
assert.ok(mysterySignals.some((signal) => signal.type === "tone"));
assert.ok(mysterySignals.some((signal) => signal.type === "secret_candidate"));
assert.equal(
  mysterySignals.some(
    (signal) =>
      signal.type === "reader_promise" && /kebangkitan|pembalasan/i.test(signal.value),
  ),
  false,
);

const romcomDraftText = `
BAB 1

Kira menutup laptopnya tepat ketika Mama menelepon untuk menanyakan undangan
pernikahan Dimas minggu depan. Dalam kepanikan, Kira mengaku sudah punya pacar.
Masalahnya, pacar itu tidak ada.

Maya, sahabat Kira sekaligus pemilik coffee shop kecil, menyarankan solusi
paling buruk dengan wajah paling serius: pinjam saja Arka.

BAB 2

Arka Wibisana muncul di kantor brand dengan kemeja terlalu rapi dan senyum
terlalu percaya diri. Mantan teman SMA Kira itu setuju pura-pura menjadi pacar
Kira selama acara keluarga, tetapi ia punya syarat: Kira harus membantunya
memenangkan pitch brand besar dengan berpura-pura menjadi muse kampanye
romantisnya.

BAB 3

Di depan keluarga besar, Kira dan Arka saling melempar senyum palsu, jawaban
witty, dan tatapan yang hampir terlalu meyakinkan. Setiap kali Mama bertanya
kapan nikah, Kira ingin menghilang di balik piring kue.
`.trim();

const romcomSignals = extractDraftImportSignalsFromText(romcomDraftText);
const romcomByType = new Map(romcomSignals.map((signal) => [signal.type, signal]));
assert.equal(romcomByType.get("protagonist")?.value, "Kira");
assert.equal(romcomByType.get("genre")?.value, "romantic comedy");
assert.match(romcomByType.get("tone")?.value ?? "", /witty|hangat|ringan/i);
assert.match(
  romcomByType.get("core_conflict")?.value ?? "",
  /pura-pura|pacar|keluarga|pitch|mantan/i,
);
assert.match(
  romcomByType.get("reader_promise")?.value ?? "",
  /romansa|komedi|chemistry|fake dating|keluarga/i,
);
assert.equal(
  romcomSignals.some(
    (signal) => /misteri|stasiun|arsip|kereta|kematian ayah/i.test(`${signal.label} ${signal.value}`),
  ),
  false,
);

const domesticDramaDraftText = `
BAB 1

Rani Pradipta menata piring di meja makan untuk tiga orang, seperti biasa.
Bima pulang larut lagi, membawa alasan pendek tentang lembur dan wajah yang
terlalu lelah untuk diajak bicara. Alia memperhatikan keduanya tanpa bertanya.

BAB 2

Ketika Rani mengecek tabungan bersama untuk belanja katering, jumlahnya
berkurang tanpa penjelasan. Ia sempat mengira Bima berselingkuh, tetapi catatan
transfer dan pesan dari penagih utang membuat dadanya lebih sesak.

BAB 3

Bu Ratna datang ke rumah dan langsung mengatur cara Rani bicara pada tetangga.
Masalah rumah tangga, kata Bu Ratna, harus ditutup rapat. Rani mulai memahami
bahwa Bima kehilangan pekerjaan enam bulan lalu, berutang diam-diam, dan
melibatkan ibunya agar kebohongan itu tetap rapi.
`.trim();

const domesticSignals = extractDraftImportSignalsFromText(domesticDramaDraftText);
const domesticByType = new Map(domesticSignals.map((signal) => [signal.type, signal]));
assert.equal(domesticByType.get("protagonist")?.value, "Rani");
assert.equal(domesticByType.get("genre")?.value, "drama rumah tangga");
assert.match(domesticByType.get("tone")?.value ?? "", /emosional|realistis|tegang/i);
assert.match(
  domesticByType.get("core_conflict")?.value ?? "",
  /utang|pekerjaan|tabungan|mertua|kebohongan/i,
);
assert.match(
  domesticByType.get("reader_promise")?.value ?? "",
  /rumah tangga|kebohongan|Rani|keluarga/i,
);
assert.ok(domesticSignals.some((signal) => signal.type === "secret_candidate"));
assert.equal(
  domesticSignals.some(
    (signal) => /romantic comedy|fake dating|Kira|Arka|pitch brand/i.test(`${signal.label} ${signal.value}`),
  ),
  false,
);

const aiExtractionText = JSON.stringify({
  signals: [
    {
      type: "genre",
      label: "Drama rumah tangga realistis",
      value: "drama rumah tangga",
      confidence: 0.94,
      evidence: "Bima kehilangan pekerjaan enam bulan lalu, berutang diam-diam",
    },
    {
      type: "tone",
      label: "Emosional, realistis, tegang pelan",
      value: "emosional realistis tegang pelan",
      confidence: 0.9,
      evidence: "Rani menata piring di meja makan untuk tiga orang",
    },
    {
      type: "protagonist",
      label: "Tokoh utama: Rani Pradipta",
      value: "Rani Pradipta",
      confidence: 0.92,
      evidence: "Rani Pradipta menata piring di meja makan",
    },
    {
      type: "core_conflict",
      label: "Kebohongan finansial dalam keluarga",
      value: "suami kehilangan pekerjaan, utang diam-diam, tabungan berkurang, dan mertua menutupinya",
      confidence: 0.93,
      evidence: "tabungan bersama berkurang tanpa penjelasan",
    },
  ],
});

const aiParsedSignals = parseDraftImportSignalExtractionOutput(aiExtractionText, {
  provider: "openrouter",
  model: "google/gemini-2.5-flash:free",
  promptHash: "prompt-hash",
});
assert.equal(aiParsedSignals.length, 4);
assert.equal(aiParsedSignals[0].metadata.extractor, "ai_draft_import");
assert.equal(aiParsedSignals[0].metadata.extractionMode, "ai");
assert.equal(aiParsedSignals[0].metadata.model, "google/gemini-2.5-flash:free");
assert.match(String(aiParsedSignals[0].metadata.evidence), /Bima kehilangan pekerjaan/i);

const staleRomcomFallback = [
  {
    type: "genre",
    label: "Romantic Comedy",
    value: "romantic comedy",
    confidence: 0.9,
    metadata: { source: "imported_draft", extractor: "deterministic_draft_import" },
  },
  {
    type: "core_conflict",
    label: "Pacar pura-pura, tekanan keluarga, dan pitch brand",
    value: "fake dating dan pitch brand",
    confidence: 0.88,
    metadata: { source: "imported_draft", extractor: "deterministic_draft_import" },
  },
];

const aiFirstResult = await extractDraftImportSignalsAiFirst({
  bindings: { AI_PROVIDER_MOCK: "false", AI_GENERATION_ENABLED: "true" } as AppBindings,
  fallbackSignals: staleRomcomFallback,
  generationAttemptId: "11111111-1111-1111-1111-111111111111",
  providerEventSequence: createProviderEventSequence(),
  routerInput: await buildDraftImportSignalExtractionRouterInput(
    domesticDramaDraftText,
  ),
  generate: async (input) => {
    assert.equal(input.generationType, GENERATION_TYPES.draft_import_signal_extraction);
    assert.equal(input.qualityMode, WRITER_QUALITY_MODES.hemat);
    assert.equal(input.temperature, 0.1);
    assert.ok(input.promptMessages?.some((message) => /JSON/i.test(message.content)));
    return {
      text: aiExtractionText,
      output: [],
      provider: "openrouter",
      logicalModel: "deepseek_flash",
      model: "google/gemini-2.5-flash:free",
      inputTokens: 300,
      outputTokens: 120,
      latencyMs: 42,
      finishReason: "stop",
      promptHash: input.promptHash,
      routingPolicyVersion: "v3",
      fallbackUsed: false,
      retryCount: 0,
      estimatedCostUsd: 0,
    };
  },
});
assert.equal(aiFirstResult.extractionMode, "ai");
assert.equal(aiFirstResult.signals.find((signal) => signal.type === "genre")?.value, "drama rumah tangga");
assert.equal(
  aiFirstResult.signals.some((signal) => /romantic comedy|fake dating|pitch brand/i.test(signal.value)),
  false,
);

const fallbackAfterAiError = await extractDraftImportSignalsAiFirst({
  bindings: { AI_PROVIDER_MOCK: "false", AI_GENERATION_ENABLED: "true" } as AppBindings,
  fallbackSignals: domesticSignals,
  generationAttemptId: "22222222-2222-2222-2222-222222222222",
  providerEventSequence: createProviderEventSequence(),
  routerInput: await buildDraftImportSignalExtractionRouterInput(
    domesticDramaDraftText,
  ),
  generate: async () => {
    throw new AppError("AI_PROVIDER_ERROR", "simulated model failure", 502);
  },
});
assert.equal(fallbackAfterAiError.extractionMode, "deterministic_fallback");
assert.equal(fallbackAfterAiError.signals, domesticSignals);

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

const auditEnumMigrationSql = readFileSync(
  "../../supabase/migrations/00018_sprint18_draft_import_audit_enum.sql",
  "utf8",
);
for (const required of [
  "ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'draft_import'",
  "ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'draft_import_created'",
  "ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'draft_import_signals_extracted'",
]) {
  assert.match(auditEnumMigrationSql, new RegExp(required), `${required} must exist in migration`);
}

assert.equal(isDuplicateDraftImportError({ code: "23505" }), true);
assert.equal(isDuplicateDraftImportError({ code: "PGRST116" }), false);
assert.equal(isDuplicateDraftImportError(null), false);

const draftImportServiceSource = readFileSync("src/services/draft-import.ts", "utf8");
for (const required of [
  "isDuplicateDraftImportError(error)",
  ".eq(\"content_hash\", summary.contentHash)",
  ".maybeSingle()",
]) {
  assert.match(
    draftImportServiceSource,
    new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${required} must exist in draft import duplicate retry path`,
  );
}

console.log("PASS Sprint 15 draft import contracts");
