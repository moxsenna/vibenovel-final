# apps/api — Backend API (Placeholder)

## Fungsi folder ini

Tempat **backend API VibeNovel** — route HTTP, auth boundary, orchestration workflow, dan integrasi ke database/AI engine.

Rencana arsitektur (belum dibuat):

```txt
apps/api/src/index.ts          # entry Worker/API
apps/api/src/routes/           # projects, story-bible, prose, publish, dll.
apps/api/src/modules/          # story-state, planning, writing, validation
apps/api/src/ai/               # model router, agents, prompts
```

## Status saat ini

**Belum diimplementasikan.** Folder ini hanya placeholder struktur monorepo.

Sprint 1 **tidak** membangun backend. Frontend di `apps/web` memakai typed mock data.

## Kapan akan dipakai

| Sprint | Cakupan |
|---|---|
| Sprint 2+ | Project persistence, CRUD dasar |
| Sprint 3+ | Story foundation flow + intake |
| Sprint 5+ | AI writing pipeline (Context Packet, Reveal Gate, Validator) |
| Sprint 6+ | Chapter Delta, canon update |

Lihat `docs/17-roadmap-sprint-plan-mvp-to-full.md` dan `docs/13-api-routes-and-backend-workflow.md`.

## Larangan untuk agent / developer

Jangan membangun di Sprint 1:

- route API production
- Supabase client dengan service role
- OpenRouter / AI generation asli
- credit deduction, payment webhook
- validator, Reveal Gate, Context Packet logic
- fake endpoint yang pura-pura production-ready

Jika perlu eksperimen, buat boundary jelas dan jangan campur dengan UI Sprint 1.