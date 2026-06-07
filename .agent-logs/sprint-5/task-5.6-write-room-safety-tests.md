# Task 5.6 — Safety Tests & Write Room Leak Guard

## Task goal

Add Sprint 5 final safety tests so Context Packet, WritePage, prose draft, and write-room API do not leak `planningTruth`, `packet_json`, full context, future chapter summaries, or future reveal truth. Testing/hygiene only — no new product features.

## Files read

- `README.md`
- `docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`
- `apps/api/README.md`
- `scripts/sprint5-smoke-api.ps1` (pre-change)
- `scripts/sprint4-smoke-web.ps1`
- `apps/web/e2e/sprint4-outline-flow.spec.ts`
- `apps/web/src/pages/WritePage.tsx`
- `apps/web/src/hooks/useWriteRoomData.ts`
- `apps/web/src/services/write.ts`
- `apps/web/src/components/writer/`
- `apps/api/src/services/context-packet-builder.ts`
- `apps/api/src/services/context-packet-safety.ts`
- `apps/api/src/services/prose-draft.ts`
- `apps/api/src/routes/write.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Note |
|---|---|
| `scripts/sprint5-smoke-api.ps1` | Extended leak guards, DB `packet_json` check, prose/canon/ready_for_summary safety |
| `apps/web/e2e/sprint5-write-flow.spec.ts` | **Created** — mock + API mode WritePage E2E |
| `scripts/sprint5-smoke-web.ps1` | **Created** — Playwright wrapper (mock default, `-IncludeApiMode`) |
| `package.json` | Added `smoke:web:write` |
| `apps/web/package.json` | Added `test:e2e:sprint5` |
| `README.md` | Sprint 5 smoke commands |
| `scripts/README.md` | Sprint 5 API + write web smoke docs |
| `apps/api/README.md` | Task 5.6 safety smoke table |

## Commands run

```bash
npm run typecheck
npm run build:shared
npm run build:web
npm run build:api
npm run smoke:api
powershell -ExecutionPolicy Bypass -File scripts/sprint5-smoke-api.ps1
npm run smoke:web
npm run smoke:web:outline
npm run smoke:web:write
npm run smoke:web:write -- -IncludeApiMode
```

## Results

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run smoke:api` (Sprint 2 regression) | **PASS** — 17/17 |
| `scripts/sprint5-smoke-api.ps1` | **PASS** — 49/49 |
| `npm run smoke:web` | **PASS** — mock 3/3, API NOT RUN |
| `npm run smoke:web:outline` | **PASS** — mock 3/3, API NOT RUN |
| `npm run smoke:web:write` | **PASS** — mock 3/3, API NOT RUN |
| `npm run smoke:web:write -- -IncludeApiMode` | **PASS** — mock + API 10/10 |

## Decisions

- DB `packet_json` verified via Supabase PostgREST owner SELECT (user JWT + anon key) — no service role in smoke script.
- `Get-SpeechRulesCount` helper handles API returning `data` as array (not `data.rules`).
- Mock E2E uses role-based locators to avoid hidden mobile duplicate nodes.
- API E2E sets viewport 1440×900 so `WriterAssistantPanel` (`xl:flex`) is visible.
- `ready_for_summary` E2E asserts navigation to mock `/summary` (no Sprint 6 canon) instead of transient workflow notice lost on route change.
- Fictional prose test uses ASCII punctuation only (PowerShell encoding safety).

## Bugs found/fixed

1. **sprint5-smoke-api.ps1** — em dash in fictional prose string broke PowerShell parser → replaced with period.
2. **sprint5-smoke-api.ps1** — speech-rules count used wrong response shape (`.data.rules`) → `Get-SpeechRulesCount` helper.
3. **sprint5-write-flow.spec.ts** — mock marker matched hidden mobile node → role-based headings/buttons.
4. **sprint5-write-flow.spec.ts** — API flow did not wait for beat generation / xl viewport → explicit generate wait + 1440px viewport.
5. **sprint5-write-flow.spec.ts** — finish CTA assertion looked for notice text after navigation → assert `/summary` URL + mock summary heading.

No application source bugs required fixes — tests revealed test-script/E2E hygiene issues only.

## Limitations

- Sprint 5 API smoke not wired to `npm run smoke:api` (Sprint 2 regression unchanged by design).
- API-mode write E2E not in GitHub Actions CI (browser + Supabase + dual `VITE_USE_MOCKS`).
- DB `packet_json` check uses owner RLS SELECT — does not audit service-role-only paths.
- Summary page after `ready_for_summary` is still mock Sprint 1 — E2E does not prove absence of future Sprint 6 canon pipeline.
- No `chapter_summaries` table exists yet — ready_for_summary “no summary created” verified via status + fact count only.

## Next recommended task

**Task 5.7** — Sprint 5 verification report (`docs/35-sprint-5-verification-report.md`) after user approval of Task 5.6.