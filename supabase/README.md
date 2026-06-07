# supabase — Database Migrations (Placeholder)

## Fungsi folder ini

Tempat **schema database** dan migrasi Supabase/Postgres VibeNovel:

```txt
supabase/migrations/
  0001_initial_schema.sql
  0002_rls_policies.sql
  ...
```

Menyimpan canonical persistence: projects, story foundation, characters, facts, outlines, prose versions, chapter deltas, usage logs, dll.

## Status saat ini

**Belum diimplementasikan.** Tidak ada migration atau Supabase project terhubung.

Sprint 1 **tidak** membangun schema atau koneksi database nyata.

## Kapan akan dipakai

| Sprint | Cakupan |
|---|---|
| Sprint 2 | Schema projects + persistence dasar |
| Sprint 3 | Story foundation, intake messages |
| Sprint 4 | Outline & beat contracts |
| Sprint 5–6 | Prose versions, chapter deltas |
| Sprint 7+ | Publish package, billing tables |

Lihat `docs/12-database-schema-and-data-model.md` dan `stitch-reference/architecture_paths.md`.

## Larangan untuk agent / developer

Jangan di Sprint 1:

- membuat migration production tanpa sprint plan
- mengedit migration lama yang sudah applied
- menaruh service role key di frontend
- membangun RLS/payment sebelum model data stabil
- menghubungkan UI ke Supabase tanpa typed data layer

Gunakan mock data di `apps/web/src/mocks/` sampai Sprint 2.