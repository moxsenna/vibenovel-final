# 16 — Security, Privacy, and Risk Guardrails

## Product risks

- overclaim “AI bisa membuat novel otomatis tanpa edit”,
- AI membocorkan twist,
- AI membuat konten canon palsu,
- biaya AI membengkak,
- user kecewa karena output masih perlu review,
- data cerita user bocor.

## Guardrails

- no BYOK for main product,
- backend-managed AI calls,
- clear credit estimate,
- no raw future reveal in writer context,
- AI output as proposal until accepted,
- versioning for prose,
- audit trail for important story changes,
- plain-language warnings.

## Sprint 1 risk

Sprint 1 hanya frontend. Jangan membuat fake production logic yang tampak bekerja tapi tidak punya persistence/validator asli.
