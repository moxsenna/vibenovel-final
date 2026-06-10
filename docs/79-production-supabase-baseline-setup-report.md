# 79 — Production Supabase Baseline Setup (Task 10.21)

**Date:** 2026-06-10  
**Status:** **GO** (rerun apply complete) — production baseline `00001`–`00009` applied; `00010` excluded; staging untouched  
**First run:** Closed — **BLOCKED** (approval not received)  
**Rerun pre-apply:** **PARTIAL GO** (credentials pending)
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/78`](78-production-environment-foundation-plan.md), [`docs/77`](77-production-payment-preflight-migration-approval-gate.md), [`docs/73`](73-duitku-production-payment-enable-plan.md), [`.agent-logs/sprint-10/task-10.21-production-supabase-baseline-setup.md`](../.agent-logs/sprint-10/task-10.21-production-supabase-baseline-setup.md)

Limited production infrastructure task: create/link dedicated production Supabase and apply baseline migrations `00001`–`00009` only. **Migration `00010` NOT applied.** **Payment NOT enabled.** **Production API/web NOT deployed.**

---

## 1. Approval gate

```txt
PRODUCTION SUPABASE BASELINE APPROVAL REQUIRED

Target action:
- Create or link dedicated production Supabase project for Narraza.
- Apply baseline migrations 00001–00009 only.
- Do NOT apply 00010.
- Do NOT enable payment.
- Do NOT deploy production API/web.
- Do NOT register Duitku callback.

Forbidden production ref:
- jdxyhrnibmmwlbtbokqo is staging and must not be used as production.

Founder/operator must explicitly approve:
"APPROVE TASK 10.21 PRODUCTION SUPABASE BASELINE ONLY"
```

| Item | Result |
|---|---|
| **Approval received** | **NO** — exact approval text not provided in this task session |
| **Production Supabase created** | **NO** — stopped at gate |
| **Migrations applied** | **NO** |

**To unblock:** Founder/operator resubmits Task 10.21 with approval text above, or replies in session with exact string before any `supabase link` / migration apply.

---

## 2. Preflight (read-only)

| Check | Result |
|---|---|
| Staging API health | **PASS** — Mode A (`creditTopupEnabled=false`, `paymentProviderMock=true`, `paymentProvider=mock`) |
| Staging Supabase ref | `jdxyhrnibmmwlbtbokqo` (forbidden as production) |
| CLI linked project | **Staging** — `supabase migration list --linked` shows `00001`–`00010` all applied on linked remote |
| Production Supabase in repo/env | **NOT FOUND** — no `.env.production`; no production project ref |
| `narraza.id` / `api.narraza.id` DNS | **Not resolved** (per Task 10.19/10.20) |
| `.env.production` in git | **Not tracked** — covered by `.gitignore` `.env.*` pattern |
| Production payment | **OFF** |

---

## 3. Production Supabase (not executed)

| Item | Value |
|---|---|
| **Project ref** | **NOT CREATED** |
| **Region** | Planned: `ap-southeast-1` ([`docs/78`](78-production-environment-foundation-plan.md)) |
| **Confirmed ≠ staging** | N/A — no production project |

**Operator steps when approved** (from [`docs/78`](78-production-environment-foundation-plan.md) §3):

1. Dashboard → create `narraza-production` (or designate existing non-staging project).
2. Record ref in gitignored operator notes + `.env.production` (never commit).
3. Visual check: ref **≠** `jdxyhrnibmmwlbtbokqo`.

---

## 4. CLI link safety procedure

### Current state

- Repo CLI link points to **staging** (`jdxyhrnibmmwlbtbokqo`) — all migrations including `00010` already on staging remote.
- Single `supabase link` per working tree — switching projects overwrites link metadata in `supabase/.temp/`.

### Safe switch procedure (when approved)

| Step | Action |
|---|---|
| 1 | Note current linked ref: `supabase migration list --linked` — must show staging `00010` applied |
| 2 | **STOP** if about to link `jdxyhrnibmmwlbtbokqo` as “production” |
| 3 | `supabase link --project-ref <PRODUCTION_REF>` — dashboard visual confirm first |
| 4 | `supabase migration list --linked` — fresh prod should show local `00001`+ pending, remote empty or partial |
| 5 | Apply baseline only (§5) — **never** blind `db push` on repo with `00010` present without exclusion |
| 6 | To restore staging link after prod work: `supabase link --project-ref jdxyhrnibmmwlbtbokqo` |

### Staging link restore

Document operator ref before switch. After production baseline, relink staging for ongoing staging ops.

---

## 5. Migrations `00001`–`00009` inspection

| Migration | Purpose | Destructive? |
|---|---|---|
| `00001_sprint2_core` | Core schema: profiles, projects, settings, foundations, characters, facts, audit_logs, RLS | Additive |
| `00002_sprint3_intake_concepts` | Intake sessions, concepts, signals | Additive |
| `00003_sprint4_outline_planning` | Outline plans, chapter outlines, loops, reveals | Additive |
| `00004_sprint5_write_room` | Writing sessions, beats, prose versions, context logs | Additive |
| `00005_sprint6_chapter_summary_delta` | Chapter summaries, deltas, proposals | Additive |
| `00006_sprint7_publish_package` | Publish packages | Additive |
| `00007_audit_enum_extension` | Audit enum extensions | Additive |
| `00008_sprint8_ai_generation_credit` | `generation_attempts`, `credit_ledger`, `credit_balances` | Additive |
| `00009_sprint10_payment_topup` | Topup products/orders, webhook events, product seed | Additive |
| **`00010_atomic_grant_credit_topup_rpc`** | **EXCLUDED** — atomic grant RPC + unique index | Apply only via Task 10.19 approval |

**Preflight:** Baseline `00001`–`00009` are additive-only; no staging-data assumptions. **`00010` explicitly excluded from this task.**

### Applying `00001`–`00009` without `00010` (when approved)

**Risk:** `supabase db push` applies **all** pending local migrations including `00010`.

**Safe methods (choose one):**

**Method A — Temporary exclude `00010` (recommended):**

```bash
# After link to PRODUCTION ref only
mv supabase/migrations/00010_atomic_grant_credit_topup_rpc.sql /tmp/00010_hold.sql
supabase db push
supabase migration list --linked   # expect 00001-00009 remote match; 00010 absent
mv /tmp/00010_hold.sql supabase/migrations/
```

**Method B — Manual ordered SQL:** Run `00001`…`00009` files via dashboard SQL editor or `psql` in order; register versions in `supabase_migrations.schema_migrations` per Supabase docs.

**Method C — `db push` with repair:** Only if Supabase CLI gains migration-range push — **not available today**; do not use plain `db push` without excluding `00010`.

---

## 6. Schema verification (when approved — checklist)

After `00001`–`00009` applied, verify (read-only queries via dashboard or service role in operator shell):

| Category | Expected tables |
|---|---|
| Auth/profile | `profiles` |
| Projects | `projects`, `project_settings`, `story_foundations`, `characters`, `facts` |
| Intake/concepts | `intake_sessions`, `story_concepts`, … |
| Outline/write | `outline_plans`, `writing_sessions`, `chapter_prose_versions`, … |
| Publish | `publish_packages` |
| Credits/AI | `credit_balances`, `credit_ledger`, `generation_attempts` |
| Payment schema | `credit_topup_products`, `credit_topup_orders`, `payment_webhook_events` |
| Audit | `audit_logs` |

**Seed (from `00009`):** `credit_topup_products` rows `starter`, `creator`, `pro`, `studio` — catalog only; no paid orders.

**Do not:** copy staging users/orders; insert test payment rows; apply `00010`.

---

## 7. Security baseline

| Check | Status (this task) |
|---|---|
| Secrets in repo | **None** — no `.env.production` committed |
| `.env.production` gitignored | **Yes** — `.env.*` in `.gitignore` |
| RLS on production | **Pending** — apply with migrations when approved |
| Service role in web env | **Forbidden** — names-only in docs |
| Payment enabled | **NO** |

---

## 8. Production env placeholders (names only)

Store in gitignored `.env.production` when project exists:

```txt
APP_ENV=production
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CREDIT_TOPUP_ENABLED=false
PAYMENT_PROVIDER=mock
PAYMENT_PROVIDER_MOCK=true
AI_GENERATION_ENABLED=false
```

No Duitku variables until docs/73 payment enablement (separate approval).

---

## 9. Migration result (this task)

| Item | Value |
|---|---|
| `00001`–`00009` applied to production | **NO** |
| `00010` applied to production | **NO** |
| Method | **Not run** — approval gate |

---

## 10. Rollback / forward-fix

| Scenario | Action |
|---|---|
| No migration applied (this task) | No rollback |
| Partial baseline on empty prod project | Forward-fix with next migration file; do not drop schema casually |
| Wrong project linked | **STOP**; unlink; verify ref; founder review if staging touched |
| `00010` accidentally applied | Incident doc; do not enable payment; Task 10.19 path may need adjustment |
| Catastrophic empty prod setup | Delete/recreate **production** project only with founder approval — **never** delete staging |

---

## 11. Remaining blockers

| # | Blocker |
|---|---|
| 1 | Founder approval `"APPROVE TASK 10.21 PRODUCTION SUPABASE BASELINE ONLY"` |
| 2 | Production Supabase project not created |
| 3 | Production API/web/DNS still not provisioned ([`docs/78`](78-production-environment-foundation-plan.md) Phases 3–7) |
| 4 | Migration `00010` still pending for production ([`docs/77`](77-production-payment-preflight-migration-approval-gate.md)) |
| 5 | Payment enablement ([`docs/73`](73-duitku-production-payment-enable-plan.md) §7) — gated |

---

## 12. Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **BLOCKED** | Approval missing; no production Supabase action taken |
| NO-GO triggers | **None** — staging untouched; no secrets exposed; `00010` not applied to any new project |

---

## Final summary (first run — superseded by §13)

```txt
Task 10.21 — Production Supabase Baseline Setup (first run)
Status: BLOCKED

Approval: NOT RECEIVED
Production Supabase: NOT CREATED
Migrations 00001-00009: NOT APPLIED
Migration 00010: NOT APPLIED (by design + no prod project)
Staging: unchanged Mode A (jdxyhrnibmmwlbtbokqo)
```

---

## 13. Rerun (2026-06-10) — new Supabase account, staging retained

### Context update

| Item | Decision |
|---|---|
| Staging Supabase | **Retained** — ref `jdxyhrnibmmwlbtbokqo`; staging/test/audit only; **do not touch as production** |
| Production Supabase | **New account** — founder approved baseline on a **clean project** in a separate Supabase account |
| Scope | Baseline DB only — no payment, no API/web deploy, no Duitku |

### Approval gate (rerun)

| Item | Result |
|---|---|
| Founder approval to continue baseline on new account | **YES** — session context: approved continuing production Supabase baseline using new account/project; still limited to baseline DB setup |
| Exact text `"APPROVE TASK 10.21 PRODUCTION SUPABASE BASELINE ONLY"` | Not quoted verbatim; operational approval recorded in task rerun brief |
| Production migration apply executed | **NO** — blocked on operator credentials |

### Preflight (rerun — read-only)

| Check | Result |
|---|---|
| Staging API health | **PASS** — Mode A (`creditTopupEnabled=false`, `paymentProviderMock=true`, `paymentProvider=mock`) |
| Staging Supabase touched | **NO** — CLI `migration list --linked` still shows staging `00001`–`00010` applied |
| Production ref ≠ staging | **N/A** — no production ref in operator environment yet |
| `.env.production` | **MISSING** — only `.env.production.example` committed |
| `supabase projects list` (new account) | **Not run** — no `SUPABASE_ACCESS_TOKEN` / login for production account in operator shell |
| Operator script | **FIXED** — `scripts/operator-production-supabase-baseline.ps1` parses; preflight exits BLOCKED on missing `.env.production` |
| Payment enabled | **NO** |
| Production API/web deploy | **NO** |
| Secrets exposed | **NO** |

### Production project (rerun)

| Item | Value |
|---|---|
| **Production project ref** | **Not set** — operator must create `narraza-production` (or equivalent) in new account and fill gitignored `.env.production` |
| **Confirmed ≠ staging** | Staging ref `jdxyhrnibmmwlbtbokqo` remains forbidden; script hard-fails if prod ref matches staging |
| **Region (planned)** | `ap-southeast-1` per [`docs/78`](78-production-environment-foundation-plan.md) |

### Migrations (rerun)

| Item | Result |
|---|---|
| `00001`–`00009` applied to production | **NO** — apply not run |
| `00010` applied to production | **NO** |
| Safe procedure documented | **YES** — Method A: move `00010` out → `db push` → verify → restore → relink staging |

### Operator unblock (to reach full GO)

1. In **new** Supabase account: create project (e.g. `narraza-production`, region `ap-southeast-1`).
2. Copy `.env.production.example` → **`.env.production`** (gitignored) with `SUPABASE_URL`, keys, and `SUPABASE_DB_PASSWORD`.
3. `supabase login` (or `SUPABASE_ACCESS_TOKEN`) on the **production** account.
4. Run:

   ```powershell
   npm run operator:production:supabase:baseline -- -Mode preflight
   npm run operator:production:supabase:baseline -- -Mode apply
   ```

5. Confirm script restores staging CLI link to `jdxyhrnibmmwlbtbokqo` (or relink manually if `SUPABASE_DB_PASSWORD` not in `.env.staging`).

### Artifacts prepared (rerun)

| Path | Purpose |
|---|---|
| `.env.production.example` | Names-only template; committed; `.env.production` gitignored |
| `scripts/operator-production-supabase-baseline.ps1` | Preflight + apply with `00010` exclusion and schema checks |
| `package.json` → `operator:production:supabase:baseline` | npm entry point |

### Go / Partial / Blocked (rerun)

| Level | Verdict |
|---|---|
| **PARTIAL GO** | Approval + tooling + staging safety verified; production baseline migrations pending operator `.env.production` |
| NO-GO triggers | **None** — staging untouched; `00010` not applied; no secrets in repo/logs |

### Final summary (rerun)

```txt
Task 10.21 — Production Supabase Baseline Setup (rerun)
Status: PARTIAL GO

Approval: RECEIVED (new Supabase account baseline)
Production project ref: NOT SET (sanitized — fill via .env.production)
Confirmed not staging ref jdxyhrnibmmwlbtbokqo: YES (guard in script; no prod ref yet)
Migrations 00001-00009: NOT APPLIED (blocked on .env.production)
Migration 00010: NOT APPLIED
Baseline schema verification: NOT RUN (no prod DB)
Payment enabled: NO
Production API/web deploy: NO
Secrets exposed: NO
Staging: unchanged Mode A (jdxyhrnibmmwlbtbokqo, 00001-00010 intact)

Next: Operator creates prod project + .env.production → rerun -Mode apply
```

---

## 14. Rerun apply complete (2026-06-10)

### Execution

| Step | Result |
|---|---|
| Preflight | **PASS** — prod ref `qjmb…njct` (sanitized); ≠ staging `jdxyhrnibmmwlbtbokqo` |
| Exclude `00010` (Method A) | **PASS** — moved to temp hold, restored after push |
| `supabase link` production | **PASS** |
| `supabase db push` | **PASS** — `00001`–`00009` applied |
| Migration list | **PASS** — remote `00001`–`00009`; `00010` local only (not on remote) |
| Schema verification (REST) | **PASS** — baseline tables + topup seed (`starter`/`creator`/`pro`/`studio`) |
| `grant_paid_credit_topup_atomic` | **Absent** — `00010` not applied |
| Staging API health | **PASS** — Mode A unchanged |
| Staging Supabase DB | **NOT touched** |
| Payment enabled | **NO** |
| Production API/web deploy | **NO** |
| Secrets in repo/logs | **NO** |

### Production project (sanitized)

| Item | Value |
|---|---|
| **Project ref** | `qjmb…njct` (20-char ref; full ref in gitignored `.env.production` only) |
| **Confirmed ≠ staging** | **YES** |
| **Account** | Separate production Supabase account (not staging account) |

### Migration result (final)

| Migration | Production remote |
|---|---|
| `00001`–`00009` | **Applied** |
| `00010` | **NOT applied** (by design) |

### CLI link note (cross-account)

After apply, CLI may remain linked to **production** (`qjmb…njct`) because production and staging projects live on **different Supabase accounts**. To run staging CLI ops, relink with **staging** `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` in `.env.staging` (or `supabase login` on staging account), then `supabase link --project-ref jdxyhrnibmmwlbtbokqo`.

### Final summary (GO)

```txt
Task 10.21 — Production Supabase Baseline Setup (rerun apply)
Status: GO

Production project ref: qjmb…njct (sanitized)
Confirmed not staging ref jdxyhrnibmmwlbtbokqo: YES
Migrations 00001-00009: APPLIED
Migration 00010: NOT APPLIED
Baseline schema verification: PASS
Payment enabled: NO
Production API/web deploy: NO
Secrets exposed: NO
Staging: unchanged Mode A (not touched for migration apply)

Next: Task 10.23 deploy on narraza.web.id (docs/81 — BLOCKED until approval + EC2/DNS) OR Task 10.19 for 00010 only
```