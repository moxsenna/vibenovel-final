# 10 — Master Fix Sprint Plan ("Fix Everything")

> Turunan dari audit `docs/audit/00`–`09`. Verdict audit: **NOT_READY_NEEDS_FIX** (sudah jauh melewati Sprint 1–2; produksi private beta; belum siap public/payment).
> Repo berada **pasca-Sprint 11**, jadi penomoran lanjut dari **Sprint 12**.
> Dokumen ini **rencana**, bukan eksekusi. Tidak ada kode diubah saat membuat plan ini.

---

## 0. Prinsip & aturan global (berlaku di semua sprint)

**Guardrails wajib (jangan dilanggar):**
1. AI bukan source of truth; Canonical Story State (DB) yang benar.
2. Planner boleh tahu masa depan; Writer hanya `safe present`.
3. `planningTruth` & future outline **tidak boleh** masuk writer prompt mentah.
4. Context Packet Builder = satu-satunya pintu konteks ke writer.
5. Fakta penting AI → proposal dulu → approval → baru canon.
6. Output AI tidak langsung final; beat-level default; Chapter Delta wajib.
7. Beginner Mode sederhana; Advanced Mode opt-in.
8. Tidak ada model ID/API/prompt mentah ke user; tidak ada overclaim.

**Larangan operasional sampai gate-nya lulus:**
- Jangan buka AI ke **user non-founder** sebelum **Sprint 14** selesai (validator + cost guard).
- Jangan aktifkan **payment produksi** sebelum **Sprint 18** (apply `00010` + atomic grant teruji + founder Go).
- Jangan menambah fitur retensi besar sebelum Sprint 14 selesai.
- Jangan refactor arsitektur besar tanpa mencatat alasan.

**Definition of Done (DoD) tiap sprint:** typecheck + lint + unit test + smoke kritis **hijau**; verification report ditulis (`docs/NN-*`); tidak ada regresi pada E2E `auth-settings-regression`.

---

## Peta sprint & dependensi

```
Sprint 12  Stabilization & Quality Foundation      (P0)  ── blocker semua
   └─> Sprint 13  Real Generation (Foundation+Outline) (P1)
          └─> Sprint 14  AI Safety Hardening + Cost Guard (P1)  ── GATE: buka AI non-founder
                 ├─> Sprint 15  Draft Import / Legacy Continuation (P2)
                 ├─> Sprint 16  Creator Mode (Advanced opt-in)    (P2)
                 └─> Sprint 17  Retention Intelligence (KBM)      (P2)
Sprint 18  Payment Enablement (gated, founder Go)    (independen, butuh 12)
Cleanup backlog (kontinu)
```

Public launch hanya boleh setelah **12 + 13 + 14** lulus. Payment hanya setelah **18**.

---

## SPRINT 12 — Production Story-Flow Stabilization & Quality Foundation  (P0)

**Goal:** Hilangkan kegagalan user-flow nyata (auth/session) dan pasang pagar kualitas minimum agar perbaikan berikutnya tidak menimbulkan regresi diam-diam.

**Kenapa pertama:** Semua route proyek lewat `authMiddleware`; kalau token/sesi rapuh, semua flow AI mentok (temuan E2E: `Invalid or expired access token`). Tanpa lint/CI-regresi, perbaikan apa pun berisiko balik rusak.

### Tasks
| ID | Task | File/area | Acceptance |
|---|---|---|---|
| 12.1 | Audit & samakan Supabase project web↔API di **produksi**; pastikan token web tervalidasi API | `.env.production`, `build-production-web.ps1`, `apps/api/src/middleware/auth.ts` | 1 user nyata login → semua call authed sukses; 0 `Invalid or expired access token` di happy path |
| 12.2 | Verifikasi token refresh + retry end-to-end di prod build | `apps/web/src/lib/api.ts` | Token kadaluarsa → refresh sekali → retry sukses (E2E `auth-settings-regression`) |
| 12.3 | Pastikan build prod **tidak** fallback mock | `apps/web/src/lib/env.ts`, hook `allowMockFallback()` | `VITE_USE_MOCKS=false` di prod; tidak ada layar demo Sprint 1 saat authed |
| 12.4 | Seed/prepare **test project** sampai `outline_locked` untuk E2E Write Room | `supabase/seed*`, script smoke | E2E write-room punya precondition benar; "belum tersedia" hanya saat memang belum locked |
| 12.5 | Tambah **ESLint** + root `lint` script | `eslint.config.*`, `package.json` | `npm run lint` jalan & hijau |
| 12.6 | Perluas CI (`ci.yml`) → typecheck + build + **lint** + E2E `auth-settings-regression` (mock-mode) | `.github/workflows/ci.yml` | CI gagal bila lint/regresi gagal |
| 12.7 | Rerun seluruh E2E user-flow yang dilaporkan gagal; catat hasil | `apps/web/e2e/*` | Laporan PASS/FAIL per flow |
| 12.8 | Verification report | `docs/96-sprint-12-stabilization-report.md` | Ditulis |

**Scope BOLEH:** perbaikan auth/session, env alignment, lint/CI, seed test, rerun E2E.
**Scope DILARANG:** fitur baru, payment, refactor services besar.

**First-task prompt (12.1):**
```
Peran: Senior full-stack + DevOps untuk Narraza (produksi private beta).
Tugas 12.1 — Pastikan web & API produksi memakai Supabase project yang SAMA dan token tervalidasi.
Konteks: E2E melaporkan "Invalid or expired access token". Web baca VITE_SUPABASE_ANON_KEY/PUBLISHABLE;
API validasi via authMiddleware getUser(token). Prod ref = qjmbobvarspwvaalnjct.
Batasan: jangan ubah arsitektur; jangan buka payment; jangan tambah fitur.
Langkah: (1) verifikasi ref web vs API di .env.production + build-production-web.ps1;
(2) reproduksi 1 login nyata, cek header Authorization & respons /api/me;
(3) bila mismatch, perbaiki sumber key build, redeploy web, rerun auth-settings-regression.
Output: root cause, perbaikan, hasil E2E. Jangan commit/deploy tanpa review.
```

---

## SPRINT 13 — Real Generation Engine (Foundation + Outline)  (P1)  [lanjutan 10.31b]

**Goal:** Ganti generator deterministik/stub menjadi AI nyata mengikuti ide user (seperti concept generator sudah real), tanpa melanggar canon discipline.

**Kenapa:** Audit menemukan `foundation_stub_batch` (`apps/api/src/services/foundation-proposal.ts`) dan `outline_stub_deterministic` (`apps/api/src/services/outline-generator.ts`) → flow "generate foundation/outline" terasa template walau API sukses.

### Tasks
| ID | Task | File/area | Acceptance |
|---|---|---|---|
| 13.1 | Real foundation proposal generation via OpenRouter (mengganti stub batch) | `services/foundation-proposal.ts`, `model-router.ts` | 2 ide berbeda → fondasi berbeda & spesifik; tetap masuk `ai_proposals` (bukan canon langsung) |
| 13.2 | Real outline generation dari **locked foundation** (mengganti stub deterministik) | `services/outline-generator.ts` | Outline 10 bab nyata dari fondasi terkunci; tiap bab punya hook/ending/miniVictory bermakna |
| 13.3 | Perbaiki billing alias concept generation | `services/concept.ts` (alias `publish_copy`) | Generation type benar/eksplisit; cost tercatat sesuai jenis |
| 13.4 | Specificity guard (anti-template): larang nama/elemen klise default | prompt builders | Output tidak memakai placeholder klise; uji 2 ide |
| 13.5 | Reveal schedule otomatis dari fondasi (planner-only `planningTruth`) | `services/outline*.ts`, `planned_reveals` | Reveal ter-generate dengan `forbidden_before_chapter`; tak bocor ke writer |
| 13.6 | Smoke + E2E API-mode foundation/outline | `scripts/*`, `apps/web/e2e/*` | Flow lulus tanpa 401 (pakai hasil Sprint 12) |
| 13.7 | Verification report | `docs/97-sprint-13-real-generation-report.md` | Ditulis |

**DILARANG:** menulis canon langsung dari output AI; membocorkan future outline ke writer.

---

## SPRINT 14 — AI Safety Hardening: Validator + Safe Repair + Knowledge Gate + Cost Guard  (P1)
> **GATE WAJIB sebelum membuka AI ke user non-founder.**

**Goal:** Tutup R1–R4 audit: validasi output AI, repair otomatis, knowledge gate per-tokoh, batas biaya, dan unit test jalur safety.

### Tasks
| ID | Task | File/area | Acceptance |
|---|---|---|---|
| 14.1 | Tabel `validation_reports` + service penyimpan laporan | migrasi `00011_*`, `services/validation-report.ts` | Tiap generate punya report tersimpan (lolos/langgar) |
| 14.2 | **Output validator** writer: deteksi forbidden concept/reveal leak/hallucination di prose | `services/*-safety.ts`, baru `output-validator.ts` | Prose menyebut forbidden concept → ditandai gagal |
| 14.3 | **Safe Repair loop**: gagal → repair/regenerate → re-validate (batas retry) | `services/prose-beat-generation.ts`, `prose-rewrite-generation.ts` | Pelanggaran tidak pernah diterima sebagai "siap" |
| 14.4 | **Character Knowledge Gate per-POV**: fakta yang belum sah diketahui POV → `mustNotInclude` | `services/context-packet-builder.ts`, `write-snapshot.ts` | Writer tak menulis tokoh tahu hal yang belum ia tahu |
| 14.5 | **Cost guard**: hard cap harian + cooldown per user + estimasi pra-generate | `services/ai-credit-policy.ts`, `routes/ai.ts`, web | Generate ditolak saat lewat cap; estimasi tampil sebelum aksi |
| 14.6 | **Unit test (Vitest)** jalur safety (lihat `docs/audit/08` §6) | `*.test.ts` baru | Reveal Gate / packet-safety / delta→proposal / promotion teruji |
| 14.7 | Verification report + checklist "AI non-founder ready" | `docs/98-sprint-14-safety-hardening-report.md` | Semua gate hijau |

**Exit gate Sprint 14:** Hanya setelah ini AI boleh dibuka ke user non-founder.

---

## SPRINT 15 — Draft Import / Legacy Continuation  (P2)

**Goal:** Persona "sudah punya draft" — import draft, deteksi sinyal (genre/karakter/konflik/target pembaca), masukkan ke proposal (bukan canon langsung).

**Kenapa:** Audit: **NOT STARTED** — tidak ada route/page draft import (`apps/web/src/routes/index.tsx`).

### Tasks
| ID | Task | Acceptance |
|---|---|---|
| 15.1 | Route + page Import Draft + upload/paste teks | Draft tersimpan sebagai sumber analisis, bukan canon |
| 15.2 | Pipeline ekstraksi sinyal (reuse intake signal logic) | Genre/karakter/konflik/readership terdeteksi |
| 15.3 | Hasil ekstraksi → `ai_proposals` + review | User approve sebelum jadi canon |
| 15.4 | E2E "import existing draft for analysis" | Lulus tanpa 401; panel deteksi terisi |
| 15.5 | Verification report `docs/99-*` | Ditulis |

---

## SPRINT 16 — Creator Mode (Advanced, opt-in)  (P2)

**Goal:** Definisikan & bangun Advanced Creator Mode (prinsip #12) tanpa membebani Beginner.

**Kenapa:** Audit: "advanced creator mode" sekarang hanya quality tier; tak ada Story Bible/reveal editor.

### Tasks
| ID | Task | Acceptance |
|---|---|---|
| 16.1 | Definisi scope Creator Mode (doc) | Disepakati: apa yang opt-in |
| 16.2 | Toggle Advanced Mode opt-in (Beginner tetap default sederhana) | Beginner tanpa istilah teknis; Advanced eksplisit |
| 16.3 | Story Bible viewer/editor (characters/facts/speech rules) | Edit canon via approval flow |
| 16.4 | Reveal & Knowledge editor (planner) | `planningTruth` tetap planner-only |
| 16.5 | E2E + report | Ditulis |

---

## SPRINT 17 — Retention Intelligence (KBM)  (P2)

**Goal:** Lapisan retensi serial mobile yang audit tandai **Missing**.

### Tasks
| ID | Task | Acceptance |
|---|---|---|
| 17.1 | Tabel `chapter_promises` + tracking | Janji per-bab terlacak & dipantau |
| 17.2 | **Payoff Scheduler** (open loop jatuh tempo → pengingat) | Loop tak terbayar → diingatkan |
| 17.3 | **Suffering Fatigue Detector** | Deteksi protagonis ditindas tanpa reward |
| 17.4 | **Protagonist Agency Tracker** | Deteksi tokoh pasif |
| 17.5 | **Unlockability score** per bab | Skor potensi unlock tampil |
| 17.6 | **Mobile readability validator** (paragraf/dialog) | Output memenuhi batas keterbacaan HP |
| 17.7 | E2E + report | Ditulis |

---

## SPRINT 18 — Payment Enablement  (GATED — butuh founder Go)

**Goal:** Aktifkan top-up kredit dengan aman (anti "bayar tapi kredit tak masuk"/dobel).

**Pra-syarat keras:** approval founder eksplisit + Sprint 12 selesai.

### Tasks
| ID | Task | Acceptance |
|---|---|---|
| 18.1 | Apply migrasi `00010` (atomic grant RPC) ke **produksi** | RPC `grant_paid_credit_topup_atomic` ada di prod |
| 18.2 | Uji idempotensi grant (duplicate webhook/callback) | Tidak ada double-credit |
| 18.3 | E2E "bayar → kredit masuk" sandbox→prod (Duitku BCA VA) | Sekali grant, idempoten |
| 18.4 | Aktifkan `CREDIT_TOPUP_ENABLED=true` + monitoring | Hanya setelah 18.1–18.3 lulus |
| 18.5 | Runbook "paid-but-no-credit" + rollback | Ditulis |
| 18.6 | Verification report | Ditulis |

**DILARANG:** set `CREDIT_TOPUP_ENABLED=true` sebelum 18.1–18.3 lulus + founder Go.

---

## Cleanup Backlog (kontinu, sisipkan di sela sprint)

| ID | Item | Aksi |
|---|---|---|
| C1 | `packages/core` placeholder | Hapus atau dokumentasikan "engine di apps/api" |
| C2 | Bundle web 684 kB satu chunk | `manualChunks`/dynamic import (perf mobile) |
| C3 | `apps/web/src/pages/PlaceholderPage.tsx` (dead?) | Konfirmasi & hapus/relokasi |
| C4 | Wrangler out-of-date warning | Upgrade toolchain terencana |
| C5 | Artefak non-produk (`agent-tools/`, `terminals/`, `test-results/`) | `.gitignore`/relokasi `_scratch/` |

---

## Exit criteria — kapan boleh "public launch"

Public launch (tanpa payment) **boleh** setelah: **Sprint 12 + 13 + 14 lulus** + DoD masing-masing terpenuhi + E2E user-flow inti hijau di API-mode.
Payment **boleh** setelah: **Sprint 18 lulus** + founder Go.

## Ringkasan urutan eksekusi (TL;DR)
1. **Sprint 12** — stabilkan auth/session + lint/CI (P0, blocker).
2. **Sprint 13** — foundation & outline jadi AI nyata.
3. **Sprint 14** — validator + repair + knowledge gate + cost guard → **buka AI non-founder**.
4. **Sprint 15–17** — Draft Import, Creator Mode, Retention KBM (paralelkan setelah 14).
5. **Sprint 18** — payment (gated).
6. **Cleanup** — sisipkan terus.
