# 09 — Validator, QA, and Auto-Repair System

## Purpose

AI output tidak boleh langsung final. Validator menjaga output agar sesuai beat, tidak bocor rahasia, tidak merusak canon, dan enak dibaca di HP.

> **Implementation status 2026-06-16:** **Shipped:** `apps/api/src/services/output-validator.ts` (`validateAiOutput`), persistence to `validation_reports` (migration `00012`), safe-repair endpoint / repair loop integration per Sprint 14 ([`docs/98-sprint-14-safety-hardening-report.md`](98-sprint-14-safety-hardening-report.md)). **Remaining backlog:** the eight named validators below as separate pipelines (instruction compliance, mobile readability, retention/unlockability, style/voice, etc.) — track in [`docs/100-competitive-manuscript-teardown-and-gap-sprint-plan.md`](100-competitive-manuscript-teardown-and-gap-sprint-plan.md) and [`docs/audit/12-docs-code-truth-matrix-2026-06-16.md`](audit/12-docs-code-truth-matrix-2026-06-16.md).


## Validators

1. Instruction Compliance Validator
2. Continuity Validator
3. Character Knowledge Validator
4. Spoiler/Reveal Validator
5. Canon Accuracy Validator
6. Mobile Readability Validator
7. Retention/Unlockability Validator
8. Style/Voice Validator

## MVP validators

Untuk MVP, cukup mulai dengan:

- instruction compliance,
- basic spoiler/reveal check,
- basic continuity check,
- mobile readability check,
- simple retention check.

## Auto-repair rule

Jika output gagal validator:

```txt
Repair existing prose first.
Do not regenerate from scratch unless repair fails.
Repair must not add new major facts.
```

## User-facing labels

Internal validator tidak harus tampil teknis. Tampilkan:

```txt
✅ Cerita nyambung
✅ Rahasia belum bocor
✅ Format enak dibaca di HP
⚠️ Ending kurang kuat
```

## Acceptance criteria

- Validator menghasilkan report.
- Output gagal bisa masuk repair pass.
- UI bisa menampilkan status sederhana.
- Agent tidak menganggap UI check sebagai validator asli tanpa logic.
