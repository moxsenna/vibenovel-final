# 89 — Full Repo Audit vs Sprint Plan (Task 10.27)

**Date:** 2026-06-10  
**Status:** **GO** (audit-only; no code/deploy/env changes)  
**Brand:** **Narraza**  
**Related:** [`docs/26`](26-current-sprint-plan.md) (historical vision), [`docs/61`](61-roadmap-and-sprint-number-reconciliation.md), [`docs/63`](63-updated-product-roadmap-after-sprint-11.md), [`docs/88`](88-founder-private-beta-story-smoke-report.md), [`.agent-logs/sprint-10/task-10.27-full-repo-audit-vs-sprint-plan.md`](../.agent-logs/sprint-10/task-10.27-full-repo-audit-vs-sprint-plan.md)

**Note:** Founder requested deploy before audit; EC2 deploy **not completed** in this session (operator script harness error). Production API health unchanged. Audit is read-only per Task 10.27 stop rule.

---

## Executive summary

Narraza has **outpaced the historical sprint plan on infra and backend safety**, but **lags the original product vision** on Creator Mode, Draft Import, Voice Learning, full validators, and end-to-end MVP proof.

**What is real today:** Production stack live (homepage / app / API), production Supabase `00001`–`00009`, auth, **real project create + intake persistence**, full API surface for outline/write/summary/publish — mostly **deterministic stubs** or **AI-gated** features.

**What is intentionally off:** Payment, migration `00010` on production.

**Post-audit (Task 10.28):** OpenRouter AI **ON** for founder test only — see [`docs/90`](90-ai-founder-test-mode-report.md). Payment still OFF.

**Honest stage at audit:** **Private beta without AI**. **After 10.28:** **Private beta with founder-only AI test path** — not public AI launch.

**Biggest leverage next (updated):** (1) ~~**10.29** browser E2E~~ **DONE** [`docs/91-founder-browser-e2e`](91-founder-browser-e2e-story-workflow-report.md), (2) ~~**10.29** mock-removal~~ **DONE** [`docs/91-mock-flow`](91-remove-misleading-mock-flow-report.md), (3) **10.30** shell credit UX + sidebar/route project alignment, (4) founder-only AI gate before public beta.

---

## 1. Current production reality

| Surface / System | Current Status | Evidence | Risk | Next Action |
|---|---|---|---|---|
| Homepage `narraza.web.id` | **GO** — HTTP 200 | [`docs/85`](85-production-homepage-placeholder-report.md); curl 200 | Low | Content/marketing iteration only |
| App `app.narraza.web.id` | **GO** — HTTP 200 | [`docs/84`](84-production-app-custom-domain-verify-report.md); curl 200 | Low | Invite beta testers |
| API `api.narraza.web.id` | **GO** Mode A | [`docs/83`](83-production-ec2-api-mode-a-deploy-report.md); health PASS | Medium — env not redeployed with local OpenRouter key | Redeploy EC2 `.env.production` when AI Go approved |
| Staging API | **GO** Mode A | [`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md); health PASS | Low | Read-only regression only |
| Production Supabase | **GO** baseline | [`docs/79`](79-production-supabase-baseline-setup-report.md) — ref `qjmbobvarspwvaalnjct`; `00001`–`00009` | Low | No `00010` until payment Go |
| Staging Supabase | **GO** | ref `jdxyhrnibmmwlbtbokqo`; includes `00010` RPC | Low | Separate from prod |
| Auth (Supabase) | **GO** | [`docs/86`](86-private-beta-launch-readiness-audit.md), [`docs/88`](88-founder-private-beta-story-smoke-report.md) | Medium — email confirm settings | Founder verify Auth email policy |
| Real project workflow | **GO** | [`docs/87`](87-real-private-beta-story-flow-report.md), [`docs/88`](88-founder-private-beta-story-smoke-report.md) | Low | Onboard beta users |
| Intake persistence | **GO** | Founder smoke; API stub agent (no OpenRouter) | Low | Optional richer intake AI later |
| AI generation | **ON (founder test)** | [`docs/90`](90-ai-founder-test-mode-report.md) — was OFF at audit | Medium — no founder-only gate in code | 10.29 browser E2E; gate before public beta |
| Payment | **OFF** | `creditTopupEnabled=false`, `paymentProvider=mock` | Expected | [`docs/73`](73-duitku-production-payment-enable-plan.md) gates |
| Duitku production | **NOT setup** | health flags all false | Expected | Defer until product + payment Go |
| Migration `00010` prod | **NOT applied** | [`docs/77`](77-production-payment-preflight-migration-approval-gate.md) | Expected | Staging only |
| Secrets / bundle | **PASS** | No staging API/ref in prod bundle; `.env.*` gitignored | Low | Keep discipline |
| Domain model | **GO** | apex=homepage, `app.`=dashboard, `api.`=API | Low | `narraza.id` future |

---

## 2. Sprint plan comparison

*Baseline: [`docs/26`](26-current-sprint-plan.md) (historical). Actual status: README + docs/61/63 + closure reports.*

| Sprint / Area | Planned Goal | Actual Repo Status | Production Status | Gap | Recommendation |
|---|---|---|---|---|---|
| **Sprint 0** Blueprint | Docs, rules, repo | **DONE** | N/A | None | Closed |
| **Sprint 1** Stitch parity | UI mock parity 1.1–1.16 | **DONE** | App live | API integration in Sprints 2–7 | Closed |
| **Task 1.17** Visual polish | Manual UI polish | **DEFERRED** | Partial incidental polish | No closure doc | Phase C — low priority |
| **Sprint 1.5** Legacy audit | Docs-only audit | **DONE** | N/A | docs/23–25 | Closed |
| **Sprint 2** Data model | Projects, RLS, API | **DONE** | Prod Supabase baseline | — | Closed |
| **Sprint 3** Intake/concept/foundation | Real flow | **DONE** (API); UI **PARTIAL** | Intake **real**; concept/foundation need user path | Stub generators; mock fallback on errors | Founder E2E concept→foundation |
| **Sprint 4** Outline/KBM | Planning engine | **DONE** (API stub generator) | Outline API real; generator stub | No live AI outline | Wire founder outline smoke |
| **Sprint 5** Safe beat writer | Context packet, beats | **DONE** | Write room API real | Prose AI off in prod | Enable AI test mode |
| **Sprint 6** Validator/repair/delta | Full validator suite | **PARTIAL** | Summary/delta APIs stub+real mix | Validators/repair agent incomplete | Phase D |
| **Sprint 7** Publish package | KBM export | **DONE** (stub generator) | Publish API real | No auto-post KBM | Founder publish smoke |
| **Sprint 8** Credit/cost (roadmap) | Ledger, control | **DONE** (actual = AI prose + credits) | Ledger schema exists; AI off | Topup = Sprint 10 arc | Credit seed for AI test |
| **Sprint 9** Creator mode (roadmap) | Story Bible editors | **DEFERRED** | Not started | Actual Sprint 9 = rewrite/credit UI | Phase G |
| **Sprint 10** Draft import (roadmap) | Paste/upload draft | **NOT STARTED** | — | Actual Sprint 10 = payment | Phase E defer |
| **Sprint 11** Voice learning (roadmap) | Style profile | **DEFERRED** | Rewrite API exists; AI off | Actual Sprint 11 = staging | Phase F defer |
| **Sprint 12** Analytics | Growth layer | **PARTIAL** | Audit/cost primitives only | No dashboard | Phase H defer |
| **Sprint 8–11 actual** | AI, payment, staging, prod | **DONE** infra arc | Prod Mode A live | Payment/AI prod off by design | See README Sprint 10–11 table |
| **Task 10.26/10.26b** | Real beta onboarding | **DONE** | Founder GO | — | Invite beta users |

---

## 3. MVP benchmark status

*Benchmark: 20–30 chapter KBM drama; major reveal ch 20–25; no leak; mobile format; publish package.*

**Can the app do this today?** **No** — not end-to-end with safety guarantees in production.

| MVP Requirement | Current Status | Real/Mock | Evidence | Missing Work |
|---|---|---|---|---|
| 20–30 chapter serial structure | **Partial** | Outline stub generator persists real rows | `outline-generator.ts` stub; lock/approve API | Founder-generated outline on prod; quality review |
| Major reveal ~ch 20–25 timed | **No** | Reveal schedule display-only | docs/63 §I.2, outline UI | Reveal gate + editor; spoiler validator |
| No reveal leakage before time | **Partial** | Context packet safety (Sprint 5) | Write room gates | Automated spoiler validator on output |
| No character knowledge leak | **Partial** | Canon facts in packet | No automated validator | Character knowledge validator |
| Protagonist agency / mini victories | **No** | — | Retention validator not started | Sprint 6 scope deferred |
| Mobile-readable formatting | **Partial** | UI responsive; publish fields | No mobile readability validator | Validator + publish polish |
| Publish package per chapter | **Partial** | API + stub generator | `publish-package-generator.ts` | Real copy workflow; AI copy off |
| AI-assisted prose production | **Blocked** | API exists; prod off | `AI_GENERATION_ENABLED=false` | EC2 deploy + credit seed |
| Full canon workflow | **Partial** | Delta/proposals (Sprint 6) | Stub extractors | AI summary generation optional |

---

## 4. Dummy/mock audit (production app, `VITE_USE_MOCKS=false`)

| Route | Data Source | Real Production Ready? | Mock Risk | Needed Fix |
|---|---|---|---|---|
| `/` | Redirect/landing shell | N/A | Low | — |
| `/login` | Supabase auth | **Yes** | Low | — |
| `/dashboard` | API when authed; empty state real | **Yes** | Low if authed | Unauthed shows notice only |
| `/start` | `POST /api/projects` | **Yes** | Low | — |
| `/projects/:id/intake` | API persist; stub agent | **Yes** (persistence) | Low — agent is stub not fake success | Label stub agent if needed |
| `/projects/:id/concepts` | API; template stub concepts | **Partial** | Medium — stub concepts may feel “generated” | OpenRouter optional later |
| `/projects/:id/foundation` | API load; proposals stub | **Partial** | api-fallback → mock UI | Reduce fallback; founder path test |
| `/projects/:id/outline` | API; outline stub generator | **Partial** | api-fallback → mock | Founder outline E2E |
| `/projects/:id/write` | API beats/prose; AI off | **Partial** | api-fallback; AI disabled honest | AI test mode + credits |
| `/projects/:id/summary` | API; summary stub | **Partial** | api-fallback | Summary AI optional |
| `/projects/:id/publish` | API; publish stub | **Partial** | api-fallback; copy AI off | Publish smoke |
| `/settings` | API credits/settings | **Partial** | CreditIndicator header still shell mock | Wire header credits |
| `/credits/topup` | Disabled UI | **Blocked** (payment) | Low — honest “belum tersedia” | Payment gates |

**Pattern:** All major hooks (`use*Data`) support `mock | api | api-fallback`. Production with auth uses **api** when healthy; errors fall back to Sprint 1 mocks — **misleading if API flaky**.

---

## 5. Backend/API audit

| Area | Classification | Notes |
|---|---|---|
| `GET /api/health` | **Real** | Safe flags only |
| Auth middleware | **Real** | JWT via Supabase |
| `GET/POST /api/projects` | **Real** | Wired from UI (10.26) |
| Intake routes | **Real** persist; **stub** agent/signals | No OpenRouter |
| Concept generate | **Real** persist; **stub** drafts | `buildConceptDrafts` |
| Foundation proposals | **Real**; **stub** generator | `foundation-proposal.ts` |
| Outline generate | **Real**; **stub** deterministic | `outline-generator.ts` |
| Write/beats/prose | **Real** persistence | Beat stub generator available |
| Summary/delta | **Real** APIs; **stub** extractors | |
| Publish package | **Real**; **stub** generator | |
| `POST .../ai/generate-prose` | **Real**; **disabled** | 503 `AI_DISABLED` |
| `POST .../ai/rewrite-prose` | **Real**; **disabled** | Same |
| `POST .../ai/improve-publish-copy` | **Real**; **disabled** | Same |
| Credits balance | **Real** | |
| Topup checkout | **Real**; **disabled** env | `TOPUP_DISABLED` |
| Payment webhooks | **Real** code; **inactive** prod | Mayar/Duitku |
| CORS | **Real** | prod origins incl. app + apex |

---

## 6. Database/migration audit

| Migration | Purpose | Applied to Production? | Used by UI/API? | Notes |
|---|---|---|---|---|
| `00001` | Core: profiles, projects, foundation, characters, facts | **Yes** | Yes | [`docs/79`](79-production-supabase-baseline-setup-report.md) |
| `00002` | Sprint 3 intake, concepts | **Yes** | Yes | Intake real |
| `00003` | Sprint 4 outline | **Yes** | Yes | |
| `00004` | Sprint 5 write room | **Yes** | Yes | |
| `00005` | Sprint 6 summary/delta | **Yes** | Yes | |
| `00006` | Sprint 7 publish | **Yes** | Yes | |
| `00007` | Audit enum extension | **Yes** | Internal | |
| `00008` | AI generation + credit ledger | **Yes** | AI routes (off) | |
| `00009` | Payment topup tables | **Yes** | Topup (disabled) | |
| `00010` | Atomic grant RPC | **Staging only** | Callback grant path | **NOT prod** per docs/77 |

**~30 tables** across migrations support full pipeline; production has schema for payment/AI but flags disable runtime use.

---

## 7. AI generation readiness

| AI Feature | Current Status | Requires OpenRouter? | Requires Credits? | Safe to Founder-Test? | Gap |
|---|---|---|---|---|---|
| Intake chat agent | Stub deterministic | No | No | **Yes** | Richer AI optional |
| Concept generate | Stub templates | No | No | **Yes** | Not true LLM concepts |
| Foundation proposals | Stub batch | No | No | **Yes** | |
| Outline generate | Stub deterministic | No | No | **Yes** | |
| Beat generate (write) | Stub deterministic | No | No | **Yes** | |
| Prose beat AI | **Disabled** prod | **Yes** | **Yes** | After EC2 deploy + seed | Key in local `.env.production` not live |
| Prose rewrite | **Disabled** | **Yes** | **Yes** | Same gate | |
| Publish copy AI | **Disabled** | **Yes** | **Yes** | Same gate | |
| Summary generate | Stub | Optional | Optional | Partial | |
| Context packet | **Real** (non-LLM) | N/A | No | **Yes** | Reveal gate incomplete |

**Approval gate:** `APPROVE TASK 10.26 AI FOUNDER TEST MODE ONLY` + EC2 redeploy + credit seed.

---

## 8. Payment/credit readiness

| Item | Status |
|---|---|
| Credit ledger schema | **Exists** (`00008`) |
| Topup products/orders | **Exists** (`00009`); UI built |
| Provider abstraction | **Done** (mock/Mayar/Duitku) |
| Duitku staging proof | **GO** BCA VA (10.13b/c); rolled back Mode A safe |
| Production payment | **BLOCKED** — docs/73, docs/77 |
| Migration `00010` prod | **NOT applied** |
| Private beta without payment | **Yes — OK** | 
| Before payment prod | Prod `00010` approval, Duitku prod credentials, callback URL, founder Go |

---

## 9. Security audit

| Security Area | Status | Risk | Action |
|---|---|---|---|
| Service role in frontend | **PASS** | Low | Continue bundle audits |
| Staging API in prod bundle | **PASS** (0 hits) | Low | Per deploy |
| `.env.production` gitignored | **PASS** (`.env.*` pattern) | Low | Never commit |
| OpenRouter key in repo | **Assumed gitignored** — founder local only | Medium if committed | Verify `git status` clean |
| CORS | **PASS** — prod origins | Low | |
| Prod/staging separation | **PASS** — different Supabase refs, EC2 IPs | Low | |
| Apex/app/API split | **PASS** | Low | |
| Payment/AI kill switches | **PASS** Mode A | Low | |

---

## 10. What we accomplished (founder-friendly)

**Infra:** Production homepage, app, API on AWS EC2 + Cloudflare; staging parallel stack; Docker Mode A; HTTPS + custom domains.

**Data:** Production Supabase with full story pipeline schema (minus payment RPC on prod).

**Auth:** Login/register, session, logout (10.26b), real per-user projects.

**Real workflow:** Create project → intake messages persist across reload — **founder verified**.

**Backend depth:** Sprints 2–10 API surface — outline, write room, summary, publish, credits, payment webhooks (fixture-proven).

**Intentionally not activated:** OpenRouter AI, payment, Duitku production, migration `00010` on prod.

**Not production-ready:** End-to-end AI prose, MVP validator suite, Creator Mode, Draft Import, Voice DNA, analytics.

---

## 11. Honest current product stage

**Private beta without AI**

**Why:** Founders can onboard, create projects, save intake — real DB. Full serial production (AI prose, reveal safety, payment) is not switched on. Many “generation” steps use **transparent stubs** or need API mode + credits + OpenRouter. Payment off is correct for current beta.

Not “technical demo only” — production URLs and persistence are real.  
Not “private beta with limited AI” — production API has AI off at audit.

---

## 12. Biggest gaps

1. **Product path after intake** — concept→foundation→outline→write not founder-verified end-to-end on production.
2. **AI prose off** — core value prop (AI writing) unavailable in prod despite local OpenRouter key.
3. **Stub generators** — outline/concepts/foundation/summary/publish use deterministic stubs, not LLM quality.
4. **Validator / reveal gate** — MVP safety benchmark unmet.
5. **Mock api-fallback** — API errors silently show Sprint 1 demo data.
6. **Payment** — correctly deferred; not blocking current beta.

---

## 13. Recommended next roadmap

### Immediate next task

**Task 10.28 — Production API redeploy + AI Founder Test Mode (gated)**  
Copy gitignored `.env.production` to EC2 (`/opt/vibenovel/.env.production`), set `AI_GENERATION_ENABLED=true`, `AI_PROVIDER_MOCK=false`, restart Docker, seed founder credits, verify one `generate-prose` call. **Do not enable payment.**

### Next 3

1. **10.29 — Founder production workflow E2E:** concept → select → foundation lock → outline lock → write session (document blockers per step).
2. **10.30 — Reduce api-fallback mock risk:** show error state instead of Sprint 1 mocks when authed API fails.
3. **11.x — Context packet / reveal gate spike:** minimal spoiler gate before wider beta AI.

### Next 10

1. 10.28 AI founder test mode (above)  
2. 10.29 Full workflow E2E  
3. 10.30 Honest error states (no mock fallback)  
4. 11.0 Reveal/spoiler validator MVP  
5. 11.1 Credit indicator + settings real balance in shell  
6. 11.2 Replace outline stub with OpenRouter optional path  
7. 11.3 Beta user onboarding doc + limits  
8. 11.4 Retention/mini-victory validator (MVP slice)  
9. 11.5 Publish package founder smoke  
10. **Defer** payment prod until product path proven — then docs/73 execution  

### Defer

- Payment production / Duitku prod / `00010` prod  
- Draft Import (roadmap Sprint 10)  
- Creator Mode editors (roadmap Sprint 9)  
- Voice DNA learning (roadmap Sprint 11)  
- Analytics dashboard (roadmap Sprint 12)  
- Task 1.17 dedicated visual polish  
- `narraza.id` domain migration  

---

## 14. Final verdict

| Question | Answer |
|---|---|
| Still aligned with sprint plan? | **Partially** — same north star; **execution order diverged** (payment/staging before draft import/voice/creator mode). Justified per docs/61. |
| Truly done? | Sprints 0–2, 1.5, 1 UI parity, 3–7 API cores, 8–9 AI+credits code, 10 payment code, 11 staging, 10.21–10.26b prod onboarding |
| Superficially done? | Sprint 6 validators, Sprint 9 Creator Mode, Sprint 10 Draft Import, Sprint 11 Voice — **not done** despite similar sprint numbers |
| Ahead of plan? | **Infra, payment adapter, staging/prod deploy, private beta onboarding** |
| Out of sequence but justified? | **Yes** — safety + monetization infra before deferred vision features |
| Biggest risk inviting beta now? | Users hit **stub/mock fallbacks** after intake expecting real AI; **confusion** if API errors show demo data |
| Highest-leverage next task? | **10.28** EC2 redeploy + gated AI test OR **10.29** workflow E2E to expose real blockers |

---

## Deploy note (founder request)

Founder asked to deploy before audit. Agent attempted `operator-production-aws-deploy.ps1`; **failed** (shell/approval parsing). Production health at audit:

```json
"aiGenerationEnabled": false,
"hasOpenRouterApiKey": false
```

Local `.env.production` with `OPENROUTER_API_KEY` does **not** affect live API until EC2 copy + container restart (see [`docs/88`](88-founder-private-beta-story-smoke-report.md) § OpenRouter).

---

## Files changed

**None** (audit-only). Work log only.

## Docs updated

- `docs/89-full-repo-audit-vs-sprint-plan.md` (this file)
- `README.md` (task row)
- `docs/36`, `docs/63` (pointers)
- `.agent-logs/sprint-10/task-10.27-full-repo-audit-vs-sprint-plan.md`