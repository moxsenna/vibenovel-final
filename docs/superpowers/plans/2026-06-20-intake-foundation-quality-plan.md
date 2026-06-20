# Intake Foundation Quality Implementation Plan

> **For Codex / agen pelaksana:** Eksekusi plan ini dengan
> `superpowers:executing-plans`. Gunakan `superpowers:test-driven-development`
> untuk setiap perubahan perilaku, dan `superpowers:verification-before-completion`
> sebelum klaim selesai apa pun. Plan ini menutup 4 perbaikan inti yang disepakati
> (1–4 di bawah). Jangan menambah scope di luar empat butir itu tanpa persetujuan.

**Goal:** Menghentikan obrolan intake Asisten Narra yang "berputar-putar" dan
membuat **Progres Fondasi** benar-benar terisi. Akar masalah: deteksi sinyal
memakai regex keyword yang buta terhadap narasi bebas, dan system prompt intake
tidak sadar slot mana yang masih kosong sehingga AI menggali satu benang tanpa
henti. Plan ini mengganti deteksi sinyal menjadi berbasis LLM, membuat prompt
sadar-checklist, membatasi AI agar tidak mengarang plot, dan menjadikan progres
digerakkan oleh ekstraksi LLM.

**Architecture (prinsip yang dipertahankan):**
- Satu lifecycle AI tetap dipakai: create attempt → debit → provider call →
  success atau refund (lihat `appendUserMessageForOwner` di
  `apps/api/src/services/intake.ts`). **Tidak boleh** menambah panggilan LLM
  berbayar kedua per pesan; ekstraksi sinyal "menumpang" pada satu panggilan chat
  yang sama lewat **JSON envelope**.
- Mode AI disabled tetap memakai fallback deterministik gratis (regex stub
  dipertahankan sebagai fallback, bukan dihapus).
- Semua nilai tetap server-authoritative. Frontend tidak perlu diubah; ia sudah
  menghitung progres dari `signals[].type` (`buildHonestProgress` di
  `apps/web/src/lib/api-mappers.ts`).

**Tech Stack:** TypeScript, Hono, React/Vite, Supabase/Postgres, OpenRouter via
`model-router.ts`, Vitest/contract suite, Playwright (`apps/web/e2e`).

---

## Konteks Kode yang Wajib Dipahami Sebelum Mulai

Baca file-file ini lebih dulu; semua perubahan terkonsentrasi di API service:

1. `apps/api/src/services/intake.ts` — jantung intake.
   - `appendUserMessageForOwner` (baris ~471): handler pesan user → balasan agen.
     Sudah memuat lifecycle billing + panggilan `generateWithModelRouter`.
   - `buildAgentStubReply` (baris ~157): balasan deterministik saat AI disabled.
   - `extractSignalsFromText` (baris ~845): **regex extractor yang harus diturunkan
     jadi fallback**.
   - `computeProgressFromSignals` (baris ~971): hitung progres dari 7 tipe wajib.
   - `upsertDetectedSignal` (baris ~983): upsert match by `(type, value)`.
   - `extractSignalsAndProgressInternal` (baris ~1043): jalankan extractor +
     update progres/phase. Dipanggil di akhir `appendUserMessageForOwner`.
   - `extractDetectedSignalsForOwner` (baris ~1133): endpoint standalone
     `POST /extract-signals`.
2. `apps/api/src/services/story-agent-context.ts` — `buildNarraSystemPrompt` +
   `resolveNarraPhase`. **Tempat utama perbaikan prompt (#2, #3).**
3. `apps/api/src/services/concept.ts` — **pola referensi** ekstraksi JSON via LLM
   yang sudah terbukti di codebase (baris ~532–667): system prompt minta JSON,
   `generateWithModelRouter`, strip fence ```` ```json ````, `JSON.parse`,
   validasi bentuk, `assertPlanningOutputSpecificToProject`. **Tiru pola ini.**
4. `apps/api/src/services/model-router.ts` — `generateWithModelRouter(bindings, input)`.
   `input` mendukung: `generationType`, `qualityMode`, `promptHash`,
   `promptMessages`, `temperature`, `maxOutputTokensOverride`. Result:
   `{ text, model, provider, inputTokens, outputTokens, latencyMs, promptHash }`.
   Token cap intake ada di `GENERATION_TYPE_TOKEN_CAP[intake_assistant] = 800`
   (baris ~63) — **akan dinaikkan**.
5. `packages/shared/src/enums.ts` — `DETECTED_SIGNAL_TYPES` (baris ~334),
   `DETECTED_SIGNAL_STATUSES`, `INTAKE_PHASES`, `GENERATION_TYPES`,
   `WRITER_QUALITY_MODES`.
6. `apps/web/src/lib/api-mappers.ts` — `buildHonestProgress` (baris ~433) +
   `SIGNAL_TYPE_ICONS` (baris ~383). **Kontrak frontend:** 7 tipe wajib =
   `genre, protagonist, core_conflict, reader_promise, target_reader,
   secret_candidate, tone`. Selama LLM mengisi `type` ini, UI bekerja tanpa
   perubahan frontend.

### 7 slot fondasi (sumber kebenaran tunggal)
Urut prioritas pertanyaan (breadth-first). Disebut **REQUIRED_SIGNAL_TYPES**:

| Prioritas | `type` | Label UI | Kardinalitas |
|---|---|---|---|
| 1 | `genre` | Genre Cerita | tunggal (replace-by-type) |
| 2 | `protagonist` | Tokoh Utama | tunggal |
| 3 | `core_conflict` | Konflik Utama | tunggal |
| 4 | `reader_promise` | Janji Pembaca | tunggal |
| 5 | `target_reader` | Target Pembaca & Format | tunggal |
| 6 | `tone` | Nada Emosional | tunggal |
| 7 | `secret_candidate` | Rahasia Cerita | **jamak** (boleh >1) |

Tipe lain di `DETECTED_SIGNAL_TYPES` (`antagonist`, `setting`, `theme`,
`relationship_dynamic`, `style_preference`) bersifat **opsional & jamak** — boleh
diekstrak bila muncul, tidak menghalangi progres.

---

## Keputusan Desain (baca sebelum coding)

**D1. Satu panggilan, JSON envelope (bukan dua panggilan).**
`appendUserMessageForOwner` tetap memanggil LLM **sekali** per pesan. Output LLM
diubah dari teks bebas menjadi objek JSON:

```jsonc
{
  "reply": "Balasan percakapan untuk penulis (maks ~4 kalimat).",
  "signals": [
    { "type": "genre", "label": "Fantasi Urban", "value": "fantasi urban indonesia kontemporer", "confidence": 0.9 }
  ],
  "readyForConcept": false
}
```

- `reply` → disimpan sebagai pesan `agent`.
- `signals` → di-upsert ke `detected_signals` (menggantikan regex sebagai sumber
  utama). Ini ekstraksi **atas seluruh percakapan** karena history dikirim ke LLM.
- `readyForConcept` → **hanya sinyal lunak untuk teks balasan**; **gating fase
  tetap deterministik** dari `computeProgressFromSignals` (jangan percaya klaim
  AI untuk gating).
- Tidak ada billing tambahan: tetap satu attempt `intake_assistant`.

**D2. Fallback berlapis (resilience).** Model tier `hemat` kadang mengembalikan
JSON cacat. Parser harus tahan banting:
1. Strip fence ```` ``` ````/```` ```json ````, lalu coba `JSON.parse`.
2. Bila gagal: cari blok `{...}` pertama–terakhir, parse ulang.
3. Bila tetap gagal: **jangan tampilkan JSON mentah ke user.** Pakai `reply`
   fallback = teks dengan blok JSON dibuang; jika kosong, pakai seluruh teks.
   Untuk sinyal, jalankan **regex stub lama** sebagai fallback turn ini agar
   progres tetap bergerak. Tandai `metadata.extractor` sesuai sumber.
4. Parse gagal **tidak** menyebabkan refund/visible error — user tetap dapat
   balasan. Catat `metadata.envelopeParse = "failed"` pada pesan agen untuk audit.

**D3. Regex stub di-*demote*, tidak dihapus.** `extractSignalsFromText` tetap ada
dan dipakai untuk: (a) mode AI disabled, (b) fallback D2. Sinyal ditandai
`metadata.extractor: "deterministic_stub"` vs `"llm"`.

**D4. Precedence saat upsert (cegah clobber).**
- Sinyal `confirmed` (user mengonfirmasi) **tidak boleh** ditimpa/di-downgrade.
- Sinyal `dismissed` (user membuang) **tidak boleh** dibangkitkan ulang dengan
  `value` yang sama.
- Untuk tipe **tunggal** (genre…tone): LLM merevisi nilai → **update baris yang
  ada untuk tipe itu** (match by `type`), bukan menambah baris baru. Ini
  memperbaiki bug "genre lama nyangkut saat direvisi".
- Untuk tipe **jamak** (secret_candidate, dst.): match by `(type, normalized value)`
  seperti sekarang; tambah baris baru bila value baru.
- Sinyal ber-`extractor: "llm"` boleh menimpa baris `deterministic_stub`
  sebelumnya untuk tipe yang sama; sebaliknya **tidak** (LLM lebih dipercaya).

**D5. Endpoint standalone `extract-signals` tidak meng-clobber.** Saat AI enabled,
`extractDetectedSignalsForOwner` **tidak** menjalankan regex (yang bisa merusak
sinyal LLM). Ia hanya **recompute progres/phase dari sinyal yang sudah ada**.
Saat AI disabled, ia tetap jalankan regex stub (perilaku lama). Inline flow sudah
menjaga sinyal tetap segar, jadi endpoint ini cuma "refresh".

**D6. Prompt sadar-checklist + anti-mengarang.** `buildNarraSystemPrompt` untuk
mode intake disuntik ringkasan coverage (slot terisi + nilainya, slot kosong) dan
diberi aturan tegas: tanya **satu** slot kosong prioritas-tertinggi per giliran,
balasan ringkas, maksimal 1–2 opsi pendek, **jangan menulis paragraf plot**,
jangan menetapkan canon diam-diam, dan bila semua slot terisi minimal → rangkum +
arahkan "Lanjut ke Konsep".

**D7. Token & temperature.** Naikkan cap output `intake_assistant` 800 → 1500
(envelope butuh ruang untuk reply + signals). Gunakan `temperature: 0.5` pada
panggilan intake (cukup luwes untuk percakapan, cukup stabil untuk JSON).

---

## Definition of Done

Intake quality dianggap selesai bila **semua** terpenuhi:

1. Dengan AI enabled, mengirim deskripsi "fantasi urban Indonesia, tokoh kurir
   yang salah menerima paket organisasi sihir, konflik melindungi adik yang
   menunjukkan gejala sihir" menghasilkan sinyal `genre=fantasi urban` (BUKAN
   "Fantasy Academy"), `protagonist`, `core_conflict`, `tone`, dan `secret_candidate`
   terisi — dibuktikan lewat smoke/integration test pada Supabase lokal.
2. Balasan Narra ≤ 4 kalimat, mengajukan **satu** pertanyaan, dan pertanyaan itu
   menyasar slot yang **masih kosong** (bukan menggali slot yang sudah terisi).
3. Saat semua 7 slot terisi minimal, `progress_percent` ≥ 80 dan `phase` maju ke
   `concept_generation`; balasan Narra menawarkan lanjut ke konsep.
4. JSON envelope cacat tidak pernah bocor ke user; fallback regex menjaga progres
   tetap bergerak; tidak ada refund/silent error akibat parse gagal (unit test
   parser membuktikan).
5. Sinyal `confirmed`/`dismissed` user tidak ditimpa/dibangkitkan ulang oleh
   ekstraksi berikutnya (test membuktikan).
6. Mode AI disabled tetap berfungsi dengan stub deterministik (regex), tanpa
   memanggil provider, tanpa debit.
7. `extract-signals` standalone tidak merusak sinyal LLM saat AI enabled.
8. Build API + web, lint, dan contract/unit suite hijau. Tidak ada perubahan
   schema DB (semua muat di kolom `metadata` JSON yang sudah ada).
9. Laporan singkat ditulis di `docs/` dengan bukti (transkrip uji + isi
   `detected_signals`).

---

## Task 1 — Helper coverage + REQUIRED_SIGNAL_TYPES (fondasi #2 & #4)

**Tujuan:** Satu sumber kebenaran untuk "slot apa yang wajib & mana yang kosong",
dipakai oleh prompt (Task 3) dan progres (Task 4).

**Files:**
- `apps/api/src/services/story-agent-context.ts` (tambah helper murni, no DB).
- (opsional) ekspor konstanta dari sini, diimpor `intake.ts`.

**Implementasi:**

1. Tambah konstanta + tipe di `story-agent-context.ts`:

```ts
import { DETECTED_SIGNAL_TYPES, type DetectedSignalType } from "@vibenovel/shared";

/** 7 slot fondasi wajib, urut prioritas pertanyaan (breadth-first). */
export const REQUIRED_SIGNAL_TYPES = [
  "genre",
  "protagonist",
  "core_conflict",
  "reader_promise",
  "target_reader",
  "tone",
  "secret_candidate",
] as const satisfies readonly DetectedSignalType[];

export const REQUIRED_SIGNAL_LABELS: Record<(typeof REQUIRED_SIGNAL_TYPES)[number], string> = {
  genre: "Genre cerita",
  protagonist: "Tokoh utama (siapa & luka/keinginannya)",
  core_conflict: "Konflik utama",
  reader_promise: "Janji pembaca (kepuasan yang dijanjikan)",
  target_reader: "Target pembaca & format (mis. hp_serial)",
  tone: "Nada emosional",
  secret_candidate: "Rahasia yang perlu ditahan",
};

export interface CoverageSlot {
  type: (typeof REQUIRED_SIGNAL_TYPES)[number];
  label: string;
  filled: boolean;
  value: string | null;
}

export interface SignalCoverage {
  slots: CoverageSlot[];
  filledCount: number;
  missing: (typeof REQUIRED_SIGNAL_TYPES)[number][];
  percent: number;
  nextMissing: (typeof REQUIRED_SIGNAL_TYPES)[number] | null;
  allFilled: boolean;
}
```

2. Tambah fungsi murni (input = sinyal yang sudah dipetakan, tidak menyentuh DB):

```ts
export function computeSignalCoverage(
  signals: Array<{ type: string; value: string; label?: string; status?: string }>,
): SignalCoverage {
  const active = signals.filter((s) => s.status !== "dismissed");
  const slots: CoverageSlot[] = REQUIRED_SIGNAL_TYPES.map((type) => {
    const hit = active.find((s) => s.type === type);
    return {
      type,
      label: REQUIRED_SIGNAL_LABELS[type],
      filled: Boolean(hit),
      value: hit ? (hit.label || hit.value || null) : null,
    };
  });
  const missing = slots.filter((s) => !s.filled).map((s) => s.type);
  const filledCount = slots.length - missing.length;
  return {
    slots,
    filledCount,
    missing,
    percent: Math.round((filledCount / slots.length) * 100),
    nextMissing: missing[0] ?? null,
    allFilled: missing.length === 0,
  };
}
```

3. Refactor `computeProgressFromSignals` di `intake.ts` agar memakai
   `REQUIRED_SIGNAL_TYPES` (impor dari story-agent-context) alih-alih array literal
   lokal — supaya tidak ada dua daftar yang bisa menyimpang. Perilaku identik.

**Tests (Task 1):** unit test `computeSignalCoverage`:
- 0 sinyal → percent 0, nextMissing `genre`, allFilled false.
- sinyal genre+protagonist → percent 29 (2/7), nextMissing `core_conflict`.
- sinyal dismissed tidak dihitung.
- semua 7 → allFilled true, percent 100, nextMissing null.

---

## Task 2 — Skema envelope, prompt builder, dan parser (inti #1)

**Tujuan:** Definisikan kontrak output LLM + prompt yang memintanya + parser tahan
banting. Tempatkan di modul baru agar mudah diuji terpisah.

**Files baru:**
- `apps/api/src/services/intake-extraction.ts` (prompt builder + parser + tipe).
- `apps/api/src/services/intake-extraction.test.ts` (unit test parser).

**Isi `intake-extraction.ts`:**

1. Tipe envelope + draft sinyal:

```ts
import { DETECTED_SIGNAL_TYPES, type DetectedSignalType } from "@vibenovel/shared";

export interface IntakeSignalDraft {
  type: DetectedSignalType;
  label: string;
  value: string;
  confidence: number;
}

export interface IntakeEnvelope {
  reply: string;
  signals: IntakeSignalDraft[];
  readyForConcept: boolean;
  parseStatus: "ok" | "recovered" | "failed";
}

const VALID_SIGNAL_TYPES = new Set<string>(Object.values(DETECTED_SIGNAL_TYPES));
```

2. **Bagian instruksi output JSON** (dipakai oleh prompt builder Task 3). Simpan
   sebagai konstanta string yang ditambahkan ke akhir system prompt:

```ts
export const INTAKE_ENVELOPE_INSTRUCTION = [
  "FORMAT OUTPUT WAJIB: kembalikan HANYA satu objek JSON valid, tanpa teks lain, tanpa code fence.",
  "Struktur:",
  "{",
  '  "reply": "balasan percakapan untukmu, hangat dan ringkas, MAKS 4 kalimat, hanya SATU pertanyaan",',
  '  "signals": [',
  '    { "type": "<salah satu tipe valid>", "label": "ringkas untuk UI", "value": "nilai kanonik singkat", "confidence": 0.0-1.0 }',
  "  ],",
  '  "readyForConcept": true|false',
  "}",
  "Tipe valid: genre, protagonist, antagonist, core_conflict, reader_promise, tone, secret_candidate, target_reader, relationship_dynamic, setting, theme, style_preference.",
  "Aturan signals:",
  "- Ekstrak dari SELURUH percakapan (bukan hanya pesan terakhir), termasuk yang baru saja ditulis penulis.",
  "- Untuk setiap slot yang sudah JELAS dari percakapan, WAJIB sertakan sinyalnya walau penulis tidak memakai kata kunci eksplisit.",
  "- 'genre' isi sesuai cerita nyata (mis. 'Fantasi Urban'), JANGAN menebak dari satu kata.",
  "- Hanya keluarkan sinyal yang benar-benar didukung percakapan. Jangan mengarang.",
  "- value: frasa kanonik singkat (<= 120 char). label: <= 60 char.",
  "readyForConcept=true HANYA jika genre, protagonist, core_conflict, reader_promise, target_reader, tone, dan minimal satu secret_candidate sudah tertangkap.",
].join("\n");
```

3. **Parser tahan banting** (implementasi D2):

```ts
export function parseIntakeEnvelope(raw: string): IntakeEnvelope {
  const fallbackReply = stripJsonNoise(raw);

  const tryParse = (text: string): unknown | null => {
    try { return JSON.parse(text); } catch { return null; }
  };

  // 1) strip code fences
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  let obj = tryParse(cleaned);
  let status: IntakeEnvelope["parseStatus"] = obj ? "ok" : "failed";

  // 2) recover: ambil { ... } pertama–terakhir
  if (!obj) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      obj = tryParse(cleaned.slice(start, end + 1));
      if (obj) status = "recovered";
    }
  }

  if (!obj || typeof obj !== "object") {
    return { reply: fallbackReply, signals: [], readyForConcept: false, parseStatus: "failed" };
  }

  const o = obj as Record<string, unknown>;
  const reply =
    typeof o.reply === "string" && o.reply.trim() ? o.reply.trim() : fallbackReply;
  const signals = sanitizeSignals(o.signals);
  const readyForConcept = o.readyForConcept === true;
  return { reply, signals, readyForConcept, parseStatus: status };
}
```

4. Helper `sanitizeSignals` (validasi + clamp; buang yang tidak valid):

```ts
function sanitizeSignals(value: unknown): IntakeSignalDraft[] {
  if (!Array.isArray(value)) return [];
  const out: IntakeSignalDraft[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const type = typeof r.type === "string" ? r.type.trim() : "";
    if (!VALID_SIGNAL_TYPES.has(type)) continue;
    const valueStr = String(r.value ?? r.label ?? "").trim().slice(0, 120);
    if (!valueStr) continue;
    const label = String(r.label ?? valueStr).trim().slice(0, 60);
    let confidence = typeof r.confidence === "number" ? r.confidence : 0.7;
    confidence = Math.min(1, Math.max(0, confidence));
    out.push({ type: type as DetectedSignalType, label, value: valueStr, confidence });
  }
  return out;
}
```

5. `stripJsonNoise(raw)`: buang blok ```` ``` ```` dan blok `{...}` dari teks lalu
   trim; jika hasilnya kosong, kembalikan `raw.trim()`. Ini cadangan terakhir agar
   user tetap melihat sesuatu yang mirip kalimat, bukan JSON mentah.

**Tests (Task 2)** di `intake-extraction.test.ts`:
- JSON bersih → `parseStatus "ok"`, reply & signals benar.
- Dibungkus ```` ```json ```` → `ok`.
- Ada prefiks "Tentu! " sebelum `{...}` → `recovered`, reply dari field reply.
- Teks bebas tanpa JSON → `failed`, reply = teks, signals = [].
- Sinyal dengan `type` invalid dibuang; `confidence` di-clamp; `value` kosong dibuang.

---

## Task 3 — Prompt intake sadar-checklist + anti-mengarang (#2 & #3)

**Tujuan:** Ubah `buildNarraSystemPrompt` mode intake agar (a) tahu slot kosong,
(b) breadth-first satu pertanyaan, (c) ringkas & tidak mengarang plot, (d) minta
envelope JSON.

**Files:**
- `apps/api/src/services/story-agent-context.ts`.

**Implementasi:**

1. Perluas `NarraPromptContext` dengan `coverage?: SignalCoverage` dan flag
   `wantsEnvelope?: boolean` (default true untuk intake; mode foundation_refinement
   tetap teks bebas — TIDAK pakai envelope agar tidak mengganggu alur fondasi).

2. Untuk cabang intake (bukan `foundation_refinement`), bangun blok coverage:

```ts
function renderCoverage(coverage?: SignalCoverage): string {
  if (!coverage) return "";
  const filled = coverage.slots
    .filter((s) => s.filled)
    .map((s) => `- ${s.label}: ${s.value}`)
    .join("\n") || "- (belum ada)";
  const missing = coverage.slots
    .filter((s) => !s.filled)
    .map((s) => `- ${s.label}`)
    .join("\n") || "- (semua sudah terisi)";
  return [
    "Status fondasi saat ini —",
    "SUDAH TERTANGKAP:",
    filled,
    "MASIH KOSONG (prioritaskan ini):",
    missing,
  ].join("\n");
}
```

3. Susun system prompt intake baru (gabungkan `base` + aturan perilaku + coverage +
   `INTAKE_ENVELOPE_INSTRUCTION`). Teks aturan perilaku (anti-mengarang, #3):

```
Kamu Asisten Narra, rekan brainstorming penulis serial Indonesia.
Tujuanmu pada fase ini: MELENGKAPI 7 slot fondasi secepat & senatural mungkin.

Cara bertanya:
- Tanyakan SATU slot yang MASIH KOSONG dengan prioritas tertinggi setiap giliran.
- Jangan menggali lebih dalam slot yang SUDAH tertangkap sampai semua slot terisi minimal.
- Balasan maksimal 4 kalimat, hangat, konkret, tidak bertele-tele.
- Boleh menawarkan paling banyak 2 opsi pendek bila membantu penulis memilih.

Larangan:
- JANGAN menulis paragraf plot, adegan, atau worldbuilding panjang. Ini cerita penulis, bukan ceritamu.
- JANGAN menetapkan fakta canon diam-diam; semua tetap usulan yang bisa ditolak penulis.
- JANGAN mengulang detail yang sudah jelas.

Penutup:
- Jika semua 7 slot sudah terisi minimal, rangkum singkat 2-3 kalimat lalu ajak penulis "Lanjut ke Konsep".
```

   Urutan akhir string: `base perilaku` + `\n\n` + `renderCoverage(coverage)` +
   `\n\n` + `INTAKE_ENVELOPE_INSTRUCTION`.

4. **Penting:** cabang `foundation_refinement` di `buildNarraSystemPrompt`
   **tidak diubah** (tetap teks bebas, tanpa envelope). Hanya cabang intake yang
   memakai envelope + coverage.

**Tests (Task 3):** unit test `buildNarraSystemPrompt` untuk mode intake:
- Mengandung label slot yang kosong di bagian "MASIH KOSONG".
- Mengandung nilai slot yang terisi di bagian "SUDAH TERTANGKAP".
- Mengandung `INTAKE_ENVELOPE_INSTRUCTION`.
- Mode `foundation_refinement` TIDAK mengandung instruksi envelope.

---

## Task 4 — Sambungkan envelope ke alur pesan + upsert presedence (inti #1, #4)

**Tujuan:** Ubah `appendUserMessageForOwner` agar: bangun prompt sadar-coverage →
panggil LLM → parse envelope → simpan reply → upsert sinyal LLM dengan presedence
→ recompute progres. Plus implementasi D4 di `upsertDetectedSignal`.

**Files:**
- `apps/api/src/services/intake.ts`.
- `apps/api/src/services/model-router.ts` (naikkan token cap).

**Langkah 4a — token cap & temperature.**
Di `model-router.ts` ubah `GENERATION_TYPE_TOKEN_CAP[intake_assistant]` dari `800`
menjadi `1500`. (Ini batas atas; biaya kredit tidak berubah karena harga
ditentukan `ai-credit-policy.ts` per attempt, bukan per token.)

**Langkah 4b — bangun prompt sadar-coverage (cabang `aiEnabled`).**
Di dalam blok `if (aiEnabled)` pada `appendUserMessageForOwner`, SEBELUM memanggil
`buildNarraSystemPrompt`:

1. Muat sinyal aktif sesi ini:
   `const existingSignals = await listSignalsForSession(bindings, projectId, sessionRow.id);`
2. Untuk cabang intake (bukan foundation_refinement), hitung coverage:
   `const coverage = computeSignalCoverage(existingSignals);`
3. Panggil `buildNarraSystemPrompt({ phase: narraPhase, projectTitle, coverage })`.
   (Untuk `foundation_refinement`, alur lama dipertahankan: kirim
   `foundationSummary`/`readinessSummary`, tanpa coverage/envelope.)

**Langkah 4c — panggil router & parse.**
Saat memanggil `generateWithModelRouter`, tambahkan `temperature: 0.5`. Setelah
dapat `routerResult.text`:

- **Mode intake (envelope):**
  ```ts
  const envelope = parseIntakeEnvelope(routerResult.text);
  agentContent = envelope.reply;
  ```
  Simpan pesan agen dengan metadata diperkaya:
  ```ts
  metadata: {
    source: "openrouter",
    attemptId: attempt.id,
    model: routerResult.model,
    provider: routerResult.provider,
    envelopeParse: envelope.parseStatus,
    readyForConcept: envelope.readyForConcept,
  }
  ```
- **Mode foundation_refinement:** `agentContent = routerResult.text` (tanpa parse),
  seperti sekarang.

**Langkah 4d — terapkan sinyal LLM (ganti pemanggilan extractor).**
Saat ini akhir fungsi memanggil
`extractSignalsAndProgressInternal(bindings, projectId, sessionRow.id, userMsgRow.id)`
(yang menjalankan regex). Ubah menjadi router by source:

- Jika **mode intake & aiEnabled & envelope.parseStatus !== "failed"**:
  panggil fungsi baru
  `applyLlmSignalsAndProgress(bindings, projectId, sessionRow.id, envelope.signals, userMsgRow.id)`
  (Task 4e). Sinyal ditandai `extractor: "llm"`.
- Jika **envelope.parseStatus === "failed"** (fallback D2) **atau mode AI disabled**:
  panggil `extractSignalsAndProgressInternal(...)` lama (regex). Sinyal tetap
  `extractor: "deterministic_stub"`.
- Mode `foundation_refinement`: pertahankan perilaku saat ini (tidak menulis sinyal
  intake; alur fondasi terpisah).

**Langkah 4e — fungsi baru `applyLlmSignalsAndProgress`.**
Mirror `extractSignalsAndProgressInternal` tetapi menerima draft dari LLM
(bukan regex). Logika:

```ts
async function applyLlmSignalsAndProgress(
  bindings, projectId, sessionId,
  drafts: IntakeSignalDraft[],
  sourceMessageId: string | null,
): Promise<{ progressPercent: number; nextPhase: IntakePhase; signals: DetectedSignalRow[] }> {
  const admin = createServiceRoleClient(bindings);
  const { data: existingRows } = await admin
    .from("detected_signals").select(SIGNAL_SELECT)
    .eq("project_id", projectId).eq("session_id", sessionId);
  const existing = (existingRows ?? []) as DetectedSignalRow[];

  const upserted: DetectedSignalRow[] = [];
  for (const draft of drafts) {
    const row = await upsertDetectedSignalWithPrecedence(
      bindings, projectId, sessionId, draft, sourceMessageId,
      [...existing, ...upserted], "llm",
    );
    if (row) upserted.push(row);
  }
  // gabung existing + upserted (dedup by id) → hitung progres & phase
  // (sama seperti extractSignalsAndProgressInternal baris ~1095–1130)
}
```

Lalu hitung `progressPercent = computeProgressFromSignals(allSignals)` dan update
`intake_sessions.progress_percent` + `phase` dengan aturan transisi yang SAMA
seperti sekarang (baris ~1113–1128): jika `foundation_refinement` tetap; jika
progres ≥ 80 → `concept_generation`; selain itu `signal_detection`.

**Langkah 4f — `upsertDetectedSignalWithPrecedence` (implementasi D4).**
Bisa memperluas `upsertDetectedSignal` yang ada atau buat varian baru. Aturan:

1. `SINGLE_VALUE_TYPES = new Set(["genre","protagonist","core_conflict","reader_promise","target_reader","tone"])`.
2. Cari kandidat existing:
   - Jika tipe **tunggal**: `match = existing.find(r => r.type === draft.type)`.
   - Jika tipe **jamak**: `match` by `(type, normalized value)` (logika lama).
3. Presedence:
   - Jika `match.status === "confirmed"` → **return match apa adanya** (jangan ubah).
   - Jika `match.status === "dismissed"`:
     - tipe tunggal → **jangan** buat baris baru (hormati pembuangan user); return null.
     - tipe jamak → jika value sama dengan yang dibuang → return null; jika value
       beda → boleh insert baru.
   - Jika ada `match` aktif (`detected`): update `label/value/confidence`,
     set `metadata.extractor = source`. Untuk tipe tunggal, **update juga `value`**
     (kasus genre direvisi).
   - Jika tidak ada match: insert baris baru `status: "detected"`,
     `metadata: { extractor: source }`.
4. Jangan biarkan sinyal `extractor: "deterministic_stub"` menimpa nilai
   `extractor: "llm"` untuk tipe yang sama. (Cek pada fallback path: jika existing
   row tipe itu sudah `llm`, dan source sekarang `deterministic_stub`, skip.)

**Catatan kompatibilitas:** `extractSignalsAndProgressInternal` lama tetap dipakai
untuk path regex (AI disabled / fallback). Pertahankan `upsertDetectedSignal`
lama untuk path itu, atau arahkan keduanya ke `upsertDetectedSignalWithPrecedence`
dengan `source` berbeda (lebih bersih — disarankan, tapi pastikan test regex lama
tetap hijau).

**Tests (Task 4):** integration/contract (Supabase lokal, `AI_PROVIDER=mock`,
`AI_GENERATION_ENABLED=true` — mock provider harus diprogram mengembalikan
envelope JSON; lihat `apps/web/e2e/sprint10b-real-intake-concept-pipeline.spec.ts`
dan harness mock di `model-router.ts` `generateWithMockProvider`):
- Kirim pesan kaya → `detected_signals` berisi genre benar (bukan Fantasy Academy),
  protagonist, core_conflict, tone, secret_candidate; `extractor: "llm"`.
- Genre direvisi di pesan berikut → baris genre **diupdate**, tidak duplikat.
- Tandai satu sinyal `confirmed` → ekstraksi berikut tidak menimpanya.
- Tandai satu sinyal `dismissed` → ekstraksi berikut tidak membangkitkannya.
- Envelope cacat (program mock mengembalikan teks non-JSON) → user tetap dapat
  reply waras, regex fallback mengisi sinyal, tidak ada error/refund.
- AI disabled → stub deterministik jalan, tanpa debit.

---

## Task 5 — Endpoint `extract-signals` aman (D5)

**Files:** `apps/api/src/services/intake.ts` (`extractDetectedSignalsForOwner`).

**Implementasi:**
- Jika `isAiGenerationEnabled(bindings)` **true**: JANGAN jalankan regex. Cukup
  muat sinyal existing → `computeProgressFromSignals` → update
  `progress_percent`/`phase` → kembalikan sinyal. (Recompute murni; tidak ada
  panggilan LLM, tidak ada billing.)
- Jika **false**: jalankan `extractSignalsAndProgressInternal` (regex) seperti
  sekarang.

**Tests (Task 5):**
- AI enabled + ada sinyal LLM → memanggil extract-signals tidak mengubah/merusak
  sinyal; progres tetep konsisten.
- AI disabled → regex mengisi sinyal seperti sebelumnya.

---

## Task 6 — Verifikasi end-to-end & laporan

**Files:** `docs/` (laporan baru, mis. `docs/119-intake-foundation-quality-report.md`).

**Langkah:**
1. Build: `pnpm -r build` (atau perintah build repo) untuk API + web → hijau.
2. Lint + unit/contract suite untuk paket API → hijau (sertakan test Task 1–5).
3. Playwright/integration intake (adaptasi
   `sprint10b-real-intake-concept-pipeline.spec.ts`) dengan mock provider yang
   mengembalikan envelope → progres naik melewati slot, fase maju ke konsep.
4. Smoke manual transkrip kasus PDF (kurir/paket/organisasi sihir/adik) →
   tangkap isi `detected_signals` + balasan Narra.
5. Tulis laporan: ringkasan perubahan, file tersentuh, bukti DoD #1–#9
   (transkrip + dump sinyal), dan GO/NO-GO.

**Gunakan `superpowers:verification-before-completion` sebelum mengklaim selesai.**

---

## Yang TIDAK Dikerjakan (out of scope plan ini)

- Tidak menaikkan tier model intake `hemat → seimbang` (itu butir #5 terpisah dari
  diskusi; bisa di-flag belakangan via env `AI_MODEL_HEMAT`).
- Tidak mengubah schema DB. Semua status ekstraksi disimpan di `metadata` JSON.
- Tidak mengubah UI/komponen frontend. `buildHonestProgress` sudah memetakan 7
  tipe; perubahan murni server-side.
- Tidak menyentuh alur `foundation_refinement` (mode matangkan fondasi) selain
  memastikan ia tetap memakai jalur teks-bebas lama.

## Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Model `hemat` sering keluarkan JSON cacat | Parser 3-lapis + fallback regex (D2); naikkan retry floor sudah aktif untuk PLANNING types (intake_assistant termasuk). |
| Envelope memperbesar output → kena cap 800 | Naikkan cap ke 1500 (Task 4a). |
| Regex fallback meng-clobber sinyal LLM | Presedence D4: `deterministic_stub` tak menimpa `llm`. |
| User dismiss/confirm tertimpa ekstraksi | Presedence D4 menghormati `confirmed`/`dismissed`. |
| Double billing karena 2 panggilan | Desain D1 satu panggilan envelope; tidak ada attempt kedua. |
