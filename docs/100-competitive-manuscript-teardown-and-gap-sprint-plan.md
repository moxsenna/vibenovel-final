# 100 — Competitive Teardown (Manuscript) + Gap Analysis & Remediation Sprint Plan

| Item | Value |
|---|---|
| **Tanggal** | 2026-06-14 |
| **Penulis** | Audit teknis (code-verified, bukan docs-only) |
| **Repo pembanding** | `DoktorDaveJoos/manuscript` (GitHub) |
| **Basis Narraza** | branch `codex/narraza-audit-recovery-sprint-0`; snapshot awal per Sprint 13, diperbarui 2026-06-15 setelah production Worker live |
| **Metode** | Baca repo Manuscript (README + struktur) → baca `docs/01–17` Narraza → **verifikasi klaim docs terhadap kode nyata** (migrations `00001–00014`, `apps/api/src/services/*`, `apps/web/src/components/writer/*`) |
| **Status** | Living document — Part E/F adalah backlog yang dieksekusi; Part B adalah snapshot yang wajib re-check sebelum sprint lanjutan |

> Catatan penting: dokumen ini sengaja **mengoreksi** beberapa klaim di `docs/04`, `docs/07`, `docs/08`, `docs/12` yang **tidak cocok dengan kode**. Lihat Part C dan Part G.

> Update 2026-06-15: AWS/EC2 sudah retired dari jalur produksi. API production aktif di Cloudflare Worker custom domain `https://api.narraza.web.id`, OpenRouter live, dan Duitku production live. Health smoke menunjukkan `aiProviderMock=false`, `paymentProvider=duitku`, `paymentProviderMock=false`, dan secrets Duitku/OpenRouter tersedia.

> Update backlog: sejak snapshot awal, repo sudah punya Sprint 15 draft import signal extraction (`draft_imports`, `draft_import_signals`) dan Sprint 16 creator mode. Karena itu, bagian lama yang menyebut draft import/creator mode sebagai "belum ada" harus dibaca sebagai "partial, belum full RAG/voice/proposal materialization".

---

## 0. Executive Summary

Manuscript adalah desktop app **craft-focused / refine-first / BYOK** untuk novelis terampil (pasar EN/DE/ES). Narraza adalah **cloud, mobile-serial, generation-first, managed-credit** untuk penulis serial Indonesia (pola baca KBM). Keduanya **hampir berlawanan posisi** — jadi pelajaran harus difilter, bukan disalin.

Temuan utama hasil verifikasi kode:

1. **Yang sudah nyata & kuat di Narraza:** Reveal Gate (anti-bocor masa depan), Context Packet + safety assertion, managed-credit model router (bukan BYOK), pipeline prose generation real via OpenRouter dengan idempotency + refund, alur "AI = proposal bukan canon".
2. **Yang ternyata DOCS-ONLY (belum ada di DB/kode):** Character Knowledge (unknown/suspects/knows), Character State per-bab, Timeline Event. `docs/08` masih aspirasional.
3. **Yang UI-nya kosong padahal DB siap:** version history / diff accept-reject prosa. `chapter_prose_versions` punya `version_number` + `is_current`, tapi `WriterEditorPanel` cuma `<textarea>` dengan undo/redo **di-disable**.
4. **Docs yang usang vs kode:** `fact_canon_status` (docs 5-state, kode 2-state), `ProseVersion.source` (docs 5 nilai, kode 3 nilai), `ProseContextPacket.povKnowledge` (ada di docs 07, tidak ada di kode).
5. **Belum ada / partial:** RAG/vector store belum ada; draft import sudah partial (paste/upload + deterministic signals), tapi belum full prep pipeline RAG/style/proposal materialization; mini-arc planning belum ada (Season cuma label teks).

Remediasi diprioritaskan: **(A) UX version/diff (quick win, DB sudah ada) → (B) sinkronisasi docs ↔ kode → (C) Continuity Engine (knowledge+state) → (D) Timeline → (E) Full: import+RAG+voice → (F) Full: Story Bible granularity + writer-retention.**

---

## PART A — Teardown Manuscript

### A.1 Posisi & filosofi
- Tagline pencipta: *"Most writing tools either ignore craft entirely or try to write for you. Manuscript does neither."*
- Tiga pilar: **data sovereignty** (SQLite lokal), **AI sebagai refine bukan generator**, **craft education** (menjelaskan masalah, bukan menulis untukmu).

### A.2 Tech stack
| Layer | Teknologi |
|---|---|
| Desktop | NativePHP (macOS/Windows/Linux) |
| Backend | Laravel 12 / PHP 8.4 |
| Frontend | React 19 + TypeScript + Tailwind v4 |
| Bridge | Inertia.js v2 |
| DB | SQLite + `sqlite-vec` (vector RAG) |
| Editor | TipTap |
| Test | Pest v4 / PHPUnit 12 |

### A.3 UX flow inti
```txt
Writing : Create book → chapters/scenes → Story Bible panel saat menulis → command palette (⌘P) → version snapshot
AI      : Set API key → run prep pipeline → AI dashboard (health) → prose pass diff review → editorial review → track token/cost
Version : Write → snapshot → review diff → accept/reject per-perubahan → restore
```

### A.4 Struktur fitur
- **Editor & craft:** splitscreen, scene drag-drop, **version history + visual diff accept/reject**, find&replace regex, focus/typewriter mode, command palette, auto-save.
- **Story structure:** template plot bernama (*Three Act / Five Act / Save the Cat / Story Circle / Hero's Journey*); Acts → Plot points → Beats; status Planned→In Progress→Complete.
- **Story Bible (wiki):** characters / locations / organizations / items / lore = **entitas first-class**; global search; **dual description (catatan author + hasil AI dipisah)**; AI character extraction.
- **Dashboard penulis:** goal harian, **heatmap kontribusi 365-hari, streak, NaNoWriMo, manuscript health timeline**.
- **Import/Export:** DOCX/EPUB/ODT/MD/TXT (auto chapter detection, CJK count) → PDF/EPUB/KDP/DOCX.

### A.5 AI pipeline
Multi-phase prep: **chunking → embedding → analysis → entity extraction → bible population → style extraction** (progress tracking + error recovery). Capability: prose pass (diff), editorial review per-bab, plot-hole detection, chapter analysis (tension/hook/pacing), RAG chat. **BYOK** 10 provider (Anthropic/OpenAI/Gemini/Groq/xAI/DeepSeek/Mistral/OpenRouter/Azure/Ollama), user bayar token langsung ke provider.

---

## PART B — Narraza: kondisi NYATA (code-verified)

Tabel berikut adalah hasil pembacaan kode, bukan docs.

| Klaim | Status | Bukti di kode |
|---|---|---|
| Managed credit + cost-aware router (bukan BYOK) | ✅ Benar | `apps/api/src/services/model-router.ts` — `MODEL_ALLOWLIST` hardcoded, mapping `hemat/seimbang/terbaik`→model, klien tak bisa kirim model id; `credit-ledger.ts` debit+refund |
| Reveal Gate / anti-bocor masa depan | ✅ Benar & nyata | tabel `planned_reveals` (`00003`), `context-packet-builder.ts:buildRevealGate()`, `assertWriterPacketSafe()`, `extractForbiddenConcepts()` |
| Context Packet = satu pintu konteks | ✅ Benar | `context-packet-builder.ts` (hash, audit ke `context_packet_logs`, safety assertion) |
| AI = proposal, bukan canon | ✅ Benar | `facts.source` enum **tanpa** `ai_*`; output AI → `ai_proposals` → accept → canon (`00001`) |
| Prose generation = AI sungguhan | ✅ Benar | `prose-beat-generation.ts` → OpenRouter, attempt state machine, idempotency, mock fallback, refund saat gagal |
| Production API | ✅ Benar | Cloudflare Worker custom domain `api.narraza.web.id`; AWS/EC2 path retired; health smoke live OpenRouter + Duitku |
| `Fact.canonStatus` 5-state (docs 04) | ❌ Docs salah | schema `fact_canon_status` = `('confirmed','deprecated')` saja |
| CharacterKnowledge / CharacterState / TimelineEvent (docs 08) | ❌ Belum ada | **tidak ada tabel**; context packet **tak** bawa `povKnowledge` |
| Context Packet punya `povKnowledge` + `authorVoice`/voice cards (docs 07) | ⚠️ Sebagian | `WriterContextPacket` nyata: foundation/concept/canon/currentChapter/continuity/revealGate/emotionalTarget/hookTarget/constraints — tanpa povKnowledge & voice cards (cuma `speechRules`) |
| `ProseVersion.source` punya `ai_rewritten/accepted/published` (docs 12) | ❌ Docs salah | `chapter_prose_source` = `user_edited/stub_deterministic/ai_generated`; "current" via `is_current` |
| Prose version backend | ✅ Benar | `GET /api/projects/:id/write/beats/:beatId/prose`, `GET /api/projects/:id/write/prose/:versionId`, `POST /api/projects/:id/write/prose/:versionId/make-current` |
| UX diff accept/reject prosa | ❌ Tak ada di UI | `WriterEditorPanel.tsx` = `<textarea>`; undo/redo/preview **disabled**; version history/diff belum terekspos |
| RAG / vector store | ❌ Tak ada | tidak ada pgvector/embedding |
| Draft import Persona C | ⚠️ Partial | `draft_imports` + `draft_import_signals` + page/API ada; belum RAG/style/proposal materialization |
| Creator Mode | ⚠️ Partial | setting `creator_mode` + advanced outline controls ada; generator semantics lanjutannya belum penuh |
| Planning Season→MiniArc→Chapter→Beat (docs 03/05) | ⚠️ Sebagian | `outline_plans.season_label` = field teks; **tak ada tabel mini-arc**; chapter+beat ada |

### B.1 Tabel DB yang benar-benar ada (per migration)
```txt
00001 core      : profiles, projects, project_settings, story_foundations,
                  characters, ai_proposals, facts, relationship_speech_rules,
                  credit_balances, audit_logs
00002 intake    : intake_sessions, intake_messages, detected_signals, story_concepts
00003 outline   : outline_plans, chapter_outlines, open_loops, planned_reveals
00004 write     : writing_sessions, chapter_writing_states, chapter_beats,
                  chapter_prose_versions, context_packet_logs
00005 delta     : chapter_summaries, chapter_deltas, chapter_summary_items,
                  chapter_summary_proposals
00006 publish   : publish_packages
00008 ai/credit : generation_attempts, credit_ledger
00009 payment   : credit_topup_products, credit_topup_orders, payment_webhook_events
00010 payment   : atomic credit topup grant RPC
00011 gen type  : generation type contract extensions
00012 safety    : safety validation/reporting support
00013 import    : draft_imports, draft_import_signals
00014 creator   : project_settings.creator_mode
```
**Tidak ada:** `character_knowledge`, `character_states`, `timeline_events`, `mini_arcs`, `prose_embeddings`, `import_jobs`.

---

## PART C — Gap Analysis (3 sumbu)

### C.1 Docs vs Kode (drift internal — wajib dibereskan)
1. `docs/04` canonStatus 5-state → kode 2-state (proposal-lifecycle pindah ke `ai_proposals`; desain kode **lebih bersih**).
2. `docs/12` `ProseVersion` (TS interface) tidak cocok dengan `chapter_prose_versions`.
3. `docs/07` `ProseContextPacket.povKnowledge` tidak diimplementasikan.
4. `docs/08` Character State/Knowledge/Timeline disajikan seolah desain final padahal **belum ada implementasi**.
5. `docs/17` Sprint 5 task 7 ("Accept/reject flow") sudah partial di backend version storage/API, tetapi full UI diff accept/reject belum ada. Sprint 6 task 5 ("Timeline/character state update") masih **belum tuntas di kode**.

### C.2 Narraza vs target final Narraza (docs)
- Continuity Engine (knowledge+state+timeline) adalah **gap terbesar** menuju target "konsisten sampai puluhan/ratusan bab" (`docs/01`, `docs/08`). Saat ini hanya Reveal Gate yang melindungi; "siapa tahu apa" belum dijaga.
- Mini-arc planning belum ada → retensi antar-arc (`docs/10`) belum terstruktur.

### C.3 Narraza vs Manuscript
| Area | Manuscript | Narraza nyata | Sikap |
|---|---|---|---|
| Version/diff UX | Matang | DB siap, UI nol | **Adopsi** (quick win) |
| Continuity engine | Plot-hole pasca-tulis | Reveal Gate ✅, knowledge/state/timeline ❌ | **Bangun** (target final, bukan keunggulan eksisting) |
| Story Bible granular | entitas first-class | dilipat ke `facts.category` | **Pertimbangkan** utk Full |
| RAG/memory | sqlite-vec | tidak ada | **Adopsi pola** utk Full (pgvector) |
| Prep pipeline import | chunk→embed→extract→style | tidak ada | **Adopsi** utk Persona C |
| Writer retention | streak/heatmap/goal | tidak ada | **Pertimbangkan** |
| Provider/biaya | BYOK 10 provider | managed credit | **Tolak BYOK**, ambil transparansi biaya |
| Editor density | command palette/regex | textarea (Beginner Mode) | **Tetap beda** (benar utk pasar) |

---

## PART D — Pelajaran: Adopsi vs Tolak

**Adopsi:**
- Version history + diff accept/reject per-perubahan (UX).
- Template struktur bernama (Save the Cat dll) sebagai preset Outline — hanya di Creator/Advanced Mode.
- Pipeline prep import (chunk→embed→extract→style) untuk Persona C.
- RAG retrieval (pgvector) untuk long-form memory (Full).
- Dual-description pattern (catatan author vs AI dipisah) — sejalan aturan "AI=proposal".
- Transparansi biaya generate (tampilkan estimasi credit per aksi).
- (Opsional) writer-retention: streak/goal/heatmap.

**Tolak (langgar posisi Narraza):**
- BYOK / user bayar provider (`docs/01`).
- Desktop/local-first.
- Filosofi "AI tak pernah generate" (Narraza generation-first).
- Density power-user sebagai default (command palette/regex/splitscreen) — bentrok "Simple by default" (`docs/11`).

---

## PART E — Sprint Plan (track "Manuscript-Parity & Continuity")

Penomoran melanjutkan kondisi kode (kode sudah di ~Sprint 13). Track ini = **Sprint 14–19**. Setiap sprint kecil, dapat dirilis, mengikuti aturan non-negotiable `docs/03` (AI=proposal, writer tanpa future truth, Chapter Delta update state).

Update 2026-06-15: repo sudah memiliki implementation reports untuk Sprint 14 safety, Sprint 15 draft import, dan Sprint 16 creator mode. Maka nomor di track ini dibaca sebagai **label backlog competitive/manuscript**, bukan nomor migration yang wajib sama. Saat mengeksekusi feature berikutnya, pilih nomor sprint/migration berikutnya yang tidak konflik.

### Sprint 14 — Docs ↔ Code Reconciliation (Risk: Low)
**Goal:** hilangkan drift docs/kode agar audit berikutnya faktual.
**Out of scope:** perubahan skema/feature apa pun.

### Sprint 15 — Ruang Tulis: Version History & Diff Accept/Reject (Risk: Medium)
**Goal:** ekspos versioning yang DB-nya sudah ada; aktifkan undo/redo; transparansi credit.
**Scope:** UI + API read versions; tanpa skema baru (kolom sudah ada).
**Out of scope:** continuity engine, import.

### Sprint 16 — Continuity Engine I: Character State + Knowledge (Risk: Critical)
**Goal:** mulai jaga "siapa tahu apa" + state per bab; alirkan ke Context Packet `povKnowledge`.
**Scope:** skema `character_states`, `character_knowledge`; update Chapter Delta untuk menulisnya; tambah `povKnowledge` ke packet (safe — POV only, bukan future truth).
**Out of scope:** timeline, RAG.

### Sprint 17 — Continuity Engine II: Timeline + Mini-Arc Planning (Risk: High)
**Goal:** timeline event saat chapter close; mini-arc sebagai struktur (bukan label).
**Scope:** skema `timeline_events`, `mini_arcs`; outline generator mengisi mini-arc; retensi antar-arc.

### Sprint 18 — Full: Draft Import + RAG + Voice (Persona C) (Risk: High)
**Goal:** Persona C ("sudah punya draft") jalan; long-form memory.
**Scope:** prep pipeline (chunk→embed→extract→style), pgvector store, retrieval memory ke packet (read-only, never source of truth).

### Sprint 19 — Full: Story Bible Granularity + Writer Retention (Risk: Medium)
**Goal:** entitas first-class (location/item/org/lore) opsional; dashboard kebiasaan penulis.
**Scope:** tabel entitas atau view di atas `facts`; streak/goal/heatmap.

---

## PART F — Detailed Task Checklist

> Konvensi: `- [ ]` = belum, `- [x]` = selesai. Setiap task wajib punya test (Vitest API / Playwright web) sesuai pola repo.

### Sprint 14 — Docs ↔ Code Reconciliation

- [x] **14.1** Update `docs/04` — ganti `Fact.canonStatus` 5-state menjadi 2-state (`confirmed`/`deprecated`); jelaskan lifecycle `proposed/rejected/merged` ada di `ai_proposals`.
- [x] **14.2** Update `docs/12` — selaraskan interface `ProseVersion` dengan tabel `chapter_prose_versions` nyata (`source` = `user_edited/stub_deterministic/ai_generated`, `is_current` boolean, `version_number`).
- [x] **14.3** Update `docs/07` — tandai `povKnowledge` sebagai **PLANNED (Sprint 16)**, dan dokumentasikan struktur `WriterContextPacket` yang sebenarnya dibangun.
- [x] **14.4** Update `docs/08` — beri banner status: Character State/Knowledge/Timeline = **belum diimplementasikan**, target Sprint 16–17.
- [x] **14.5** Update `docs/17` — tandai Sprint 5 task 7 partial dan Sprint 6 task 5 belum tuntas, tautkan ke Sprint 15/16/17 di sini.
- [x] **14.6** Tambah pointer di `docs/03` ke dokumen ini untuk daftar engine yang "shipped vs planned".
- [x] **14.7** Review pass: pastikan tidak ada docs lain (05/06) yang menyebut tabel yang belum ada tanpa label PLANNED.
- [x] **14.8** Acceptance: pembaca baru bisa membedakan "shipped" vs "planned" hanya dari docs.

### Sprint 15 — Version History & Diff Accept/Reject

Update 2026-06-15: backend route untuk list/get/make-current prose version sudah ada. Sprint ini sebaiknya dimulai dari audit API contract/test coverage lalu fokus ke web UX: version panel, diff, undo/redo, dan apply selected version.

Update implementasi 2026-06-15: desktop Write Room sudah punya `WriterVersionHistoryPanel`, diff word-level sederhana, aksi "Pakai versi ini" via endpoint `make-current`, undo/redo lokal in-session, review pending untuk hasil AI generate/rewrite dengan tombol terima/tolak, dan pratinjau pembaca desktop. Coverage: `apps/web/e2e/sprint15-version-history-flow.spec.ts`.

**API**
- [x] **15.1** Endpoint `GET /projects/:id/beats/:beatId/prose-versions` — list versi (number, source, word_count, created_at, is_current), owner-scoped via RLS pattern yang ada.
- [x] **15.2** Endpoint `POST /projects/:id/write/prose/:versionId/make-current` — set `is_current` (transaksi: matikan current lama, idempotent), audit log.
- [x] **15.3** Pastikan tidak ada kebocoran: response hanya field aman (tanpa model id/token/prompt) — mapper prose version sekarang menyaring metadata sensitif secara recursive; coverage `npm run test:prose-version-safe-response -w @vibenovel/api`.

**Web**
- [x] **15.4** Komponen `WriterVersionHistory` (panel/sheet) — daftar versi + badge sumber (AI/Manual), waktu, jumlah kata. Desktop panel done; mobile sheet planned.
- [x] **15.5** Komponen diff view sederhana (word-level, library ringan / util sendiri) untuk membandingkan versi terpilih vs current.
- [x] **15.6** Aksi "Pakai versi ini" (set-current) + "Bandingkan".
- [x] **15.7** Aktifkan undo/redo lokal di editor (saat ini `disabled`) — minimal in-session history stack.
- [x] **15.8** Saat AI rewrite/generate: tampilkan hasil sebagai **versi baru** (jangan timpa diam-diam); user pilih terima/tolak. Desktop flow done: versi AI pending bisa diterima atau ditolak; reject mengembalikan current ke versi sebelumnya via `make-current`.
- [x] **15.9** Transparansi credit: tampilkan estimasi credit per aksi generate di panel asisten (mirror policy web dari `ai-credit-policy`/`getCreditCostForGeneration`). Coverage: Playwright memastikan saldo, mode kualitas, biaya generate, dan estimasi sisa kredit tampil sebelum aksi AI.

**Test**
- [x] **15.10** Contract test: set-current memindah `is_current` tepat satu baris; idempotent. Repo belum memakai Vitest untuk API, jadi coverage memakai runner existing `tsx scripts/write-room-contracts.test.mts`: idempotent branch, promote selected version, demote same-beat current rows, no delete, dan partial unique index `chapter_prose_versions_one_current_per_beat_idx`.
- [x] **15.11** Playwright: generate → muncul versi baru → bandingkan → set-current → reload tetap konsisten. Implemented variants: mocked versions → compare → set-current → editor updates; AI generate → pending version → reject → editor returns to previous version. Reload/live persistence remains for a later hosted smoke.
- [x] **15.12** Acceptance: tidak ada lagi tombol stub `disabled` yang menyesatkan; versi AI tidak menimpa tanpa konfirmasi. Desktop Write Room done: pratinjau aktif, stub tambah adegan/close assistant/recheck cerita dihapus dari role button, dan versi AI pending tidak diterima diam-diam.

### Sprint 16 — Continuity Engine I (Character State + Knowledge)

**Skema (migration baru `00016_sprint16_character_continuity.sql`)**
- [x] **16.1** Tabel `character_states` (`character_id`, `chapter_number`, `emotional_state`, `physical_state`, `current_goal`, `location_id?`, `metadata`) + RLS owner-only + index. Implemented 2026-06-15: migration adds owner-only RLS, FK indexes, and `(project_id, character_id, chapter_number desc)` snapshot index.
- [x] **16.2** Tabel `character_knowledge` (`character_id`, `fact_id`, `knowledge_status` enum `unknown|suspects|partially_knows|knows|misbelieves`, `confidence`, `learned_at_chapter?`, `learned_from?`) + RLS. Implemented 2026-06-15: enum/table/RLS/indexes are covered by `npm run test:sprint16-character-continuity -w @vibenovel/api`.
- [x] **16.3** Enum baru di `packages/shared/src/enums.ts` + sinkron ke migration.
- [x] **16.4** Guardrail: tabel ini **tidak** menulis ke `facts` langsung; perubahan via Chapter Delta/approval. Implemented 2026-06-15: migration has no facts-writing trigger; services write continuity rows only.

**Service**
- [x] **16.5** Service `character-knowledge.ts` & `character-state.ts` (CRUD owner-scoped + snapshot per chapter). Implemented 2026-06-15: owner-scoped list/upsert plus state snapshot `<= chapter_number`; missing-table rollout is fail-soft to empty continuity.
- [x] **16.6** Extend `chapter-delta-extractor.ts` agar mengusulkan perubahan knowledge/state sebagai **proposal** (bukan langsung canon). Implemented 2026-06-15: `character_state_update` and `character_knowledge_update` proposal types are emitted from chapter delta items and accepted through explicit review flow only.
- [x] **16.7** Extend `context-packet-builder.ts`: tambah blok `povKnowledge` (knownFacts/suspectedFacts/falseBeliefs) **hanya untuk POV character**, dari `character_knowledge`.
- [x] **16.8** Update `context-packet-safety.ts`: pastikan `povKnowledge` tidak memuat fakta yang `forbidden_before_chapter > current` (tidak boleh jadi celah bocor).
- [x] **16.9** Update tipe `WriterContextPacket` di `@vibenovel/shared` + `buildPreviewFromPacket`.

**Web**
- [x] **16.10** Tampilkan ringkasan knowledge POV di Advanced Mode (read-only) — sejalan `docs/11`. Implemented 2026-06-15: Write Room reads `creatorMode`; POV knowledge counts render only in Advanced Mode.
- [x] **16.11** Saat approve Chapter Delta: tampilkan usulan perubahan knowledge/state untuk di-accept/reject. Implemented 2026-06-15: summary proposal review labels/excerpts support state/knowledge proposals; accept writes to continuity tables after summary approval.

**Test**
- [x] **16.12** Vitest: fakta yang belum diketahui POV **tidak** muncul di `povKnowledge.knownFacts`. Covered by `apps/api/scripts/sprint16-character-continuity-contracts.test.mts` (tsx contract style used by this repo).
- [x] **16.13** Vitest: reveal masa depan tetap diblok meski karakter "knows" secara internal (safety > knowledge).
- [x] **16.14** Acceptance: packet membedakan unknown/suspects/knows; tidak ada regресi pada Reveal Gate test lama. Verified with Sprint 16 contract plus `test:sprint14-safety`, `test:write-room-contracts`, and `test:sprint17-timeline-miniarc`.

### Sprint 17 — Continuity Engine II (Timeline + Mini-Arc)

Update implementasi 2026-06-15: backend vertical lengkap + web. Migration `00015_sprint17_timeline_miniarc.sql` menambah `mini_arcs`, `timeline_events`, dan kolom `chapter_outlines.mini_arc_id` (RLS owner-only). Shared (`MiniArc`, `TimelineEvent`, `TIMELINE_EVENT_SOURCES`, `recentTimeline` di packet) + mappers selaras. `timeline.ts` memateralisasi event saat chapter close (hook best-effort di `chapter-summary-approval`), `outline-generator` mengisi mini-arc deterministik (size 5; AI hanya menamai, tidak menggambar ulang range), `context-packet-builder` menyuntik `continuity.recentTimeline` past-only via `write-snapshot`. Endpoint `GET /api/projects/:id/timeline`. Web: OutlinePage mengelompokkan bab per mini-arc + badge payoff; `OutlineTimelineInspector` read-only di Advanced Mode. Coverage: `npm run test:sprint17-timeline-miniarc -w @vibenovel/api` (PASS), typecheck shared+api hijau.

Catatan verifikasi: tes adalah kontrak fungsi-murni (tsx), bukan integrasi DB. Idempotensi insert + RLS diverifikasi lewat schema review (partial unique index `timeline_events_one_close_per_chapter_idx` + pola RLS Sprint 4–6), belum dieksekusi terhadap Supabase live.

**Skema**
- [x] **17.1** Tabel `timeline_events` (`project_id`, `chapter_number`, `relative_order`, `event`, `involved_character_ids`, `location_id?`, `consequences`, `source`) + RLS + index.
- [x] **17.2** Tabel `mini_arcs` (`outline_plan_id`, `arc_number`, `title`, `premise`, `start_chapter`, `end_chapter`, `payoff`) + unique (plan, arc_number).
- [x] **17.3** Tambah `mini_arc_id?` (nullable, ON DELETE SET NULL) ke `chapter_outlines` (additive, backward-compatible).

**Service**
- [x] **17.4** `timeline.ts`: materialize event saat chapter close (hook best-effort di `chapter-summary-approval`, idempotent via delete+insert).
- [x] **17.5** Extend `outline-generator.ts` + persistensi `outline.ts`: mini-arc deterministik lalu chapter ter-assign ke arc (Season→MiniArc→Chapter).
- [x] **17.6** Context packet `continuity.recentTimeline`: ringkasan timeline ringkas, **past-only** (filter `chapter_number < current` di `write-snapshot`).

**Web**
- [x] **17.7** Outline UI: kelompokkan chapter per mini-arc; badge arc payoff (header arc di `OutlinePage`).
- [x] **17.8** Advanced Mode: `OutlineTimelineInspector` read-only + endpoint `GET /timeline`.

**Test**
- [x] **17.9** timeline summaries past/current only, tidak ada future (`buildPastTimelineSummaries`).
- [x] **17.10** mini-arc grouping kontigu menutup semua bab + chapter ter-link ke arc (`buildMiniArcDrafts`).
- [x] **17.11** Acceptance: bab current/future tidak bocor ke packet timeline; cap dihormati. _Sisa: smoke integrasi DB (RLS/idempotensi) di staging._

### Sprint 18 — Full: Draft Import + RAG + Voice (Persona C)

**Skema**
- [x] **18.1** Enable `pgvector` di Supabase; tabel `prose_embeddings` (`project_id`, `source_ref`, `chunk_text`, `embedding vector`, `metadata`) + index ANN. Implemented 2026-06-15: migration `00017_sprint18_import_rag.sql` adds pgvector, owner-scoped `prose_embeddings`, FK indexes, and HNSW cosine ANN index.
- [x] **18.2** Tabel `import_jobs` (status multi-phase, progress, error) untuk error recovery ala Manuscript. Implemented 2026-06-15: `import_jobs` tracks phase, status, progress, safe error, phase state, timestamps, and owner-only RLS.

**Service (pipeline prep)**
- [x] **18.3** `import/chunking.ts` — pecah draft (paragraf/scene), CJK/ID-aware word count. Implemented 2026-06-15: deterministic paragraph chunking, chunk hash, source refs, and Latin/CJK word counting covered by `test:sprint18-import-rag`.
- [x] **18.4** `import/embedding.ts` — embed chunk via provider allowlist (managed, bukan BYOK). Implemented 2026-06-15: OpenRouter `/embeddings` client uses server-side allowlist (`openai/text-embedding-3-small`, 1536 dims), request/response validation, and `prose_embeddings` row builder.
- [x] **18.5** `import/entity-extraction.ts` — ekstrak karakter/fakta sebagai **ai_proposals** (review dulu, bukan canon). Implemented 2026-06-15: draft import signals materialize to `ai_proposals` via `materialize-proposals`, with `source=ai_import`, `status=proposed`, and no direct `facts` insert.
- [x] **18.6** `import/style-extraction.ts` — turunkan authorVoice → simpan ke style (proposal). Implemented 2026-06-15: deterministic author voice metrics/tags produce a low-risk `style` proposal via `materialize-proposals`, with no raw prose dump.
- [x] **18.7** Retrieval memory: util ambil top-k snippet untuk packet (`continuity`/style), **read-only, never source of truth** (`docs/08`). Implemented 2026-06-15: `retrievalMemory` enters `WriterContextPacket.continuity` as `readOnly/context_only` snippets from `prose_embeddings`; packet safety/hash includes the final memory snapshot.
- [x] **18.8** Progress + error recovery per fase (resume). Implemented 2026-06-15: `import/job-progress.ts` adds phase progress patches, safe failure messages, resume patching, and `import-jobs/latest|resume` routes.
- [x] **18.13** Prep runner hardening: `import-jobs/resume` now runs the idempotent prep pipeline (`chunking → embedding → prose_embeddings refresh → signal/entity extraction → author voice/style proposal → ready_for_review`) with safe failure recovery. Implemented 2026-06-16: `import/pipeline-runner.ts` wires OpenRouter embeddings and proposal materialization without writing `facts`.

**Web**
- [x] **18.9** Flow Persona C: upload/paste draft → progress fase → review hasil ekstraksi (accept/reject proposal) → lanjut menulis. Implemented 2026-06-15: web Draft Import flow shows prep progress/resume, materializes review proposals, and routes to Fondasi review; covered by Playwright `sprint15-draft-import-flow`.

**Test**
- [x] **18.10** Vitest: ekstraksi menghasilkan proposal `proposed`, bukan `facts` langsung. Covered by `apps/api/scripts/sprint18-import-rag-contracts.test.mts`.
- [x] **18.11** Vitest: retrieval snippet tidak pernah menimpa canon; hanya konteks. Covered by `apps/api/scripts/sprint18-import-rag-contracts.test.mts` (`readOnly`, `context_only`, no canon ids).
- [x] **18.12** Acceptance: draft → Fondasi hasil ekstraksi → lanjut, tanpa BYOK, tanpa bocor. Code acceptance 2026-06-15: managed OpenRouter embedding allowlist, proposal-first import, read-only retrieval memory, and web review flow are covered by Sprint 18 contract + Draft Import Playwright. Production migration/deploy smoke remains separate.

### Sprint 19 — Full: Story Bible Granularity + Writer Retention

- [ ] **19.1** Keputusan desain: entitas first-class (`locations`/`items`/`organizations`/`lore`) **atau** view+filter di atas `facts.category` (rekomendasi: mulai dari view, promote ke tabel bila perlu link/relasi kompleks).
- [ ] **19.2** Global search lintas-entitas di Fondasi Cerita.
- [ ] **19.3** Dual-description: pisahkan `author_note` vs `ai_generated` pada karakter/entitas (proposal pattern).
- [ ] **19.4** Writer retention: tabel `writing_activity` (per hari) + dashboard streak/goal/heatmap.
- [ ] **19.5** NaNoWriMo-style goal opsional (jangan default; jangan ganggu Beginner Mode).
- [ ] **19.6** Test + Acceptance: search jalan; dashboard kebiasaan tidak menambah kompleksitas di Beginner Mode.

---

## PART G — Dokumen yang harus di-update (output Sprint 14)

| Docs | Perubahan |
|---|---|
| `docs/04` | canonStatus 2-state; lifecycle proposal di `ai_proposals` |
| `docs/07` | `povKnowledge` → PLANNED; dokumentasikan packet nyata |
| `docs/08` | banner "belum diimplementasi"; target Sprint 16–17 |
| `docs/12` | `ProseVersion` selaras `chapter_prose_versions` |
| `docs/17` | tandai Sprint 5.7 & 6.5 belum tuntas; link ke doc ini |
| `docs/03` | pointer "shipped vs planned engines" |

---

## PART H — Prinsip yang DIPERTAHANKAN (jangan diubah saat remediasi)

```txt
1. AI bukan source of truth — DB/state yang benar. AI output = proposal sampai diterima.
2. Writer tidak pernah menerima raw future truth (Reveal Gate wajib lolos lebih dulu
   dari knowledge/timeline yang baru).
3. Managed credit, bukan BYOK (docs/01).
4. Simple by default — fitur continuity/version inspector di Advanced Mode (docs/11).
5. Setiap accepted chapter meng-update state via Chapter Delta.
```

---

## Appendix — Evidence (file references)

- Reveal Gate & packet: `apps/api/src/services/context-packet-builder.ts`, `context-packet-safety.ts`, `supabase/migrations/00003_sprint4_outline_planning.sql`
- Generation pipeline: `apps/api/src/services/prose-beat-generation.ts`, `model-router.ts`, `openrouter-client.ts`, `mock-ai-provider.ts`, `credit-ledger.ts`
- Write-room UI: `apps/web/src/components/writer/WriterEditorPanel.tsx` (textarea; undo/redo disabled)
- Data model: `supabase/migrations/00001_sprint2_core.sql` (facts/ai_proposals), `00004_sprint5_write_room.sql` (chapter_prose_versions), `00005_sprint6_chapter_summary_delta.sql`
- Docs sumber: `docs/01,03,04,06,07,08,10,11,12,17`
- Pembanding: `DoktorDaveJoos/manuscript` (GitHub README + struktur direktori)
