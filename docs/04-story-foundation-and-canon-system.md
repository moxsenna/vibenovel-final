# 04 — Story Foundation and Canon System

## Purpose

Fondasi Cerita adalah sumber kebenaran awal sebelum AI menulis bab. Tanpa fondasi ini, AI akan mengarang bebas dan cerita panjang akan cepat rusak.

## Implementation status

Status per 2026-06-15: tabel `facts` hanya menyimpan canon yang sudah sah. Lifecycle calon perubahan AI ada di `ai_proposals`, bukan di `facts.canonStatus`.

- `facts.canon_status`: `confirmed` atau `deprecated`.
- `ai_proposals.status`: `proposed`, `accepted`, `rejected`, atau `merged`.
- Saat proposal diterima, service promotion dapat membuat/memperbarui entity canon dengan `source = accepted_proposal`.

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

Sistem yang sudah tersedia menyimpan:

- premise,
- genre,
- target reader,
- tone,
- story promise,
- characters,
- locked facts,
- relationships,
- world rules sebagai `facts`,
- reveals dan open loops lewat `planned_reveals` / `open_loops`,
- prose draft/current lewat `chapter_prose_versions` (bukan `facts`),
- AI proposal queue lewat `ai_proposals`.

Sistem final masih menargetkan:

- timeline,
- accepted prose sebagai chapter-level state yang jelas,
- character knowledge/state untuk continuity yang lebih halus.

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
  canonStatus: 'confirmed' | 'deprecated'
  source: 'user' | 'system' | 'accepted_proposal' | 'imported_draft'
  importance: 'minor' | 'major' | 'core'
  isLocked: boolean
  acceptedFromProposalId: string | null
}

AiProposal {
  id: string
  projectId: string
  proposalType: 'character' | 'fact' | 'relationship_speech_rule' | 'open_loop_update' | 'reveal_status_update' | 'character_update' | 'relationship_update'
  status: 'proposed' | 'accepted' | 'rejected' | 'merged'
  riskLevel: 'low' | 'medium' | 'high'
  payload: Record<string, unknown>
}
```

## Acceptance criteria

- User bisa melihat Fondasi Cerita dalam bahasa sederhana.
- Fakta penting bisa dikunci.
- AI proposal tidak otomatis menjadi fakta resmi.
- Story Foundation menjadi input utama untuk outline dan context packet.
