# packages/core — Story & AI Engine (Placeholder)

## Fungsi folder ini

Shared **domain engine** VibeNovel — logika inti yang tidak boleh hidup di UI atau tersebar di route API:

- Canonical Story State
- Context Packet builder
- Reveal Gate resolver
- Validator (instruction, spoiler, canon)
- Chapter Delta extraction
- Beat/planning contracts
- Model routing boundaries (bukan UI)

Engine ini dipanggil dari `apps/api`, bukan dari `apps/web`.

## Status saat ini

**Belum diimplementasikan.** Placeholder monorepo.

Sprint 1 hanya frontend parity dengan dummy data di `apps/web/src/mocks/`.

## Kapan akan dipakai

| Fase | Modul |
|---|---|
| Sprint 4 | Outline & beat contract services |
| Sprint 5 | Context Packet, Reveal Gate, prose writer boundary |
| Sprint 6 | Chapter Delta, canon update |
| Full | RAG, advanced memory, retention judge |

Lihat `docs/07-context-packet-and-ai-writing-workflow.md`, `docs/06-reveal-gate-and-future-leak-prevention.md`, `docs/09-validator-qa-and-auto-repair-system.md`.

## Larangan untuk agent / developer

Jangan:

- menaruh prompt/AI logic langsung di komponen React
- membuat engine palsu yang mengembalikan data random tanpa typed contract
- menggabungkan schema DB + prompt + validator dalam satu PR besar
- melanggar aturan: *Planner boleh tahu masa depan; Writer tidak boleh menerima masa depan mentah*

Tunggu sprint plan yang relevan sebelum implementasi engine.