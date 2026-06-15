# 08 — Character State, Timeline, and Memory

## Purpose

Novel panjang rusak ketika karakter tahu hal yang belum dia tahu, berada di tempat mustahil, atau berubah emosi tanpa transisi. Sistem ini menjaga kontinuitas.

## Implementation status

Status per 2026-06-15: continuity engine **separuh jalan**. Timeline + mini-arc sudah shipped (Sprint 17); character state/knowledge belum.

Sudah shipped (Sprint 17 — lihat `docs/100`):

- Tabel `timeline_events` (migration `00015`) — event past/current dimaterialisasi saat chapter close (best-effort di `chapter-summary-approval`).
- Tabel `mini_arcs` + `chapter_outlines.mini_arc_id` — Season→MiniArc→Chapter.
- Context Packet membawa `continuity.recentTimeline` **past-only** (filter `chapter_number < current` di `write-snapshot`; tidak ada bocor future).

Belum ada (target Sprint continuity I):

- Belum ada tabel `character_states`.
- Belum ada tabel `character_knowledge`.
- Context Packet saat ini belum membawa `povKnowledge`.

Proteksi lain yang sudah nyata: `WriterContextPacket` slice-only, `Reveal Gate`, `context_packet_logs`, `chapter_summaries`, `chapter_deltas`, dan `ai_proposals`.

Target implementasi tersisa:

- Sprint continuity I: `character_states` + `character_knowledge` + `povKnowledge` aman.
- ~~Sprint continuity II: `timeline_events` + timeline past-only di Context Packet.~~ **Selesai (Sprint 17).**

## Character State

```ts
CharacterState {
  characterId: string
  chapterNumber: number
  emotionalState: string
  physicalState: string
  currentGoal: string
  currentFear: string
  locationId?: string
  knowsFactIds: string[]
  believesIncorrectly: string[]
  relationshipStatus: Record<string, string>
  inventoryItemIds: string[]
}
```

## Character Knowledge

```ts
CharacterKnowledge {
  characterId: string
  factId: string
  knowledgeStatus: 'unknown' | 'suspects' | 'partially_knows' | 'knows' | 'misbelieves'
  confidence: number
  learnedAtChapter?: number
  learnedFrom?: string
}
```

## Timeline Event

```ts
TimelineEvent {
  id: string
  projectId: string
  chapterNumber: number
  relativeOrder: number
  event: string
  involvedCharacterIds: string[]
  locationId?: string
  consequences: string[]
}
```

## Memory layers

```txt
Canonical memory: facts, reveals, states, timeline.
Medium memory: season/mini arc summaries.
Short memory: previous chapter/beat.
Retrieval memory: accepted prose snippets, never source of truth.
```

## MVP acceptance criteria

Planned acceptance criteria untuk continuity engine, bukan status yang sudah shipped:

- Character knowledge bisa membedakan unknown/suspects/knows.
- Context Packet mengambil POV knowledge.
- Timeline event dasar dibuat saat chapter close.
- Character state bisa diperbarui lewat Chapter Delta.
