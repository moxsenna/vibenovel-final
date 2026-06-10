# 67 — Hosted Supabase Staging Operator Gate Report (Task 11.2b)

**Date:** 2026-06-09  
**Status:** Closed — **BLOCKED** (operator credentials unavailable)  
**Verdict:** Staging shell remains safe Mode A; full auth/API-mode smoke **not unblocked**  
**Related:** [`docs/64`](64-staging-smoke-harness-and-supabase-report.md), [`docs/62`](62-staging-deploy-mode-a-report.md), [`docs/66`](66-aws-api-staging-adapter-and-docker-prep-report.md), [`.agent-logs/sprint-11/task-11.2b-hosted-supabase-operator-gate.md`](../.agent-logs/sprint-11/task-11.2b-hosted-supabase-operator-gate.md)

Task 11.2b attempts to complete the **hosted Supabase staging operator gate**: migrations, Worker secrets, web rebuild, and full `smoke:staging -- -IncludeApiMode`. **No secrets were faked, committed, or logged.**

---

## 1. Goal and scope

| In scope | Out of scope |
|---|---|
| Operator preflight audit | Production Supabase |
| Document exact unblock steps | Payment sandbox / live |
| Verify current staging shell safety | AWS EC2 deploy |
| Record migration/secret/smoke status | `CREDIT_TOPUP_ENABLED=true` |

---

## 2. Operator preflight

| Requirement | Available in agent session |
|---|---|
| Hosted Supabase staging project URL | **No** |
| Staging anon key | **No** |
| Staging service role key | **No** |
| `STAGING_SUPABASE_*` env vars | **Not set** |
| `.env.staging` Supabase fields | **Empty** (Mode A template only) |
| Supabase CLI login (`supabase login`) | **No** — access token not provided |
| Cloudflare Wrangler auth | **Yes** — `wrangler secret list` succeeds |
| Permission to set Worker secrets | **Yes** (tooling) — **blocked by missing key values** |
| Permission to rebuild web staging | **Yes** (tooling) — **blocked by missing anon key** |

**Action:** Stopped at preflight. Did **not** run `wrangler secret put` without values. Did **not** push migrations without project link.

---

## 3. Supabase staging project status

| Item | Status |
|---|---|
| Hosted staging project in repo | **Not configured** |
| Project name (e.g. `vibenovel-staging`) | **Unknown** — operator must create/designate |
| Region | **Not recorded** |
| Separate from production | **Required** — operator must confirm |
| Auth email confirmation | **Document for operator** — if enabled, signup smokes may need pre-confirmed test user |
| RLS | Expected from migrations `00001`–`00009` |

---

## 4. Migration status

| Item | Status |
|---|---|
| Local migrations in repo | **Present** — `00001` through `00009` (10 files) |
| Applied to hosted staging | **NOT RUN** — no linked project / no CLI login |
| Backup/snapshot before push | **Operator responsibility** |

**Required tables (post `00001`–`00009`):**

`profiles`, `projects`, `project_settings`, `story_foundations`, `characters`, `facts`, `relationship_speech_rules`, `ai_proposals`, `credit_balances`, `credit_ledger`, `generation_attempts`, `credit_topup_products`, `credit_topup_orders`, `payment_webhook_events` (+ Sprint 3–7 tables from intermediate migrations).

**Seed topup products (from `00009`):** `starter`, `creator`, `pro`, `studio` — applied when migration `00009` runs.

### Operator migration commands (when ready)

```powershell
# 1. Login (operator machine)
supabase login

# 2. Link staging project (replace <project-ref> with staging ref — not production)
cd D:\Coding\vibenovel-unified-blueprint
supabase link --project-ref <staging-project-ref>

# 3. Confirm disposable/backup, then push
supabase db push

# 4. Verify tables (example — no secret output)
supabase db execute --sql "SELECT slug FROM credit_topup_products ORDER BY sort_order;"
```

**Do not** run against production project ref.

---

## 5. Worker secret status

Checked via `npx wrangler secret list --env staging`:

| Secret | Set on `vibenovel-api-staging` |
|---|---|
| `SUPABASE_URL` | **No** |
| `SUPABASE_ANON_KEY` | **No** |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** |

**Redeploy after secrets:** `npm run deploy:api:staging` — **NOT RUN** (no secrets to set).

### Operator commands (when keys available)

```powershell
cd apps\api
npx wrangler secret put SUPABASE_URL --env staging
npx wrangler secret put SUPABASE_ANON_KEY --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
cd ..\..
npm run deploy:api:staging
```

Never commit values. Never paste into docs/logs.

---

## 6. API health result

**Current** (`GET /api/health` on Cloudflare staging):

| Flag | Value |
|---|---|
| `ok` | `true` |
| `appEnv` | `staging` |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |
| `hasSupabaseUrl` | **false** |
| `hasSupabaseAnonKey` | **false** |
| `hasSupabaseServiceRoleKey` | **false** |
| Secret leak in response | **None** |

`npm run smoke:staging:health` — **PASS** (Mode A shell flags).

**Target after operator gate:** all three `hasSupabase*` flags **true**.

---

## 7. Web rebuild/deploy result

| Item | Status |
|---|---|
| Rebuild with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | **NOT RUN** |
| `npm run deploy:web:staging` | **NOT RUN** |
| Current Pages bundle | Task 11.1 shell — Supabase client not configured |

### Operator build (when anon key available)

```powershell
$env:VITE_API_URL="https://vibenovel-api-staging.moxsenna.workers.dev"
$env:VITE_SUPABASE_URL="https://<project>.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="<anon-key>"
$env:VITE_USE_MOCKS="false"
npm run build:web
npm run deploy:web:staging
```

**Never** put service role key in web env.

---

## 8. smoke:staging `-IncludeApiMode` result

```powershell
npm run smoke:staging -- -IncludeApiMode
```

| Phase | Result |
|---|---|
| A — API health | **PASS** |
| B — Web HTTP 200 | **PASS** |
| C — CORS | **PASS** |
| D — Auth + Sprint 2 API | **BLOCKED** — no `STAGING_SUPABASE_*` / Worker secrets |
| E — Web topup API-mode | **BLOCKED** |

Exit code: **0** (PARTIAL GO harness behavior — phases D/E blocked, not failed).

**With operator env (future):**

```powershell
$env:STAGING_SUPABASE_URL="https://<project>.supabase.co"
$env:STAGING_SUPABASE_ANON_KEY="<anon-key>"
npm run smoke:staging -- -IncludeApiMode
```

---

## 9. Regression result

No application code changed in this task.

| Command | Result |
|---|---|
| `npm run smoke:staging:health` | **PASS** |
| `npm run smoke:staging -- -IncludeApiMode` | **PARTIAL** (D/E blocked) |
| `npm run typecheck` / `build:*` | **Skipped** — no code changes |

---

## 10. Security / secrets verification

| Check | Result |
|---|---|
| Secrets committed to repo | **No** |
| Secret values in docs/logs | **No** |
| `.env.staging` committed | **No** (gitignored; local copy has empty Supabase fields) |
| Production Supabase touched | **No** |
| Payment/AI live enabled | **No** |
| Mode A payment flags on staging API | **Unchanged — safe** |

---

## 11. Remaining blockers

| # | Blocker | Owner |
|---|---|---|
| 1 | Create/designate hosted Supabase **staging** project (not production) | Founder/operator |
| 2 | `supabase login` + `supabase link` + `supabase db push` (`00001`–`00009`) | Operator |
| 3 | `wrangler secret put` × 3 + `deploy:api:staging` | Operator |
| 4 | Web rebuild with `VITE_SUPABASE_*` + `deploy:web:staging` | Operator |
| 5 | Set `STAGING_SUPABASE_*` for smoke scripts + re-run `-IncludeApiMode` | Operator |
| 6 | Email confirmation policy (if auth smoke fails post-setup) | Operator |

---

## 12. Go / No-Go

**Verdict: BLOCKED**

| GO FULL criterion | Met |
|---|---|
| Hosted Supabase configured | ❌ |
| Migrations applied | ❌ |
| Worker secrets set | ❌ |
| API `hasSupabase*` true | ❌ |
| Web rebuilt with Supabase anon | ❌ |
| `smoke:staging -IncludeApiMode` full PASS | ❌ |
| Mode A payment/AI disabled | ✅ (unchanged) |
| No secrets committed | ✅ |
| Production untouched | ✅ |

**Staging shell:** still **GO Mode A** (health, web, CORS).

---

## 13. Next recommended task

**Operator must complete §11 unblock checklist**, then re-run:

```powershell
npm run smoke:staging -- -IncludeApiMode
```

**Product track (after GO FULL staging):**

- **Task 10.13b** — Duitku sandbox live (Mode B, public callback)
- **Task 11.5** — AWS EC2 deploy (can proceed in parallel; still needs same Supabase for full API smoke)

**Founder choice:** Unblock Supabase first (recommended) before Mode B payment or AWS API cutover.

---

## Steps 4–5 automation (after 1–3 complete)

When Worker health shows `hasSupabaseUrl=true`, set smoke env (never commit) and run:

```powershell
$env:STAGING_SUPABASE_URL = "https://<project>.supabase.co"
$env:STAGING_SUPABASE_ANON_KEY = "<anon-key>"
npm run operator:staging:supabase-gate
```

Or fill `.env.staging` (gitignored) from `.env.staging.example`, then:

```powershell
npm run operator:staging:supabase-gate
```

Script: `scripts/operator-staging-supabase-gate.ps1` — rebuilds web, deploys Pages, runs `smoke:staging -- -IncludeApiMode`. Never prints secrets.

---

## Operator quick checklist (copy for handoff)

```txt
[ ] Create Supabase project vibenovel-staging (NOT production)
[ ] supabase login
[ ] supabase link --project-ref <staging-ref>
[ ] Backup if not disposable
[ ] supabase db push
[ ] Verify credit_topup_products: starter, creator, pro, studio
[ ] wrangler secret put SUPABASE_URL --env staging
[ ] wrangler secret put SUPABASE_ANON_KEY --env staging
[ ] wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
[ ] npm run deploy:api:staging
[ ] curl /api/health → hasSupabaseUrl=true (all three true)
[ ] Build web with VITE_SUPABASE_* + deploy:web:staging
[ ] STAGING_SUPABASE_* env → npm run smoke:staging -- -IncludeApiMode
```

---

*Authored Task 11.2b — 9 Juni 2026. Operator gate blocked; no secrets faked.*