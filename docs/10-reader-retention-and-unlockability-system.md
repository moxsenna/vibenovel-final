# 10 — Reader Retention and Unlockability System

## Purpose

VibeNovel tidak cukup menjaga cerita konsisten. Cerita juga harus membuat pembaca ingin unlock bab berikutnya.

## Reader Promise

Janji utama cerita. Contoh:

```txt
Istri yang diremehkan akan bangkit dan membuat orang yang menyakitinya menyesal.
```

## Chapter Promise

Setiap bab harus punya:

- entry hook,
- emotional question,
- plot movement,
- reader reward,
- exit question.

## Open Loop Tracker

Melacak pertanyaan aktif:

- dibuka kapan,
- urgency,
- payoff target,
- status stale atau tidak.

## Mini Victory Scheduler

Tokoh utama tidak boleh kalah terus. Mini victory bisa berupa:

- bukti kecil,
- boundary set,
- antagonis panik,
- sekutu baru,
- keputusan berani,
- clue penting,
- pembaca merasa “akhirnya ada progres”.

## Suffering Fatigue Detector

Warning jika dalam beberapa bab tokoh utama hanya ditindas tanpa agency/reward.

## Unlockability Score

```ts
UnlockabilityScore {
  openingHookScore: number
  emotionalTensionScore: number
  plotMovementScore: number
  openLoopStrengthScore: number
  payoffScore: number
  cliffhangerScore: number
  mobileReadabilityScore: number
  fillerRiskScore: number
  overall: number
}
```

## MVP acceptance criteria

- Outline bab punya tag hook/reward/cliffhanger.
- Ringkasan bab menampilkan mini victory atau warning.
- Paket Publish memakai teaser dan comment bait.
