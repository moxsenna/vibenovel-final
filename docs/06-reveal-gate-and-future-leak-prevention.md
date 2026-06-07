# 06 — Reveal Gate and Future Leak Prevention

## Purpose

Reveal Gate mencegah AI writer membocorkan twist atau fakta masa depan sebelum waktunya.

## Core rule

```txt
Planner may know the future.
Writer must not receive raw future truth.
```

## Reveal object

```ts
Reveal {
  id: string
  projectId: string
  truth: string
  revealChapter: number
  revealMode: 'explicit' | 'partial' | 'misdirection' | 'emotional' | 'visual'
  forbiddenBeforeChapter: number
  allowedBreadcrumbChapters: number[]
  charactersWhoKnowBeforeReveal: string[]
}
```

## Breadcrumb compiler

Future truth harus diterjemahkan menjadi breadcrumb aman.

Contoh:

```txt
Truth: Raka adalah anak kandung keluarga Wiratama.
Safe breadcrumb Bab 3: Raka merasa tidak nyaman saat melihat lukisan keluarga tua.
Forbidden before reveal: darah, anak hilang, warisan, pulang, keluarga kandung.
```

## Writer context must not include

- future chapters mentah,
- ending,
- full reveal schedule,
- hidden truth,
- antagonist master plan mentah,
- future relationship endpoint.

## Writer context may include

- current beat,
- known facts,
- POV knowledge,
- safe breadcrumb,
- forbidden reveal list,
- style rules,
- must include / must not include.

## MVP acceptance criteria

- Reveal chapter 10 tidak muncul sebagai allowed reveal di chapter 1–9.
- Raw hidden truth tidak pernah masuk Context Packet writer.
- Safe breadcrumb boleh muncul sebelum reveal.
- Validator bisa mendeteksi forbidden keyword/concept dasar.
