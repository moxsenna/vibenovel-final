# Narraza Layer 2 recovery log (2026-06-17)

Continues Master Recovery Roadmap Layer 2 (`docs/09`, `docs/audit/14`).

## Shipped this pass

| Item | Change |
|------|--------|
| Roadmap sync | `docs/audit/14-master-recovery-roadmap.md` — Layer 0 E2E ✅, Layer 1 ✅/🟡, Layer 2 **in progress** |
| Prose safe-repair auto-loop | `apps/api/src/services/prose-output-safe-repair.ts` — on **blocked** validator failures, up to **2** repair provider calls; **3×** first-call token budget cap; accumulates `inputTokens`/`outputTokens` on success; persists `validation_reports` with `repair_status` |
| AI output safe-repair | `generateValidatedAiOutputWithSafeRepair` wired in **prose beat**, **prose rewrite**, **publish copy** (single user credit debit per attempt) |
| Repair instruction | `buildProseRepairInstruction` in `safe-repair.ts` (shared with explicit `POST .../ai/safe-repair`) |
| POV character-knowledge validator | `character-knowledge-validator.ts` + `pov_character_knowledge` check in `output-validator`; wired on prose beat + rewrite |
| User-facing validator labels | `buildUserFacingValidationLabels` on API 422; `apps/web/src/lib/ai-validation-labels.ts` in Write/Publish AI errors |
| Tests | `test:character-knowledge-validator` |
| Contracts | `npm run test:prose-safe-repair-loop -w @vibenovel/api` |

## Still open (Layer 2)

- **Retention / unlockability** and **style/voice** validators per `docs/09`

## Verify

```bash
npm run typecheck -w @vibenovel/api
npm run test:prose-safe-repair-loop -w @vibenovel/api
npm run test:sprint14-safety -w @vibenovel/api
npm run smoke:api:sprint14:e2e-node   # Node API + mock AI
```
| Retention / style warnings | `retention_unlock_hook`, `style_voice_consistency` via `prose-validation-context.ts` |
