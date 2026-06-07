# 12 — Database Schema and Data Model

## MVP tables

MVP minimal perlu tabel/logical collections:

```txt
users / profiles
projects
story_foundations
characters
facts
reveals
chapters
chapter_beats
prose_versions
qa_reports
chapter_deltas
credits_ledger later
```

## Important design rules

- Jangan menyimpan semua story data hanya sebagai blob teks.
- Facts, reveals, character knowledge, and prose versions harus bisa diaudit.
- AI-generated data harus punya source dan status.
- User-edited prose harus menjadi accepted version bila disetujui.

## Prose version

```ts
ProseVersion {
  id: string
  projectId: string
  chapterId: string
  beatId?: string
  versionNumber: number
  text: string
  source: 'ai_generated' | 'user_edited' | 'ai_rewritten' | 'accepted' | 'published'
  isCurrentAcceptedVersion: boolean
  model?: string
  contextPacketHash?: string
  qaStatus?: 'passed' | 'warning' | 'failed'
}
```

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

## Sprint boundary

Sprint 1 tidak membuat schema production. Gunakan typed dummy data. Schema production mulai Sprint 2.
