# VibeNovel — Legacy VibeNovel Audit

Status: Sprint 1.5 Documentation  
Purpose: Audit the old VibeNovel project as reference material for the rebuilt VibeNovel Core v2 architecture.  
Source basis: prior legacy audit findings, VibeNovel Core v2 blueprint, brainstorming decisions, and Sprint 1 frontend parity results.

> Important: this document is not an instruction to copy the old architecture. The legacy project is a reference source only. The rebuilt VibeNovel architecture remains the source of truth.

---

## 1. Executive Summary

The old VibeNovel project contains many strong product ideas:

- Story Compass / story foundation workflow.
- Conversational co-author flow.
- Approval cards.
- Outline and season planning.
- Beat-level prose writing.
- Character state tracking.
- Mystery/reveal-related concepts.
- Story contract validation.
- KBM pacing concepts.
- Import/draft analysis.
- Voice/mimicry tooling.
- Visualization and analytics ideas.

However, the legacy implementation should **not** be migrated directly.

The main risks in the legacy direction are:

- too much AI logic in the frontend,
- BYOK / local API key assumptions,
- raw provider/model exposure,
- client-side AI generation,
- broad context injection into writer prompts,
- RAG/context retrieval being too close to “truth”,
- AI outputs becoming story state too easily,
- future outline leakage risk,
- insufficient separation between planner and writer,
- insufficient canon/proposal/versioning boundaries.

The rebuild must preserve useful ideas while rewriting the architecture around:

```txt
Canonical Story State
AI Proposal Queue
Foundation Readiness
Reveal Gate
Context Packet Builder
Character Knowledge
Beat Contract
Validator Suite
Chapter Delta
Retention / Unlockability Layer
Backend-managed AI credits
```

---

## 2. Legacy Repo Summary

The legacy VibeNovel project is best understood as a feature-rich AI writing workspace built around frontend-driven workflows, local state, AI service adapters, prompt files, and direct application-level orchestration.

Observed/expected legacy areas:

```txt
src/components/
  chat/
  compass/
  dashboard/
  modals/
  onboarding/
  prose/
  visualization/
  workspace/

src/hooks/
  useAuth
  useBatchGenerator
  useBeatWriter
  useLoreExtractor
  useOfflineDraft
  usePlotRadar

src/lib/
  manuscript-parser
  manuscript-reader
  kbm-pacing
  genre-blueprints
  supabase
  workspace-modes

src/prompts/
  brainstorm-agent
  outline-engine
  prose-writer
  import-analyzer
  lore-extractor
  plot-radar
  rewrite
  state-snapshot
  thread-tracker
  mimicry-engine

src/services/
  ai/
  batch-generator
  canon-proposal-service
  chapter-protection
  chapter-reindexer
  chapter-summary
  import-analyzer
  offline-draft-sync
  prose-context
  rag-service
  state-tracker
  story-contract-validator
  thread-tracker
  voice-dna-helper

src/store/
  useChatStore
  useProjectStore
  useSettingsStore
  useUiStore
```

Potential legacy schema/domain objects include:

```txt
projects
characters
items
world_rules
seasons
sub_arcs
chapters
character_states
mystery_layers
plot_threads
chapter_summaries
emotional_patterns
archived_outlines
chapter_versions
recaps
```

These are valuable as references, but the rebuilt data model should be explicitly designed around the new canon/proposal/reveal architecture.

---

## 3. Legacy Tech Stack Assessment

Likely/observed legacy stack direction:

```txt
React + Vite + TypeScript
Zustand
Supabase client usage
Tailwind
Framer Motion
Gemini / model provider pool
OpenRouter adapter
Prompt files in frontend
AI services in frontend
PWA/offline-related utilities
```

### Still useful

- React/Vite/Tailwind frontend experience patterns.
- Domain-specific components and UX concepts.
- Prompt categories as rough inspiration.
- KBM pacing heuristics.
- Story contract validator concepts.
- Import/draft parser ideas.
- Character state and chapter summary concepts.

### Should not be preserved as architecture

- BYOK as the default model.
- API keys in local storage.
- Raw provider/model UI for normal users.
- AI generation controlled directly from frontend.
- Prompt contracts spread across UI code.
- Zustand as domain source of truth.
- RAG/context injection as canon authority.

---

## 4. Feature Inventory

### 4.1 Story Compass

**Legacy value:** strong.  
**Migration status:** REWRITE.

Story Compass maps well to the new **Fondasi Cerita / Story Foundation** workflow.

Useful ideas:

- story setup progress,
- gap detection,
- premise/protagonist/antagonist/mystery direction,
- foundation approval,
- story direction cards,
- user confirmation before deeper planning.

Rewrite requirements:

- use backend data,
- create proposals before canon,
- include Foundation Readiness,
- include relationship speech rules,
- avoid technical jargon in Beginner Mode.

New mapping:

```txt
Story Compass → Fondasi Cerita + Foundation Readiness + AI Proposal Queue
```

### 4.2 Approval Cards / Canon Proposal

**Legacy value:** very high.  
**Migration status:** REWRITE and move earlier into Sprint 2.

New mapping:

```txt
Approval Card → AI Proposal Queue
```

Required statuses:

```txt
proposed
accepted
rejected
merged
deprecated
```

Required proposal categories:

```txt
character_proposal
fact_proposal
relationship_proposal
secret_proposal
reveal_proposal
world_rule_proposal
style_proposal
chapter_delta_proposal
speech_rule_proposal
```

High-risk facts must never become canon directly.

Examples of high-risk facts:

```txt
kehamilan
anak
kematian
hubungan keluarga
masa lalu romantis
rahasia besar
benda penting
status nikah/hukum
```

### 4.3 Co-Author Chat / Story Agent

**Legacy value:** high.  
**Migration status:** REWRITE.

New role:

```txt
Story Agent = story interviewer + structured data extractor + creative director
```

The user-facing experience should feel conversational, but the backend should extract structured data:

```txt
genre
target reader
premise
protagonist
emotional wound
core conflict
reader promise
secret candidates
tone
target length
style preference
speech rules
```

Important rule:

```txt
Chat output is not canon.
Chat output becomes proposal.
User confirms before lock.
```

### 4.4 Outline Engine

**Legacy value:** high.  
**Migration status:** REWRITE.

Useful ideas:

- outline engine,
- chapter planning,
- chapter function,
- emotional tone,
- cliffhanger,
- false resolution,
- dopamine beat,
- paywall advice,
- filler risk,
- foreshadowing.

New mapping:

```txt
Outline Engine → Planning Engine + KBM Outline Engine
```

New requirements:

- outline must be built from locked foundation,
- chapter outline must include chapter promise,
- open loop,
- mini victory / payoff plan,
- forbidden reveal,
- retention badge,
- reveal safety notes,
- future outline cannot enter writer prompt raw.

### 4.5 Season Architect / Long-Form Planner

**Legacy value:** high.  
**Migration status:** REWRITE.

New mapping:

```txt
Season Architect → Series / Season / Mini Arc Planner
```

Important new constraints:

- do not generate 200 chapters in detail at once,
- use progressive planning,
- use target length planner,
- connect season/arc/reveal cadence to KBM serial retention,
- feed writer only safe local instructions.

### 4.6 Beat Writer / Prose Writer

**Legacy value:** high.  
**Migration status:** REWRITE.

New mapping:

```txt
Beat Writer → Safe Beat Writer MVP
```

New required controls:

```txt
Beat Contract
Word Budget
Stop Condition
Context Packet
Reveal Gate
Character Knowledge Gate
Prose Versioning
Validator Suite
```

Hard rule:

```txt
Writer writes current beat only.
Writer does not plan future plot.
Writer does not receive hidden truth raw.
```

### 4.7 Context Injector / RAG / Prose Context

**Legacy value:** medium as reference.  
**Migration status:** REFERENCE ONLY.

New mapping:

```txt
Context Injector → Context Packet Builder
RAG Service → Retrieval helper only
```

Priority order:

```txt
Canonical Story State
> Reveal Gate
> Character Knowledge
> Beat Contract
> Recent accepted prose
> RAG snippets
> model creativity
```

### 4.8 Character State

**Legacy value:** high.  
**Migration status:** KEEP IDEA + EXTEND.

New mapping:

```txt
Character State → Character State + Character Knowledge Engine
```

The rebuild must explicitly track:

```txt
unknown
suspects
partially_knows
misbelieves
knows
```

This is required to prevent characters from knowing future/hidden facts too early.

### 4.9 Mystery Layer

**Legacy value:** high as concept.  
**Migration status:** REWRITE.

New mapping:

```txt
Mystery Layer → Reveal Gate + Jadwal Rahasia + Breadcrumb Compiler
```

Required architecture:

```txt
truth
reveal target chapter
forbidden before chapter
allowed breadcrumb chapters
characters who know
safe breadcrumb text
forbidden concepts
```

Important rule:

```txt
Hidden truth must not be sent raw to prose writer before reveal time.
```

### 4.10 Story Contract Validator

**Legacy value:** high.  
**Migration status:** REWRITE into Validator Suite.

New mapping:

```txt
Story Contract Validator → Validator Suite
```

Required validators:

```txt
Instruction Compliance Validator
Spoiler / Reveal Validator
Character Knowledge Validator
Canon Accuracy Validator
Mobile Readability Validator
Retention / Unlockability Validator
Literary Quality Validator
```

### 4.11 KBM Pacing / Retention Tools

**Legacy value:** very high.  
**Migration status:** KEEP CONCEPT + INTEGRATE EARLY.

New mapping:

```txt
KBM Pacing → Retention / Unlockability Engine
```

Useful legacy ideas:

- emotional tone,
- false resolution,
- dopamine beat,
- paywall advice,
- open thread,
- pacing warning,
- filler risk,
- cliffhanger type.

New required additions:

```txt
Reader Promise
Chapter Promise
Open Loop Tracker
Payoff Scheduler
Mini Victory Scheduler
Suffering Fatigue Detector
Protagonist Agency Tracker
Layered Conflict Engine
Unlockability Score
```

### 4.12 Import Wizard / Draft Import

**Legacy value:** high.  
**Migration status:** BACKLOG FULL VERSION / MVP SHOULD-HAVE later.

New mapping:

```txt
Import Wizard → Draft Import & Legacy Continuation
```

Useful ideas:

- paste/upload draft,
- parse manuscript,
- extract characters,
- extract facts,
- extract timeline,
- detect plot holes,
- extract style,
- continuation outline.

Important new rule:

```txt
Imported facts become proposals first, not canon automatically.
```

### 4.13 Voice DNA / Mimicry Engine

**Legacy value:** high for full version.  
**Migration status:** BACKLOG FULL VERSION.

New mapping:

```txt
Voice DNA / Mimicry → Voice Learning + Rewrite Tools
```

Do not implement too early. MVP should start with simpler controls:

```txt
speech rules
style preference
accepted prose versioning
revision memory
```

Full Voice DNA can come after safe writing pipeline.

### 4.14 Visualization Tools

**Legacy value:** medium.  
**Migration status:** BACKLOG FULL VERSION.

New mapping:

```txt
Visualization Panel → Advanced Mode later
Timeline View → Timeline visual later
Emotional Heatmap → Retention analytics later
Constellation Map → Relationship visualization later
```

Not MVP.

### 4.15 Offline Draft Sync / PWA

**Legacy value:** medium.  
**Migration status:** BACKLOG FULL VERSION.

Useful later, but not before:

```txt
auth
project persistence
prose versioning
safe writer
chapter delta
```

---

## 5. Architecture Risks Found in Legacy Direction

### 5.1 BYOK / local API key

Risk:

- confusing for beginner users,
- exposes provider concerns,
- makes credit/billing impossible,
- weakens product control.

Decision:

```txt
DROP.
Use backend-managed AI and credit system.
```

### 5.2 Raw provider/model UI

Risk:

- too technical,
- inconsistent with beginner UX,
- raw model changes can break UX expectations.

Decision:

```txt
DROP for normal users.
Expose only Hemat / Seimbang / Terbaik.
```

### 5.3 Client-side AI generation

Risk:

- unsafe key handling,
- poor credit control,
- no centralized context packet audit,
- weak generation logging,
- hard to enforce reveal gate,
- hard to validate cost per accepted output.

Decision:

```txt
DROP.
Generation must run through backend/core services.
```

### 5.4 Context dump into writer

Risk:

- future leakage,
- writer sees hidden truth,
- character knowledge violations,
- model uses future outline too early.

Decision:

```txt
DROP.
Use Context Packet Builder + Reveal Gate.
```

### 5.5 RAG as source of truth

Risk:

- retrieval can miss facts,
- retrieval can return irrelevant context,
- retrieval can conflict with canon,
- model may over-trust retrieved snippets.

Decision:

```txt
REFERENCE ONLY.
RAG is helper, not source of truth.
```

### 5.6 AI output directly becoming canon

Risk:

- AI invents family relationships, pregnancy, death, secret motives,
- story changes without user realizing,
- later validator cannot distinguish official facts from draft prose.

Decision:

```txt
DROP.
Important AI output must become proposal first.
```

---

## 6. Conflicts With VibeNovel Core v2

| Legacy tendency | VibeNovel Core v2 requirement | Resolution |
|---|---|---|
| Client-side AI | Backend-managed AI | Rewrite generation architecture |
| BYOK | No BYOK default | Drop BYOK |
| Raw model settings | Hemat / Seimbang / Terbaik | Hide model IDs from user |
| Context injector | Context Packet Builder | Rewrite |
| RAG as memory | Canonical State as source of truth | RAG helper only |
| Writer sees broad context | Writer sees safe present only | Reveal Gate |
| AI output modifies story | Proposal → approval → canon | AI Proposal Queue |
| Store-driven domain state | Database-backed canon | Use backend/db |
| Generic validation | Validator suite | Rewrite validators |
| Advanced controls visible early | Progressive control | Beginner first, Advanced opt-in |

---

## 7. Insights To Preserve

The legacy project shows that the product direction is promising. It should not be discarded wholesale.

Preserve these insights:

1. User should not start with a blank editor.
2. Chat intake is the right UX for 0-writing-skill users.
3. AI should propose structure, not only prose.
4. User approval is critical.
5. Story planning must be progressive.
6. Beat-level writing is safer than full-chapter generation.
7. KBM pacing and cliffhanger logic are product differentiators.
8. Draft import can become a powerful acquisition path.
9. Voice learning is valuable, but should come after safety rails.
10. Advanced visualization is useful, but not MVP.
11. Validator logic must become central, not decorative.
12. The app must help publish, not only write.

---

## 8. Recommended Migration Priority

### Immediate after Sprint 1.5

Move into Sprint 2 with data foundation:

```txt
projects
project_settings
story_foundations
characters
facts
relationship_speech_rules
ai_proposals
credit_balances
```

### Early MVP

Bring in legacy ideas as rewritten systems:

```txt
Story Compass → Fondasi Cerita
Approval Card → AI Proposal Queue
Outline Engine → Planning Engine
Beat Writer → Safe Beat Writer
KBM Pacing → Retention Engine
Story Contract Validator → Validator Suite
Character State → Character Knowledge
```

### Later

```txt
Import Wizard
Voice DNA / Mimicry
Visualization Panel
Timeline View
Offline Draft Sync
PWA
Advanced Free Write
```

---

## 9. Final Audit Decision

The legacy VibeNovel project is feature-rich and should be treated as a strong reference library. But it should not be treated as architecture source of truth.

Final rule:

```txt
Take the ideas.
Rewrite the architecture.
Do not copy the old mental model.
```

The new VibeNovel must be built around:

```txt
AI Serial Fiction Production OS
Canonical Story State
AI Proposal Queue
Reveal Gate
Context Packet Builder
Beat Writer
Validator Suite
Chapter Delta
Retention / Unlockability Layer
Backend-managed credits
```
