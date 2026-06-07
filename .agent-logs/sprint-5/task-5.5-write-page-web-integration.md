# Task 5.5 — WritePage Web Integration

## Task goal

Wire `/projects/:id/write` to Sprint 5 write-room APIs (session, beats, context preview, prose save, ready-for-summary) with mock fallback, `VITE_USE_MOCKS` behavior preserved, no OpenRouter/AI, no canon/summary production.

## Files read

- README.md
- docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md
- docs/33-sprint-4-verification-report.md
- apps/api/README.md
- apps/web/src/lib/api.ts
- apps/web/src/lib/env.ts
- apps/web/src/lib/project-context.ts
- apps/web/src/pages/WritePage.tsx
- apps/web/src/components/writer/*
- apps/web/src/mocks/chapter.ts
- apps/web/src/services/* (patterns)
- apps/web/src/hooks/useOutlineData.ts (pattern)
- apps/api/src/routes/write.ts
- packages/shared/src/domain.ts
- packages/shared/src/enums.ts
- .agents/rules/09-agent-work-logs.md

## Files created/changed

| Path | Note |
|---|---|
| `apps/web/src/services/write.ts` | **Created** — write-room API client |
| `apps/web/src/hooks/useWriteRoomData.ts` | **Created** — API/mock orchestration hook |
| `apps/web/src/pages/WritePage.tsx` | **Rewired** — hook + IntegrationNotice + generate CTA |
| `apps/web/src/components/writer/WriterEditorPanel.tsx` | Editable textarea, save, finish handler |
| `apps/web/src/components/writer/WriterAssistantPanel.tsx` | Safe context preview panel + build button |
| `apps/web/src/components/writer/WriterMobileLayout.tsx` | Mobile textarea + save + finish |
| `apps/web/.env.example` | Task 5.5 comment |
| `README.md` | API mode scope note for write room |

## Commands run

```bash
npm run typecheck              # PASS
npm run build:shared           # PASS
npm run build:web              # PASS
npm run build:api              # PASS
npm run smoke:api              # PASS (17/17)
scripts/sprint5-smoke-api.ps1  # PASS (38/38)
npm run smoke:web              # PASS (3/3 mock, API skipped)
npm run smoke:web:outline      # PASS (1/1 mock, API skipped)
```

## Results

All verification PASS. No dedicated WritePage Playwright spec added (existing sprint3/4 smokes unchanged). Runtime API-mode browser check: tidak dijalankan otomatis (requires login + outline_locked project manual).

## Decisions

1. **Hook name:** `useWriteRoomData` (user spec) vs plan `useWriteData`.
2. **Chapter default:** Bab 1 from locked outline via `fetchOutlineBundle`.
3. **Context build:** Explicit button "Siapkan Konteks Aman" — no auto-build on session start.
4. **Preview UI:** Uses API `preview` + `safety.packetHash` only — no `packet_json`, no `planningTruth`.
5. **Counts display:** `mustInclude`/`mustNotInclude`/`storyCheckLabels` lengths (API preview does not expose raw breadcrumb/reveal/character counts).
6. **Finish CTA:** Calls `ready-for-summary` in API mode, then navigates to summary route with notice that Sprint 6 summary is not production.
7. **Mock preservation:** `VITE_USE_MOCKS=true` → unchanged read-only mock prose layout.
8. **Fallback:** No login, API error, outline not locked → `mockChapterDraft` + `IntegrationNotice`.

## Limitations

- No WritePage Playwright E2E for API mode in this task.
- Mobile has no "Siapkan Konteks Aman" panel (desktop assistant only).
- Beat metadata PATCH not exposed in UI.
- Context preview counts are proxy fields from safe preview, not full packet stats.
- Summary page still mock after ready-for-summary navigation.
- AI write/fix CTAs remain disabled (by design).

## Next recommended task

**Task 5.6 — Safety Test final** (per sprint plan): extended smoke asserting no `planningTruth`/packet leak in web DOM + API boundary tests; or Sprint 6 summary API if plan prioritizes that next.