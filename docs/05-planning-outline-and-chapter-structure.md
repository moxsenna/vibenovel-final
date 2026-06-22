# 05 — Planning, Outline, and Chapter Structure

## Progressive planning

Implementation status per 2026-06-15:

- Sudah ada `outline_plans`, `chapter_outlines`, dan `chapter_beats`.
- `outline_plans.season_label` masih field teks.
- Belum ada tabel `mini_arcs`.
- Mini Arc tetap target produk, tapi harus punya migration/service sendiri sebelum dianggap shipped.

Jangan generate 100–300 bab detail sekaligus.

Gunakan struktur:

```txt
Series Direction
→ Season Plan
→ Mini Arc
→ Chapter Outline
→ Beat/Adegan Contract
```

## MVP planning scope

MVP cukup:

- 1 story direction,
- 1 season starter,
- outline 10 bab pertama,
- 4–8 adegan per bab.

## Chapter outline should include

- nomor bab,
- judul kerja,
- pertanyaan bab,
- tujuan emosi,
- tujuan plot,
- POV,
- lokasi,
- allowed reveal/breadcrumb,
- forbidden facts,
- expected exit state,
- ending hook.

## Beat/Adegan Contract

Status implementasi saat ini memakai `chapter_beats`: `beat_number`, `title`, `summary`, `direction`, `status`, `emotional_shift`, `must_include`, `must_not_include`, `word_target`, `stop_condition`, dan `sort_order`. Struktur di bawah adalah target richer contract, bukan schema lengkap yang sudah ada.

```ts
BeatContract {
  chapterNumber: number
  beatNumber: number
  beatGoal: string
  beatPurpose: 'setup' | 'conflict' | 'reversal' | 'intimacy' | 'reveal' | 'misdirection' | 'decision' | 'cliffhanger'
  startState: string
  expectedEndState: string
  emotionalShift: string
  retentionFunction?: 'hook' | 'tension' | 'breadcrumb' | 'payoff' | 'reversal' | 'decision' | 'humiliation' | 'intimacy' | 'threat' | 'cliffhanger'
  mustInclude: string[]
  mustNotInclude: string[]
  allowedNewFacts: string[]
  forbiddenFutureEvents: string[]
  stopCondition: string
}
```

## User-facing language

- “Season” boleh disebut “Bagian Cerita”.
- “Mini Arc” boleh disebut “Rangkaian Konflik”.
- “Beat” disebut “Adegan”.

## Acceptance criteria

- Outline 10 bab bisa dibaca user awam.
- Tiap bab punya fungsi emosional dan plot.
- Tiap bab punya hook atau promise.
- AI writer tidak menulis di luar Beat Contract.
