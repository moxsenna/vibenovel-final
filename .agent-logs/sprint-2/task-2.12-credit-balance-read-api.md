# Task 2.12 — Credit Balance Read API

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Membuat endpoint read-only `GET /api/credits/balance` untuk saldo kredit display Sprint 2. Hanya membaca `credit_balances` — tanpa ledger, mutation, payment, atau deduction.

## Files read

- `README.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/28-supabase-rls-policy-draft.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/seed.sql`
- `apps/api/README.md`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/me.ts`
- `apps/api/src/services/credit.ts`
- `apps/api/src/services/audit.ts`
- `apps/api/src/lib/mappers.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `packages/shared/src/api.ts`
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-2/task-2.6-auth-shell-profiles.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/routes/credits.ts` | Created — `GET /api/credits/balance` |
| `apps/api/src/routes/index.ts` | Register credit routes |
| `apps/api/src/services/credit.ts` | Comment update (shared service for `/api/me` + new endpoint) |
| `apps/api/README.md` | Credit balance endpoint docs |
| `.agent-logs/sprint-2/task-2.12-credit-balance-read-api.md` | Created (log ini) |

**Tidak diubah:** migrations, seed, `packages/shared`, `apps/web`, audit service, `/api/me` logic.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `GET /api/credits/balance` tanpa token | PASS — 401 `UNAUTHORIZED` |
| `GET /api/credits/balance` JWT user baru (signup) | PASS — 200 `{ creditBalance: null }` |
| `GET /api/me` JWT user baru | PASS — `creditBalance: null` (konsisten) |
| Seed user `penulis@contoh.id` password login | FAIL — GoTrue 500 (known limitation Task 2.6) |
| `supabase db query` verify seed row `credit_balances` | PASS — balance 1250, quota 1000, used 450, source seed |
| `git push` / Cloudflare deploy | tidak dijalankan |

## Results

- Endpoint `GET /api/credits/balance` tersedia, protected `authMiddleware`.
- Response: `{ ok: true, data: { creditBalance: CreditBalance | null } }`.
- Reuse `getCreditBalanceForUser` — sama dengan `/api/me`; mapper camelCase dari DB snake_case.
- Tidak ada mutation, ledger, deduction, audit log, atau auto-create balance.
- `userId` hanya dari JWT (`c.get("userId")`), tidak dari query/body.

## Decisions

1. **`GET /api/credits/balance`** — preferensi user; `/api/me` tetap mengembalikan `creditBalance` tanpa perubahan behavior.
2. **Null jika row tidak ada** — tidak auto-create; billing/ledger Sprint 8.
3. **Tidak ada audit log untuk GET** — read-only display, konsisten dengan scope Task 2.12.
4. **Service role + filter `user_id`** — sama pola Task 2.6; tidak expose key atau user lain.

## Limitations

- Seed demo user `penulis@contoh.id` tidak bisa login via GoTrue (direct `auth.users` insert) — balance 1250 tidak diverifikasi via API runtime; diverifikasi via `psql` pada row seed.
- User baru selalu `creditBalance: null` sampai seed/admin grant (Sprint 8).
- Tidak ada `PATCH /api/credits/*`, ledger, top-up, atau deduction.
- Frontend Sprint 1 belum terhubung ke endpoint ini.

## Next recommended task

**Task 2.13 — Web Integration Minimal:** dashboard/settings/foundation mulai membaca API dengan `VITE_USE_MOCKS` fallback — tanpa redesign UI dan tanpa AI generation.