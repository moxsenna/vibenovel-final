# PRD_FULL.md

Status: Full product vision  
Relationship to MVP: This is not MVP scope. This document defines the complete VibeNovel product direction after MVP validation.

---

## 1. Product Vision

VibeNovel is an **AI Serial Fiction Production OS** for Indonesian mobile-first serial writers.

It helps writers create long-form serial fiction from idea to publish while protecting:

- canon consistency,
- character knowledge,
- reveal timing,
- mobile readability,
- author voice,
- reader retention,
- unlockability,
- AI cost efficiency.

VibeNovel is not a one-click book generator. It is a guided production system.

---

## 2. Product Positioning

### Primary Positioning
```txt
VibeNovel membantu penulis Indonesia membuat serial panjang yang konsisten, enak dibaca di HP, dan punya ritme cerita yang bikin pembaca ingin lanjut unlock.
```

### What VibeNovel Is
- AI-assisted serial fiction workspace.
- Story state manager.
- Long-form continuity guard.
- Beat-level prose generator.
- Retention and unlockability planner.
- Publish package assistant.

### What VibeNovel Is Not
- One-click full novel generator.
- Generic chatbot.
- BYOK prompt playground.
- Replacement for all human review.
- Guaranteed publish-ready without editing.

---

## 3. Target Personas

## Persona A — 0 Writing Skill Beginner
Pain:
- tidak tahu mulai dari mana,
- takut form panjang,
- tidak paham istilah writing,
- ingin diarahkan.

Needs:
- chat intake,
- 3 concept options,
- auto Story Bible,
- guided beat writing,
- simple warnings.

Full product features:
- Conversational Story Agent,
- guided onboarding,
- simple mode,
- one-click repair suggestions,
- publish checklist.

---

## Persona B — Idea Owner
Pain:
- punya ide kasar,
- cerita cepat habis,
- tidak tahu konflik panjang,
- bingung hook dan escalation.

Needs:
- idea expansion,
- market fit suggestions,
- season/mini arc planning,
- reveal schedule,
- retention rhythm.

---

## Persona C — Existing Draft Writer
Pain:
- draft berantakan,
- lore tidak tercatat,
- AI susah lanjut,
- perlu continuity repair.

Needs:
- import draft,
- extract Story Bible,
- extract timeline,
- detect plot holes,
- voice extraction,
- continuation outline.

---

## Persona D — Advanced Writer
Pain:
- ingin kontrol,
- tidak mau AI terlalu mengatur,
- ingin inspect prompt/context,
- ingin preserve voice,
- ingin lock facts.

Needs:
- Advanced Control Panel,
- Context Inspector,
- Manual Story Bible Editor,
- Reveal Schedule Editor,
- Validator Override,
- Pinned Context,
- Version History.

---

## Persona E — Repair-Only User
Pain:
- ingin memperbaiki bab,
- tidak butuh setup besar,
- ingin cek plot hole / dialog / cliffhanger.

Needs:
- Quick Audit,
- Mobile Rewrite,
- Dialogue Polish,
- Continuity Report,
- Cliffhanger Enhancer.

---

## 4. Full Product Modules

| Module | Description | MVP? | Full? |
|---|---|---:|---:|
| Story Intake Agent | Chat-based ideation and extraction | Basic | Full |
| Concept Options | 3 story directions | Basic | Full |
| Story Bible Engine | Structured story foundation | Basic | Full |
| Fact Registry | Canon/proposed fact tracking | Basic | Full |
| Character State Engine | Character emotional/physical/goal state | Basic | Full |
| Character Knowledge Engine | Who knows what and when | Basic | Full |
| Reveal Gate | Prevent future leak | Basic | Full |
| Breadcrumb Compiler | Convert future truth to safe hint | Partial | Full |
| Progressive Planner | Series/season/mini arc/chapter/beat | Partial | Full |
| Beat Writer | Safe prose generation | Basic | Full |
| Context Packet Builder | Safe context input | Basic | Full |
| Validator Layer | Continuity/spoiler/canon/style/retention | Basic | Full |
| Repair Agent | Fix specific violation | Partial | Full |
| Chapter Delta | Update story state | Basic | Full |
| Retention Engine | Reader promise/open loop/payoff/mini victory | Partial | Full |
| Author Voice Engine | Preserve user style | Later | Full |
| Import Draft | Extract story from existing draft | Later | Full |
| Advanced Control | Inspect/edit/override/pin context | Later | Full |
| Publish Package | Teaser/caption/title/tags | Basic | Full |
| Billing/Credits | Paid SaaS monetization | Later | Full |
| Analytics | Product + story quality analytics | Later | Full |

---

## 5. Full User Journeys

### Journey 1 — Beginner From Zero
```txt
Landing
→ Aku belum punya ide
→ Chat with Story Agent
→ 3 Concept Options
→ Choose concept
→ Auto Story Bible
→ Review and Lock Foundation
→ Season Direction
→ 10-Chapter Outline
→ Guided Beat Writer
→ Basic Validator
→ Accept/Edit
→ Chapter Delta
→ Publish Package
```

### Journey 2 — Existing Draft
```txt
Landing
→ Aku sudah punya draft
→ Paste/upload draft
→ Chunked extraction
→ Story Bible proposal
→ Character/timeline/fact extraction
→ Plot hole report
→ User approve canon
→ Continuation outline
→ Beat-level writing
```

### Journey 3 — Advanced Writer
```txt
Dashboard
→ Create/import project
→ Manual Story Bible
→ Manual Reveal Schedule
→ Advanced Context Inspector
→ Pinned Context
→ Beat Writer
→ Validator Report
→ Override/repair/polish
→ Version History
```

### Journey 4 — Retention Optimization
```txt
Chapter completed
→ Retention Judge
→ Open Loop check
→ Mini Victory check
→ Suffering Fatigue warning
→ Ending Hook repair
→ Publish package
```

---

## 6. Full Feature Requirements

## 6.1 Story Intake
- Conversational chat.
- Behind-the-scenes structured extraction.
- Progress indicator.
- 3 concept options.
- User confirmation before locking.

## 6.2 Story Bible
- Editable foundation.
- Lock/unlock with warning.
- Version history.
- Fact proposal and approval.

## 6.3 Planning
- Series plan.
- Season plan.
- Mini arc.
- Chapter outline.
- Beat contract.
- Progressive planning after every 5–10 chapters.

## 6.4 Writing
- Beat-level writer.
- Writer model tiers.
- Strict/creative/rewrite/repair modes.
- Accepted prose rule.
- Version comparison.

## 6.5 Validation
- Instruction compliance.
- Spoiler/reveal.
- Character knowledge.
- Canon accuracy.
- Continuity/timeline.
- Mobile readability.
- Literary quality.
- Retention/unlockability.
- Voice drift.

## 6.6 Retention
- Reader Promise.
- Chapter Promise.
- Open Loop Tracker.
- Payoff Scheduler.
- Layered Conflict.
- Mini Victory.
- Suffering Fatigue.
- Protagonist Agency.
- Unlockability Score.

## 6.7 Import Draft
- Paste/upload.
- Chunking.
- Extract characters/facts/timeline/style.
- Deduplicate.
- Confidence scoring.
- User approval.

## 6.8 Advanced Control
- Inspect context packet.
- Edit locked facts.
- Edit reveal schedule.
- Pin context.
- Override validator.
- See model/prompt version.
- Compare prose versions.

## 6.9 Billing
- Credit system.
- User tier costs.
- Usage log.
- Cost per accepted output.
- Refund/retry policy.
- Admin cost dashboard.

## 6.10 Analytics
- Activation events.
- Writing flow events.
- AI cost events.
- Quality warning events.
- Retention scores.
- Future: chapter performance import.

---

## 7. Full Product Success Metrics

### Product
- time to first Story Bible,
- time to first generated beat,
- project completion rate,
- chapters accepted per user,
- retention from chapter 1 to 5.

### AI Quality
- reveal leak rate,
- canon warning rate,
- accepted output rate,
- repair success rate,
- cost per accepted chapter.

### Business
- trial to paid conversion,
- credits consumed per active user,
- gross margin per generation,
- churn,
- refund rate.

### Story/Retention
- chapters with open loop,
- mini victory cadence,
- filler risk,
- mobile-readiness,
- unlockability trend.

---

## 8. Full Product Risks

| Risk | Mitigation |
|---|---|
| User expects one-click novel | marketing guardrails |
| AI leaks future twist | Reveal Gate + validators |
| Cost too high | model routing + credits |
| Beginner overwhelmed | progressive control |
| Advanced user feels limited | Advanced Mode |
| Poor prose quality | model benchmark + polish |
| Full feature conflicts | Feature Integration Rules |

---

## 9. Full Product Non-Goals

Even full product should not:
- guarantee no editing,
- guarantee commercial success,
- generate unrestricted copyrighted style imitation,
- expose user API keys as requirement,
- bypass user approval for canon-altering facts.

---

## 10. Full Roadmap Summary

```txt
MVP:
Prove safe beat writing.

Private Beta:
Harden auth/security + retention basics.

Creator Version:
Add better editing, voice, import draft.

Paid SaaS:
Billing, credits, analytics, cost controls.

Advanced Version:
Context inspector, full retention engine, deep debug, advanced controls.
```

---

## TODO
- TODO: finalize pricing and credits.
- TODO: define public launch legal/privacy docs.
- TODO: run model benchmark for Indonesian prose.
- TODO: validate KBM-specific reading format with real samples.
