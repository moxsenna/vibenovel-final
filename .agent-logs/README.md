# Agent Work Logs

Folder ini menyimpan **catatan pekerjaan agent** per task sprint — bukan dokumentasi produk, bukan source code aplikasi.

Tujuan: agent berikutnya dan developer manusia bisa melanjutkan tanpa menebak apa yang sudah dibaca, diubah, dijalankan, atau sengaja ditunda.

## Kapan wajib menulis log

Setiap **task non-trivial** (coding, schema, integrasi, audit, rule/docs yang mengubah workflow implementasi) wajib membuat atau memperbarui log di folder ini.

Task trivial (typo satu baris, komentar saja) boleh dilewati — gunakan penilaian sprint discipline.

## Lokasi file

```txt
.agent-logs/<sprint>/task-<number>-<slug>.md
```

Contoh:

```txt
.agent-logs/sprint-2/task-2.1-shared-package-foundation.md
.agent-logs/sprint-2/task-2.0b-agent-work-logs-rule.md
```

| Bagian path | Aturan |
|---|---|
| `<sprint>` | `sprint-1`, `sprint-2`, `sprint-1.5`, dll. — selaras `docs/26-current-sprint-plan.md` |
| `<number>` | Nomor task resmi (mis. `2.1`, `2.0b`) |
| `<slug>` | Kebab-case singkat (mis. `shared-package-foundation`) |

Satu task = satu file. Jika task dilanjutkan di sesi lain, **update file yang sama** (tambah section `## Update <tanggal>`), jangan buat duplikat.

## Isi wajib setiap log

Gunakan template di bawah. Semua section wajib diisi; jika tidak relevan, tulis `N/A` atau `Tidak ada`.

```markdown
# Task X.Y — <Judul singkat>

**Date:** YYYY-MM-DD
**Sprint:** sprint-N
**Status:** completed | partial | blocked

## Task goal

## Files read

## Files created/changed

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS / FAIL / tidak dijalankan |

## Results

## Decisions

## Limitations

## Next recommended task
```

## Larangan

- **Jangan** menulis secrets: API keys, tokens, password, nilai `.env`, service role keys, JWT, credential Supabase/OpenRouter.
- **Jangan** klaim palsu (mis. "typecheck PASS" jika command tidak dijalankan).
- **Jangan** menyalin output terminal panjang penuh — ringkas fakta (PASS/FAIL, pesan error utama).
- **Jangan** mengganti docs produk (`docs/`) dengan isi log; log hanya di `.agent-logs/`.

## Jika command tidak dijalankan

Tulis eksplisit, misalnya:

```txt
npm run build:web — tidak dijalankan (scope docs-only)
```

## Hubungan dengan rules lain

- Aturan lengkap: `.agents/rules/09-agent-work-logs.md`
- Laporan akhir sprint tetap di `docs/` (mis. `docs/28-sprint-2-verification-report.md`)
- Rule `08-testing-and-change-report.md` tetap berlaku untuk ringkasan change setelah coding

## Retensi

Log **di-commit** ke repo (bukan `.gitignore`) agar handoff antar agent/manusia terbaca di git history.

## Inventaris sprint (per 2026-06-08)

### Sprint 2

| Task | Log file | Status |
|---|---|---|
| 2.0 | `sprint-2/task-2.0-data-model-implementation-plan.md` | ✅ (retroaktif) |
| 2.0b | `sprint-2/task-2.0b-agent-work-logs-rule.md` | ✅ |
| 2.1–2.15 | `sprint-2/task-2.*.md` | ✅ |

### Sprint 3

| Task | Log file | Status |
|---|---|---|
| 3.0 | `sprint-3/task-3.0-story-foundation-flow-plan.md` | ✅ committed |
| 3.1 | `sprint-3/task-3.1-intake-concept-data-model-migration.md` | ✅ committed |
| 3.2 | `sprint-3/task-3.2-intake-sessions-messages-api.md` | ✅ committed |
| 3.3 | `sprint-3/task-3.3-concept-options-api.md` | ✅ lokal — commit bersama kode Task 3.3 |

**Sprint 1:** belum ada folder `.agent-logs/sprint-1/` (selesai sebelum rule work log).