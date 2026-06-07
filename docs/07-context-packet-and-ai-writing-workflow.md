# 07 — Context Packet and AI Writing Workflow

## Purpose

Context Packet adalah satu-satunya pintu konteks ke AI Writer. Writer tidak boleh menerima semua lore mentah.

## Context Packet structure

```ts
ProseContextPacket {
  currentTask: {
    chapterNumber: number
    beatNumber: number
    beatGoal: string
    emotionalShift: string
    wordTarget: number
    povCharacterId: string
    locationId?: string
  }
  readerKnowledge: {
    knownFacts: string[]
    unresolvedThreads: string[]
    activeReaderPromises: string[]
  }
  povKnowledge: {
    knownFacts: string[]
    suspectedFacts: string[]
    falseBeliefs: string[]
    forbiddenFacts: string[]
  }
  continuity: {
    previousChapterSummary: string
    previousBeatSummary: string
    activeCharacterStates: string[]
    activeRelationshipStates: string[]
  }
  revealGate: {
    allowedBreadcrumbs: string[]
    forbiddenReveals: string[]
    forbiddenConcepts: string[]
  }
  style: {
    authorVoice: string[]
    projectStyle: string[]
    characterVoiceCards: string[]
    mobileFormatRules: string[]
  }
  constraints: {
    mustInclude: string[]
    mustNotInclude: string[]
    stopCondition: string
    allowedInventionPolicy: string[]
  }
}
```

## Workflow per beat

```txt
1. Load canonical story state
2. Load beat contract
3. Build character knowledge snapshot
4. Build reveal gate
5. Build context packet
6. Generate prose
7. Validate
8. Repair if needed
9. Save prose version
10. User accept/edit/reject
```

## Writer instruction

Writer hanya menulis adegan saat ini. Writer tidak merencanakan masa depan dan tidak membuat fakta besar baru.

## MVP acceptance criteria

- Generate prose selalu menerima Context Packet.
- Context Packet tidak berisi future outline mentah.
- Prose version tersimpan.
- User bisa menerima atau menolak output.
