# VibeNovel — Current Sprint Plan

> **⚠️ Historical / Product Roadmap — NOT the current execution tracker**  
> The “Current Status” section below (Task 1.17 next, Sprint 2 next, etc.) is **out of date** relative to the repo.  
> **Do not** use this file to pick the next implementation task.  
> **Source of truth for execution:** [README.md](../README.md), [docs/36](36-non-blocking-technical-debt-and-deferred-items.md), sprint closure reports, **[docs/61 — Roadmap & Sprint Number Reconciliation](61-roadmap-and-sprint-number-reconciliation.md)**, and **[docs/63 — Updated Product Roadmap After Sprint 11](63-updated-product-roadmap-after-sprint-11.md)**.

Status: **Historical product roadmap** (retained for vision & deferred features)  
Last Updated: 2026-06-08 (execution status superseded 2026-06-09 — see docs/61)  
Purpose: Original human-readable product sprint plan for the rebuilt VibeNovel project.

---

## 0. Planning Principles

VibeNovel is not being rebuilt as a generic AI chatbot or one-click novel generator.

VibeNovel is being rebuilt as an **AI Serial Fiction Production OS** for Indonesian mobile serial writers, especially writers targeting KBM-style serial fiction.

The system must solve two groups of problems:

1. **AI writing problems**
   - AI forgets context and details.
   - AI fails to keep characters consistent.
   - AI leaks twists or future story too early.
   - AI ignores outline, beat, and instructions.
   - AI writes generic / AI-ish prose.
   - AI overuses exposition and clichés.
   - AI struggles to preserve author voice.
   - AI is good for brainstorming but weak for long manuscript production.
   - AI writing platforms still require heavy manual editing.
   - Workflow becomes too technical or setting-heavy.
   - Cost and token usage become blockers.
   - Writers feel they lose creative control.

2. **KBM / mobile serial writing problems**
   - Readers stop unlocking because the story feels flat.
   - Chapters feel like filler.
   - The protagonist suffers too long without agency or reward.
   - Conflict runs out too early.
   - Open loops are forgotten or paid off too late.
   - Chapter endings are weak.
   - Formatting is not pleasant on mobile.
   - Writers need teaser, caption, tags, and comment bait, not only prose.

Core architecture decisions:

```txt
AI is not the source of truth.
Canonical Story State is the source of truth.

Planner may know the future.
Writer must only know the safe present.

Future outline must not enter the writer prompt raw.
Context Packet Builder is the only gateway into AI writing.

AI-generated important facts must be proposals first.
User approval is required before canon changes.

Default UX must be beginner-friendly.
Advanced control is opt-in.
```

---

## Current Status

> **Superseded.** For actual implementation progress see [docs/61](61-roadmap-and-sprint-number-reconciliation.md) and [README.md](../README.md). Snapshot below reflects **2026-06-08 product plan only**.

```txt
✅ Sprint 0 — Blueprint, docs, rules, repo direction
✅ Sprint 1.1–1.16 — Stitch Frontend Parity completed and verified
⏭️ Task 1.17 — Visual Polish After Manual Review  [historical — see docs/61]
⏭️ Sprint 1.5 — Legacy Audit + Problem Coverage Matrix  [docs done — see docs/23–25]
⏭️ Sprint 2 — Data Model & Project Foundation  [ACTUAL: closed — docs/29]
⏭️ Sprint 3–7 — See docs/61 mapping  [ACTUAL: closed]
⏭️ Sprint 8 — Credit System  [ACTUAL Sprint 8: AI+credits — closed docs/45]
⏭️ Sprint 9 — Creator Mode  [ACTUAL Sprint 9: rewrite+credit UI — closed docs/49]
⏭️ Sprint 10 — Draft Import  [ACTUAL Sprint 10: payment — closed docs/53]
⏭️ Sprint 11 — Voice Learning  [ACTUAL Sprint 11: staging — docs/60/62]
```

**Execution queue (2026-06-09):** Task 11.2 → 10.13b/10.8b → deferred Draft Import / Voice / Creator Mode per docs/61 §8.

---

# Sprint 0 — Blueprint & Agent Guardrails

**Status:** Completed.

## Goal

Create a clear product and technical foundation so both human developers and AI coding agents can work in a directed way.

## Outputs

```txt
docs/
.agents/rules/
stitch-reference/
README.md
monorepo structure
```

## Key decisions

- VibeNovel is an AI Serial Fiction Production OS.
- The app must not be marketed as “one-click complete novel”.
- Backend-managed AI is required.
- No BYOK as default.
- User-facing model choice is only:
  - Hemat
  - Seimbang
  - Terbaik
- Raw model IDs and provider names must not be shown to normal users.
- Beginner Mode is default.
- Creator Mode and Advanced Mode are opt-in.

---

# Sprint 1 — Stitch Frontend Parity

**Status:** Completed and verified.

## Goal

Build the full Sprint 1 frontend UI from Stitch references using mock data only. No backend, auth, database, AI production, or credit ledger.

## Completed tasks

```txt
✅ 1.1 Audit Stitch & repo
✅ 1.2 Frontend foundation
✅ 1.2b Monorepo cleanup
✅ 1.3 AppShell & Navigation
✅ 1.4 Landing
✅ 1.5 Mulai Proyek Baru
✅ 1.6 Dashboard
✅ 1.7 Chat Story Agent Intake
✅ 1.8 Pilihan Konsep
✅ 1.9 Fondasi Cerita
✅ 1.10 Outline Cerita
✅ 1.11a Ruang Tulis Desktop
✅ 1.11b Ruang Tulis Mobile
✅ 1.12 Ringkasan Bab
✅ 1.13 Paket Publish
✅ 1.14 Pengaturan Pemakaian
✅ 1.15 Final Stitch Parity Polish & Route QA
✅ 1.16 Sprint 1 Verification Report
```

## Final routes

```txt
/
 /start
/dashboard
/projects/demo-project-001/intake
/projects/demo-project-001/concepts
/projects/demo-project-001/foundation
/projects/demo-project-001/outline
/projects/demo-project-001/write
/projects/demo-project-001/summary
/projects/demo-project-001/publish
/settings
```

## Sprint 1 limitations

- All domain data is still mock data.
- No backend.
- No auth.
- No database.
- No AI generation.
- No real credit deduction.
- No real validator.
- No upload draft.
- No publish integration.

---

# Task 1.17 — Visual Polish After Manual Review

**Status:** Next.

This is a small UI polish task before Sprint 1.5. It does not reopen Sprint 1 architecture.

## Goal

Improve the UI based on manual screenshot review without changing architecture or adding production features.

## Scope

### 1. Dashboard

Current issue:
- The “Buat Proyek Baru” card feels too empty.
- The usage card feels slightly detached from the header.

Fix:
- Add short description or small option chips.
- Or reduce card height.
- Align usage card more cleanly with the dashboard header.

### 2. Foundation

Current issue:
- The page lacks a visible Foundation Readiness concept, even though readiness is a core product requirement.

Fix:
- Add mock “Kesiapan Fondasi” card.
- Example:
  - Kesiapan Fondasi: 82%
  - Tokoh utama: ready
  - Konflik utama: ready
  - Fakta terkunci: ready
  - Janji pembaca: ready
  - Panggilan tokoh: needs review

### 3. Outline

Current issue:
- Retention / KBM hints are present but could be more visible.

Fix:
- Add light retention hints:
  - Open Loop
  - Kemenangan Kecil
  - Rahasia Ditahan
  - Potensi Unlock

Do not create a production scoring system yet.

### 4. Publish

Current issue:
- Desktop layout is too vertical and leaves too much empty space.

Fix:
- Desktop two-column layout:
  - Left: copy fields
  - Right: mobile preview, checklist, tags, CTAs
- Mobile remains stacked.

### 5. Settings

Current issue:
- Layout can be more balanced on desktop.
- Sidebar settings active/focus ring appears visually too heavy.

Fix:
- Two-column desktop layout.
- Remove permanent black focus ring from Pengaturan item.
- Keep soft pink active state.
- Do not display raw model ID.

### 6. Global whitespace

Current issue:
- Some pages are too narrow on desktop.

Fix:
- Increase productive max-width for:
  - foundation
  - outline
  - publish
  - settings

## Constraints

```txt
Do not start Sprint 2.
Do not build backend.
Do not build auth.
Do not build Supabase.
Do not build AI generation.
Do not build credit ledger.
Do not change main flow.
Do not redesign from scratch.
Do not heavily modify Write page desktop/mobile.
```

## Acceptance criteria

```txt
npm run typecheck PASS
npm run build:web PASS
```

Manual check:

```txt
/dashboard
/projects/demo-project-001/foundation
/projects/demo-project-001/outline
/projects/demo-project-001/publish
/settings

desktop 1280px+
mobile 375px
```

---

# Sprint 1.5 — Legacy Audit + Problem Coverage Matrix

**Status:** After Task 1.17.

This is not a coding sprint.

## Goal

Audit legacy VibeNovel and map it against the new blueprint, while ensuring the 12 AI writing problem clusters and KBM serial problems are explicitly covered.

## Output documents

```txt
docs/23-legacy-vibenovel-audit.md
docs/24-feature-migration-map.md
docs/25-problem-coverage-matrix.md
```

## Task 1.5.1 — Legacy repo inspection

Audit legacy VibeNovel for:

```txt
folder structure
tech stack
frontend architecture
AI services
prompt files
database/schema
state management
generation flow
features
risks
```

## Task 1.5.2 — Feature migration map

Categorize legacy features:

```txt
KEEP
REWRITE
REFERENCE ONLY
DROP
BACKLOG FULL VERSION
```

Current migration decisions:

### KEEP / REWRITE

```txt
Story Compass → Fondasi Cerita
Approval Card → AI Proposal Queue
Outline Engine → Planning Engine
Season Architect → Series/Season/Mini Arc Planner
Beat Writer → Safe Beat Writer
Character State → Character State + Knowledge
Story Contract Validator → Validator Suite
KBM Pacing → Retention Engine
Publish helper → Publish Package Generator
```

### REFERENCE ONLY

```txt
Context Injector
RAG service
frontend AI router
OpenRouter frontend adapter
Gemini pool
Zustand domain stores
legacy prompt style
```

### DROP

```txt
BYOK default
API key localStorage
raw provider/model settings in UI
AI prompt full in frontend
client-only AI generation
context dump into writer
RAG as source of truth
AI output directly becoming canon
```

### BACKLOG FULL VERSION

```txt
Draft Import deep analysis
Voice DNA advanced
Mimicry Engine
Visualization panel
Timeline visual
Emotional heatmap
Offline sync
PWA
Advanced free-write mode
```

## Task 1.5.3 — Problem Coverage Matrix

Create `docs/25-problem-coverage-matrix.md`.

It must map:

```txt
12 AI writing problem clusters
KBM/mobile serial problems
new VibeNovel feature response
legacy reference if any
sprint target
acceptance criteria
```

## Acceptance

```txt
No code changes.
No UI changes.
docs/23, docs/24, docs/25 completed.
Sprint 2 can start with a clear data model direction.
```

---

# Sprint 2 — Data Model & Project Foundation

**Status:** After Sprint 1.5.

Sprint 2 is not AI production. It builds the data foundation required for safe AI.

## Goal

Turn VibeNovel from mock UI into an app with real project structure, user/project persistence, story foundation data, characters, facts, speech rules, and AI proposal infrastructure.

## Task 2.1 — Shared package foundation

Build `packages/shared`.

Move or define shared types:

```txt
Project
UserProfile
ProjectSettings
StoryFoundation
Character
Fact
AiProposal
WriterPreference
CreditBalance
```

Acceptance:

```txt
apps/web builds
apps/api can import shared types later
no duplicate type definitions
```

## Task 2.2 — Backend/API scaffold

Build `apps/api`.

Suggested stack:

```txt
Hono / Cloudflare Worker
TypeScript
Supabase service client
```

Scope:

```txt
health endpoint
env validation
basic error format
API README
```

No AI yet.

## Task 2.3 — Supabase migration awal

Create initial migrations for:

```txt
profiles
projects
project_settings
story_foundations
characters
facts
relationship_speech_rules
ai_proposals
credit_balances
```

## Task 2.4 — Auth shell

Build:

```txt
register
login
logout
session guard
profile basic
```

Keep auth simple. It should support project ownership and secure data.

## Task 2.5 — Project persistence

Replace partial mock behavior with real data:

```txt
create project
list projects
active project
project detail
```

Affected pages:

```txt
/dashboard
/start
AppShell project card
```

## Task 2.6 — Settings persistence

Persist:

```txt
quality mode: Hemat / Seimbang / Terbaik
default language
HP/KBM format preference
default output style
target length default
```

No real model routing yet.

## Task 2.7 — Manual AI Proposal Queue foundation

Create API/data support for proposal workflow.

Fields:

```txt
proposal type
payload
status: proposed / accepted / rejected / merged
risk level
source
```

High-risk fact categories:

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

## Acceptance Sprint 2

```txt
user can log in
user can create project
project appears on dashboard
settings persist
foundation/characters/facts can be stored minimally
ai_proposals exists
important facts do not directly become canon
seed/dummy credit balance displays
```

---

# Sprint 3 — Intake, Concept, Foundation Real Flow

## Goal

Make the early story creation flow real:

```txt
Chat Story Agent
→ structured extraction
→ 3 concept options
→ selected concept
→ foundation proposal
→ readiness check
→ lock foundation
```

## Task 3.1 — Intake session persistence

Tables:

```txt
intake_sessions
intake_messages
detected_signals
```

## Task 3.2 — Model router skeleton

Backend service:

```txt
getWriterModel(tier)
getBackgroundModel(task)
getReasoningModel(task)
```

User-facing labels remain:

```txt
Hemat
Seimbang
Terbaik
```

Raw model IDs only live in backend config/env.

## Task 3.3 — Structured extraction from chat

AI reads intake and extracts:

```txt
genre
target reader
core conflict
protagonist candidate
reader promise
tone
secret candidates
style preference
```

Output goes to `ai_proposals`, not canon.

## Task 3.4 — Generate 3 concepts

AI generates three story concepts.

Acceptance:

```txt
3 concepts stored
user can choose one
chosen concept does not automatically lock foundation
```

## Task 3.5 — Generate Foundation Proposal

From selected concept, generate:

```txt
premise
reader promise
main character
important characters
conflict
locked fact proposals
secret proposals
speech rules
target length
ending direction
style rules
```

## Task 3.6 — Foundation Readiness Check

Readiness levels:

```txt
0–49%: belum siap
50–74%: bisa lanjut tapi berisiko
75–100%: siap dikunci
```

Required fields:

```txt
temporary title
main genre
target reader
premise
emotional promise
main character
main conflict
3 locked facts
target length
rough ending direction
secret schedule if twist exists
relationship speech rules
```

## Task 3.7 — Lock Foundation

User approval flow:

```txt
proposal → confirmed facts
foundation locked
```

## Acceptance Sprint 3

```txt
user can run real intake
AI can generate 3 concepts
user can select concept
foundation proposal is created
readiness is visible
foundation can be locked
important AI output does not directly become canon
```

---

# Sprint 4 — Planning Engine + KBM Outline

## Goal

Generate a 10-chapter outline that supports both consistency and KBM retention.

## Task 4.1 — Planning schema

Tables/objects:

```txt
seasons
mini_arcs
chapters
chapter_beats
reveals
breadcrumbs
open_loops
reader_promises
chapter_promises
mini_victories
```

## Task 4.2 — Target Length Planner

Target length options:

```txt
30–50 chapters
70–100 chapters
120–150 chapters
180+ chapters
Belum tahu, bantu sarankan
```

System derives:

```txt
season count
mini arc count
reveal distance
subplot density
mini victory cadence
open loop cadence
```

## Task 4.3 — Generate 10-Chapter Outline

Each chapter must include:

```txt
title
summary
fungsi bab
arah emosi
hook
chapter promise
open loop
mini victory/payoff plan
forbidden reveal
retention badge
```

## Task 4.4 — Basic Reveal Schedule

Reveal object:

```txt
truth
reveal target chapter
allowed breadcrumb chapter
forbidden before chapter
characters who know
```

## Task 4.5 — Manual outline edit

User can edit:

```txt
title
summary
hook
fungsi bab
badge
```

## Acceptance Sprint 4

```txt
outline 10 bab generated from locked foundation
each chapter has KBM function
chapter promise is visible
mini victory/open loop/reveal safety exist
outline can be edited
future reveal does not enter writer raw
```

---

# Sprint 5 — Safe Beat Writer MVP

This sprint is high risk. Split into small tasks.

## Goal

Generate prose per scene/beat with safety rails.

Key systems:

```txt
Beat Contract
Word Budget
Stop Condition
Context Packet
Reveal Gate
Character Knowledge
Prose Versioning
```

## Task 5.1 — Beat Contract schema

Each beat has:

```txt
beat goal
beat purpose
must include
must not include
emotional shift
allowed facts
forbidden facts
word target
stop condition
```

## Task 5.2 — Word Budget System

KBM defaults:

```txt
normal chapter: ±1.800 words
normal beat: ±500–900 words
```

Rule priority:

```txt
Stop Condition > Beat Contract > Reveal Safety > Word Target
```

AI must not add new events only to hit word target.

## Task 5.3 — Context Packet Builder basic

Build:

```txt
buildContextPacket(projectId, chapterId, beatId)
```

Includes:

```txt
current beat
known facts to reader
POV character knowledge
active character state
speech rules
previous accepted prose
allowed breadcrumb
forbidden reveal
word target
stop condition
mobile formatting rule
```

## Task 5.4 — Reveal Gate basic

Ensure:

```txt
writer does not receive hidden truth raw
writer only receives safe breadcrumb
forbidden reveal enters as explicit constraint
```

## Task 5.5 — Character Knowledge Gate basic

Prevent characters from knowing facts they have not learned.

Knowledge status:

```txt
unknown
suspects
partially_knows
misbelieves
knows
```

## Task 5.6 — Beat Writer service

Generate prose for one beat only.

Do not generate whole novel/chapter freely.

## Task 5.7 — Prose Versioning

Store:

```txt
version number
source: ai_generated / user_edited / repaired / accepted
model tier
context packet snapshot/hash
validation report
```

## Task 5.8 — Accept Prose

Only accepted prose can become the next writing source.

## Acceptance Sprint 5

```txt
user can generate one scene
writer does not see hidden future truth
writer follows stop condition
prose is stored as a version
user can accept prose
```

---

# Sprint 6 — Validator, Repair, Chapter Delta

## Goal

AI output must be checked, repaired if needed, and then converted into story-state changes.

## Task 6.1 — Instruction Compliance Validator

Check:

```txt
beat goal
must include
must not include
expected end state
stop condition
word target
```

## Task 6.2 — Spoiler / Reveal Validator

Check:

```txt
forbidden reveal does not appear
secret is not leaked
breadcrumb is not too explicit
```

## Task 6.3 — Character Knowledge Validator

Check:

```txt
POV does not know facts it should not know
dialogue does not reveal illegal information
antagonist does not react to info not yet received
```

## Task 6.4 — Mobile Readability Validator

Check:

```txt
short paragraphs
dialogue/narration balance
opening hook
ending hook
no excessive info dump
```

## Task 6.5 — Retention Validator Basic

Check:

```txt
chapter promise
open loop
mini victory
filler risk
suffering fatigue
protagonist agency
```

## Task 6.6 — Safe Repair Agent

Repair rules:

```txt
do not add canon facts
do not continue plot
do not change beat goal
do not reveal secrets
output revised prose only
```

## Task 6.7 — Chapter Delta Extractor

After chapter completion, extract:

```txt
intisari
fakta baru
perubahan pengetahuan tokoh
perubahan relasi
timeline event
open loop baru
open loop selesai
breadcrumb tertanam
mini victory
continuity warning
```

## Task 6.8 — Chapter Delta Approval

User approves:

```txt
chapter delta → canonical memory update
```

## Acceptance Sprint 6

```txt
validator runs
specific violations can be repaired
chapter delta is created
canon update happens only after approval
```

---

# Sprint 7 — Publish Package Production

## Goal

Generate Publish Package from accepted chapter, not mock data.

## Build

```txt
judul bab
teaser
sinopsis pendek
caption promosi
comment bait
tags
next chapter teaser
mobile preview
```

## Additional capabilities

```txt
copy per field
store publish package
regenerate selected field
export .txt/.md optional
```

## Acceptance

```txt
publish package generated from accepted prose
package can be stored
fields can be copied
caption/teaser can be regenerated without regenerating all
```

---

# Sprint 8 — Credit System & Cost Control

## Goal

Make AI usage measurable and safe.

## Build

```txt
credit ledger real
usage events
preflight estimate
model routing backend
deduct policy
refund on failure
cost per accepted output
```

## Initial policy

```txt
deduct when generation succeeds
limited internal repair may not incur extra charge
failed generation should not deduct arbitrarily
```

## Acceptance

```txt
credit decreases correctly
ledger is auditable
no double charge
user sees estimate before generation
```

---

# Sprint 9 — Creator Mode & Advanced Story Control

## Goal

Give serious writers deeper control without making beginner flow complicated.

## Build

```txt
Story Bible editor
Locked Facts editor
Character Knowledge editor
Reveal Schedule editor
Open Loop editor
Reader Promise tracker
Manual override with warning
```

## Acceptance

```txt
advanced users can edit story structure
beginner users do not see technical complexity by default
```

---

# Sprint 10 — Draft Import & Legacy Continuation

## Goal

Support writers who already have drafts.

## Build

```txt
paste/upload draft
extract characters
extract facts
extract timeline
extract style
detect plot holes
generate continuation options
proposal approval
```

Rule:

```txt
imported facts are proposals first, not canon automatically
```

## Acceptance

```txt
draft can be analyzed
story data can be extracted
plot holes can be identified
continuation options can be generated
user approves extracted facts before canon
```

---

# Sprint 11 — Voice Learning & Rewrite Tools

## Goal

Preserve author voice and reduce generic AI prose.

## Build

```txt
accepted prose style profile
revision memory
character voice cards
speech pattern learning
canon-safe rewrite
dialogue polish
mobile rewrite
cliffhanger enhancer
```

## Acceptance

```txt
AI does not normalize writing into generic prose
rewrite does not change facts/reveals
```

---

# Sprint 12 — Analytics & Growth Layer

## Goal

Help founder and users understand product, quality, and cost performance.

## Build

```txt
project_created
foundation_locked
outline_generated
beat_generated
prose_accepted
chapter_closed
publish_package_generated
validation_blocking
retention_warning
model usage
AI cost estimate
```

Optional later:

```txt
cover prompt generator
title optimizer
reader feedback loop
series dashboard
multi-project workspace
team/collab
```

---

# MVP Acceptance Benchmark

The MVP is not “many features”. The MVP is this proof:

```txt
Can produce a 20–30 chapter KBM-style serial drama
with 1 major reveal around chapters 20–25,
without leaking the reveal before time,
without characters knowing facts they have not learned,
without the protagonist losing endlessly without mini victories,
with mobile-readable formatting,
and with Publish Package per chapter.
```

## Internal benchmark structure

```txt
Chapters 1–10:
light breadcrumbs, early conflict, clear reader promise.

Chapters 11–20:
suspicion increases, mini victories appear, open loops grow stronger.

Chapters 21–24:
clues get closer, but confirmation is still withheld.

Chapter 25:
major reveal is explicit.

Chapters 26–30:
reveal consequence, emotional payoff, new conflict direction.
```

---

# Nearest Priority Order

```txt
1. Task 1.17 — Visual Polish After Manual Review
2. Sprint 1.5 — Legacy Audit + Problem Coverage Matrix
3. Sprint 2 — Data Model & Project Foundation
4. Sprint 3 — Intake + Concept + Foundation real
5. Sprint 4 — Planning + KBM Outline
6. Sprint 5 — Safe Beat Writer MVP
```

Do not start these too early:

```txt
OpenRouter production full usage
real prose generation
real credit deduction
draft import
advanced control panel
voice learning
```

The safety rails must come first.

