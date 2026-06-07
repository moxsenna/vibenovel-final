# 08 — Character State, Timeline, and Memory

## Purpose

Novel panjang rusak ketika karakter tahu hal yang belum dia tahu, berada di tempat mustahil, atau berubah emosi tanpa transisi. Sistem ini menjaga kontinuitas.

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

- Character knowledge bisa membedakan unknown/suspects/knows.
- Context Packet mengambil POV knowledge.
- Timeline event dasar dibuat saat chapter close.
- Character state bisa diperbarui lewat Chapter Delta.
