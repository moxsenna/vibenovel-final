# 64 — Staging Smoke Harness & Hosted Supabase Report (Task 11.2)

**Date:** 2026-06-09  
**Status:** Closed — **PARTIAL GO**  
**Verdict:** Portable smoke harness **GO**; hosted Supabase staging **BLOCKED** (operator secrets pending)  
**Related:** [`docs/62`](62-staging-deploy-mode-a-report.md), [`docs/60`](60-sprint-11-staging-deploy-and-public-callback-plan.md), [`docs/63`](63-updated-product-roadmap-after-sprint-11.md), [`.agent-logs/sprint-11/task-11.2-hosted-supabase-portable-staging-smoke-harness.md`](../.agent-logs/sprint-11/task-11.2-hosted-supabase-portable-staging-smoke-harness.md)

Task 11.2 implements a **cloud-agnostic staging smoke harness** and documents hosted Supabase staging operator gates. **No AWS deploy.** **No payment sandbox.** **No secrets committed.**

---

## 1. Goal and scope

| In scope | Out of scope |
|---|---|
| Portable `smoke:staging` orchestrator | AWS EC2 deploy (Task 11.3) |
| Staging Supabase param support in smoke scripts | `CREDIT_TOPUP_ENABLED=true` |
| Cloud-agnostic `-ApiBaseUrl` / `-WebBaseUrl` | Duitku/Mayar live payment |
| Worker secrets gate documentation | Production deploy / migration push |
| Local smoke regression | Mode B payment sandbox |

---

## 2. Preflight audit

### Staging Worker health (before Task 11.2 changes)

| Check | Result |
|---|---|
| `GET /api/health` | **PASS** `ok=true` |
| `appEnv` | `staging` |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |
| `hasSupabaseUrl` | **false** |
| `hasSupabaseAnonKey` | **false** |
| `hasSupabaseServiceRoleKey` | **false** |

### Web staging

| Check | Result |
|---|---|
| `GET /` | **200** |
| `GET /credits/topup` | **200** |
| Built with hosted `VITE_SUPABASE_*` | **No** — shell only (Task 11.1) |

### Smoke script portability (before)

| Script | `-ApiBaseUrl` | `-WebBaseUrl` | Staging Supabase params | Hardcoded CF URLs |
|---|---|---|---|---|
| `staging-health-smoke.ps1` | ✅ (required or env) | ❌ | ❌ | None |
| `sprint2-smoke-api.ps1` | ✅ | — | Partial (`-SupabaseUrl`, `-SupabaseAnonKey`) | None |
| `sprint10-smoke-web.ps1` | ✅ | ✅ | Partial (local `supabase status` fallback) | None |
| `smoke-all-local.ps1` | ✅ forwarded | ✅ forwarded | Local only | None |
| Most API smokes | ✅ default localhost | — | Local `supabase status` | None |

### Gaps identified

1. No unified `smoke:staging` orchestrator.
2. `staging-health-smoke.ps1` required explicit `-ApiBaseUrl` (no safe default).
3. Remote Supabase URLs still fell back to local `supabase status` (wrong for staging).
4. No env var convention for operator-provided staging Supabase (`STAGING_SUPABASE_*`).
5. Worker Supabase secrets not set — full API-mode staging blocked.
6. Web not rebuilt with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

### Web env variable names (verified)

| Variable | Used in |
|---|---|
| `VITE_API_URL` | `apps/web/src/lib/env.ts` |
| `VITE_SUPABASE_URL` | `apps/web/src/lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | `apps/web/src/lib/supabase.ts` |
| `VITE_USE_MOCKS` | API mode gate |

### Auth flow assumptions

- API smokes: Supabase Auth `signup` via anon key → JWT → API `Authorization: Bearer`.
- Web API-mode: Playwright uses pre-seeded email/password; expects API + Supabase reachable.
- Staging: same flows work against any HTTPS API if Supabase params + Worker secrets align.

---

## 3. Cloud-agnostic smoke design

```txt
-ApiBaseUrl  = source of truth for API target (Worker, EC2+Nginx, VPS, etc.)
-WebBaseUrl  = source of truth for web target (Pages, S3+CloudFront, static host, etc.)
-TargetName  = label for reports only (default: cloudflare-staging)

Defaults (overrideable):
  ApiBaseUrl  → https://vibenovel-api-staging.moxsenna.workers.dev
  WebBaseUrl  → https://vibenovel-web-staging.pages.dev

Env aliases (operator shell, never commit):
  VIBENOVEL_STAGING_API_URL
  VIBENOVEL_STAGING_WEB_URL
  STAGING_SUPABASE_URL
  STAGING_SUPABASE_ANON_KEY
  STAGING_SUPABASE_SERVICE_ROLE_KEY  (optional; smokes avoid service role)

Shared library: scripts/lib/staging-smoke-common.ps1
Orchestrator:   scripts/smoke-staging.ps1
npm alias:      npm run smoke:staging
```

**Phases:**

| Phase | What | Requires Supabase |
|---|---|---|
| A | API health Mode A flags | No |
| B | Web HTTP 200 (`/`, `/credits/topup`) | No |
| C | CORS (Origin = WebBaseUrl) | No |
| D | Auth signup + `sprint2-smoke-api.ps1` | Yes (Worker + hosted SB) |
| E | Web topup API-mode (`-IncludeApiMode`) | Yes |

AWS EC2 run (Task 11.5 — after operator deploy):

```powershell
npm run operator:aws:staging:smoke -- `
  -ApiBaseUrl "https://api-staging.<domain>" `
  -IncludeApiMode `
  -TestEmail "staging-smoke@vibenovel.test" `
  -CloudflareRegression
```

Or direct harness:

```powershell
npm run smoke:staging -- `
  -TargetName "aws-staging" `
  -ApiBaseUrl "https://api-staging.<domain>" `
  -WebBaseUrl "https://vibenovel-web-staging.pages.dev" `
  -IncludeApiMode `
  -TestEmail "staging-smoke@vibenovel.test"
```

**Task 11.5 status:** [`docs/68`](68-aws-ec2-api-staging-deploy-report.md) — BLOCKED in agent session; Cloudflare staging **GO FULL** (post 11.2b).

---

## 4. Supabase staging status

| Item | Status |
|---|---|
| Hosted Supabase project configured in repo | **No** |
| Operator `STAGING_SUPABASE_*` env in agent session | **Not available** |
| Migrations pushed to hosted project | **NOT RUN** (no operator approval) |
| Schema requirement | Migrations `00001`–`00009` minimum |

**Operator gate (when ready):**

1. Create or designate hosted Supabase staging project.
2. Apply migrations (`supabase db push` or dashboard) — **snapshot/backup if not disposable**.
3. Verify seed / topup products if needed.
4. Set Worker secrets (names only):

```powershell
npx wrangler secret put SUPABASE_URL --env staging
npx wrangler secret put SUPABASE_ANON_KEY --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
npm run deploy:api:staging
```

5. Rebuild web with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_USE_MOCKS=false`.
6. `npm run deploy:web:staging`
7. Re-run `npm run smoke:staging -- -IncludeApiMode`

---

## 5. Worker secrets status

| Secret | Set on `vibenovel-api-staging` |
|---|---|
| `SUPABASE_URL` | **No** |
| `SUPABASE_ANON_KEY` | **No** |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** |

**Action taken:** Documented operator procedure; **not faked**. No `wrangler secret put` executed (no credentials available).

---

## 6. API staging health after redeploy

**Redeploy:** Not required — no secret changes in this task.

**Health check (Task 11.2 verification):**

| Flag | Value |
|---|---|
| `ok` | `true` |
| `appEnv` | `staging` |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |
| `hasSupabaseUrl` | `false` |
| Secret leak patterns in response | **None** |

---

## 7. Web staging rebuild/deploy status

| Item | Status |
|---|---|
| Rebuild with `VITE_SUPABASE_*` | **NOT RUN** — no hosted anon key |
| `deploy:web:staging` | **NOT RUN** |
| Current Pages bundle | Task 11.1 shell (API URL baked; Supabase placeholder/missing) |

**Operator build command (documented, not executed):**

```powershell
$env:VITE_API_URL="https://vibenovel-api-staging.moxsenna.workers.dev"
$env:VITE_SUPABASE_URL="https://<project>.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="<anon-key>"
$env:VITE_USE_MOCKS="false"
npm run build:web
npm run deploy:web:staging
```

For AWS/VPS later: set `VITE_API_URL` to the AWS/VPS API domain — **do not hardcode in source**.

---

## 8. Smoke script changes

| File | Change |
|---|---|
| `scripts/lib/staging-smoke-common.ps1` | **Created** — URL resolution, health, CORS, web reachability, redaction |
| `scripts/smoke-staging.ps1` | **Created** — portable orchestrator (phases A–E) |
| `scripts/staging-health-smoke.ps1` | **Updated** — uses common lib; default CF API URL; optional CORS |
| `scripts/sprint2-smoke-api.ps1` | **Updated** — `STAGING_SUPABASE_ANON_KEY`; no local CLI for remote URL |
| `scripts/sprint10-smoke-web.ps1` | **Updated** — `-StagingMode`; staging Supabase resolution |
| `package.json` | **Added** `smoke:staging` |
| `apps/web/.env.example` | **Updated** — staging smoke env var notes |

**Local smoke defaults unchanged** — absent staging params, scripts still use local `supabase status`.

---

## 9. smoke:staging result

```powershell
npm run smoke:staging:health   # PASS (5/5 Mode A flags)
npm run smoke:staging          # PARTIAL GO (exit 0)
```

| Phase | Result |
|---|---|
| A — API health | **PASS** |
| B — Web HTTP 200 | **PASS** (`/`, `/credits/topup`) |
| C — CORS | **PASS** |
| D — Auth + Sprint 2 API | **BLOCKED** (no Supabase params / Worker secrets) |
| E — Web topup API-mode | **NOT RUN** (default without `-IncludeApiMode`) |

**Optional topup API-mode:** Blocked until Supabase + Worker secrets configured.

---

## 10. AWS/VPS compatibility notes

- **Task 11.2 does not deploy AWS.** Task **11.3** ✅ plans AWS separate instance (not Hermes) — [`docs/65`](65-aws-staging-readiness-and-ec2-plan.md).
- **Task 11.4** will deploy API to EC2.
- Smoke harness tests any HTTPS API by changing `-ApiBaseUrl` / `-WebBaseUrl`.
- Web rebuild points to AWS/VPS API via `VITE_API_URL` at build time.
- Payment callback URL can later target AWS/VPS API if chosen.
- **Hosted Supabase can remain** even when API moves to AWS/VPS.
- **Do not store** VibeNovel production/payment secrets on Hermes instance.
- Hermes may assist deploy orchestration but should not host the VibeNovel app.

---

## 11. Local regression result

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run smoke:staging:health` | **PASS** |
| `npm run smoke:staging` | **PARTIAL GO** (exit 0) |
| `npm run smoke:api` (Sprint 2) | **PASS** 17/17 |
| `npm run smoke:all:local` | **PASS** 14/14 (~1.4m) |

---

## 12. Remaining blockers

| Blocker | Unblock path |
|---|---|
| Hosted Supabase project | Operator creates/configures staging project |
| Worker Supabase secrets | `wrangler secret put` × 3 + redeploy |
| Web `VITE_SUPABASE_*` rebuild | Operator build + `deploy:web:staging` |
| Hosted migration apply | Operator approval + `db push` |
| Full staging auth/API smoke | Complete above + `npm run smoke:staging -- -IncludeApiMode` |
| Mode B payment sandbox | After full staging smoke — Task 10.13b / 10.8b |
| AWS EC2 target | Task 11.3 / 11.4 |

---

## 13. Go / No-Go

**Verdict: PARTIAL GO** (Task 11.2b operator gate: **BLOCKED** — see [`docs/67`](67-hosted-supabase-staging-operator-gate-report.md))

| Criterion | Met |
|---|---|
| Portable `smoke:staging` harness | ✅ |
| Cloud-agnostic `-ApiBaseUrl` / `-WebBaseUrl` | ✅ |
| Staging Supabase param support | ✅ |
| Local smoke regression intact | ✅ |
| Mode A payment/AI disabled | ✅ |
| No secrets committed | ✅ |
| No AWS deploy | ✅ |
| Worker Supabase secrets set | ❌ |
| Full staging API-mode smoke | ❌ |
| Web rebuilt with Supabase env | ❌ |

---

## 14. Next recommended task

**Task 11.2b (operator)** — Attempted; **BLOCKED** ([`docs/67`](67-hosted-supabase-staging-operator-gate-report.md)). Operator must complete checklist, then re-run:

```powershell
npm run smoke:staging -- -IncludeApiMode
```

**Product track (parallel):**

- **Task 11.3** — AWS Staging Readiness & EC2 separate instance plan
- **Task 10.13b** — Duitku sandbox live (after Supabase + Mode B)

Founder decision: proceed AWS plan (11.3) while operator completes Supabase gate (11.2b), or prioritize 10.13b on Cloudflare staging first.

---

*Authored Task 11.2 — 9 Juni 2026. Harness + docs; Supabase operator gate pending.*