# VibeNovel — Feature Migration Map

Status: Sprint 1.5 Documentation  
Purpose: Decide how legacy VibeNovel features map into the rebuilt VibeNovel Core v2 roadmap.

---

## 1. Decision Categories

Legacy features are classified into five categories:

| Category | Meaning |
|---|---|
| KEEP | Keep the concept with minor adjustment. Rare for code; more common for product idea. |
| REWRITE | Preserve the feature idea, but rebuild the implementation around Core v2 architecture. |
| REFERENCE ONLY | Use as inspiration only. Do not preserve implementation. |
| DROP | Do not carry forward because it conflicts with Core v2 decisions. |
| BACKLOG FULL VERSION | Valuable, but not MVP. Revisit after safety rails and production pipeline exist. |

---

## 2. High-Level Migration Table

| Legacy Feature | New VibeNovel Feature | Category | Target Sprint | Notes |
|---|---|---:|---:|---|
| Story Compass | Fondasi Cerita / Story Foundation | REWRITE | Sprint 3 | Must include Foundation Readiness and AI Proposal Queue. |
| Approval Cards | AI Proposal Queue | REWRITE | Sprint 2 | Must move early because AI facts cannot become canon directly. |
| Co-Author Chat | Chat Story Agent | REWRITE | Sprint 3 | Chat in front, structured extraction behind. |
| Brainstorm Agent | Story Intake Agent | REWRITE | Sprint 3 | Must create proposals, not canon. |
| Outline Engine | Planning Engine + KBM Outline | REWRITE | Sprint 4 | Must include chapter promise, mini victory, open loop, reveal safety. |
| Season Architect | Series / Season / Mini Arc Planner | REWRITE | Sprint 4+ | Progressive planning, not 200 chapters at once. |
| Beat Writer | Safe Beat Writer | REWRITE | Sprint 5 | Must use Context Packet + Reveal Gate. |
| Prose Writer Prompt | Beat Writer Prompt Contract | REWRITE | Sprint 5 | Writer writes current beat only. |
| Context Injector | Context Packet Builder | REFERENCE ONLY | Sprint 5 | Old approach too free; new packet must be deterministic. |
| RAG Service | Retrieval Helper | REFERENCE ONLY | Sprint 5+ | RAG is helper, never source of truth. |
| Character State | Character State + Character Knowledge | REWRITE | Sprint 2/5 | Need knowledge states: unknown/suspects/partially_knows/misbelieves/knows. |
| Mystery Layer | Reveal Gate + Jadwal Rahasia | REWRITE | Sprint 4/5 | Hidden truth must not go raw to writer. |
| Thread Tracker | Open Loop Tracker | REWRITE | Sprint 4/6 | Needed for KBM retention and payoff. |
| Story Contract Validator | Validator Suite | REWRITE | Sprint 6 | Expand into instruction, reveal, knowledge, canon, readability, retention validators. |
| KBM Pacing | Retention / Unlockability Engine | REWRITE | Sprint 4/6 | Must include mini victory and suffering fatigue. |
| Chapter Summary | Chapter Delta Extractor | REWRITE | Sprint 6 | Summary alone is not enough; must update story state. |
| Chapter Versions | Prose Versioning | KEEP/REWRITE | Sprint 5 | Store context packet hash and validation report. |
| Import Wizard | Draft Import & Legacy Continuation | BACKLOG FULL VERSION | Sprint 10 | Imported facts become proposals first. |
| Manuscript Parser | Draft Import Parser | BACKLOG FULL VERSION | Sprint 10 | Use after core persistence exists. |
| Plot Radar | Quick Story Audit / Validator | REWRITE | Sprint 6/10 | Separate production validator vs repair-only audit. |
| Voice DNA | Voice Learning | BACKLOG FULL VERSION | Sprint 11 | MVP uses speech rules + accepted prose first. |
| Mimicry Engine | Voice-Safe Rewrite | BACKLOG FULL VERSION | Sprint 11 | Must not mutate facts/reveals. |
| Director’s Cut | Canon-Safe Rewrite Tools | BACKLOG FULL VERSION | Sprint 11 | Useful after prose versioning. |
| Visualization Panel | Advanced Mode Visuals | BACKLOG FULL VERSION | Sprint 9+ | Not MVP. |
| Timeline View | Timeline Visual | BACKLOG FULL VERSION | Sprint 9+ | Backend timeline data first. |
| Emotional Heatmap | Retention Analytics | BACKLOG FULL VERSION | Sprint 12 | Need chapter metrics first. |
| Offline Draft Sync | Offline Writer UX | BACKLOG FULL VERSION | Later | Only after production persistence. |
| PWA Update Prompt | PWA polish | BACKLOG FULL VERSION | Later | Not before core web is stable. |
| BYOK Settings | None | DROP | Never | Conflicts with backend-managed credits. |
| Local API Key Storage | None | DROP | Never | Security/product risk. |
| Raw Provider Selection | None for normal users | DROP | Never | Normal users see Hemat/Seimbang/Terbaik only. |
| Client-Side AI Generation | Backend AI Jobs | DROP/REWRITE | Sprint 3+ | Generation must go through backend/core services. |
| Frontend AI Router | Backend Model Router | REFERENCE ONLY | Sprint 3/8 | Use concept only, not implementation. |
| Prompt Files in Frontend | Backend Prompt Contracts | DROP/REWRITE | Sprint 3+ | Prompt contracts must be controlled in backend/core. |

---

## 3. KEEP

Very few legacy elements should be kept directly. Most should be rewritten.

### KEEP as product concepts

```txt
- User starts from guided flow, not blank editor.
- Beat-level writing is preferred over full chapter generation.
- Chapter versions/prose versions are important.
- KBM pacing is a key differentiator.
- Approval before committing story state is essential.
```

### KEEP with implementation changes

```txt
- Chapter versions → Prose Versioning with context packet hash.
- Character state idea → Character State + Character Knowledge.
- KBM pacing idea → Retention / Unlockability Engine.
```

---

## 4. REWRITE

These are the highest-value legacy ideas, but must be rebuilt around Core v2.

### 4.1 Story Compass → Fondasi Cerita

New requirements:

```txt
- user-facing: Fondasi Cerita
- internal: Story Foundation
- includes readiness score
- includes target length
- includes reader promise
- includes relationship speech rules
- AI-generated content enters proposals first
```

### 4.2 Approval Card → AI Proposal Queue

New requirements:

```txt
- backend/database-backed
- proposal status
- risk level
- source
- audit trail
- accept/reject/merge
```

### 4.3 Outline Engine → KBM Planning Engine

New requirements:

```txt
- target length planner
- chapter promise
- open loop
- mini victory
- reveal safety
- retention badge
- forbidden reveal notes
```

### 4.4 Beat Writer → Safe Beat Writer

New requirements:

```txt
- Beat Contract
- Word Budget
- Stop Condition
- Context Packet
- Reveal Gate
- Character Knowledge Gate
- Prose Versioning
```

### 4.5 Story Contract Validator → Validator Suite

New validators:

```txt
Instruction Compliance
Spoiler / Reveal
Character Knowledge
Canon Accuracy
Mobile Readability
Retention / Unlockability
Literary Quality
```

---

## 5. REFERENCE ONLY

Use only as inspiration:

```txt
Context Injector
RAG service
frontend AI router
Gemini pool
OpenRouter frontend adapter
legacy prompt style
Zustand domain stores
visualization components
old service structure
```

Reason:

```txt
The ideas are useful, but the architectural assumptions conflict with Core v2.
```

---

## 6. DROP

These should not return:

```txt
BYOK as default
API key localStorage
raw provider/model settings in normal UI
AI prompt full in frontend
client-only generation
context dump into writer
RAG as source of truth
AI output directly becoming canon
```

Reason:

```txt
They recreate the exact problems VibeNovel Core v2 is designed to solve:
future leakage, uncontrolled canon drift, high user complexity, security risk, and lack of cost control.
```

---

## 7. BACKLOG FULL VERSION

These are valuable but must wait until the safe production pipeline exists:

```txt
Draft Import deep analysis
Voice DNA advanced
Mimicry Engine
Director’s Cut
Inline surgical edit
Timeline visual
Emotional arc heatmap
Constellation map
Offline draft sync
PWA
Advanced free-write mode
Cover/title optimizer
Reader feedback loop
```

---

## 8. Sprint Target Summary

| Sprint | Migration Focus |
|---:|---|
| Sprint 2 | Data model: projects, foundations, characters, facts, speech rules, AI proposals, settings. |
| Sprint 3 | Chat intake, concepts, foundation proposals, readiness, lock foundation. |
| Sprint 4 | Planning engine, target length, 10-chapter outline, reveal schedule, retention hints. |
| Sprint 5 | Safe Beat Writer, Context Packet, Reveal Gate, Character Knowledge, Prose Versioning. |
| Sprint 6 | Validator Suite, Safe Repair, Chapter Delta, Canon update after approval. |
| Sprint 7 | Publish Package generation from accepted chapter. |
| Sprint 8 | Real credit ledger, model routing, preflight estimate, cost control. |
| Sprint 9+ | Advanced controls, draft import, voice learning, analytics. |

---

## 9. Migration Rules

1. New blueprint wins over legacy behavior.
2. Legacy code is reference, not source of truth.
3. Do not copy architecture that exposes AI directly in frontend.
4. Do not reintroduce BYOK as default.
5. Do not expose raw model IDs in normal UI.
6. Do not let AI output become canon directly.
7. Do not send future outline raw to writer.
8. Do not treat RAG as canonical memory.
9. Preserve useful UX ideas by rewriting them into Core v2 architecture.
10. If a feature does not support the MVP benchmark, push it to later backlog.

---

## 10. Final Migration Decision

The legacy VibeNovel is best treated as a **feature inspiration library**, not a codebase to port directly.

Final formula:

```txt
Legacy idea + Core v2 architecture + KBM problem coverage = accepted migration.
Legacy implementation without Core v2 guardrails = reject.
```
