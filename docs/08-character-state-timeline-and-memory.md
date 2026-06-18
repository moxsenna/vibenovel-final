# 08 — Character State, Timeline, and Memory

## Purpose

Novel panjang rusak ketika karakter tahu hal yang belum dia tahu, berada di tempat mustahil, atau berubah emosi tanpa transisi. Sistem ini menjaga kontinuitas.

## Implementation status

Status per **2026-06-16** (code-verified; see [`docs/audit/12-docs-code-truth-matrix-2026-06-16.md`](audit/12-docs-code-truth-matrix-2026-06-16.md)):

**Shipped — Sprint 16 (character continuity, migration `00016`):**

- Tabel `character_states` dan `character_knowledge` (RLS owner-only).
- Services `character-state.ts`, `character-knowledge.ts`; proposal types dari Chapter Delta (`character_state_update`, `character_knowledge_update`).
- Context Packet membawa `povKnowledge` (known/suspected/false beliefs) untuk POV — `write-snapshot.ts` / `context-packet-builder.ts`; tipe `PovKnowledgeSnapshot` di `@vibenovel/shared`.
- Safety: `context-packet-safety.ts` memastikan `povKnowledge` tidak menjadi celah bocor reveal masa depan.

**Shipped — Sprint 17 (migration `00015`):**

- Tabel `timeline_events`, `mini_arcs`, `chapter_outlines.mini_arc_id`.
- `continuity.recentTimeline` **past-only** di packet (filter `chapter_number < current`).

**Belum ada / backlog (bukan regressi Sprint 16–17):**

- Voice cards / author voice learning sebagai canon.
- RAG sebagai source of truth (retrieval memory di Sprint 18 adalah **read-only** snippet).
- Full Story Bible entity editors (Creator Mode = settings + outline knobs partial — lihat [`docs/101-sprint-16-creator-mode-report.md`](101-sprint-16-creator-mode-report.md)).

Proteksi lain yang sudah nyata: `WriterContextPacket` slice-only, Reveal Gate, `context_packet_logs`, `chapter_summaries`, `chapter_deltas`, dan `ai_proposals`.

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
