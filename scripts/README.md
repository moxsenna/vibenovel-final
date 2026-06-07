# scripts — Helper Scripts (Placeholder)

## Fungsi folder ini

Skrip operasional **non-runtime** untuk developer dan CI:

- seed database dev
- export/import fixture
- parity check Stitch vs built UI
- generate type dari schema
- pre-deploy checks

Contoh masa depan:

```txt
scripts/seed-dev.ts
scripts/check-stitch-parity.ts
scripts/typegen-from-schema.ts
```

## Status saat ini

**Belum diimplementasikan.** Folder placeholder.

Perintah harian saat ini dijalankan dari **root `package.json`** atau `apps/web/package.json`.

## Kapan akan dipakai

- Sprint 2+: seed & migration helpers
- Sprint 1 Task 1.16+: optional visual parity scripts
- Full build: CI pipeline, deploy hooks

## Larangan untuk agent / developer

Jangan:

- menaruh business logic production di scripts yang dipanggil UI
- membuat script yang mengubah schema tanpa review
- menggantikan `npm run typecheck` / `build:web` dengan script ad-hoc
- menambahkan dependency berat di root hanya untuk satu script kecil

Tambah script hanya jika ada kebutuhan jelas dan terdokumentasi di sprint task.