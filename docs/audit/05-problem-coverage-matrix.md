# 05 - Problem Coverage Matrix

## AI writing problem clusters

| Problem cluster | Product problem | Current feature coverage | Status | Enough? | Target sprint | Acceptance criteria |
|---|---|---|---|---|---|---|
| Ide mentah tidak jelas | User tidak tahu mulai dari mana | Intake chat, detected signals, concepts | Partial | Belum, karena auth E2E gagal | Stabilization | User chat -> signals -> 3 concepts tanpa 401. |
| Konsep terlalu generik | AI menghasilkan template | Real concept generator path in `concept.ts`; prompt forbids Nadira/Arman/Siska | Partial | Belum cukup | Stabilization/10.31b | Dua ide berbeda menghasilkan konsep berbeda dan spesifik. |
| Canon drift | Fakta berubah-ubah | Facts, characters, AI proposals, canon promotion | Implemented | Cukup untuk MVP | Hardening | Semua perubahan canon lewat approval. |
| Future spoiler leak | Twist muncul terlalu cepat | Planned reveals, context packet, reveal gate | Partial/Implemented | Perlu output validator | Hardening | Prompt/output bebas planning truth dan future summaries. |
| Character knowledge mismatch | Tokoh tahu hal yang belum ia tahu | Character safe summary partial | Partial | Tidak cukup | Hardening | POV knowledge filtered per chapter/character. |
| Outline datar | Bab tidak punya hook/arc | Outline 10 bab, markers, hooks, mini victory fields | Partial | Belum jika generator masih stub | 10.31b | Outline real dari locked foundation berisi hook/ending/mini victory. |
| Filler | Bab tidak menggerakkan cerita | Chapter function, purpose, retention markers | Partial | Perlu validator | Hardening | Validator menandai filler/no agency. |
| Open loop lupa dibayar | Janji pembaca hilang | `open_loops`, planned reveals | Partial/Implemented | Perlu payoff scheduler | Future | Loop punya opened/payoff dan status dipantau. |
| Ending bab lemah | Unlock turun | `endingHook`, publish teaser/caption | Partial | Perlu scoring | Future | Setiap bab punya ending hook yang dievaluasi. |
| Format HP sulit dibaca | Paragraf terlalu panjang | Mobile layout, publish package, planned mobile format | Partial | Perlu readability validator | Hardening/Future | Output memenuhi batas paragraf/dialogue/readability. |
| Output AI langsung dianggap benar | User menerima tanpa review | Prose versioning, proposal queue, summary/delta | Partial | Perlu validation report | Hardening | Output AI divalidasi dan user approve perubahan canon. |
| Biaya AI tidak terkendali | Kredit habis/biaya provider naik | Credit ledger, fixed cost display | Partial | Perlu cap/rate limit | Hardening | Ada daily cap/cooldown dan estimate sebelum action. |

## KBM/mobile serial problems

| Masalah KBM | Fitur yang menjawab | Current status | Gap |
|---|---|---|---|
| Pembaca berhenti unlock | Hook, ending hook, reader promise, publish copy | Partial | Belum ada unlockability score. |
| Tokoh utama ditindas terus | Mini victory marker | Partial | Belum ada suffering fatigue detector. |
| Konflik datar | Chapter function/emotion markers | Partial | Belum ada conflict escalation validator. |
| Open loop tidak payoff | `open_loops`, `planned_reveals` | Partial | Payoff scheduler belum eksplisit. |
| Bab terasa filler | Purpose, mini victory, summary delta | Partial | Perlu retention/filler validator. |
| Mobile tidak enak dibaca | Writer mobile layout, publish package | Partial | Perlu mobile readability validator. |
| Teaser/caption/tag kurang kuat | Publish package + publish copy AI | Implemented | Perlu E2E API-mode stabil. |

## Persona coverage

| Persona | Supported? | Evidence | Gap |
|---|---|---|---|
| User 0 writing skill | Partial | Guided start/intake/concepts/foundation UI | Auth and real generation must work reliably. |
| User punya ide kasar | Partial/Implemented | Intake -> concept generator | E2E blocked by token. |
| User sudah punya draft | Not started | No draft import route | Need future Draft Import sprint. |
| Advanced writer | Partial | Quality mode, API settings, outline/reveal data | Full Creator Mode not built. |
| Repair-only user | Partial | Rewrite prose exists | Safe Repair agent not validator-driven. |

## Kesimpulan coverage

Core long-fiction governance exists, but coverage is strongest for planned/project flow and weakest for existing draft, advanced control, validator/repair, and retention scoring.
