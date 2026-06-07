# Stitch UI Source of Truth

This folder records which Stitch screens should be treated as visual source of truth for Sprint 1.

## Primary variants

- `vibenovel_selamat_datang_polished`
- `mulai_proyek_baru_polished`
- `dashboard_penulis_refined`
- `beri_tahu_ide_ceritamu_refined`
- `pilihan_konsep_cerita_refined`
- `fondasi_cerita_refined`
- `outline_cerita_natural_terms`
- `tulis_bab`
- `tulis_bab_mobile_polished`
- `ringkasan_bab_drama_consistent`
- `paket_publish_bab_kbm_optimized`
- `pengaturan_pemakaian`

## Secondary/fallback variants

- `fondasi_cerita_drama_consistent` for sample drama story content.
- `mulai_proyek_baru` for desktop fallback if polished variant is too mobile-focused.
- `outline_cerita_10_bab` only if `natural_terms` lacks a component detail.

## Rule

If multiple Stitch variants conflict, prefer:

```txt
polished > refined > kbm_optimized > natural_terms > drama_consistent > original
```

Exception: For outline wording, `natural_terms` is preferred because user-facing language matters more than technical phrasing.
