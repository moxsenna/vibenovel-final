# packages/shared — Shared Types & Schema (Placeholder)

## Fungsi folder ini

Kontrak data **bersama** antar `apps/web`, `apps/api`, dan `packages/core`:

- TypeScript types / Zod schemas
- DTO request/response API
- enum status (project, chapter, validation, credits)
- shared constants (model tier labels, route names)

Tujuan: satu sumber kebenaran tipe agar frontend dan backend tidak drift.

## Status saat ini

**Belum diimplementasikan.**

Sprint 1: types sementara hidup di `apps/web/src/types/` dan `apps/web/src/mocks/` untuk keperluan UI dummy.

## Kapan akan dipakai

| Sprint | Migrasi |
|---|---|
| Sprint 2 | Project & foundation types → shared |
| Sprint 3–4 | Story foundation, outline, beat types |
| Sprint 5–6 | Chapter, prose version, chapter delta types |
| Sprint 7+ | Publish package, usage/credits types |

Lihat `docs/12-database-schema-and-data-model.md`.

## Larangan untuk agent / developer

Jangan:

- menduplikasi schema di banyak folder tanpa rencana migrasi
- mengedit migration production di `supabase/` tanpa sprint yang jelas
- memindahkan semua types ke shared sebelum ada konsumen backend nyata
- menghapus types di `apps/web` secara prematur tanpa update import

Saat shared package aktif, `apps/web` boleh re-export atau import dari `@vibenovel/shared`.