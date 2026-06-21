# Narraza Layer 1 recovery log (2026-06-17)

Master Recovery Roadmap Layer 1 + Layer 0 remainder (prose→publish proof).

## Layer 1 — UX / correctness

| Item | Change |
|------|--------|
| Branding | User-facing payment/OpenRouter strings → **Narraza** (`node-server`, credit-topup, Duitku/Mayar product copy, OpenRouter `X-Title` / referer). Web `index.html` already Narraza; no `VibeNovel` in `apps/web/src` copy. |
| Intake progress | `mapIntakeBundleToUi`: `progressPercent` from `buildHonestProgress` done/total only (no `session.progressPercent`). |
| Readiness calibration | Maturity checks **+1** each (max +5 → cap 80 on rich text); structural base **75** stays in **75–84** refine band; lock still needs mature row ≥85. |
| Lock gate | `coreKeys` adds `genre_tone` + `secret_guard` (both require **pass**). |
| Post-lock UI | `lockFoundationNow` refetches full `fetchFoundationBundle` + readiness (not `result.promoted.facts` only). |
| AI failure UX | `aiGenerationFailureNotice` + refund line on concept/foundation/outline AI errors. |

## Layer 0

| Item | Change |
|------|--------|
| E2E smoke | `scripts/sprint14-e2e-prose-publish-node.ps1` — Node `:8787`, through `publish/generate`. Run: `npm run smoke:api:sprint14:e2e-node`. |

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test:sprint19-asisten-narra -w @vibenovel/api`
- Local: `npm run dev:api:node` + `npm run smoke:api:sprint14:e2e-node`

## Deferred (per plan)

- Full SSE streaming for AI generation (Layer 2+).

## What comes after (roadmap layers)

- **Layer 2**: Validator / safe-repair, canon gates, production stub policy.
- **Layer 3**: Streaming AI, credit UX polish, competitive manuscript gaps.
- **Layer 4**: Old sprint plan items (Sprints 4–8) — outline/write/publish hardening, staging E2E.
