# 07 — Context Packet and AI Writing Workflow

## Purpose

Context Packet adalah satu-satunya pintu konteks ke AI Writer. Writer tidak boleh menerima semua lore mentah.

## Context Packet structure

Status per 2026-06-15: runtime membangun `WriterContextPacket`, bukan `ProseContextPacket` konseptual lama. Packet ini slice-only dan backend-built; ia tidak membawa full outline, raw future truth, atau `planningTruth`.

```ts
WriterContextPacket {
  meta: {
    projectId: string
    chapterOutlineId: string
    chapterNumber: number
    beatId?: string
    beatNumber?: number
    builderVersion: string
    packetHash: string
    generatedAt: string
  }
  foundation: {
    premiseSummary: string
    mainConflictSummary: string
    readerPromise: string
    tone: string | null
    storySecretsPreview: string | null
  }
  concept: {
    title: string
    shortPitch: string
    readerPromise: string | null
  }
  canon: {
    characters: CharacterSafeSummary[]
    facts: string[]
    speechRules: SpeechRuleSummary[]
  }
  currentChapter: {
    title: string
    summary: string
    purpose: string | null
    chapterFunction: string
    emotionalDirection: string | null
    endingHook: string | null
    miniVictory: string | null
    hook: string | null
    markers: ChapterOutlineMarker[]
  }
  continuity: {
    previousChapterSummaries: string[]
    openLoopsActive: OpenLoopSafeSummary[]
    unresolvedThreadLabels: string[]
  }
  revealGate: {
    allowedBreadcrumbs: string[]
    allowedReveals: RevealSafeSummary[]
    forbiddenReveals: ForbiddenRevealEntry[]
    forbiddenConcepts: string[]
  }
  emotionalTarget: {
    chapterEmotion: string | null
    beatEmotionalShift: string | null
  }
  hookTarget: {
    chapterEndingHook: string | null
    beatStopCondition: string | null
  }
  constraints: {
    mustInclude: string[]
    mustNotInclude: string[]
    wordTarget: number | null
    mobileFormatRules: string[]
  }
}
```

Planned extension for Sprint continuity:

```ts
povKnowledge?: {
  knownFacts: string[]
  suspectedFacts: string[]
  falseBeliefs: string[]
  forbiddenFacts: string[]
}
```

`povKnowledge` baru boleh masuk setelah ada tabel `character_knowledge` dan safety check yang memastikan knowledge POV tidak menjadi celah bocor reveal masa depan.

## Workflow per beat

```txt
1. Load canonical story state
2. Load beat contract
3. Build character knowledge snapshot (PLANNED; saat ini memakai canon facts + reveal gate)
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
- User bisa menyimpan versi prose.
- Full accept/reject/diff version UX masih planned di sprint Version History.
