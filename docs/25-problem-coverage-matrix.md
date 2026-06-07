# VibeNovel — Problem Coverage Matrix

Status: Sprint 1.5 Documentation  
Purpose: Ensure the rebuilt VibeNovel directly addresses the 12 AI writing problem clusters and the specific problems of KBM/mobile serial writers.

---

## 1. Coverage Principle

VibeNovel Core v2 must not be judged by feature count. It must be judged by whether it solves the real problems that caused AI novel writing workflows to fail.

Core benchmark:

```txt
Can produce a 20–30 chapter KBM-style serial drama
with 1 major reveal around chapters 20–25,
without leaking the reveal before time,
without characters knowing facts they have not learned,
without the protagonist losing endlessly without mini victories,
with mobile-readable formatting,
and with Publish Package per chapter.
```

---

# 2. AI Writing Problem Coverage

## 2.1 AI lupa konteks dan detail cerita

| Field | Coverage |
|---|---|
| Problem | AI forgets story details, timeline, character facts, and prior events. |
| New VibeNovel response | Canonical Story State, Fact Registry, Character State, Timeline, Chapter Delta, Accepted Prose Versioning. |
| Legacy reference | Character State, chapter summaries, state tracker, RAG/context services. |
| Sprint target | Sprint 2, 5, 6. |
| Acceptance criteria | Important facts are stored as objects; chapter close creates Chapter Delta; future generation uses accepted state, not model memory. |
| Risk | If RAG/raw summaries become source of truth, continuity will still fail. |

## 2.2 AI tidak konsisten menjaga karakter

| Field | Coverage |
|---|---|
| Problem | Characters change personality, knowledge, speech style, or relationship logic. |
| New VibeNovel response | Character State Engine, Character Knowledge Engine, Relationship State, Speech Rules, Character Voice Cards. |
| Legacy reference | character_states, Voice DNA ideas. |
| Sprint target | Sprint 2, 5, 6, 11. |
| Acceptance criteria | Character knowledge status is explicit; writer cannot make a character know facts not learned; speech rules apply during writing. |
| Risk | If character data remains plain description, AI will drift in long serials. |

## 2.3 AI membocorkan twist / masa depan cerita terlalu cepat

| Field | Coverage |
|---|---|
| Problem | AI reveals future twists, hidden truths, or later plot points before the target chapter. |
| New VibeNovel response | Reveal Gate, Breadcrumb Compiler, Future Context Firewall, Forbidden Reveals, Spoiler Validator. |
| Legacy reference | Mystery Layer, chapter protection ideas. |
| Sprint target | Sprint 4, 5, 6. |
| Acceptance criteria | Writer receives safe breadcrumb only; hidden truth is not included raw; forbidden reveal validator blocks early leakage. |
| Risk | If future outline is included raw in writer prompt, leakage will return. |

## 2.4 AI mengabaikan outline, beat, atau instruksi

| Field | Coverage |
|---|---|
| Problem | AI skips required beat, changes scene goal, ignores must-include/must-not-include. |
| New VibeNovel response | Beat Contract, Stop Condition, Instruction Compliance Validator, Safe Repair. |
| Legacy reference | Beat writer, story contract validator. |
| Sprint target | Sprint 5, 6. |
| Acceptance criteria | Each beat has goal, must include, must not include, expected end state; validator checks compliance. |
| Risk | If generation is chapter-level/freeform, instruction drift increases. |

## 2.5 AI menghasilkan prose generic / AI-ish

| Field | Coverage |
|---|---|
| Problem | Output sounds bland, overly polished, generic, or recognizably AI-written. |
| New VibeNovel response | Literary Quality Engine, Author Voice Preservation, Accepted Prose as style source, Revision Memory, Character Speech Rules. |
| Legacy reference | Voice DNA, Mimicry Engine, rewrite prompts. |
| Sprint target | Sprint 6, 11. |
| Acceptance criteria | Rewrite tools preserve canon and voice; accepted prose influences future style; cliché/exposition warnings exist. |
| Risk | If polish only makes text “neater”, it may erase the author’s voice. |

## 2.6 AI terlalu banyak exposition dan klise

| Field | Coverage |
|---|---|
| Problem | AI over-explains, repeats emotional statements, uses clichés, or produces info dumps. |
| New VibeNovel response | Literary Quality Validator, Mobile Readability Validator, Show-don’t-tell checks, Dialogue/Narration Balance. |
| Legacy reference | Plot radar, rewrite services, quality heuristics. |
| Sprint target | Sprint 6, 11. |
| Acceptance criteria | Validator flags info dump, too-long paragraphs, weak dialogue rhythm, and cliché-heavy prose. |
| Risk | If quality checks are not separated from canon checks, repairs may accidentally change story facts. |

## 2.7 AI sulit menjaga voice penulis

| Field | Coverage |
|---|---|
| Problem | AI normalizes the author’s style and makes every story sound similar. |
| New VibeNovel response | Accepted Prose Versioning, Revision Memory, Author Voice Profile, Character Voice Cards, Voice-Safe Rewrite. |
| Legacy reference | Voice DNA, Mimicry Engine. |
| Sprint target | Sprint 5, 11. |
| Acceptance criteria | User edits are learned as style preferences; rewrite does not mutate facts/reveals. |
| Risk | Voice learning too early can add complexity before safe canon pipeline exists. |

## 2.8 AI bagus untuk brainstorming, tapi lemah untuk produksi naskah panjang

| Field | Coverage |
|---|---|
| Problem | AI can generate ideas but fails in long serial production. |
| New VibeNovel response | Full production pipeline: Story Intake → Foundation → Planning → Beat Contract → Context Packet → Beat Writer → Validator → Chapter Delta. |
| Legacy reference | Story Compass, Outline Engine, Beat Writer, Chapter Summary. |
| Sprint target | Sprint 3–6. |
| Acceptance criteria | A user can produce multiple chapters without reveal leakage, character knowledge errors, or lost state. |
| Risk | If product stops at idea/outline generation, it remains a brainstorming tool, not a production OS. |

## 2.9 Platform khusus tetap butuh banyak editing manual

| Field | Coverage |
|---|---|
| Problem | Specialized writing tools still leave the user doing too much repair, continuity checking, and publish preparation. |
| New VibeNovel response | Guided workflow, validator suite, safe repair, publish readiness, publish package generation. |
| Legacy reference | Story contract validator, rewrite tools, publish helper. |
| Sprint target | Sprint 6, 7. |
| Acceptance criteria | The system identifies specific issues and can repair them without changing canon. Publish package is generated from accepted prose. |
| Risk | VibeNovel must not promise “no edit”; it should reduce blind manual editing. |

## 2.10 Workflow terlalu teknis atau terlalu banyak setting

| Field | Coverage |
|---|---|
| Problem | Users get overwhelmed by prompts, models, tokens, settings, POV, arc terminology, and writing jargon. |
| New VibeNovel response | Beginner Mode, plain-language UI, progressive control, no BYOK, user-facing Hemat/Seimbang/Terbaik. |
| Legacy reference | Onboarding modes, Story Compass UX. |
| Sprint target | Sprint 1, 3, 9. |
| Acceptance criteria | Beginner user can start by chatting; advanced controls are opt-in; raw model IDs do not appear in normal UI. |
| Risk | If advanced settings appear too early, 0-writing-skill users will churn. |

## 2.11 Biaya dan token menjadi hambatan

| Field | Coverage |
|---|---|
| Problem | Long serial generation can become expensive and unpredictable. |
| New VibeNovel response | Backend model routing, credit estimate, credit ledger, repair-first policy, cost per accepted output. |
| Legacy reference | Provider/model routing ideas only; BYOK dropped. |
| Sprint target | Sprint 3, 8. |
| Acceptance criteria | User sees estimate; ledger is auditable; failed generations do not arbitrarily deduct; model IDs remain backend config. |
| Risk | If model routing is uncontrolled, cost can spike before product-market fit. |

## 2.12 Writer merasa kehilangan kontrol kreatif

| Field | Coverage |
|---|---|
| Problem | User feels AI is taking over the story or changing intent without permission. |
| New VibeNovel response | AI Proposal Queue, user approval before lock, editable foundation/outline, manual prose edits, Creator Mode, Advanced Mode. |
| Legacy reference | Approval Cards, advanced controls. |
| Sprint target | Sprint 2, 3, 4, 9. |
| Acceptance criteria | Important AI suggestions are proposed, not automatically applied; user can accept/reject/merge. |
| Risk | If AI changes canon silently, trust will collapse. |

---

# 3. KBM / Mobile Serial Problem Coverage

## 3.1 Pembaca berhenti unlock

| Field | Coverage |
|---|---|
| Problem | Readers stop paying/unlocking because chapters do not create enough curiosity or reward. |
| New VibeNovel response | Reader Promise, Chapter Promise, Open Loop Tracker, Payoff Scheduler, Ending Hook Checker, Unlockability Score. |
| Legacy reference | KBM pacing, paywall advice, cliffhanger type. |
| Sprint target | Sprint 4, 6, 7. |
| Acceptance criteria | Each chapter has a promise, open loop, hook, and payoff/tease logic. |
| Risk | Consistent story alone is not enough; it must also create emotional momentum. |

## 3.2 Cerita terasa filler

| Field | Coverage |
|---|---|
| Problem | Chapters add words but do not move plot, emotion, relationship, secret, or conflict. |
| New VibeNovel response | Chapter Promise, Plot Movement Score, Filler Risk Detector, Beat Contract. |
| Legacy reference | Plot radar, KBM pacing. |
| Sprint target | Sprint 4, 6. |
| Acceptance criteria | Each chapter/beat has story function and expected end state. |
| Risk | Word target must not override stop condition or story function. |

## 3.3 Tokoh utama ditindas terus tanpa reward

| Field | Coverage |
|---|---|
| Problem | Readers get fatigued when protagonist only suffers without agency, clue, or small win. |
| New VibeNovel response | Mini Victory Scheduler, Suffering Fatigue Detector, Protagonist Agency Tracker. |
| Legacy reference | Emotional patterns, dopamine beat. |
| Sprint target | Sprint 4, 6. |
| Acceptance criteria | The system warns if several chapters pass without mini victory or agency gain. |
| Risk | Revenge/drama stories need suffering, but not endless helplessness. |

## 3.4 Konflik datar atau habis terlalu cepat

| Field | Coverage |
|---|---|
| Problem | The story runs out of conflict or repeats the same conflict too many times. |
| New VibeNovel response | Layered Conflict Engine, Target Length Planner, Season Plan, Mini Arc Plan, Open Loop Cadence. |
| Legacy reference | Season Architect, sub arcs, KBM pacing. |
| Sprint target | Sprint 4. |
| Acceptance criteria | Target length affects season count, subplot density, reveal distance, and mini victory cadence. |
| Risk | If outline is too short-sighted, the story may burn its main conflict too early. |

## 3.5 Open loop lupa dibayar

| Field | Coverage |
|---|---|
| Problem | Questions are opened but forgotten, or paid off too late/too early. |
| New VibeNovel response | Open Loop Tracker, Payoff Scheduler, Chapter Delta. |
| Legacy reference | Thread Tracker, plot threads. |
| Sprint target | Sprint 4, 6. |
| Acceptance criteria | Each open loop has openedAt, urgency, planned payoff, status. |
| Risk | Too many unresolved loops can confuse readers. |

## 3.6 Ending bab lemah

| Field | Coverage |
|---|---|
| Problem | Chapter endings fail to create the desire to continue. |
| New VibeNovel response | Ending Hook Checker, Retention Validator, Publish Package next chapter teaser. |
| Legacy reference | Cliffhanger type, paywall advice. |
| Sprint target | Sprint 6, 7. |
| Acceptance criteria | Validator flags weak ending; publish package includes next chapter teaser. |
| Risk | Overusing cliffhangers can feel manipulative; vary hook types. |

## 3.7 Reveal terlalu cepat

| Field | Coverage |
|---|---|
| Problem | Secrets/twists are exposed before they create enough curiosity. |
| New VibeNovel response | Reveal Gate, Breadcrumb Compiler, Reveal Schedule, Spoiler Validator. |
| Legacy reference | Mystery Layer. |
| Sprint target | Sprint 4–6. |
| Acceptance criteria | Reveal has target chapter, forbidden before chapter, allowed breadcrumb chapters. |
| Risk | Breadcrumb must hint without confirming truth. |

## 3.8 Format tidak enak dibaca di HP

| Field | Coverage |
|---|---|
| Problem | Paragraphs are too long, dialogue/narration rhythm is poor, and scroll experience is weak. |
| New VibeNovel response | KBM Mobile Readability Engine, paragraph length rule, dialogue density rule, mobile preview. |
| Legacy reference | KBM pacing/mobile style hints. |
| Sprint target | Sprint 6, 7. |
| Acceptance criteria | Validator checks paragraph length, dialogue/narration balance, mobile rhythm. |
| Risk | Desktop editor quality does not guarantee mobile reading quality. |

## 3.9 Penulis butuh teaser/caption/tag/comment bait

| Field | Coverage |
|---|---|
| Problem | Writers need publish assets, not just prose. |
| New VibeNovel response | Publish Package Generator. |
| Legacy reference | Publish helper/caption ideas. |
| Sprint target | Sprint 7. |
| Acceptance criteria | Package includes title, teaser, caption, tags, comment bait, next chapter teaser, mobile preview. |
| Risk | Do not claim automatic publishing unless real integration exists. |

## 3.10 Penulis pemula tidak tahu cerita mana yang bisa jalan panjang

| Field | Coverage |
|---|---|
| Problem | Beginners may choose concepts that cannot sustain a long serial. |
| New VibeNovel response | Chat Story Agent, 3 Concept Options, Target Length Planner, Foundation Readiness, Reader Promise hints. |
| Legacy reference | Story Compass, genre blueprints. |
| Sprint target | Sprint 3, 4. |
| Acceptance criteria | User gets 3 concepts and target-length-aware planning before outline. |
| Risk | Do not overclaim “market fit”; present as “kenapa pembaca bisa tertarik”. |

## 3.11 Biaya AI membengkak untuk serial panjang

| Field | Coverage |
|---|---|
| Problem | Long serials multiply AI calls and can become expensive. |
| New VibeNovel response | Model routing, context budget manager, repair-first, credit estimate, cost per accepted output. |
| Legacy reference | Provider routing ideas only. |
| Sprint target | Sprint 8. |
| Acceptance criteria | User sees estimates; system tracks accepted-output cost, not just generation count. |
| Risk | Advanced validators and repair can increase hidden costs if not routed carefully. |

---

# 4. MVP Acceptance Benchmark

The MVP must pass this test:

```txt
Create a 20–30 chapter KBM-style drama/revenge serial
with one major reveal in chapter 20–25.

Chapters 1–10:
- only light breadcrumbs,
- early conflict,
- clear reader promise,
- at least 2 mini victories.

Chapters 11–20:
- suspicion increases,
- open loops grow stronger,
- protagonist gains agency,
- no explicit reveal leak.

Chapters 21–24:
- clues get closer,
- confirmation is still withheld.

Chapter 25:
- major reveal is explicit.

Chapters 26–30:
- emotional consequence,
- payoff,
- new conflict direction.
```

MVP passes only if:

```txt
- reveal does not leak early,
- character knowledge remains logical,
- protagonist does not suffer endlessly without agency,
- chapters are mobile-readable,
- each chapter has a publish package,
- AI outputs important new facts as proposals first.
```

---

## 5. Final Coverage Decision

The new VibeNovel roadmap covers the 12 AI writing problem clusters and KBM serial problems only if the following features remain mandatory in MVP path:

```txt
AI Proposal Queue
Foundation Readiness
Target Length Planner
Relationship Speech Rules
Chapter Promise
Open Loop Tracker
Mini Victory Scheduler
Beat Contract
Word Budget + Stop Condition
Context Packet Builder
Reveal Gate
Character Knowledge Gate
Validator Suite
Chapter Delta
Publish Package
Credit Estimate
```

If any of these are removed, the product risks becoming another generic AI writing interface rather than a serial fiction production OS.
