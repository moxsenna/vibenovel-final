# Admin Dashboard — Sprint A Foundation Log

**Date:** 2026-06-18  
**Source plan:** `docs/ADMIN_DASHBOARD_PLAN.md` (Admin Sprint A / foundation MVP)  
**Status:** Shipped in repo — grant credit **mutation** intentionally stubbed for Codex.

## Scope delivered

| Area | What shipped |
|------|----------------|
| API errors | `AppError.forbidden` (403), `AppError.notImplemented` (501) |
| API guard | `requireAdmin({ minRole })` on `/api/admin/*` after `authMiddleware` |
| API routes | `GET /api/admin/users`, `GET /api/admin/users/:userId`, stub `POST .../credits/grant` |
| Shared types | `USER_ROLES.super_admin` in TS (DB enum still `writer` \| `admin` until migration) |
| Web routes | `/admin/*` under `AdminGuard` + `AdminShell` |
| Web UI | Overview KPI shells, users list/detail, empty states, `GrantCreditsModal` |
| Verification | `npm run typecheck`, `npm run build:shared/web/api`, `node apps/api/scripts/test-admin-guard.mjs` |

## Intentional deferrals (Codex / later sprints)

- Real `POST /api/admin/users/:userId/credits/grant` RPC and ledger mutation
- `admin_audit_logs`, `admin_notes` migrations
- Admin projects/proposals/system/audit data endpoints
- Postgres `super_admin` enum value (use `profiles.role = 'admin'` for smoke today)

## Smoke & commands

```bash
# Unit role matrix (no server)
node apps/api/scripts/test-admin-guard.mjs

# API integration (requires dev:api + Supabase + service role)
npm run smoke:api:admin
```

### Smoke expectations

1. No `Authorization` → `UNAUTHORIZED` on `/api/admin/users`
2. Writer JWT after `/api/me` → `FORBIDDEN`
3. Admin JWT (`profiles.role` patched to `admin` via service role) → list + detail OK
4. Grant POST → `NOT_IMPLEMENTED` (UI shows: *Fitur dalam pengembangan oleh Codex.*)

## Files (anchors)

- `apps/api/src/middleware/admin.ts`
- `apps/api/src/routes/admin.ts`
- `apps/web/src/components/admin/AdminGuard.tsx`
- `apps/web/src/routes/index.tsx`
- `scripts/admin-smoke-api.ps1`

## Notes

- Client-side `/admin` guard uses `useAdminCheck` → `fetchMe()`; server guard is authoritative.
- Do not treat grant modal success locally; 501 is the correct interim behavior.