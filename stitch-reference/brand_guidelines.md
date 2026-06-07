# BRAND_GUIDELINES.md

Status: Brand direction for MVP and full product  
Audience: Founder, AI coding agents, designer, future developer  
Product: VibeNovel

---

## 1. Brand Essence

VibeNovel adalah workspace AI untuk membantu penulis Indonesia membuat serial panjang yang konsisten, nyaman ditulis, enak dibaca di HP, dan punya potensi membuat pembaca lanjut unlock.

Brand harus terasa:

```txt
hangat
profesional
modern
tenang
percaya diri
membimbing
tidak menggurui
tidak norak
tidak terlalu techy
```

VibeNovel bukan aplikasi “AI robot futuristik” yang dingin. VibeNovel harus terasa seperti **teman kerja kreatif yang rapi, sabar, dan pintar**.

---

## 2. Target Audience Visual Context

Target user awal:
- mayoritas perempuan dewasa / emak-emak,
- pembaca/penulis serial dari HP,
- ingin menulis cerita yang emosional dan komersial,
- tidak semuanya paham istilah teknis writing/AI,
- butuh rasa aman dan diarahkan,
- sensitif terhadap UI yang terlalu ribet atau norak.

Visual harus menghindari:
- neon berlebihan,
- gradient terlalu ramai,
- efek AI futuristik berlebihan,
- kartun kekanak-kanakan,
- warna terlalu mencolok,
- dashboard yang terasa seperti developer tool.

Visual harus mendekati:
- premium soft workspace,
- modern editorial,
- aplikasi produktivitas kreatif,
- calming writing studio,
- mobile-first serial fiction workspace.

---

## 3. Brand Personality

| Trait | Meaning |
|---|---|
| Warm | terasa dekat dan manusiawi |
| Clear | tidak membingungkan |
| Professional | layak untuk produk SaaS serius |
| Creative | tetap punya rasa cerita |
| Supportive | membantu user pemula tanpa merendahkan |
| Structured | cerita terasa tertata |
| Calm | tidak membuat user panik dengan banyak istilah |

---

## 4. Voice and Tone

### Main Tone
```txt
hangat, jelas, praktis, tidak sok pintar
```

### Do
- Gunakan bahasa Indonesia yang natural.
- Jelaskan istilah teknis dengan bahasa sederhana.
- Beri arahan yang menenangkan.
- Gunakan kalimat pendek untuk instruksi UI.
- Fokus ke manfaat user.

### Don't
- Jangan terlalu formal seperti dokumen hukum.
- Jangan terlalu alay.
- Jangan terlalu banyak istilah AI.
- Jangan pakai copy yang overpromise.
- Jangan bilang “AI akan menulis novel sempurna”.

---

## 5. Messaging Pillars

### Pillar 1 — Cerita tetap nyambung
```txt
Bantu menjaga fakta, karakter, dan rahasia cerita agar tidak nabrak.
```

### Pillar 2 — Menulis jadi lebih terarah
```txt
Dari ide mentah sampai outline dan bab, user tidak dibiarkan bingung.
```

### Pillar 3 — Cocok untuk serial mobile
```txt
Format dan ritme cerita diarahkan agar nyaman dibaca dari HP.
```

### Pillar 4 — Bantu pembaca lanjut unlock
```txt
Bukan cuma menulis bab, tapi menjaga hook, open loop, dan mini victory.
```

### Pillar 5 — AI tetap terkendali
```txt
AI membantu, tapi fondasi cerita tetap dikunci dan dicek.
```

---

## 6. Brand Tagline Options

Use later for landing/marketing.

```txt
Menulis serial panjang jadi lebih terarah.
```

```txt
Dari ide sampai bab siap publish, dengan cerita yang tetap nyambung.
```

```txt
AI writing workspace untuk serial mobile Indonesia.
```

```txt
Bantu tulis, jaga alur, siapkan publish.
```

Avoid:
```txt
Novel jadi otomatis sekali klik.
```

---

## 7. Visual Direction

### Overall Look
```txt
soft premium editorial
modern creative SaaS
calm writing workspace
mobile-first
```

### Visual Keywords
- warm ivory
- soft blush
- muted rose
- deep plum
- gentle lavender
- slate text
- rounded cards
- subtle shadows
- spacious layout
- readable typography

### Avoid
- hot pink overload,
- neon cyan/purple AI look,
- dark hacker dashboard,
- childish pastel overload,
- too many gradients,
- heavy glassmorphism,
- comic/cartoon visuals.

---

## 8. Color Palette

### Primary Palette

| Token | Color | Use |
|---|---|---|
| `--color-primary` | `#9F4F68` | main buttons, active states |
| `--color-primary-dark` | `#7A334C` | hover/pressed |
| `--color-primary-soft` | `#F6E7EC` | soft background |
| `--color-accent` | `#8B6FAD` | secondary accent |
| `--color-accent-soft` | `#EFE9F7` | panels/badges |
| `--color-success` | `#4F8A6B` | success status |
| `--color-warning` | `#B7791F` | warning |
| `--color-danger` | `#B94A48` | blocking/error |
| `--color-ink` | `#1F2933` | main text |
| `--color-muted` | `#6B7280` | secondary text |
| `--color-border` | `#E6DDE2` | borders |
| `--color-surface` | `#FFFFFF` | cards |
| `--color-background` | `#FBF8F6` | app background |

### Why This Palette
- Warm enough for target audience.
- Professional enough for SaaS.
- Feminine without being childish.
- Softer than bright pink.
- Readable on mobile.

### Color Usage Rules
- Primary color should be used sparingly.
- Background should stay calm.
- Use warning/danger only for actual issues.
- Avoid more than 2 accent colors per screen.
- Do not use saturated neon gradients.

---

## 9. Typography

### Recommended Font Stack

```css
font-family:
  Inter,
  "Nunito Sans",
  "Source Sans 3",
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

### Tone
- Sans-serif modern.
- Friendly but professional.
- Avoid overly decorative fonts.

### Type Scale

| Token | Size | Use |
|---|---:|---|
| `text-xs` | 12px | labels, helper text |
| `text-sm` | 14px | secondary UI |
| `text-base` | 16px | body |
| `text-lg` | 18px | section title |
| `text-xl` | 20px | card title |
| `text-2xl` | 24px | page title |
| `text-3xl` | 32px | hero title |

### Writing Editor Text
For prose editor:
```css
font-size: 17px;
line-height: 1.8;
```

Reason:
- comfortable for mobile reading,
- not too dense,
- matches serial reading style.

---

## 10. Icon and Illustration Style

### Icons
- Use line icons.
- Rounded corners.
- Medium stroke.
- No overly playful emoji-heavy UI.

### Illustrations
If needed:
- soft editorial illustration,
- women writing/reading from phone,
- desk/laptop/coffee but not cliché,
- subtle book/story elements.

Avoid:
- robot mascots as main identity,
- exaggerated AI brain graphics,
- childish cartoon characters,
- stock photo that feels fake.

---

## 11. UI Shape Language

| Element | Style |
|---|---|
| Cards | rounded 20–24px |
| Buttons | rounded 12–999px depending use |
| Inputs | rounded 14–16px |
| Panels | soft border + subtle shadow |
| Modal | clean, spacious |
| Status badges | pill-shaped |
| Editor | calm, paper-like surface |

---

## 12. Brand Voice Examples

### Good
```txt
Aku sudah punya cukup bahan untuk membuat fondasi cerita kamu.
```

```txt
Rahasia cerita ini sebaiknya belum dibuka di bab ini.
```

```txt
Bab ini sudah cukup nyambung, tapi ending-nya bisa dibuat lebih menggoda pembaca.
```

```txt
Tokoh utama terlalu lama tertekan. Coba beri kemenangan kecil agar pembaca tetap merasa ada progres.
```

### Bad
```txt
Generating narrative continuity schema...
```

```txt
Your prompt violated hidden canonical ontology.
```

```txt
Novel otomatis publish-ready 100% tanpa edit!
```

```txt
Bikin novel viral cuma sekali klik!
```

---

## 13. Product Copy Rules

### Buttons
Use action-oriented plain labels:

```txt
Buat Fondasi Cerita
Lanjut Tulis Bab
Cek Cerita
Perbaiki Ending
Terima Versi Ini
Buat Paket Publish
```

Avoid:

```txt
Execute Agent
Compile Canon
Run LLM
```

### Warnings
Use calm explanation + suggested action.

Format:

```txt
Masalah:
Kenapa ini penting:
Saran:
```

Example:

```txt
Rahasia cerita mungkin terbuka terlalu cepat.

Pembaca seharusnya baru tahu hal ini di bab 20.
Saran: ubah bagian ini menjadi petunjuk kecil saja.
```

---

## 14. Brand Do/Don't

### Do
- Make UI feel calm and safe.
- Use whitespace.
- Use clear status labels.
- Use warm neutral colors.
- Use mobile preview.
- Keep AI complexity hidden by default.

### Don't
- Use dark sci-fi AI dashboard as default.
- Use too many bright pink gradients.
- Use all-caps shouting copy.
- Show token/model complexity to beginner.
- Make warnings scary.
- Make UI feel like developer tool.

---

## 15. Brand Compatibility With Full Features

Full features like Advanced Control, Context Inspector, and Prompt Studio should not change the brand into a technical IDE.

Beginner stays calm.

Advanced panels can be more technical, but still:
- readable,
- organized,
- plain language first,
- raw JSON hidden behind “Lihat detail teknis”.

---

## 16. TODO

- TODO: create logo direction.
- TODO: create landing page visual system.
- TODO: create app screenshots/mockups.
- TODO: benchmark color contrast in real UI.
