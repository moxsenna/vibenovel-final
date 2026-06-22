# Credit System v2 Closure Implementation Plan

> **For Codex:** Execute this plan with `superpowers:executing-plans`. Use
> `superpowers:test-driven-development` for each behavior change and
> `superpowers:verification-before-completion` before any completion claim.

**Goal:** Menutup seluruh gap `docs/credit-system-v2-full-implementation-plan.md`
hingga implementasi, pengujian, dokumentasi, dan deployment gate Credit System v2
memiliki bukti yang dapat diaudit.

**Architecture:** Pertahankan `ai-credit-policy.ts` sebagai sumber harga
server-authoritative dan `model-routing-v2.ts` sebagai sumber routing terpisah.
Semua aksi AI menggunakan satu lifecycle: create attempt -> debit -> provider
call -> success atau refund. Frontend mengambil estimasi dari server dan
menampilkan biaya sebelum aksi serta debit/saldo setelah sukses. Payment publik
tetap OFF selama closure.

**Tech Stack:** TypeScript, Hono, React/Vite, Supabase/Postgres, Cloudflare
Workers, PowerShell smoke harness, Playwright.

---

## Status Awal dan Definition of Done

Status saat plan ini dibuat:

- Phase 0-7 sebagian besar sudah diimplementasikan pada commit `97c6dc2`.
- Build API/web, contract suite, dan lint sudah lulus pada audit 19 Juni 2026.
- Empat file hotfix billing Intake/Concept masih belum di-commit.
- UI Intake, Concept, Write, dan Publish sudah menampilkan biaya.
- Fondasi dan Outline belum menampilkan estimasi/hasil debit.
- Sejumlah service masih menganggap provider mock sebagai fallback gratis.
- Routing v2 berisi model yang belum memiliki bukti verifikasi OpenRouter.
- Belum ada integration smoke tunggal yang membuktikan debit/refund/idempotency
  menggunakan API dan database lokal.
- Migration `00021` sudah lolos lokal, tetapi belum memiliki operator gate
  production yang aman dan belum ada bukti apply production.
- Dokumen utama masih berstatus `Planning only` dengan checkbox kosong.

Credit System v2 baru boleh disebut selesai jika:

1. Semua aksi berbayar pada matriks v2 melewati lifecycle debit/refund yang sama,
   termasuk saat `AI_PROVIDER=mock` dan `AI_GENERATION_ENABLED=true`.
2. Mode AI disabled tetap menggunakan fallback deterministik gratis.
3. Semua tombol aksi AI berbayar menampilkan estimasi server sebelum eksekusi dan
   penggunaan kredit setelah sukses.
4. Debit, refund, replay idempotent, metadata snapshot, dan penolakan override
   client dibuktikan dengan integration smoke terhadap Supabase lokal.
5. Semua model routing production adalah subset dari katalog OpenRouter yang
   diverifikasi, dengan harga internal yang tercatat tanggal verifikasinya.
6. Produk top-up v2 dan historical order integrity dibuktikan di lokal dan
   staging; production hanya diubah setelah persetujuan eksplisit founder.
7. Seluruh gate build/test/lint/smoke hijau dan closure report berisi GO/NO-GO.
8. Payment publik tetap OFF.

---

## Task 1: Amankan Worktree dan Landing Hotfix Intake/Concept

**Files:**

- Modify:
  `apps/api/scripts/credit-chat-concept-idempotency-contracts.test.mts`
- Modify: `apps/api/src/services/intake.ts`
- Modify: `apps/api/src/services/concept.ts`
- Modify: `apps/api/src/services/mock-ai-provider.ts`
- Do not stage: seluruh perubahan `apps/web/src/**dashboard**`,
  `apps/web/src/hooks/useProjectBrowse.ts`, `apps/web/src/services/projects.ts`,
  dan `docs/audit/17-production-deploy-log-2026-06-17.md`

**Step 1: Audit scope hotfix**

Run:

```powershell
git diff -- apps/api/scripts/credit-chat-concept-idempotency-contracts.test.mts apps/api/src/services/intake.ts apps/api/src/services/concept.ts apps/api/src/services/mock-ai-provider.ts
git status --short
```

Expected: hanya perubahan billing mock Intake/Concept dan fixture mock yang masuk
scope commit ini.

**Step 2: Jalankan regression tests**

Run:

```powershell
npm run test:credit-v2
npm run build:api
```

Expected: keduanya exit code 0.

**Step 3: Commit hanya empat file**

Run:

```powershell
git add apps/api/scripts/credit-chat-concept-idempotency-contracts.test.mts apps/api/src/services/intake.ts apps/api/src/services/concept.ts apps/api/src/services/mock-ai-provider.ts
git diff --cached --check
git commit -m "fix(credit): bill intake and concepts through mock provider"
```

Expected: perubahan dashboard tetap unstaged dan tidak masuk commit.

**Step 4: Buat worktree terisolasi untuk sisa closure**

Gunakan `superpowers:using-git-worktrees`, buat branch
`codex/credit-v2-closure`, lalu lanjutkan Task 2-8 di worktree tersebut.

---

## Task 2: Samakan Semantik Billing untuk Seluruh Provider Mock

**Policy yang diuji:**

- `AI_GENERATION_ENABLED=true` berarti aksi AI berbayar, baik provider
  `openrouter` maupun `mock`.
- `AI_GENERATION_ENABLED=false` berarti fallback deterministik/offline gratis.
- Provider mock harus menghasilkan payload valid untuk parser setiap generation
  type; provider mock bukan bypass billing.

**Files:**

- Create: `apps/api/scripts/credit-generation-matrix-contracts.test.mts`
- Modify: `apps/api/scripts/credit-system-v2-contracts.test.mts`
- Modify: `apps/api/src/services/mock-ai-provider.ts`
- Modify: `apps/api/src/services/foundation-proposal.ts`
- Modify: `apps/api/src/services/outline.ts`
- Modify: `apps/api/src/services/asisten-narra-foundation-patch.ts`
- Modify: `apps/api/src/services/chapter-beat.ts`
- Modify: `apps/api/src/services/chapter-summary.ts`
- Inspect/modify only if test proves a bypass:
  `apps/api/src/services/beat-generation-ai.ts`,
  `apps/api/src/services/chapter-summary-ai.ts`,
  `apps/api/src/services/continuity-delta-ai.ts`,
  `apps/api/src/services/prose-generation.ts`,
  `apps/api/src/services/prose-rewrite.ts`,
  `apps/api/src/services/publish-copy.ts`

**Step 1: Tulis failing source/behavior contracts**

Test matrix minimum:

| Feature | Cost |
|---|---:|
| intake reply | 100 |
| concept generate 3 | 1,000 |
| foundation setup | 2,000 |
| outline 10 chapters | 2,500 |
| chapter beats | 3 |
| summary/delta | 500 |
| continuity standalone | 500 |
| prose hemat/seimbang/terbaik | 800 / 1,500 / 7,500 |
| rewrite hemat/seimbang/terbaik | 500 / 900 / 4,500 |
| publish package | 400 |

Contracts harus gagal jika service masih memakai
`isAiGenerationEnabled(bindings) && !isAiProviderMock(bindings)` untuk memilih
jalur berbayar.

Run:

```powershell
npm exec --workspace @vibenovel/api tsx scripts/credit-generation-matrix-contracts.test.mts
```

Expected: FAIL pada Foundation/Outline dan service lain yang masih bypass.

**Step 2: Lengkapi output provider mock**

Tambahkan payload JSON valid untuk:

- `foundation_proposal`
- `outline_generation`
- `beat_generation`
- `chapter_summary_generation`
- `continuity_delta`

Gunakan marker hash mock yang sudah ada agar output deterministik dan dapat
dikenali dalam test.

**Step 3: Ubah pemilihan jalur AI**

Pada setiap service, pilih jalur billed/provider melalui
`isAiGenerationEnabled(bindings)`. Biarkan `model-router.ts` yang menentukan
provider mock atau OpenRouter. Jangan menghapus fallback AI-disabled.

**Step 4: Jalankan matrix dan suite**

Run:

```powershell
npm exec --workspace @vibenovel/api tsx scripts/credit-generation-matrix-contracts.test.mts
npm run test:credit-v2
npm run test:api:contracts
```

Expected: seluruh matrix dan suite hijau.

**Step 5: Commit**

```powershell
git add apps/api/scripts/credit-generation-matrix-contracts.test.mts apps/api/scripts/credit-system-v2-contracts.test.mts apps/api/src/services
git diff --cached --check
git commit -m "fix(credit): enforce billing lifecycle across mock AI routes"
```

Review staged diff sebelum commit agar perubahan service yang tidak relevan tidak
ikut masuk.

---

## Task 3: Lengkapi Transparansi Kredit Fondasi dan Outline

**Files:**

- Modify: `apps/api/src/services/foundation-proposal.ts`
- Modify: `apps/api/src/services/outline-generator.ts`
- Modify: `apps/api/src/services/outline.ts`
- Modify: `apps/web/src/services/foundation-flow.ts`
- Modify: `apps/web/src/services/outline.ts`
- Modify: `apps/web/src/hooks/useFoundationFlow.ts`
- Modify: `apps/web/src/hooks/useOutlineData.ts`
- Modify:
  `apps/web/src/components/foundation/FoundationProposalsPanel.tsx`
- Modify: `apps/web/src/components/outline/OutlineWorkflowActions.tsx`
- Modify: `apps/web/src/pages/FoundationPage.tsx`
- Modify: `apps/web/src/pages/OutlinePage.tsx`
- Modify: `apps/web/src/services/ai-credit-display.ts`
- Modify: `apps/web/scripts/credit-transparency-ui-contracts.test.mts`
- Create: `apps/web/e2e/credit-v2-foundation-outline.spec.ts`
- Modify: `apps/web/package.json`

**Step 1: Tulis failing UI/API contracts**

Kontrak yang harus ditambahkan:

- Fondasi memanggil
  `fetchCreditEstimate("foundation_setup", undefined, token)`.
- Outline memanggil
  `fetchCreditEstimate("outline_10_chapters", undefined, token)`.
- Tombol menampilkan `Biaya: 2.000 kredit` dan `Biaya: 2.500 kredit`.
- Respons sukses mengandung `creditCost`, `creditBalance`, dan
  `idempotentReplay` jika relevan.
- Notice sukses menggunakan `formatCreditSuccessNotice`.
- Tidak ada quality mode pada Fondasi/Outline.

Run:

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
```

Expected: FAIL sebelum implementasi.

**Step 2: Perluas response contract server**

Return shape untuk generasi Fondasi dan Outline:

```ts
{
  ...existingResult,
  creditCost: number,
  creditBalance: CreditBalance | null,
  idempotentReplay: boolean
}
```

Untuk existing-result/no-generation path, `creditCost` harus `0` dan saldo tidak
boleh berkurang. Jangan membuat harga di route; ambil dari policy/lifecycle.

**Step 3: Implement state frontend**

Tambahkan state:

- `serverCreditCost`
- `creditBalance`
- `creditLoading`
- `creditError`

Fetch estimate setelah `projectId` dan token tersedia. Sebelum submit, cegah aksi
jika known balance lebih kecil dari cost. Setelah sukses, gunakan response server
untuk notice dan balance.

**Step 4: Render pre-action copy**

`FoundationProposalsPanel` dan `OutlineWorkflowActions` menerima label biaya,
loading, error, dan insufficient-balance state. Copy tidak boleh menyebut token,
model, atau provider.

**Step 5: E2E**

Tambahkan Playwright test yang memverifikasi:

1. Fondasi menampilkan 2.000 sebelum klik.
2. Sukses menampilkan debit dan saldo tersisa.
3. Outline menampilkan 2.500 sebelum klik.
4. Tidak ada selector quality mode pada kedua halaman.
5. Error provider menjelaskan kredit tidak terpakai/dikembalikan.

Run:

```powershell
npm run test:credit-v2
npm run build:web
npm run test:e2e --workspace @vibenovel/web -- credit-v2-foundation-outline.spec.ts
```

Expected: seluruhnya hijau.

**Step 6: Commit**

```powershell
git add apps/api/src/services/foundation-proposal.ts apps/api/src/services/outline-generator.ts apps/api/src/services/outline.ts apps/web/src/services/foundation-flow.ts apps/web/src/services/outline.ts apps/web/src/hooks/useFoundationFlow.ts apps/web/src/hooks/useOutlineData.ts apps/web/src/components/foundation/FoundationProposalsPanel.tsx apps/web/src/components/outline/OutlineWorkflowActions.tsx apps/web/src/pages/FoundationPage.tsx apps/web/src/pages/OutlinePage.tsx apps/web/src/services/ai-credit-display.ts apps/web/scripts/credit-transparency-ui-contracts.test.mts apps/web/e2e/credit-v2-foundation-outline.spec.ts apps/web/package.json
git diff --cached --check
git commit -m "feat(credit): expose foundation and outline spend transparently"
```

---

## Task 4: Tambahkan Integration Smoke Debit, Refund, dan Idempotency

**Files:**

- Create: `scripts/credit-system-v2-smoke-api.ps1`
- Create: `scripts/credit-system-v2-launch-gate.ps1`
- Modify: `package.json`
- Reuse patterns from: `scripts/sprint8-smoke-api.ps1`
- Reuse patterns from: `scripts/sprint9-smoke-api.ps1`
- Modify: `apps/api/scripts/credit-system-v2-contracts.test.mts`

**Step 1: Buat harness user/proyek sementara**

Harness harus:

- membaca URL/key Supabase lokal;
- membuat auth user dan project unik;
- memberi saldo fixture melalui service-role/admin grant dengan audit metadata;
- membersihkan hanya fixture dengan identifier run tersebut;
- berhenti jika target bukan localhost kecuali switch hosted eksplisit diberikan.

**Step 2: Uji success matrix**

Untuk setiap endpoint yang representatif:

- catat balance awal;
- kirim fixed idempotency key;
- assert HTTP success;
- assert balance turun tepat sesuai policy;
- assert satu debit ledger;
- assert metadata `featureKey`, `creditCost`,
  `creditPricingVersion=v2`, `generationAttemptId`, `idempotencyKey`;
- assert generation attempt sukses dan provider/model tercatat.

Minimum live local coverage: Intake, Concept, Foundation, Outline, Prose ketiga
mode, Rewrite, dan Publish. Beat/Summary/Continuity boleh ditutup melalui endpoint
existing Sprint 8/9 jika fixture prerequisite-nya sudah tersedia.

**Step 3: Uji replay**

Kirim ulang request dengan idempotency key sama. Assert:

- response replay benar;
- balance tidak berubah;
- tidak ada debit ledger kedua.

**Step 4: Uji failure/refund**

Jalankan API dengan failure injection provider. Assert:

- debit tercatat;
- refund dengan nominal yang sama tercatat;
- final balance sama dengan balance awal;
- attempt `failed`;
- user-facing error tidak membocorkan provider payload/secrets.

**Step 5: Uji client authority**

Request dengan `creditCost`, `model`, dan `provider` dari client harus ditolak
atau diabaikan sesuai kontrak endpoint, dan tidak boleh memengaruhi debit/model.
User message tanpa AI reply harus gratis.

**Step 6: Uji top-up integrity**

Assert products aktif:

- starter: 20.000
- creator: 50.000 + 5.000
- pro: 120.000 + 10.000
- studio: 270.000 + 30.000

Tambahkan fixture historical order yang mereferensikan produk lama, lalu pastikan
order tetap terbaca setelah migration v2.

**Step 7: Buat launch gate agregat**

`credit-system-v2-launch-gate.ps1` menjalankan:

```powershell
npm run test:credit-v2
npm run test:api:contracts
npm run typecheck
npm run lint
npm run build:web
npm run build:api
npm run smoke:no-prod-stubs
powershell -ExecutionPolicy Bypass -File scripts/credit-system-v2-smoke-api.ps1
```

Script harus fail-fast dan mencetak ringkasan PASS/FAIL per gate.

**Step 8: Commit**

```powershell
git add scripts/credit-system-v2-smoke-api.ps1 scripts/credit-system-v2-launch-gate.ps1 package.json apps/api/scripts/credit-system-v2-contracts.test.mts
git diff --cached --check
git commit -m "test(credit): add database-backed v2 launch gate"
```

---

## Task 5: Verifikasi Model Routing v2, Jangan Mengasumsikan ID

**Files:**

- Create: `apps/api/scripts/openrouter-model-verification.mts`
- Create: `apps/api/src/services/openrouter-model-verification.ts`
- Modify: `apps/api/src/services/model-routing-v2.ts`
- Modify: `apps/api/src/services/model-router.ts`
- Modify: `apps/api/src/services/model-cost-map.ts`
- Modify: `apps/api/scripts/model-routing-v2-contracts.test.mts`
- Create: `docs/audit/20-credit-v2-model-verification-2026-06-19.md`
- Modify: `apps/api/package.json`

**Step 1: Tulis failing allowlist contract**

Assert seluruh primary/fallback route adalah member
`VERIFIED_OPENROUTER_MODELS`. Contract harus gagal untuk setiap ID tanpa
`verifiedAt`, catalog match, context limit, dan pricing record.

**Step 2: Implement read-only catalog verifier**

Script membaca katalog resmi OpenRouter dan menghasilkan laporan berisi:

- requested model ID;
- exact catalog match;
- canonical ID;
- input/output pricing;
- context length;
- supported parameters yang dibutuhkan;
- status `VERIFIED`, `MISSING`, atau `INCOMPATIBLE`;
- timestamp UTC dan source URL.

Tidak boleh mengubah routing otomatis ketika hanya melakukan verification.

**Step 3: Jalankan verifikasi**

Run:

```powershell
npm run verify:openrouter-models -w @vibenovel/api
```

Jika credentials diperlukan, script harus berhenti dengan instruksi yang jelas.
Jangan mengarang hasil. Live generation smoke yang menimbulkan biaya hanya
dijalankan dengan switch eksplisit dan persetujuan user.

**Step 4: Koreksi routing**

- Hapus/ganti ID `MISSING` atau `INCOMPATIBLE`.
- Masukkan hanya ID `VERIFIED` ke source verified, allowlist, routing matrix,
  dan cost map.
- Harga kredit user tidak boleh berubah akibat koreksi model.
- Simpan tanggal/source pricing pada komentar atau record verified.

**Step 5: Test**

Run:

```powershell
npm exec --workspace @vibenovel/api tsx scripts/model-routing-v2-contracts.test.mts
npm run test:credit-v2
npm run build:api
```

Expected: route subset invariant hijau dan pricing credit tetap sama.

**Step 6: Commit**

```powershell
git add apps/api/scripts/openrouter-model-verification.mts apps/api/src/services/openrouter-model-verification.ts apps/api/src/services/model-routing-v2.ts apps/api/src/services/model-router.ts apps/api/src/services/model-cost-map.ts apps/api/scripts/model-routing-v2-contracts.test.mts apps/api/package.json docs/audit/20-credit-v2-model-verification-2026-06-19.md
git diff --cached --check
git commit -m "chore(ai): verify and constrain credit v2 model routing"
```

---

## Task 6: Buat Operator Gate Migration v2 yang Aman

**Files:**

- Create: `scripts/operator-credit-v2-migrations.ps1`
- Modify: `package.json`
- Reference only: `supabase/migrations/00021_credit_scale_v2_topup_products.sql`
- Reference patterns:
  `scripts/operator-production-supabase-baseline.ps1`
- Create: `docs/audit/21-credit-v2-migration-preflight-2026-06-19.md`

**Step 1: Implement preflight sebagai default**

Tanpa switch apply, script hanya:

- memvalidasi target project ref dan environment;
- memastikan staging dan production ref tidak tertukar;
- membaca migration history remote;
- menentukan dependency gap 00017-00021;
- memeriksa payment flag tetap OFF;
- menampilkan SQL/migration yang akan dijalankan;
- menulis audit output tanpa mutation.

**Step 2: Tambahkan apply gate**

Mutation membutuhkan:

- switch `-Apply`;
- exact approval string yang mencantumkan environment dan project ref;
- working tree bersih/commit SHA tercatat;
- migration dependency lengkap;
- backup/query snapshot produk dan order count sebelum apply.

Jika remote belum mencapai dependency yang dibutuhkan, script harus block, bukan
menjalankan migration parsial secara buta.

**Step 3: Post-apply verification**

Setelah apply:

- verifikasi migration history;
- verifikasi empat produk v2 aktif;
- verifikasi produk lama inactive, tidak dihapus;
- verifikasi historical order count dan FK tetap utuh;
- verifikasi `CREDIT_TOPUP_ENABLED=false`;
- tulis hasil ke audit file.

**Step 4: Test preflight lokal**

Run:

```powershell
npm run operator:credit-v2:migrations -- -Environment local
npm run operator:credit-v2:migrations -- -Environment staging
```

Expected: local/staging preflight jelas; tidak ada production mutation.

**Step 5: Commit**

```powershell
git add scripts/operator-credit-v2-migrations.ps1 package.json docs/audit/21-credit-v2-migration-preflight-2026-06-19.md
git diff --cached --check
git commit -m "ops(credit): add guarded v2 migration operator"
```

---

## Task 7: Full Verification, Browser QA, dan Closure Report

**Files:**

- Create: `docs/audit/22-credit-system-v2-closure-report-2026-06-19.md`
- Modify: `docs/credit-system-v2-full-implementation-plan.md`
- Modify only if drift checker requires it: related docs indexes/audit links

**Step 1: Jalankan gate dari kondisi bersih**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/credit-system-v2-launch-gate.ps1
git status --short
```

Expected:

- seluruh gate PASS;
- warning lint boleh dicatat, tetapi error harus 0;
- tidak ada generated artifact tidak sengaja.

**Step 2: Browser QA lokal**

Gunakan Browser plugin pada aplikasi lokal dan akun fixture. Verifikasi:

- Intake 100;
- Concept 1.000;
- Foundation 2.000;
- Outline 2.500;
- Prose 800/1.500/7.500 dengan warning Terbaik;
- Rewrite 500/900/4.500;
- Publish 400 tanpa quality mode;
- success copy menunjukkan saldo;
- failure copy menjelaskan refund/no charge;
- model/token/provider tidak bocor ke UI normal.

Simpan screenshot atau referensi evidence di closure report.

**Step 3: Tulis closure report**

Report harus memuat:

- commit SHA per task;
- command dan exit code;
- billing matrix expected vs observed;
- debit/refund/idempotency evidence;
- migration status local/staging/production;
- model verification result;
- payment flag evidence;
- known residual risk;
- keputusan GO/NO-GO.

**Step 4: Update dokumen utama**

Ubah status `Planning only` menjadi status implementasi faktual. Centang item
hanya jika ada evidence pada closure report. Jangan menandai production complete
jika migration/deploy production belum dijalankan.

**Step 5: Commit**

```powershell
git add docs/audit/22-credit-system-v2-closure-report-2026-06-19.md docs/credit-system-v2-full-implementation-plan.md
git diff --cached --check
git commit -m "docs(credit): close v2 implementation audit"
```

---

## Task 8: Staging dan Production Execution Gate

Task ini dijalankan hanya setelah Task 1-7 hijau.

**Staging:**

1. Apply migration melalui operator gate.
2. Deploy API dan web dari commit closure yang sama.
3. Jalankan authenticated smoke dan read-only ledger verification.
4. Pastikan payment tetap OFF.
5. Catat evidence ke closure report.

**Production preflight:**

Run read-only:

```powershell
npm run operator:credit-v2:migrations -- -Environment production
npm run deploy:api:production:dry-run
```

Kemudian berhenti dan minta persetujuan eksplisit founder sebelum mutation.

**Production apply setelah approval:**

1. Apply migration dengan exact approval string.
2. Deploy API/web melalui operator production existing.
3. Jalankan smoke kecil dengan akun beta terkontrol.
4. Verifikasi debit/refund/idempotency dan empat produk.
5. Pastikan `CREDIT_TOPUP_ENABLED=false`.
6. Update closure report dengan timestamp, commit SHA, project ref, dan GO/NO-GO.

Jangan:

- mengalikan saldo beta otomatis;
- mengubah historical ledger;
- mengaktifkan payment;
- menjalankan live OpenRouter model sweep berbiaya tanpa approval;
- mencampur deployment Credit v2 dengan perubahan dashboard yang tidak terkait.

---

## Urutan Commit yang Diharapkan

1. `fix(credit): bill intake and concepts through mock provider`
2. `fix(credit): enforce billing lifecycle across mock AI routes`
3. `feat(credit): expose foundation and outline spend transparently`
4. `test(credit): add database-backed v2 launch gate`
5. `chore(ai): verify and constrain credit v2 model routing`
6. `ops(credit): add guarded v2 migration operator`
7. `docs(credit): close v2 implementation audit`

Setiap commit harus dapat diuji dan direvert secara independen. Production apply
adalah langkah operasional terpisah, bukan alasan mencampur commit.

---

## Estimasi Eksekusi

- Task 1: 30-60 menit
- Task 2: 3-5 jam
- Task 3: 3-5 jam
- Task 4: 4-6 jam
- Task 5: 2-4 jam, bergantung hasil katalog/model live
- Task 6: 2-4 jam
- Task 7: 2-3 jam
- Task 8: 1-3 jam setelah approval dan akses environment tersedia

Total engineering closure: sekitar 2-4 hari kerja fokus. Ketidakpastian terbesar
adalah validitas model OpenRouter dan state migration hosted, bukan implementasi
harga inti.
