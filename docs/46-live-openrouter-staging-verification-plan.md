# 46 — Live OpenRouter Staging Verification Plan

**Sprint:** Sprint 8 follow-up (Task 8.8)  
**Status:** Plan complete (not executed)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/45-sprint-8-verification-report.md`](45-sprint-8-verification-report.md), [`docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md)

Dokumen ini adalah **rencana verifikasi staging** untuk provider OpenRouter nyata sebelum menambah fitur AI lanjutan (rewrite, publish copy, summary/delta). **Docs-only** — tidak ada live call otomatis, tidak ada perubahan kode router/credit, tidak ada deploy remote.

**Work log:** `.agent-logs/sprint-8/task-8.8-live-openrouter-staging-verification-plan.md`

**Execution task (next):** Task 8.9 — Live OpenRouter Staging Smoke Execution (manual run + results doc).

---

## 1. Purpose

### Kenapa live provider perlu diverifikasi dulu

Sprint 8 menutup MVP prose beat generation dengan **mock provider** (`AI_PROVIDER_MOCK=true`). Mock memverifikasi orchestration (packet → prompt → attempt → debit → persist → refund), tetapi **tidak** memverifikasi:

- Autentikasi dan billing nyata ke OpenRouter
- Latensi, rate limit, dan error shape dari provider eksternal
- Token usage yang dikembalikan provider vs yang disimpan di `generation_attempts`
- Perilaku retry (`AI_MAX_RETRIES`) pada kegagalan transient
- Keamanan respons error (tidak ada raw body / key leak di log atau response)

Tanpa staging live, perilaku production AI tetap **unknown** meskipun mock PASS (lihat `docs/45` §12).

### Risiko jika langsung lanjut rewrite / publish AI tanpa live staging

| Risiko | Dampak |
|---|---|
| Credit debit tanpa output valid | User kehilangan kredit; refund path belum diuji live |
| Provider error bocor ke client/log | Prompt hash aman, tetapi raw body bisa leak metadata sensitif |
| Model di luar allowlist / deprecated | 502 berulang; attempt failed menumpuk |
| Biaya provider >> estimasi fixed credit | Kerugian finansial sebelum cost observation |
| Timeout tidak reliable | UX hang; attempt stuck `in_progress` |
| Idempotency + retry interaksi | Double debit atau double provider call |
| Canon / packet leak | Pelanggaran safety policy pre-AI |

**Keputusan gate:** Fitur AI baru (rewrite, publish copy, summary/delta, topup) **tidak** dimulai sampai Task 8.9 Go dan dokumentasi hasil staging.

---

## 2. Current Sprint 8 State

| Area | Status |
|---|---|
| Mock provider | ✅ Verified (Task 8.6) — modes `success`, `fail_provider`, `unsafe_output` |
| `POST /api/projects/:id/ai/generate-prose` | ✅ Ready |
| Credit debit / refund | ✅ Verified (mock) — fixed cost per quality tier |
| WritePage `Tulis Beat dengan AI` | ✅ Verified (API mode + mock) |
| `AI_GENERATION_ENABLED` default | ✅ `false` (repo + `.dev.vars.example`) |
| Live OpenRouter | ❌ **Not tested** — no live provider calls in Sprint 8 |

**Post–Task 8.6 env restore:** Lokal kembali ke `AI_GENERATION_ENABLED=false` agar default smoke aman.

---

## 3. Staging Env Requirements

### Variabel wajib (staging live)

Set di `apps/api/.dev.vars` (lokal, gitignored) atau Worker secret (staging Worker — **bukan** commit ke repo):

| Variable | Staging live value | Notes |
|---|---|---|
| `AI_GENERATION_ENABLED` | `true` | Kill switch; default repo tetap `false` |
| `AI_PROVIDER_MOCK` | `false` | Pakai `openrouter-client`, bukan mock |
| `OPENROUTER_API_KEY` | `<your-key>` | Worker-only; **never** in git/logs/PR |
| `OPENROUTER_BASE_URL` | optional | Default `https://openrouter.ai/api/v1` |
| `DEFAULT_AI_MODEL` | optional | Fallback jika tier env kosong; harus di `MODEL_ALLOWLIST` |
| `AI_MODEL_HEMAT` | optional | Override tier hemat |
| `AI_MODEL_SEIMBANG` | optional | Override tier seimbang |
| `AI_MODEL_TERBAIK` | optional | Override tier terbaik |
| `AI_TIMEOUT_MS` | optional | Terdefinisi di `env.ts`; **saat ini** timeout aktual dari quality tier di `model-router.ts` (hemat 30s, seimbang 45s, terbaik 60s) — catat saat observasi |
| `AI_MAX_RETRIES` | optional | Default `1` (satu retry pada error retryable) |

Tetap butuh Supabase vars (`SUPABASE_URL`, keys, `ALLOWED_ORIGINS`) seperti dev normal.

### Aturan keamanan key

| Rule | Enforcement |
|---|---|
| No key in git | `.dev.vars` gitignored; hanya placeholder di `.dev.vars.example` |
| No key in logs | `openrouter-client` tidak log key/body; verifikasi console saat live |
| No key in health | `/api/health` hanya `hasOpenRouterApiKey: boolean` |
| Do not share `.dev.vars` | Satu operator per mesin; jangan paste di chat/PR |
| Low-budget account | Gunakan akun OpenRouter dengan **daily spend cap** rendah untuk staging |
| Restore after test | Set `AI_GENERATION_ENABLED=false` dan hapus/rotate key jika perlu |

### Health check expectation (live staging)

```json
{
  "aiGenerationEnabled": true,
  "aiProviderMock": false,
  "hasOpenRouterApiKey": true
}
```

---

## 4. Model Allowlist Plan

Allowlist **hardcoded** di `apps/api/src/services/model-router.ts` — client **tidak** bisa mengirim `model` di body.

### Tier → default model (code)

| Quality tier | Default model | Timeout (code) | Max output tokens (code) |
|---|---|---|---|
| **hemat** | `google/gemma-2-9b-it` | 30s | 800 |
| **seimbang** | `anthropic/claude-3-haiku` | 45s | 1200 |
| **terbaik** | `anthropic/claude-3.5-sonnet` | 60s | 2000 |

### Allowlist penuh (`MODEL_ALLOWLIST`)

- `google/gemma-2-9b-it`
- `anthropic/claude-3-haiku`
- `anthropic/claude-3.5-sonnet`
- `anthropic/claude-3-haiku-20240307`
- `anthropic/claude-3-5-sonnet-20240620`

### Fallback resolution order

1. Env tier (`AI_MODEL_HEMAT` / `AI_MODEL_SEIMBANG` / `AI_MODEL_TERBAIK`) jika ada **dan** allowlisted  
2. Else `DEFAULT_AI_MODEL` jika allowlisted  
3. Else `QUALITY_DEFAULT_MODELS[qualityMode]`

### Kenapa client tidak boleh pilih model

- Mencegah cost escalation dan model injection
- Satu policy server-side untuk credit cost + safety
- Body parser menolak field terlarang (`model`, `provider`, `creditCost`, dll.)

### Mengubah allowlist dengan aman

1. Edit `MODEL_ALLOWLIST` + default tier di kode (task terpisah, **bukan** 8.8)
2. Konfirmasi model masih tersedia di OpenRouter dashboard
3. Uji satu generation per tier di staging (Task 8.9)
4. Dokumentasikan di work log; jangan enable production sampai Go

### ⚠️ Manual selection sebelum live test

**Model final production belum dikunci.** Sebelum Task 8.9:

- [ ] Operator memilih model hemat/seimbang/terbaik dari allowlist di atas (atau dated variant)
- [ ] Konfirmasi model aktif di [OpenRouter models](https://openrouter.ai/models)
- [ ] Set env tier di `.dev.vars` jika override dari default
- [ ] Rekomendasi staging pertama: **`hemat`** (`google/gemma-2-9b-it`) — biaya terendah

---

## 5. Budget / Cost Cap Plan

### Prinsip

- **Fixed credit cost** tetap dipakai (client tidak override): hemat **5**, seimbang **10**, terbaik **20** (`ai-credit-policy.ts`)
- Provider billing **terpisah** dari credit user; observasi wajib sebelum scale

### Batas staging (disarankan)

| Cap | Nilai disarankan | Tindakan jika terlampaui |
|---|---|---|
| Daily live test budget (OpenRouter) | **≤ USD 2.00** | Stop test; rollback `AI_GENERATION_ENABLED=false` |
| Max attempts per session | **≤ 5** live calls | Hentikan; review ledger |
| Max output tokens per call | Cap code: min(quality cap, 2000 prose_beat) | Gunakan tier **hemat** dulu |
| Max quality tier staging | **hemat** dulu; seimbang/terbaik hanya setelah 3× hemat Go | Kurangi tier |

### Observasi biaya

| Field | Sumber | Catatan staging |
|---|---|---|
| `credit_cost` | `generation_attempts` | Fixed per tier |
| `input_tokens` / `output_tokens` | OpenRouter `usage` → attempt row | Bisa `null` jika provider tidak kirim usage |
| `estimated_cost_usd` | Kolom DB ada | **Saat ini tidak di-populate** pada success path — bandingkan manual dengan dashboard OpenRouter |
| OpenRouter dashboard | Provider billing | Sumber kebenaran USD |

### Stop criteria (cost)

- Satu call > **USD 0.50** → stop, investigasi model/tier
- Total sesi > **daily cap** → rollback
- Token output konsisten > cap code → bug atau model noncompliant
- Credit debited 20 (terbaik) tanpa prose valid → treat as No-Go

---

## 6. Live Smoke Plan (Manual)

**Scope:** Satu operator, lokal (`dev:api` + Supabase lokal), **tidak** otomatisasi di CI, **tidak** remote deploy.

### Prasyarat umum

```text
supabase start && supabase db reset
npm run dev:api   # setelah .dev.vars live staging
```

Gunakan user smoke yang sama pola dengan `scripts/sprint8-smoke-api.ps1` (signup/login, foundation, outline lock, beat).

---

### A. Health / env check

1. `GET /api/health` (atau health route yang expose `getEnvPresenceFlags`)
2. Assert: `aiGenerationEnabled=true`, `hasOpenRouterApiKey=true`, `aiProviderMock=false`
3. Assert: tidak ada string key di response body

---

### B. Single success generation

1. Seed `credit_balances` → balance ≥ 20 (service role REST, sama seperti sprint8 smoke)
2. `GET /api/credits/balance` — catat `balanceBefore`
3. Build context packet + `POST /api/projects/:projectId/ai/generate-prose`:
   - `qualityMode`: `hemat` (staging pertama)
   - `idempotencyKey`: unik per run, e.g. `live-staging-001`
   - `beatId`, `chapterOutlineId`, `writingSessionId` valid
4. Verify response:
   - HTTP 200
   - `generationAttempt.status` = `succeeded`
   - `generationAttempt.provider` = `openrouter`
   - `generationAttempt.model` = model yang di-resolve
   - `inputTokens` / `outputTokens` terisi atau null (catat)
   - `idempotentReplay` = `false`
   - `creditCost` = 5 (hemat)
5. Verify `credit_balances`: `balanceBefore - 5`
6. Verify prose version: `source` = `ai_generated` (DB atau GET prose endpoint)
7. Verify **tidak** ada di response: `planningTruth`, `packet_json`, raw prompt, OpenRouter key
8. Verify canon tables unchanged (no new `canon_*` / `ai_proposals`)

---

### C. Idempotency replay

1. Ulangi **identical** request dengan **same** `idempotencyKey` sebagai B
2. Expect: HTTP 200, `idempotentReplay: true`
3. Verify: balance **tidak** berkurang lagi
4. Verify: `generation_attempts` — tidak ada row succeeded kedua untuk key yang sama
5. Observasi provider: idealnya **no second billable call** (cek OpenRouter dashboard activity)

---

### D. Failure mode

**Hanya jika aman** (budget cap rendah):

| Mode | Setup | Expect |
|---|---|---|
| Invalid model | Set `AI_MODEL_HEMAT=invalid/model` (not in allowlist), restart API | 503 `AI_NOT_CONFIGURED` — **no provider call** |
| Provider error | Opsional: key sementara invalid **setelah** success path selesai | Safe `error_code` (e.g. `AI_PROVIDER_ERROR`); **no raw body** in response |
| Post-debit failure | Jika debit terjadi lalu provider gagal | `credit_ledger` refund row; attempt `failed` |

Catat: jangan gunakan invalid key di awal jika itu menghabiskan attempt budget tanpa belajar apa-apa.

---

### E. Timeout behavior

- Timeout aktual per tier di `model-router.ts` (bukan `AI_TIMEOUT_MS` env saat ini)
- Staging: gunakan tier **terbaik** (60s cap) hanya jika budget memungkinkan **satu** call
- Expect pada timeout: `AI_PROVIDER_TIMEOUT`, attempt failed, refund jika sudah debited
- **Jangan** mematikan network secara agresif tanpa rollback plan

---

### F. Rollback

1. Set `AI_GENERATION_ENABLED=false` di `.dev.vars`
2. Restart `dev:api`
3. `POST .../ai/generate-prose` → 503 `AI_DISABLED`
4. Optional: set `AI_PROVIDER_MOCK=true` untuk kembali ke mock dev
5. Konfirmasi WritePage menampilkan pesan AI nonaktif (sama Task 8.6 disabled path)

---

## 7. Observability Checklist

Setelah setiap live call, periksa:

| Signal | Where | Pass criteria |
|---|---|---|
| Attempt status | `generation_attempts.status` | `succeeded` / `failed` sesuai skenario |
| Credit debit | `credit_ledger` direction=debit | Satu debit per successful new attempt |
| Credit refund | `credit_ledger` direction=refund | Ada jika provider gagal setelah debit |
| Audit | `audit_logs` | `generation_attempt_*`, `credit_debited`, `credit_refunded`, `ai_output_persisted` |
| Provider / model | attempt row + safe API summary | `openrouter` + allowlisted model id |
| Token counts | attempt row | Recorded or null — document either |
| Latency | `[model-router] success` log | `latencyMs` masuk akal (< tier timeout) |
| `error_code` | attempt + API error | Mapped `AppError` code, not raw HTTP |
| No raw provider body | API response + logs | Tidak ada JSON choices/provider payload |
| No raw prompt | API response + logs | Hanya `promptHash` |
| `estimated_cost_usd` | attempt row | Expected **null** today — note for future wiring |

---

## 8. Safety Checklist

| Check | Method |
|---|---|
| No `planningTruth` in response | Inspect JSON body |
| No `packet_json` | Inspect body + audit metadata |
| No raw prompt text | Body + server logs |
| No OpenRouter key | Health, errors, logs |
| No raw provider response | Errors + logs |
| No canon mutation | Query canon tables before/after |
| No `ai_proposals` insert | Table count unchanged |
| No auto summary/publish | No calls to summary/publish AI routes (belum ada) |

---

## 9. Rollback Plan

| Step | Action |
|---|---|
| 1 | `AI_GENERATION_ENABLED=false` — immediate kill switch |
| 2 | `AI_PROVIDER_MOCK=true` untuk dev lokal mock regression |
| 3 | Revert model env vars ke default kosong atau known-safe allowlist ids |
| 4 | **Jangan** hapus `generation_attempts` / `credit_ledger` rows — audit trail |
| 5 | Dokumentasikan failed attempts di Task 8.9 work log |
| 6 | User-facing: endpoint returns 503 `AI_DISABLED`; WritePage shows disabled notice |

Rotate `OPENROUTER_API_KEY` di dashboard jika ada suspicion leak.

---

## 10. Go / No-Go Criteria

### Go (boleh lanjut fitur AI baru / shared staging enable)

Semua harus true:

- [ ] **≥ 3** live generations **succeeded** (min 1 idempotency replay verified)
- [ ] Cost/token **sane** vs daily cap dan fixed credit tiers
- [ ] **No leaks** (safety checklist §8)
- [ ] Refund/error path **safe** (min 1 controlled failure observed or documented skip with reason)
- [ ] Latency **acceptable** (< quality timeout, no systematic 504)
- [ ] **No canon mutation**
- [ ] **No double debit** on replay

### No-Go (block AI expansion)

Any of:

- Provider error exposes **raw body** or stack to client/logs
- **Credit mismatch** (debit without prose, or double debit)
- Model returns **unsafe content** repeatedly (policy filter fires often)
- Costs **exceed budget** or expectation
- Timeout behavior **unreliable** / attempts stuck
- Any **prompt/context leak**

No-Go → rollback §9, fix in code/config task, re-run Task 8.9.

---

## 11. Commands / Manual Checklist (PowerShell)

**Placeholders only — no real secrets.**

### 11.1 Prepare `.dev.vars` (manual edit)

```powershell
# From repo root — edit gitignored file, never commit
notepad apps\api\.dev.vars
```

Add or uncomment (values are **examples**, replace placeholders):

```ini
AI_GENERATION_ENABLED=true
AI_PROVIDER_MOCK=false
OPENROUTER_API_KEY=<YOUR_OPENROUTER_KEY>
# OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
# AI_MODEL_HEMAT=google/gemma-2-9b-it
# AI_MAX_RETRIES=1
```

Keep existing `SUPABASE_*` and `ALLOWED_ORIGINS` lines.

### 11.2 Restart API

```powershell
# Stop existing dev:api terminal (Ctrl+C), then:
cd D:\Coding\vibenovel-unified-blueprint
npm run dev:api
```

### 11.3 Health check

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/health" | ConvertTo-Json -Depth 5
# Expect: aiGenerationEnabled=true, aiProviderMock=false, hasOpenRouterApiKey=true
```

### 11.4 Baseline smoke (AI still disabled path — optional regression)

```powershell
# With AI_GENERATION_ENABLED=false restored only:
npm run smoke:api:sprint8
```

### 11.5 Live generation (manual — Task 8.9)

Use patterns from `scripts/sprint8-smoke-api.ps1`:

1. Auth signup/login → bearer token  
2. Seed credits via Supabase REST (`credit_balances`)  
3. Foundation + outline + beat setup (or reuse smoke helpers)  
4. `POST /api/projects/{projectId}/ai/generate-prose` with `qualityMode=hemat`  
5. Repeat with same `idempotencyKey` for replay test  

**Do not** add live OpenRouter to `sprint8-smoke-api.ps1` in Task 8.8 — execution is Task 8.9.

### 11.6 Web check (optional, after API live success)

```powershell
# Requires dev:web API mode + AI enabled on API
npm run smoke:web:write-ai -- -IncludeApiMode
```

### 11.7 Restore disabled env

```powershell
notepad apps\api\.dev.vars
# Set:
#   AI_GENERATION_ENABLED=false
#   AI_PROVIDER_MOCK=true
# Remove or comment OPENROUTER_API_KEY when not testing
# Restart dev:api
```

Verify:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/health" | ConvertTo-Json -Depth 5
# Expect: aiGenerationEnabled=false
```

---

## 12. Documentation Updates (Task 8.8)

| Doc | Update |
|---|---|
| `README.md` | Task 8.8 ✅, link `docs/46`, next Task 8.9 |
| `docs/36` | Live OpenRouter plan complete; execution = 8.9 |
| `docs/45` §14 | Link ke `docs/46` sebagai plan complete |

---

## 13. Recommended Next Task

### Task 8.9 — Live OpenRouter Staging Smoke Execution

- Jalankan manual checklist §6 + §11
- Tulis hasil (PASS/FAIL per step, cost observation, Go/No-Go)
- **Tidak** mengubah router/credit behavior kecuali bug fix terpisah
- **Tidak** claim live tested sampai eksekusi selesai

---

## Related documents

- [`docs/45-sprint-8-verification-report.md`](45-sprint-8-verification-report.md)
- [`docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`apps/api/README.md`](../apps/api/README.md)
- [`apps/api/src/services/model-router.ts`](../apps/api/src/services/model-router.ts)
- [`apps/api/src/services/openrouter-client.ts`](../apps/api/src/services/openrouter-client.ts)
- [`scripts/sprint8-smoke-api.ps1`](../scripts/sprint8-smoke-api.ps1)
- [`scripts/sprint8-smoke-web.ps1`](../scripts/sprint8-smoke-web.ps1)