# QUALITY_SYSTEM.md

Status: MVP + future-ready  
Purpose: Define what “good output” means in VibeNovel.

---

## 1. Quality Definition

For VibeNovel, quality is not just beautiful prose.

Quality means:

```txt
consistent
+ canon-safe
+ character-logical
+ reveal-safe
+ instruction-compliant
+ mobile-friendly
+ emotionally engaging
+ retention-aware
```

---

## 2. MVP Quality Checks

### 2.1 Instruction Compliance
Checks whether output follows:

- beat goal,
- must include,
- must not include,
- word target,
- stop condition,
- expected end state.

### 2.2 Reveal Safety
Checks whether output reveals forbidden future truth.

MVP:
- deterministic phrase check,
- forbidden reveal list.

Future:
- semantic leak check,
- implied spoiler check.

### 2.3 Character Knowledge
Checks whether POV character knows, suspects, or does not know a fact.

MVP:
- basic known/unknown checks.

Future:
- full Character Knowledge Engine.

### 2.4 Canon Accuracy
Checks whether AI invented or contradicted major facts.

MVP:
- restricted invention warning.

Future:
- New Fact Candidate extractor,
- Fact Approval UI.

### 2.5 Mobile Readability
Checks:
- paragraph length,
- dialogue density,
- heavy exposition,
- ending hook.

MVP:
- paragraph length warning.

Future:
- full KBM Mobile Readability Score.

### 2.6 Retention Basic
Checks:
- ending hook exists,
- beat has tension,
- no obvious filler.

Future:
- Unlockability Score.

---

## 3. Output Readiness Labels

| Label | Meaning |
|---|---|
| Draft | generated but not checked |
| Needs Review | warnings exist |
| Needs Polish | structurally okay, prose weak |
| Mobile-Ready | format good for phone |
| Publish-Ready | accepted and passed core checks |

MVP may start with:
- Draft
- Warning
- Accepted

---

## 4. Blocking vs Warning

### Blocking
Cannot mark publish-ready:
- forbidden reveal leaked,
- POV knows impossible fact,
- mustNotInclude directly violated,
- text is not prose / contains AI explanation.

### Warning
Can be accepted by user:
- paragraph too long,
- hook weak,
- minor mustInclude unclear,
- possible style issue.

### Info
Suggestions only:
- could be more emotional,
- dialogue density low,
- ending could be sharper.

---

## 5. Quality Report Schema

```json
{
  "status": "draft|needs_review|needs_polish|mobile_ready|publish_ready",
  "passed": true,
  "scores": {
    "instruction": 0,
    "revealSafety": 0,
    "knowledge": 0,
    "canon": 0,
    "mobile": 0,
    "retention": 0
  },
  "issues": []
}
```

---

## 6. Future Quality Engines

### Literary Quality Engine
Detects:
- cliché,
- exposition,
- generic metaphors,
- unnatural dialogue,
- formulaic ending.

### Author Voice Preservation
Checks:
- diction,
- rhythm,
- POV,
- signature emotional style,
- accepted prose match.

### Canon Accuracy Engine
Detects:
- new family relationship,
- pregnancy/child,
- death,
- important object,
- secret,
- timeline event.

### Retention Judge
Detects:
- filler,
- weak hook,
- suffering fatigue,
- no mini victory,
- open loop stale.

---

## 7. Benchmark Quality Test

Benchmark story:
- drama rumah tangga,
- Siska is Arman's ex,
- reveal chapter 20,
- Nadira must not know before chapter 20.

MVP passes if:
- no explicit reveal before chapter 20,
- generated beats stay within beat goal,
- prose is mobile readable,
- chapter delta captures key changes.

---

## TODO
- TODO: implement scoring thresholds.
- TODO: add model benchmark results.
- TODO: add UI labels for each warning.
