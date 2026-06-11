# 96 — Sprint 12 Verification Report (Production Story-Flow Stabilization)

> Penutupan resmi Sprint 12. Tanggal: 2026-06-12.
> Sumber rencana: `docs/audit/10-master-fix-sprint-plan.md`, checklist eksekusi: `docs/audit/11-sprint-12-18-execution-checklist.md`.
> Semua perubahan kode sudah merged ke `main` (PR #1, #2, #3) dan dua hotfix API sudah live di produksi.

---

## 1. Executive Summary

Sprint 12 = **stabilisasi alur cerita produksi + fondasi kualitas**, lanjutan dari audit (`docs/audit/00`–`11`, verdict `NOT_READY_NEEDS_FIX`). Tujuan: membuat alur user nyata berjalan jujur di produksi tanpa `Invalid or expired access token`, memasang pagar kualitas (lint/CI), dan mengunci batas mock↔real — **tanpa** menambah fitur, payment, atau refactor besar.

Selama eksekusi, verifikasi end-to-end dengan akun test produksi **menemukan dua bug produksi P0 yang sebelumnya tersembunyi** (di bawah lapisan auth yang sudah diperbaiki). Keduanya **diperbaiki, dideploy, dan diverifikasi live**.

### Closure decision
**Sprint 12 inti: CLOSED ✅.** Alur `intake → 3 konsep AI → fondasi → lock → outline → lock → ruang tulis → AI prose diterima sebagai sumber` **terverifikasi end-to-end di produksi**. Sisa item (render mobile-write visual, outline/foundation generator yang masih stub, hard cap biaya AI) **dipindahkan ke Sprint 13/14** sesuai master plan — bukan blocker penutupan Sprint 12.

---

## 2. Delivered Scope (Task 12.1–12.8)

### 12.1 — Auth/session production alignment ✅
- Semua key `.env.production` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) terkonfirmasi ref **`qjmbobvarspwvaalnjct`** (konsisten web↔API; bukan staging `jdxyhrnibmmwlbtbokqo`).
- `apps/web/src/lib/supabase.ts` menerima publishable key sebagai fallback (deploy sebelumnya, commit `8ed0435`).
- **Live verify:** login akun test → Supabase prod mint access_token → `GET https://api.narraza.web.id/api/me` **HTTP 200**, profil benar. Loop bug "Invalid or expired access token" **tertutup**.

### 12.2 — Token refresh + retry ✅
- `apps/web/src/lib/api.ts`: refresh sesi + retry sekali pada 401 `UNAUTHORIZED`, lalu clear session bila tetap invalid.
- **Verify:** E2E `auth-settings-regression` ("refreshes a stale access token") PASS.

### 12.3 / 12.3b / 12.3c — Mock boundary lock ✅
- 12.3b: audit 9 hook — silent fallback ke demo **sudah** ter-gate (honest else-branch `error`/`locked`/empty); `allowMockFallback() === shouldUseMocks()`. Tidak perlu rewrite.
- 12.3c: `apps/web/src/lib/env.ts` — baris pertama `if (import.meta.env.PROD) return false;` → build produksi **mustahil** masuk mock mode walau `VITE_USE_MOCKS` hilang/`true` atau ada `__MOCK_OVERRIDE__`. Dev/test tak berubah.
- **Verify:** typecheck PASS; `auth-settings-regression` 3/3 PASS (mock-mode dev tetap jalan, prod terkunci).

### 12.4 — Project test → `outline_locked` ✅
- Project test digiring via API sampai `outline_locked` (foundation locked + outline locked) **setelah** hotfix bug #1 & #2.
- **Verify:** write session terbuka untuk project `outline_locked` (bukan "Ruang Tulis belum tersedia").

### 12.5 — ESLint + lint script ✅
- `eslint.config.mjs` (flat config): web=browser+react-hooks, api/shared/e2e=node, non-type-checked. Script root `lint`/`lint:fix`.
- Triage: 24 error awal (23 `no-useless-assignment`, 1 `no-empty-object-type`) → **bukan bug** → diturunkan ke `warn` dengan rationale; `react-hooks/rules-of-hooks` tetap error.
- **Verify:** `npm run lint` → **0 errors, 34 warnings, exit 0**.

### 12.6 — CI gate ✅
- `.github/workflows/ci.yml`: tambah step **Lint** + job **e2e-regression** (chromium + `auth-settings-regression`, mock + route-mocked API).
- **Bonus:** memperbaiki **CI yang sudah lama merah di `main`** (sejak ≥8 Jun): npm/cli#4828 (lockfile lintas-platform), `build:shared` sebelum `vite dev`, env Supabase dummy untuk test refresh, warm-up route + retries.
- **Verify:** **PR #1 CI HIJAU** (job `build` + `e2e-regression`).

### 12.7 — Rerun E2E user-flow yang dilaporkan gagal ✅ (inti)
Diverifikasi via API (akun test prod) + 2 hotfix:

| Flow | Hasil |
|---|---|
| Generate 3 concepts | ✅ AI nyata (201) pasca hotfix #1 |
| Foundation + outline | ✅ lock + outline 10 bab + `outline_locked` pasca hotfix #2 (generator masih stub → S13) |
| Logout | ✅ guard + boundary lock (regression) |
| Settings "Terbaik" persist | ✅ regression |
| Credit estimate | ✅ regression (20/12/12) |
| Accept generated prose (Write Room) | ✅ AI prose v1 jadi current source |
| Mobile write room | ⚠️ session terbuka via API; render UI mobile belum dicek visual (S13) |

### 12.8 — Verification report ✅
- Dokumen ini.

---

## 3. Emergent Production Hotfixes (P0 — ditemukan saat verifikasi)

### Hotfix #1 — Concept generation 500 (PR #2, live)
- **Symptom:** setiap proyek baru, `POST /concepts/generate` → 500. User baru tak bisa lewat langkah AI pertama.
- **Root cause (log EC2):** OpenRouter sukses tapi output **dipotong di 800 token** (`maxOutputTokens = min(hemat=800, publish_copy=800)`), JSON 3-objek terpotong → `JSON.parse` gagal → unhandled 500 (kredit di-refund).
- **Fix:** `maxOutputTokensOverride` server-only (clamp ≤4000) di `model-router.ts`; concept gen minta 3000 token @ temp 0.4; parse fail → 502 bersih. Cap/biaya fitur lain tak berubah.
- **Live verify:** `POST /concepts/generate` → **201**, 3 konsep AI nyata ("Bayangan di Balik Stetoskop", `generator: openrouter`, spesifik ke ide intake).

### Hotfix #2 — Foundation readiness/lock inconsistency (PR #3, live)
- **Symptom:** `GET /foundation/readiness` → 75% `canLock=true`, tapi `POST /foundation/lock` → 409 (recompute 70% < 75). UI bilang "siap dikunci" tapi lock gagal.
- **Root cause:** `secret_guard` (`foundation-readiness.ts`) memakai `secretProposals.every(status==="proposed")` → bergantung `activeStatuses`. GET (proposed-only) lolos (+5); lock (proposed+accepted) gagal begitu proposal high-risk **di-accept** (jalur promosi yang benar) (−5).
- **Fix:** `secretGuardOk = !highRiskSecretsInFacts` saja (lindungi risiko nyata: rahasia high-risk ditulis langsung ke facts). Proteksi reveal-ke-pembaca tetap di Reveal Gate hilir. Kedua readiness kini konsisten.
- **Live verify (full pipeline):** readiness 75% → **foundation LOCKED** → outline 10 bab → **outline LOCKED** → write session terbuka → 5 beats → **AI prose v1 (260 kata, `source=ai_generated`, `isCurrent=true`, −5 kredit) jadi current source**.

---

## 4. Verification Summary

| Cek | Hasil |
|---|---|
| `npm run typecheck` (shared/web/api) | PASS |
| `npm run lint` | 0 errors / 34 warnings / exit 0 |
| `npm run build:web` | PASS (warning bundle 684 kB — S13 cleanup) |
| `npm run build:api:node` | PASS |
| Playwright `auth-settings-regression` | 3/3 PASS (lokal + CI) |
| CI PR #1 (build + e2e-regression) | HIJAU |
| Live prod: login → `/api/me` | 200 |
| Live prod: pipeline intake→…→accept prose | ✅ end-to-end |

---

## 5. Task Completion Matrix

| Task | Status | Evidence |
|---|---|---|
| 12.1 Auth alignment | ✅ | login→/api/me 200 (prod) |
| 12.2 Token refresh+retry | ✅ | E2E regression |
| 12.3b Silent fallback off | ✅ | hook audit + 12.3c |
| 12.3c Boundary lock prod | ✅ | `env.ts` PROD guard |
| 12.4 outline_locked | ✅ | pipeline live |
| 12.5 ESLint + lint | ✅ | `eslint.config.mjs`, lint 0 err |
| 12.6 CI gate | ✅ | PR #1 hijau |
| 12.7 Rerun E2E | ✅ inti | tabel §2 |
| 12.8 Report | ✅ | dokumen ini |
| Hotfix #1 concept-gen | ✅ live | PR #2 |
| Hotfix #2 foundation lock | ✅ live | PR #3 |

---

## 6. Deferred ke Sprint 13/14 (bukan blocker Sprint 12)

- **Outline generator masih stub** (`outline_stub_deterministic`; prose menyebut nama template "Nadira") → real outline generation (Sprint 13).
- **Foundation stub** tidak auto-isi tokoh utama/fakta (harus manual saat verifikasi) → real foundation generation + samakan UX readiness (Sprint 13).
- **Mobile write room**: session terbuka via API; render UI mobile belum diverifikasi visual (butuh browser) → Sprint 13.
- **Bundle web 684 kB** satu chunk → code-split (Sprint 13 cleanup).
- **Cost guard AI per-user** (hard cap/cooldown/estimasi pra-generate) → Sprint 14 (sebelum buka AI non-founder).
- **Lockfile lintas-platform** agar CI bisa kembali ke `npm ci` (saat ini `rm package-lock.json && npm install`).

---

## 7. Artefak (PR / commit / deploy)

- **PR #1** — Sprint 12 stabilization (mock boundary lock, ESLint, CI gate). Merged.
- **PR #2** — Hotfix concept-gen 500. Merged + deploy prod (EC2).
- **PR #3** — Hotfix foundation readiness/lock. Merged + deploy prod (EC2).
- **Produksi:** API EC2 redeploy 2× (Mode A, `appEnv=production`, health PASS). Web tidak diubah.
- **Branch verifikasi:** `sprint-12-stabilization`, `hotfix/concept-gen-token-budget`, `hotfix/foundation-readiness-lock` (semua merged ke `main`, branch dihapus).

---

## 8. Exit Gate Sprint 12

- [x] `typecheck` + `lint` hijau; CI hijau.
- [x] Happy-path authed prod: 0 `Invalid or expired access token`.
- [x] `auth-settings-regression` 3/3 PASS.
- [x] Silent mock fallback mati di jalur authed; mock tak bisa leak ke prod.
- [x] Alur inti `intake → konsep → fondasi lock → outline lock → write → accept prose` verified live di prod.
- [x] Report (`docs/96`) ditulis.

**→ Sprint 12 CLOSED. Lanjut Sprint 13 (Real Generation Engine: foundation + outline).**

---

## 9. Catatan operasional

- Proyek test produksi `78d4b671…` ("ZZ-TEST-writeroom") kini berisi data tes lengkap — aman dihapus.
- Verifikasi memakai akun test founder via API (read + mutate terbatas); **disarankan rotasi password** dan akun test khusus untuk verifikasi berikutnya.
- AI produksi **ON** untuk founder test; payment tetap **OFF/blocked** (tak diubah di Sprint 12).
