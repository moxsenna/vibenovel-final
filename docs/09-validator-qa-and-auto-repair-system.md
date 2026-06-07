# 09 — Validator, QA, and Auto-Repair System

## Purpose

AI output tidak boleh langsung final. Validator menjaga output agar sesuai beat, tidak bocor rahasia, tidak merusak canon, dan enak dibaca di HP.

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
