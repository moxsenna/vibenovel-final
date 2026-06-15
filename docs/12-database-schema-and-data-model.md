# 12 — Database Schema and Data Model

## MVP tables

MVP minimal perlu tabel/logical collections. Status per 2026-06-15: sebagian sudah menjadi tabel production migration; sebagian masih target lanjutan.

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

planned later:
character_states
character_knowledge
timeline_events
mini_arcs
prose_embeddings
import_jobs
```

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

Status saat ini: `chapter_deltas` dan `chapter_summary_items` sudah ada, dan kandidat canon harus masuk `ai_proposals`. `characterStateChanges`, `timelineEvents`, dan memory/RAG masih target Sprint continuity berikutnya, bukan tabel yang sudah ada.

## Sprint boundary

Sprint 1 tidak membuat schema production. Gunakan typed dummy data. Schema production mulai Sprint 2.
