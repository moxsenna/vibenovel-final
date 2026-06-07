# 03 — Unified Feature Blueprint

Dokumen ini menyatukan fitur MVP dan Full. Jangan membuat dokumen terpisah `MVP.md` dan `FULL.md`. Pemisahan hanya ada di roadmap.

## Core user-facing modules

1. Landing / Selamat Datang
2. Mulai Proyek Baru
3. Dashboard Penulis
4. Chat Story Agent
5. Pilihan Konsep Cerita
6. Fondasi Cerita
7. Outline Cerita
8. Ruang Tulis
9. Ringkasan Bab / Chapter Delta Preview
10. Paket Publish
11. Pengaturan Pemakaian
12. Advanced Control Panel later

## Core engines

1. Story Intake Agent
2. Story Foundation Engine
3. Canonical Story State
4. Fact Registry
5. Character State Engine
6. Character Knowledge Engine
7. Timeline Engine
8. Reveal Gate Engine
9. Breadcrumb Compiler
10. Planning Engine: Season → Mini Arc → Chapter → Beat
11. Context Packet Builder
12. Prose Writer Engine
13. Validators
14. Chapter Delta Extractor
15. Reader Retention Engine
16. Publish Package Generator
17. Cost-Aware Model Router

## Non-negotiable architecture rules

```txt
AI is not the source of truth.
Database/state is the source of truth.
AI output is proposal until accepted.
Writer must not receive hidden future truth.
Every accepted chapter must update state through Chapter Delta.
```

## MVP definition

MVP membuktikan:

```txt
Dari ide kasar → Fondasi Cerita → Outline 10 bab → Bab 1–5 per adegan → tidak bocor twist → mobile-friendly → ada hook unlock.
```

## Full definition

Full version memperluas MVP dengan:

- draft import yang matang,
- advanced control panel,
- full reveal editor,
- long-form memory/RAG,
- analytics feedback loop,
- deeper author voice learning,
- publish optimization,
- monetization tooling.
