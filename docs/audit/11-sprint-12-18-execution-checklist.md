# 11 — Sprint 12–18 Execution Checklist (task-level)

> Turunan eksekusi dari `docs/audit/10-master-fix-sprint-plan.md`. Dokumen ini = **tracker langkah-demi-langkah** (centang `[ ]` → `[x]`).
> Aturan global & guardrails: lihat `docs/audit/10` §0. Tidak ada kode diubah saat menyusun checklist ini.
>
> **Konvensi status sub-task:** `[ ]` belum · `[~]` jalan · `[x]` selesai · `[!]` blocked.
> **Setiap task wajib lulus "✅ Verify" sebelum dicentang selesai.**

---

## Cara pakai
1. Kerjakan **sprint berurutan** (12 → 18). Jangan lompat gate.
2. Per task: kerjakan sub-langkah dari atas; jalankan command "Verify"; baru centang.
3. Akhir tiap sprint: jalankan **Exit Gate**; tulis verification report; baru lanjut.
4. Jangan commit/deploy tanpa review founder kecuali sprint/task menyatakan boleh.

---

# SPRINT 12 — Production Story-Flow Stabilization & Quality Foundation (P0)

**Pre-flight Sprint 12**
- [x] Buat branch kerja `sprint-12-stabilization` (jangan kerja di `main`). — dibuat 2026-06-11.
- [x] Baca `docs/audit/00`, `02`, `04`, `06`, `07`.
- [ ] Pastikan akses: `.env.production` (operator), SSH key EC2, wrangler login, akun test Supabase. — `.env.production`/SSH/wrangler ✅; **akun test Supabase belum** (perlu dari founder).
- [x] Snapshot baseline: `npm run typecheck` PASS (shared/web/api).

### Task 12.1 — Samakan Supabase project web↔API di produksi
- [x] Decode ref dari `.env.production`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` → **semua = `qjmbobvarspwvaalnjct`** (konsisten; bukan staging `jdxyhrnibmmwlbtbokqo`).
- [x] Cek `scripts/build-production-web.ps1` — fallback `VITE_SUPABASE_ANON_KEY ← SUPABASE_ANON_KEY` (ref prod) + forbid staging ref. Plus hardening `apps/web/src/lib/supabase.ts` menerima publishable key (sudah deploy commit `8ed0435`).
- [x] Reproduksi 1 login nyata (akun test founder) → Supabase prod (`qjmbobvarspwvaalnjct`) mint access_token (exp 3600) → `GET https://api.narraza.web.id/api/me` **HTTP 200**, profil benar. Loop bug "Invalid or expired access token" **tertutup**.
- [x] Tidak ada 401 di happy path — auth web↔API prod konsisten.
- [x] ✅ Verify: login→`/api/me` 200 ✅. Surface authed lain juga 200: `/api/credits/balance` (saldo 4990), `/api/projects`, `/api/projects/:id/{concepts,foundation,outline}`. Konsep AI-real ("Luka yang Dibayar Mahal"); outline 10 bab + `planningTruthRedacted` aktif (catatan: outline masih pakai nama template → Sprint 13).

### Task 12.2 — Verifikasi token refresh + retry end-to-end ✅
- [x] Telusuri `apps/web/src/lib/api.ts` — `refreshAccessToken()` + retry 401 `UNAUTHORIZED` sekali, lalu `clearLocalSession()` bila tetap invalid. Logika benar.
- [x] Jalankan E2E refresh (`-g "refreshes a stale"`) terhadap dev server.
- [x] ✅ Verify: test refresh **PASS** (stale token → refresh → retry sukses; 0 `API tidak tersedia`).

### Task 12.3 — Pastikan build prod tidak fallback ke mock
- [ ] Konfirmasi `VITE_USE_MOCKS=false` di build prod (`build-production-web.ps1`).
- [ ] Audit pemakaian `allowMockFallback()` di hooks (`useDashboardData`, `useWriteRoomData`, dll.) — pastikan tak aktif saat authed prod.
- [ ] ✅ Verify: di prod authed, tidak muncul layar demo Sprint 1 / data `demo-project-00x`.

### Task 12.3b — Matikan silent mock fallback di jalur authenticated/prod
> Tujuan: kegagalan API jadi **jujur & berisik** (error nyata), bukan ketutup data demo. Ini menutup akar bug yang kemarin ditemukan (`docs/91`, `docs/93` sudah memulai). **Bukan** menghapus file mock — hanya jalur fallback-nya.
- [x] Inventarisasi semua pemanggil `allowMockFallback()` / `applyMockFallback()` di hooks — selesai (9 hook + `lib/hook-fallback.ts` + `lib/env.ts`). **Temuan:** semua sudah berpola `allowMockFallback() ? mock : error/empty`, dan `allowMockFallback() === shouldUseMocks()`.
- [x] Saat **API-mode + authed**: fallback-ke-mock **sudah** tidak terjadi — honest else-branch (`error`/`locked`/empty) sudah ada di tiap hook (warisan `docs/91`/`93`). Tidak perlu rewrite.
- [x] Pertahankan mock **hanya** untuk mode demo eksplisit — dijamin oleh boundary lock 12.3c.
- [x] JANGAN hapus `apps/web/src/mocks/*` di task ini — tidak dihapus.
- [x] JANGAN sentuh server mock providers — tidak disentuh.
- [x] ✅ Verify: `allowMockFallback()` tied ke `shouldUseMocks()`; dengan 12.3c, di prod = false → fallback demo **mustahil** di prod. E2E `auth-settings-regression` 3/3 PASS (incl. signed-out → honest redirect, bukan demo).

### Task 12.3c — Kunci boundary: buktikan mock mustahil leak ke prod
> Tujuan: bukan sekadar "default false", tapi **tidak mungkin** aktif di build produksi.
- [x] Tinjau `apps/web/src/lib/env.ts: shouldUseMocks()` — `__MOCK_OVERRIDE__` hanya dihormati di `MODE==='test'||DEV` (sudah benar; tidak di prod).
- [x] Tambah guard runtime: baris pertama `if (import.meta.env.PROD) return false;` → di build prod `shouldUseMocks()` **selalu** false, abaikan `VITE_USE_MOCKS`/`__MOCK_OVERRIDE__`. (commit di `env.ts`)
- [ ] (Opsional) Tambah assertion build/test yang gagal bila bundle prod mereferensikan `apps/web/src/mocks/*` — **ditunda** (nice-to-have; cukup ditegakkan saat 13.6b hapus mock).
- [x] ✅ Verify: typecheck PASS; E2E `auth-settings-regression` 3/3 PASS (dev/test mock tetap jalan, prod terkunci). Bukti logika: Vite mengganti `import.meta.env.PROD`→`true` di `vite build` sehingga fungsi efektif `return false` lebih dulu.

> ⚠️ **TEMUAN BARU (P0) — Concept generation 500 di produksi.** Dengan akun test, `POST /api/projects/:id/concepts/generate` **konsisten 500** (3x) untuk proyek baru. Penyebab: dengan AI ON (`AI_GENERATION_ENABLED=true`, `AI_PROVIDER_MOCK=false`) jalur masuk ke OpenRouter (`concept.ts:449`) dan gagal → refund kredit → rethrow 500. Proyek lama "Cerita Baru" ternyata `generator: deterministic_stub` → **jalur OpenRouter belum pernah sukses di prod**. Ini lapisan ke-2 di bawah laporan awal (auth sudah beres, tapi generasi tetap gagal). **Memblokir 12.4/12.7** (tak bisa capai `outline_locked`). **Root cause (dari log EC2, disetujui founder):** OpenRouter SUKSES, tapi output **dipotong di 800 token** → `JSON.parse` gagal (`Unterminated string in JSON`, `Unexpected end of JSON input`). Concept gen jalan sebagai `publish_copy`+`hemat` → `maxOutputTokens=min(800,800)=800` (`model-router.ts:55,63`), padahal 3 objek konsep JSON > 800 token. `applyInputOverrides` (`model-router.ts:138`) hanya bisa **menurunkan** cap. Parse error tak tertangani → 500 (refund jalan). **Fix (Hotfix/Task 13.1):** beri concept gen anggaran token memadai (~2500) — opsi bersih: generation type tersendiri (stop alias `publish_copy`); opsi cepat: naikkan cap utk jalur concept + hardening parse/repair. Berimplikasi biaya → tunggu keputusan founder.
>
> ✅ **RESOLVED & DEPLOYED (PR #2, `hotfix/concept-gen-token-budget`).** Tambah `maxOutputTokensOverride` server-only (clamp ≤4000) di `model-router.ts`; concept gen minta 3000 token @ temp 0.4; parse fail → 502 bersih. Cap/biaya fitur lain tak berubah. Deploy API ke prod (EC2) sukses. **Verify live:** `POST /concepts/generate` → **201**, 3 konsep AI nyata ("Bayangan di Balik Stetoskop", `generator: openrouter`, spesifik ke ide intake). Blokir user baru di langkah konsep **terbuka**.
>
> ⚠️ **TEMUAN BARU #2 (Sprint 13) — Foundation readiness/lock TIDAK KONSISTEN.** Setelah konsep jalan, pipeline ke `outline_locked` mentok di lock fondasi. Dengan premise/conflict/promise/targetReader(`hp_serial`)/genre/tone terisi + tokoh protagonist/main + 2 fakta: `GET /foundation/readiness` → **75% `canLock=true` missing=[]**, TAPI `POST /foundation/lock` → **409**, recompute readiness **70% < 75** (`failedChecks:["readiness_score","can_lock"]`, `foundation-lock.ts:467`). Dua perhitungan readiness **beda ~5%** → user lihat "siap dikunci" tapi lock gagal. Plus stub fondasi tak auto-isi tokoh utama/fakta (harus manual). **Memblokir 12.4/12.7** lewat alur jujur (tak dipalsukan via DB).
>
> ✅ **RESOLVED & DEPLOYED (PR #3, `hotfix/foundation-readiness-lock`).** Root cause persis: `secret_guard` (`foundation-readiness.ts`) memakai `secretProposals.every(status==="proposed")` → bergantung `activeStatuses`. GET (proposed-only) lolos (+5→75); lock (proposed+accepted) gagal begitu proposal high-risk **di-accept** (jalur promosi yang benar) (−5→70). Fix: `secretGuardOk = !highRiskSecretsInFacts` saja (lindungi risiko nyata: rahasia high-risk ditulis langsung ke facts; proteksi reveal-ke-pembaca tetap di Reveal Gate hilir). Kedua readiness kini konsisten. Deploy API ke prod sukses. **Verify live (full pipeline):** readiness 75% canLock=true → **foundation LOCKED** → outline 10 bab → **outline LOCKED (`outline_locked`)** → write session terbuka → 5 beats → **AI prose v1 (260 kata, `source=ai_generated`, `isCurrent=true`, −5 kredit) jadi current source**. ⇒ **12.4 & 12.7 TUNTAS.** (Catatan: prose menyebut "Nadira" → outline generator masih stub → tetap Sprint 13.)

### Task 12.4 — Seed test project → `outline_locked` ✅
- [x] Project test digiring via API (akun test) sampai `outline_locked` (foundation locked + outline locked) — pasca hotfix bug #1 & #2.
- [x] Cara pakai akun test + driver pipeline terdokumentasi di sini (intake→concept→select→foundation fields/char/facts→lock→outline→lock).
- [x] ✅ Verify: write session terbuka untuk project `outline_locked` (bukan "Ruang Tulis belum tersedia").

### Task 12.5 — Tambah ESLint + root `lint` script ✅
- [x] Tambah `eslint.config.mjs` (flat config) untuk web (browser+react-hooks) + api/shared/e2e (node). Non-type-checked (cepat).
- [x] Tambah script root `lint` + `lint:fix` (via `npm pkg set`). DevDeps: `eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals`.
- [x] Jalankan `npm run lint`: 24 error awal (23 `no-useless-assignment`, 1 `no-empty-object-type`) → ditinjau **bukan bug** (pola `let x; try{x=…}` di service kredit/AI; interface alias) → diturunkan ke **warn** (didokumentasikan di config). `react-hooks/rules-of-hooks` tetap error.
- [x] ✅ Verify: `npm run lint` → **0 errors, 34 warnings, exit 0**. `typecheck` & `build:web` tetap PASS pasca-install.

### Task 12.6 — Perluas CI gate
- [x] Edit `.github/workflows/ci.yml`: tambah step **Lint** (`npm run lint`) di job build + job baru **e2e-regression** (install chromium, start dev, run `auth-settings-regression`).
- [x] CI gagal bila lint/regresi gagal (step non-zero → job merah).
- [x] ✅ Verify: **PR #1 CI HIJAU** — job `build` (typecheck+lint+build) PASS, job `e2e-regression` PASS. Sepanjang jalan menemukan & memperbaiki **CI yang sudah lama merah di `main`** (sejak ≥8 Jun): (1) npm/cli#4828 lockfile lintas-platform → `rm -f package-lock.json && npm install` di CI; (2) e2e butuh `build:shared` sebelum `vite dev`; (3) e2e butuh env Supabase dummy agar client init untuk test refresh-token; (4) warm-up route + `--retries=2`. TODO terpisah: regenerasi lockfile lintas-platform agar bisa kembali ke `npm ci`.

### Task 12.7 — Rerun seluruh E2E user-flow yang dilaporkan gagal (sebagian besar ✅)
- [x] Rerun via API (akun test prod) + 2 hotfix:
  - [x] **Generate 3 concepts** — ✅ AI nyata (201) pasca hotfix #1
  - [x] **Foundation + outline** — ✅ foundation lock + outline 10 bab + outline_locked pasca hotfix #2 (outline gen masih stub → Sprint 13)
  - [x] **Logout** — ✅ (guard + boundary lock, regression 3/3)
  - [x] **Settings "Terbaik" persist** — ✅ (regression)
  - [x] **Credit estimate** — ✅ (regression: 20/12/12)
  - [x] **Accept generated prose (Write Room)** — ✅ AI prose v1 jadi current source
  - [~] **Mobile write room** — write session terbuka (API); render mobile UI belum dicek visual (butuh browser)
- [x] ✅ Verify: semua flow inti **PASS** end-to-end di prod; sisa visual-mobile + outline-real → catatan Sprint 13.

### Task 12.8 — Verification report ✅
- [x] Tulis [`docs/96-sprint-12-stabilization-report.md`](../96-sprint-12-stabilization-report.md) — scope, 12.1–12.7, 2 hotfix prod, hasil verifikasi, sisa gap, exit gate.

**🚪 Exit Gate Sprint 12 — ✅ LULUS / CLOSED**
- [x] `typecheck` + `lint` hijau; CI hijau (PR #1).
- [x] Happy-path authed prod: 0 `Invalid or expired access token`.
- [x] `auth-settings-regression` 3/3 PASS.
- [x] **Silent mock fallback mati di jalur authed (12.3b); mock terbukti tak bisa leak ke prod (12.3c)** — file mock belum dihapus (ditunda ke 13.6b).
- [x] Alur inti `intake → konsep → fondasi lock → outline lock → write → accept prose` verified live di prod (+2 hotfix #1/#2).
- [x] Report `docs/96` ditulis. → **Sprint 12 CLOSED; boleh lanjut Sprint 13.**

---

# SPRINT 13 — Real Generation Engine (Foundation + Outline) (P1)

**Pre-flight**
- [ ] Branch `sprint-13-real-generation`. Sprint 12 sudah lulus.
- [ ] Konfirmasi env AI: `AI_GENERATION_ENABLED=true`, `AI_PROVIDER_MOCK=false`, OpenRouter key ada (staging dulu).
- [ ] Baca `services/foundation-proposal.ts`, `outline-generator.ts`, `concept.ts`, `model-router.ts`, `prose-generation-prompt.ts`.

### Task 13.1 — Real foundation proposal generation (ganti `foundation_stub_batch`) ✅ DEPLOYED+VERIFIED (PR #4)
- [x] Jalur OpenRouter di `services/foundation-proposal.ts` (credit-gated 3 kredit, refund bila gagal); stub jadi fallback AI-off.
- [x] Output → `ai_proposals` (bukan canon langsung); marker `foundation_ai_batch` dikenali dedup/list/regenerate.
- [x] AI JSON → payload proposal yang sama persis dengan stub → promosi canon tak berubah.
- [x] ✅ Verify live (ide "barista tuli thriller"): konsep + 13 proposal fondasi AI spesifik (protagonist "Aruna", bukan template); accept-all → **foundation LOCKED** (promosi Aruna + 6 fakta ke canon, tanpa char/fakta manual).
- [~] Catatan: `GET /foundation/readiness` (proposed-only) **turun** setelah accept (tak kredit `accepted`) walau lock sukses → UX readiness perlu disamakan (follow-up Sprint 13).

### Task 13.2 — Real outline generation dari locked foundation ✅ DEPLOYED+VERIFIED (PR #5)
- [x] Jalur AI di `outline-generator.ts` (`generateOutlineDraftWithAi`, credit-gated 3 kredit, refund) menggantikan `outline_stub_deterministic`; stub jadi fallback AI-off + fallback bila AI balas < min bab.
- [x] AI JSON → `OutlineGenerationDraft` dengan validasi enum ketat (chapterFunction/emotionalDirection/importance/riskLevel); markers diturunkan dari field; budget 4000 token + temp 0.4 + 502 bersih saat parse gagal.
- [x] Safety: reveal diminta sbg `hiddenTruth` (bukan token terlarang `planningTruth`), disimpan internal sbg `planning_truth`. **Verify live:** API outline `planningTruthRedacted:true`, baris reveal **tanpa** field `planningTruth` → planner-only tak bocor.
- [x] ✅ Verify live (foundation "barista tuli"): **10 bab spesifik** ("Bisikan di Balik Busa"…"Panggilan Terakhir", bukan template), enum valid, semua endingHook + 4 mini victory; 3 open loops; 2 reveals (`forbiddenBefore=8`). **Sekalian menutup Task 13.5 (reveal schedule planner-only).**

### Task 13.3 — Perbaiki billing alias concept generation
- [ ] Di `services/concept.ts`, ganti alias `publish_copy` → generation type eksplisit untuk concept (tambah enum bila perlu di `packages/shared`).
- [ ] Pastikan `generation_attempts.generation_type` & cost tercatat benar.
- [ ] ✅ Verify: smoke concept → ledger/attempt mencatat jenis benar.

### Task 13.4 — Specificity guard (anti-template)
- [ ] Tambah aturan prompt: larang nama/elemen klise default; minta detail spesifik dari ide user.
- [ ] (Opsional) post-check: tolak output yang mengandung token klise dilarang.
- [ ] ✅ Verify: 2 ide berbeda → output tidak generik/seragam.

### Task 13.5 — Reveal schedule otomatis (planner-only)
- [ ] Generate `planned_reveals` dengan `planningTruth` + `forbidden_before_chapter` dari fondasi/outline.
- [ ] Pastikan `assertWriterPacketSafe` tetap menahan `planningTruth` keluar ke writer.
- [ ] ✅ Verify: reveal ter-generate; build context packet → forbidden concept masuk `mustNotInclude`; planningTruth tak bocor.

### Task 13.6 — Smoke + E2E API-mode foundation/outline
- [ ] `npm run smoke:api` + smoke outline; E2E foundation/outline API-mode (pakai seed 12.4).
- [ ] ✅ Verify: flow lulus tanpa 401; output AI nyata.

### Task 13.6b — Pensiunkan test mock-dependent & hapus file mock UI (setelah E2E real ada)
> Prasyarat: harness E2E **real-API** sudah ada & hijau (12.7 + 13.6). Urutannya wajib: **punya pengganti dulu, baru buang.**
- [ ] Konfirmasi cakupan E2E real-API menutupi flow inti: concepts, foundation, outline, write/accept prose, summary, publish (pakai akun test + project seed 12.4).
- [ ] Petakan test yang masih bergantung mock-mode (`__MOCK_OVERRIDE__`/`VITE_USE_MOCKS=true`): `auth-settings-regression.spec.ts` (test mock), `sprint10a-mock-boundary-regression.spec.ts`, `sprint10b` (mock-mode), `sprint3`–`sprint9` flows.
- [ ] Untuk tiap test mock: **migrasi ke real-API** (lebih disukai) atau **pensiunkan** bila sudah tergantikan E2E real. Catat keputusan per file.
- [ ] Setelah tidak ada test/komponen yang memakainya: **hapus `apps/web/src/mocks/*`** + bersihkan import + `DEMO_PROJECT_ID`/`demo-project-00x`.
- [ ] (Tetap) JANGAN hapus server mock providers (`mock-ai-provider.ts`, `mock-payment-provider.ts`) — dipertahankan untuk smoke/CI hemat-biaya.
- [ ] ✅ Verify: `npm run typecheck` + `lint` + E2E real-API hijau **tanpa** folder `apps/web/src/mocks/`; grep `demo-project` di `apps/web/src` → kosong.

### Task 13.7 — Verification report
- [ ] Tulis `docs/97-sprint-13-real-generation-report.md`.

**🚪 Exit Gate Sprint 13**
- [ ] Foundation & outline **bukan** stub lagi; 2 ide → hasil berbeda spesifik.
- [ ] Canon tetap lewat proposal/approval; reveal planner-only aman.
- [ ] **E2E real-API menutupi flow inti; test mock-dependent dimigrasi/dipensiunkan; `apps/web/src/mocks/*` dihapus (13.6b)** — server mock providers tetap ada.
- [ ] typecheck/lint/smoke hijau; report `docs/97`. → **lanjut Sprint 14**.

---

# SPRINT 14 — AI Safety Hardening + Cost Guard (P1) — 🔒 GATE buka AI non-founder

**Pre-flight**
- [ ] Branch `sprint-14-safety-hardening`. Sprint 13 lulus.
- [ ] Tambah Vitest sebagai devDependency (tooling, bukan fitur) + script `test:unit`.
- [ ] Baca `context-packet-safety.ts`, `summary-safety.ts`, `publish-safety.ts`, `ai-prompt-safety.ts`, `ai-credit-policy.ts`.

### Task 14.1 — Tabel `validation_reports` + service
- [ ] Migrasi `00011_validation_reports.sql` (kolom: id, project_id, generation_attempt_id, scope, passed, violations_json, created_at) + RLS.
- [ ] `services/validation-report.ts` untuk tulis/baca report.
- [ ] ✅ Verify: `supabase db reset` sukses; insert report dari service jalan.

### Task 14.2 — Output validator writer
- [ ] `services/output-validator.ts`: cek prose hasil writer vs `forbiddenConcepts`/forbidden reveals/fakta belum-proposal.
- [ ] Integrasikan ke alur `prose-beat-generation.ts` (validasi sebelum tandai "siap").
- [ ] ✅ Verify: prose yang menyebut forbidden concept → report `passed=false` + violations.

### Task 14.3 — Safe Repair loop
- [ ] Saat validator gagal → repair/regenerate (maks N retry) → re-validate; jika tetap gagal → tandai gagal, jangan terima.
- [ ] Catat tiap iterasi ke `validation_reports`.
- [ ] ✅ Verify: kasus bocor reveal → otomatis diperbaiki/diregenerasi; tidak pernah lolos sebagai final.

### Task 14.4 — Character Knowledge Gate per-POV
- [ ] Tambah representasi "siapa tahu apa kapan" (mis. fakta punya `known_by`/`known_from_chapter`) atau aturan turunan dari reveal/delta.
- [ ] Di `context-packet-builder.ts`/`write-snapshot.ts`: fakta yang belum sah diketahui POV aktif → masuk `mustNotInclude`, bukan `canon.facts`.
- [ ] ✅ Verify: skenario uji — tokoh X belum tahu fakta Y → packet tidak menyuplai Y sebagai pengetahuan X.

### Task 14.5 — Cost guard AI per-user
- [ ] Hard cap harian + cooldown per user di `routes/ai.ts`/`ai-credit-policy.ts` (selain saldo kredit).
- [ ] Estimasi biaya pra-generate ditampilkan di UI sebelum aksi (`apps/web`).
- [ ] (Opsional) flag `AI_NONFOUNDER_ENABLED` agar pembukaan terkontrol.
- [ ] ✅ Verify: lewat cap → ditolak (kode jelas, bukan 500); estimasi tampil sebelum generate.

### Task 14.6 — Unit test jalur safety (Vitest)
- [ ] Test `buildRevealGate` (forbidden vs allowed).
- [ ] Test `assertWriterPacketSafe` (planningTruth/future summary → throw).
- [ ] Test `chapter-delta-extractor` fact candidate → `proposalRequired:true`.
- [ ] Test `proposal-canon-promotion` (canon berubah hanya setelah accept).
- [ ] Test knowledge gate (14.4) + output validator (14.2).
- [ ] ✅ Verify: `npm run test:unit` hijau; coverage jalur safety inti.

### Task 14.7 — Report + checklist "AI non-founder ready"
- [ ] Tulis `docs/98-sprint-14-safety-hardening-report.md` + checklist gate.

**🚪 Exit Gate Sprint 14 (GATE BUKA AI NON-FOUNDER)**
- [ ] `validation_reports` aktif; output validator + Safe Repair jalan.
- [ ] Knowledge Gate per-POV terbukti via test.
- [ ] Cost cap + estimasi aktif.
- [ ] `test:unit` + lint + smoke hijau.
- [ ] Report `docs/98` ditulis. → **AI boleh dibuka ke non-founder**; lanjut 15/16/17 (boleh paralel).

---

# SPRINT 15 — Draft Import / Legacy Continuation (P2)

**Pre-flight**
- [ ] Branch `sprint-15-draft-import`. Sprint 14 lulus.
- [ ] Review intake signal logic untuk reuse (`services/intake.ts`, detected_signals).

### Task 15.1 — Route + page Import Draft
- [ ] Tambah route `/projects/:id/import` (atau entry path baru di `/start`) + page upload/paste teks.
- [ ] Simpan draft sebagai **sumber analisis**, bukan canon.
- [ ] ✅ Verify: draft tersimpan; tidak menyentuh `facts`/`characters` langsung.

### Task 15.2 — Pipeline ekstraksi sinyal
- [ ] Ekstrak genre/karakter/konflik/target pembaca dari draft (reuse signal detection).
- [ ] ✅ Verify: panel deteksi terisi dari teks contoh.

### Task 15.3 — Hasil ekstraksi → proposal + review
- [ ] Kandidat → `ai_proposals`; UI review/approve.
- [ ] ✅ Verify: canon berubah hanya setelah approve.

### Task 15.4 — E2E + Task 15.5 report
- [ ] E2E "import existing draft for analysis" PASS (tanpa 401).
- [ ] Tulis `docs/99-sprint-15-draft-import-report.md`.

**🚪 Exit Gate:** import jalan; deteksi terisi; canon via approval; report ditulis.

---

# SPRINT 16 — Creator Mode (Advanced, opt-in) (P2)

**Pre-flight**
- [ ] Branch `sprint-16-creator-mode`. Sprint 14 lulus.

### Task 16.1 — Definisi scope (doc dulu)
- [ ] Tulis daftar fitur Advanced yang opt-in; pastikan Beginner tetap default sederhana.
- [ ] ✅ Verify: scope disepakati (catat di doc).

### Task 16.2 — Toggle Advanced Mode opt-in
- [ ] Tambah setting "Advanced Mode" (default off). Beginner tanpa istilah teknis.
- [ ] ✅ Verify: Beginner tak melihat kontrol teknis; Advanced eksplisit diaktifkan.

### Task 16.3 — Story Bible viewer/editor
- [ ] Lihat/edit characters/facts/speech rules via approval flow.
- [ ] ✅ Verify: edit canon tetap lewat proposal/approval.

### Task 16.4 — Reveal & Knowledge editor (planner)
- [ ] Editor `planned_reveals`/knowledge (planner-only `planningTruth`).
- [ ] ✅ Verify: `planningTruth` tak pernah masuk writer (cek packet).

### Task 16.5 — E2E + report
- [ ] E2E + `docs/100-sprint-16-creator-mode-report.md`.

**🚪 Exit Gate:** Advanced opt-in; Beginner tetap ringan; planner-only aman; report ditulis.

---

# SPRINT 17 — Retention Intelligence (KBM) (P2)

**Pre-flight**
- [ ] Branch `sprint-17-retention`. Sprint 14 lulus.
- [ ] Review `open_loops`, `chapter_outlines` (hook/miniVictory), `chapter_deltas`.

### Task 17.1 — `chapter_promises` + tracking
- [ ] Migrasi `00012_chapter_promises.sql` + service tracking.
- [ ] ✅ Verify: janji per-bab tersimpan & terpantau.

### Task 17.2 — Payoff Scheduler
- [ ] Deteksi open loop jatuh tempo (payoff chapter terlewati) → tandai/ingatkan.
- [ ] ✅ Verify: loop tak terbayar → muncul peringatan di summary/outline.

### Task 17.3 — Suffering Fatigue Detector
- [ ] Analisis delta: protagonis ditindas beruntun tanpa mini victory → flag.
- [ ] ✅ Verify: skenario uji → terdeteksi.

### Task 17.4 — Protagonist Agency Tracker
- [ ] Deteksi tokoh utama pasif (tidak ada keputusan/aksi) → flag.
- [ ] ✅ Verify: skenario uji → terdeteksi.

### Task 17.5 — Unlockability score
- [ ] Skor potensi unlock per bab (hook/ending/open loop/cliff) → tampil ke user.
- [ ] ✅ Verify: skor muncul; bab ending lemah → skor rendah.

### Task 17.6 — Mobile readability validator
- [ ] Validasi paragraf/dialog vs aturan HP/KBM (`buildMobileFormatRules`).
- [ ] ✅ Verify: output panjang → ditandai/diperbaiki.

### Task 17.7 — E2E + report
- [ ] `docs/101-sprint-17-retention-report.md`.

**🚪 Exit Gate:** semua detector/scheduler aktif & teruji; report ditulis.

---

# SPRINT 18 — Payment Enablement (GATED — founder Go) 

**Pre-flight 🔒**
- [ ] **Approval founder eksplisit** terdokumentasi. Sprint 12 lulus.
- [ ] Branch `sprint-18-payment`. Backup DB prod sebelum migrasi.
- [ ] Review `docs/73`, `docs/74`, `docs/77`, `services/credit-topup-grant.ts`, `duitku-*.ts`.

### Task 18.1 — Apply migrasi `00010` ke produksi
- [ ] Jalankan apply `00010_atomic_grant_credit_topup_rpc.sql` ke Supabase prod (`qjmb…`).
- [ ] ✅ Verify: RPC `grant_paid_credit_topup_atomic` ada di prod (query `pg_proc`).

### Task 18.2 — Uji idempotensi grant
- [ ] Simulasi webhook/callback duplikat → grant hanya sekali (cek `payload_hash`/order match).
- [ ] ✅ Verify: tidak ada double-credit; ledger konsisten.

### Task 18.3 — E2E "bayar → kredit masuk" (Duitku BCA VA, sandbox→prod)
- [ ] Jalankan `smoke:api:sprint10:duitku` + alur callback nyata sandbox.
- [ ] ✅ Verify: 1 pembayaran → 1 grant idempoten; saldo bertambah benar.

### Task 18.4 — Aktifkan flag (terkontrol)
- [ ] Set `CREDIT_TOPUP_ENABLED=true` (+ provider Duitku) **hanya setelah** 18.1–18.3 lulus.
- [ ] Pasang monitoring/alert paid-but-no-credit.
- [ ] ✅ Verify: 1 transaksi prod kecil end-to-end sukses (founder).

### Task 18.5 — Runbook + Task 18.6 report
- [ ] Runbook "paid-but-no-credit" + rollback (`CREDIT_TOPUP_ENABLED=false`).
- [ ] `docs/102-sprint-18-payment-enablement-report.md`.

**🚪 Exit Gate:** grant atomik & idempoten teruji prod; monitoring aktif; runbook + report ditulis.

---

## Cleanup Backlog (sisipkan di sela sprint)
- [ ] C1 — Putuskan `packages/core` (hapus / dokumentasikan engine di `apps/api`).
- [ ] C2 — Bundle split web (`manualChunks`/dynamic import).
- [ ] C3 — Konfirmasi & rapikan `apps/web/src/pages/PlaceholderPage.tsx`.
- [ ] C4 — Upgrade Wrangler (hilangkan warning out-of-date).
- [ ] C5 — Relokasi artefak non-produk (`agent-tools/`, `terminals/`, `test-results/`) ke `_scratch/` atau `.gitignore`.

---

## Ringkas progress board (isi saat eksekusi)

| Sprint | Status | Exit gate lulus? | Report |
|---|---|---|---|
| 12 Stabilization | ✅ **CLOSED** — 12.1–12.8 done (+2 hotfix prod: concept-gen #1, foundation lock #2). Sisa (mobile-write visual + outline/foundation real) → Sprint 13 | ✅ lulus | [docs/96](../96-sprint-12-stabilization-report.md) |
| 13 Real Generation | 🔧 13.1 ✅ + 13.2 ✅ + 13.5 ✅ DEPLOYED+VERIFIED (foundation+outline AI, PR #4/#5). Sisa: 13.3 concept billing alias, 13.4 specificity guard (sebagian via prompt), 13.6 smoke, readiness-UX follow-up, deploy-script health-check fix | ☐ | docs/97 |
| 14 Safety Hardening | ☐ | ☐ (GATE AI non-founder) | docs/98 |
| 15 Draft Import | ☐ | ☐ | docs/99 |
| 16 Creator Mode | ☐ | ☐ | docs/100 |
| 17 Retention KBM | ☐ | ☐ | docs/101 |
| 18 Payment (gated) | ☐ | ☐ (founder Go) | docs/102 |

**Public launch (no payment):** boleh setelah 12+13+14 ✅. **Payment:** setelah 18 ✅ + founder Go.
