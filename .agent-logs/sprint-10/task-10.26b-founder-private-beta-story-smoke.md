# Task 10.26b — Founder Private Beta Story Smoke Verification

## Task goal

Close Task 10.26 founder E2E smoke — classify founder manual results, fix minimal blockers, verify production regression, document OpenRouter key placement (no enablement).

## Files read

- `docs/87-real-private-beta-story-flow-report.md`
- `docs/86-private-beta-launch-readiness-audit.md`
- `README.md`, `docs/36`, `docs/63`
- `apps/web/src/components/layout/Sidebar.tsx`, `MobileHeader.tsx`
- `apps/web/src/context/AuthContext.tsx`
- `apps/api/.dev.vars.example`, `.env.production.example`
- `deploy/ec2/deploy-app-production.sh`

## Files created/changed

| Path | Note |
|---|---|
| `apps/web/src/components/layout/Sidebar.tsx` | **Keluar** button (desktop) when session active |
| `apps/web/src/components/layout/MobileHeader.tsx` | **Keluar** button (mobile) + Narraza label |
| `.env.production.example` | Commented `OPENROUTER_API_KEY` placement doc |
| `docs/88-founder-private-beta-story-smoke-report.md` | Report |
| `docs/87`, `docs/86`, `docs/36`, `docs/63`, `README.md` | Status updates |

## Founder smoke input (provided by user)

| Step | Result |
|---|---|
| Register/login | pass |
| Dashboard | pass |
| Create project | pass |
| Project ID real | pass |
| Intake send | pass |
| Reload persistence | pass |
| Logout/login persistence | **tombol logout tidak ditemukan** |
| Browser | Chrome / Acer Swift GO 14 |

## Commands run

```powershell
npm run typecheck                    # PASS
npm run deploy:web:production        # PASS (index-D-0atp4z.js)
Invoke-WebRequest homepage/app/login # 200
Invoke-WebRequest prod + staging health # PASS Mode A
rg api-staging on apps/web/dist      # 0 hits
```

**Not run:** Agent did not re-execute founder logout/login smoke after deploy.

## Results

**Task 10.26b status:** **GO** (founder follow-up 2026-06-10)

- All steps **PASS** including Keluar → login persistence
- OpenRouter key placed in local `.env.production` by founder
- Production API health still `hasOpenRouterApiKey=false` until EC2 redeploy

## Decisions

1. Only fix: add **Keluar** to Sidebar footer + MobileHeader; redirect to `/login` after `signOut()`.
2. Did not enable OpenRouter or change API env on EC2.
3. Task 10.26 story path considered **GO**; 10.26b closes with **PARTIAL GO** until founder re-tests logout.

## Limitations

- Founder logout/login re-smoke pending after deploy.
- OpenRouter connection documented only — requires separate founder approval + EC2 env change.

## Next recommended task

1. Founder re-smoke: **Keluar** → login lagi → proyek + intake masih terlihat.
2. Optional (separate gate): OpenRouter founder test mode per `docs/87` approval text.