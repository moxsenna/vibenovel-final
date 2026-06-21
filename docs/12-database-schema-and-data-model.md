# 12 — Database Schema and Data Model

## MVP tables

MVP minimal perlu tabel/logical collections. Status per **2026-06-16**: lihat juga [`docs/audit/12-docs-code-truth-matrix-2026-06-16.md`](audit/12-docs-code-truth-matrix-2026-06-16.md).

```txt
users / profiles
projects
story_foundations
characters
facts
ai_proposals
planned_reveals
chapter_outlines
chapter_beats
chapter_prose_versions
context_packet_logs
chapter_summaries
chapter_deltas
chapter_summary_items
chapter_summary_proposals
generation_attempts
credit_ledger
credit_topup_products / credit_topup_orders / payment_webhook_events
draft_imports / draft_import_signals
validation_reports          — shipped 00012 (Sprint 14 safety)
character_states              — shipped 00016 (Sprint 16)
character_knowledge           — shipped 00016 (Sprint 16)
timeline_events               — shipped 00015 (Sprint 17)
mini_arcs                     — shipped 00015 (Sprint 17)
prose_embeddings              — shipped 00017 (Sprint 18, pgvector)
import_jobs                   — shipped 00017 (Sprint 18)
```

**Migrations in repo:** `00001`–`00019` (`supabase/migrations/`). Hosted production may lag — operator must apply through latest migration per environment.

## Important design rules

- Jangan menyimpan semua story data hanya sebagai blob teks.
- Facts, reveals, character knowledge, and prose versions harus bisa diaudit.
- AI-generated data harus punya source dan status.
- User-edited prose harus menjadi accepted version bila disetujui.

## Chapter prose version

```ts
ChapterProseVersion {
  id: string
  projectId: string
  chapterBeatId: string
  versionNumber: number
  proseText: string
  wordCount: number
  source: 'user_edited' | 'stub_deterministic' | 'ai_generated'
  isCurrent: boolean
  contextPacketLogId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}
```

Notes:

- `chapter_prose_versions` adalah draft storage, bukan canon facts.
- Satu beat hanya boleh punya satu row `is_current = true`.
- Status seperti `accepted` atau `published` bukan nilai `source`; accept/publish hidup di workflow summary/publish, bukan di enum prose source.
- Model id, token, dan prompt raw tidak boleh menjadi response normal UI; pakai audit/generation attempt summary yang aman.

## Chapter Delta

```ts
ChapterDelta {
  chapterId: string
  summary: string
  newFactsRevealed: string[]
  characterStateChanges: string[]
  relationshipChanges: string[]
  timelineEvents: string[]
  openThreadsAdded: string[]
  openThreadsResolved: string[]
  readerPromisesAdded: string[]
  breadcrumbsPlanted: string[]
  miniVictories: string[]
  continuityWarnings: string[]
}
```

Status saat ini: `chapter_deltas` dan `chapter_summary_items` sudah ada; kandidat canon masuk `ai_proposals`. Perubahan `character_states` / `character_knowledge` dan materialisasi `timeline_events` saat chapter close **shipped** (Sprint 16–17); voice/RAG canon tetap backlog.

## Sprint boundary

Sprint 1 tidak membuat schema production. Gunakan typed dummy data. Schema production mulai Sprint 2.
