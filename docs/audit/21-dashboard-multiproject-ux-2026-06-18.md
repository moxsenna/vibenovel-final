# Dashboard Multiproject UX — Implementation Log (doc 113)

**Date:** 2026-06-18  
**Plans:** `docs/113-dashboard-multiproject-ux-improvement-plan.md`, `docs/113-dashboard-multiproject-ux-execution-plan.md`

## Summary

Writer dashboard and project browse UX for accounts with many projects: hide QA fixtures in production, paginated project API, toolbar search/filter/sort, `/projects` index, richer cards, auto-naming, greeting copy, wider layout.

## Delivered

### Fase A (P0)

| Task | Change |
|------|--------|
| A1 | `filterTestFixtureProjectsForProduction` — hide `ZZ-TEST`, `(hapus)`, `(boleh dihapus)` when `APP_ENV=production` |
| A2 | `GET /api/projects?limit=…` → `{ items, total, nextCursor }`; without `limit` → `Project[]` unchanged |
| A3 | `ProjectToolbar`, `useProjectBrowse`, `fetchProjectsPage`, dashboard preview limit 6 |
| A4 | `ROUTES.projects`, `ProjectsIndexPage`, working “Lihat Semua” link |

### Fase B (P1)

| Task | Change |
|------|--------|
| B1 | `suggestedProjectTitle` (web + API); start flow + empty API title |
| B2 | Recent cards: workflow badge, bab progress, secondary line for generic titles, time tooltips |
| B3 | Active card: `heroKicker`, “Terakhir dikerjakan …”, CTA from workflow truth |

### Fase C (P2)

| Task | Change |
|------|--------|
| C1 | `DASHBOARD_GREETING` vs `DASHBOARD_GREETING_RETURNING` |
| C2 | `workflow-tooltips.ts`, status badge `title` |
| C3 | `max-w-dashboard` 1400px, `xl:grid-cols-4` |

## Tests

- `apps/api`: `test:project-test-fixture-filter`, `test:project-list-query`
- `npm run typecheck` (shared, web, api)

## Deploy note

A1 filter applies after API deploy with `APP_ENV=production`. Verify live dashboard after deploy.

## Chore (same initiative)

- `apps/api/dist-production/` gitignored (`dc71c66` if committed separately)