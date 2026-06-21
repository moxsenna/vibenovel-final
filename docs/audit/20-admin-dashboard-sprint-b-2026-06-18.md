# Admin Dashboard — Sprint B (AI Operations) Log

**Date:** 2026-06-18  
**Source plan:** `docs/ADMIN_DASHBOARD_PLAN.md` §12  
**Status:** Shipped read-only ops layer — no retry/refund mutations yet.

## Delivered

| Layer | Items |
|-------|--------|
| API | `GET /api/admin/overview`, `/projects`, `/projects/:id`, `/proposals`, `/proposals/:id`, `/generation-attempts`, `/generation-attempts/:id`, `/users/:id/credits`, `/system/health`, `/audit-logs` |
| Service | `apps/api/src/services/admin-ops.ts` (named response types, service-role reads) |
| Web | Live KPI overview, projects/proposals/attempts lists + detail, system health, audit log table, user credit + ledger on detail |
| Nav | Sidebar: Percobaan AI |

## Explicitly not in Sprint B

- Retry failed attempt
- Refund credits from admin
- `POST .../credits/grant` real RPC (still Codex / Sprint A deferral)
- `/admin/model-usage` dedicated page (model shown on attempt rows)

## Verification (when you can test)

```bash
npm run typecheck
npm run build:shared && npm run build:web && npm run build:api
npm run smoke:api:admin   # Sprint A guards + extend for overview when API up
```

## Founder reminder — testing checklist

See `docs/audit/REMINDER-admin-testing-2026-06-18.md`.