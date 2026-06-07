# RETENTION_SYSTEM.md

Status: MVP basic + future-ready  
Purpose: Make VibeNovel stories not only consistent, but unlock-worthy for mobile serial readers.

---

## 1. Core Principle

Long serial quality is not only continuity.

It also needs:

```txt
curiosity
+ emotion
+ open loops
+ mini payoff
+ escalation
+ mini victory
+ strong chapter ending
```

---

## 2. Reader Promise

Reader Promise is the emotional/narrative reason readers start the story.

Example:

```txt
Istri yang diremehkan akhirnya bangkit dan membuat orang yang menyakitinya menyesal.
```

Store in Story Bible:

- core fantasy,
- emotional reward,
- curiosity engine,
- justice/romance/revenge promise,
- target reader.

---

## 3. Chapter Promise

Every chapter should answer:

1. Why does reader enter this chapter?
2. What emotional tension drives it?
3. What plot moves forward?
4. What reward does reader get?
5. What question makes reader continue?

MVP fields:
- chapter_goal,
- emotional_goal,
- ending_hook.

Future fields:
- entry_question,
- reader_reward,
- exit_question.

---

## 4. Open Loop Tracker

Open Loop = active question that drives curiosity.

Examples:
- Siapa Siska?
- Kenapa Arman panik?
- Apa isi pesan yang dihapus?

MVP table:
`open_loops`

Future:
- urgency,
- stale warning,
- payoff chapter,
- related reveal.

---

## 5. Payoff Scheduler

Readers need reward before they get tired.

Types:
- micro payoff,
- partial payoff,
- emotional payoff,
- reveal payoff,
- justice payoff,
- romance payoff.

Rule:

```txt
Delay without payoff = boredom.
Payoff without new complication = drop-off risk.
```

---

## 6. Mini Victory Scheduler

Mini victory prevents reader fatigue.

Mini victory examples:
- protagonist gets small evidence,
- protagonist stays calm,
- protagonist sets boundary,
- antagonist panics,
- ally appears,
- protagonist makes a decision.

MVP:
- store mini victories in Chapter Delta JSON.

Future:
- dedicated mini_victories table.

---

## 7. Layered Conflict

Conflict should be peeled like onion.

Example:

```txt
Layer 1: Arman is cold.
Layer 2: Siska appears.
Layer 3: Siska is part of Arman's past.
Layer 4: family knows.
Layer 5: money/power secret.
Layer 6: Nadira gains leverage.
```

MVP:
- represent via outline notes and retention_function.

Future:
- conflict_layers table.

---

## 8. Suffering Fatigue

Problem:
protagonist is oppressed for too many chapters without progress.

MVP warning:
If several recent chapters have pressure but no mini victory, show:

```txt
Tokoh utama terlalu lama ditekan tanpa kemenangan kecil.
Tambahkan bukti kecil, keputusan baru, atau antagonis mulai retak.
```

Future:
- suffering_fatigue_report.

---

## 9. Unlockability Score

Future scoring:

```json
{
  "openingHook": 0,
  "emotionalTension": 0,
  "plotMovement": 0,
  "openLoopStrength": 0,
  "payoff": 0,
  "cliffhanger": 0,
  "mobileReadability": 0,
  "fillerRisk": 0,
  "overall": 0
}
```

MVP:
- no numeric score required.
- simple warnings are enough.

---

## 10. Retention-aware Beat Contract

Add to beat:

```txt
retentionFunction:
hook | tension | breadcrumb | payoff | reversal | decision | humiliation | intimacy | threat | cliffhanger
```

MVP already includes `retention_function` field.

---

## 11. Publish Package Retention

Publish package should include:
- title,
- teaser,
- caption,
- comment bait,
- next chapter teaser,
- tags.

Goal:
make user ready to upload and promote chapter.

---

## 12. MVP Retention Checks

MVP should check:

- Does chapter/beat have emotional movement?
- Does ending have hook?
- Is there at least one open loop?
- Is protagonist too passive?
- Is there mini victory over several chapters?

These can start as simple heuristics and AI suggestions.

---

## TODO
- TODO: implement dedicated retention endpoint.
- TODO: add mini_victory table after MVP.
- TODO: define genre-specific retention patterns.
