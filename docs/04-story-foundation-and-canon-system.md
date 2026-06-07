# 04 — Story Foundation and Canon System

## Purpose

Fondasi Cerita adalah sumber kebenaran awal sebelum AI menulis bab. Tanpa fondasi ini, AI akan mengarang bebas dan cerita panjang akan cepat rusak.

## User-facing sections

- Tentang cerita
- Janji cerita ke pembaca
- Tokoh utama
- Tokoh penting
- Konflik utama
- Fakta yang dikunci
- Rahasia besar
- Batasan cerita
- Gaya cerita

## Canonical Story State

Sistem harus menyimpan:

- premise,
- genre,
- target reader,
- tone,
- story promise,
- characters,
- locked facts,
- relationships,
- world rules,
- reveals,
- open loops,
- timeline,
- accepted prose.

## Fact policy

Fakta penting tidak boleh dibuat diam-diam oleh AI writer. Fakta berikut harus masuk proposal/approval sebelum menjadi canon:

- hubungan keluarga,
- kehamilan/anak,
- kematian,
- identitas rahasia,
- pengkhianatan besar,
- world rule,
- benda penting,
- motif antagonis,
- event timeline besar,
- perubahan relasi besar.

## Basic schema concept

```ts
Fact {
  id: string
  projectId: string
  text: string
  category: 'identity' | 'relationship' | 'family' | 'event' | 'secret' | 'motive' | 'location' | 'item' | 'world_rule' | 'timeline' | 'status' | 'promise'
  canonStatus: 'confirmed' | 'proposed' | 'rejected' | 'deprecated' | 'contradicted'
  source: 'user' | 'story_bible' | 'outline' | 'chapter_delta' | 'ai_proposal' | 'imported_draft'
  importance: 'minor' | 'major' | 'core'
}
```

## Acceptance criteria

- User bisa melihat Fondasi Cerita dalam bahasa sederhana.
- Fakta penting bisa dikunci.
- AI proposal tidak otomatis menjadi fakta resmi.
- Story Foundation menjadi input utama untuk outline dan context packet.
