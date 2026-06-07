# VibeNovel Agent Rule — Core Architecture

VibeNovel must be built as an AI Serial Fiction Production OS.

Core pipeline:

```txt
Story Intake
→ Structured Extraction
→ Story Foundation / Canonical State
→ Planning
→ Reveal Gate + Character Knowledge
→ Context Packet
→ Beat Writer
→ Validator / Repair
→ User Accept/Edit
→ Chapter Delta
→ Canonical State Update
```

Do not replace this with a generic chat-to-text flow.

Non-negotiable rules:

- AI is not the source of truth.
- Canonical Story State is the source of truth.
- AI output is proposal until accepted.
- Future outline must not be passed raw to writer.
- Context Packet Builder is the only context path to writer.
- Chapter Delta updates story state after chapter close.
