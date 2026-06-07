# DESIGN_SYSTEM.md

Status: MVP design system + future UI foundation  
Relationship to Brand: Implements `BRAND_GUIDELINES.md`.

---

## 1. Design System Goals

VibeNovel UI must be:

```txt
modern
soft
professional
mobile-friendly
not childish
not neon
not overly technical
```

The design system should help AI coding agents build consistent UI without inventing random styles.

---

## 2. Design Tokens

### Colors

```css
:root {
  --color-background: #FBF8F6;
  --color-surface: #FFFFFF;
  --color-surface-soft: #FFF7F8;

  --color-primary: #9F4F68;
  --color-primary-dark: #7A334C;
  --color-primary-soft: #F6E7EC;

  --color-accent: #8B6FAD;
  --color-accent-soft: #EFE9F7;

  --color-ink: #1F2933;
  --color-muted: #6B7280;
  --color-subtle: #9CA3AF;
  --color-border: #E6DDE2;

  --color-success: #4F8A6B;
  --color-success-soft: #E7F3EC;

  --color-warning: #B7791F;
  --color-warning-soft: #FFF4D8;

  --color-danger: #B94A48;
  --color-danger-soft: #FCE8E7;
}
```

### Spacing

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

### Radius

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-2xl: 24px;
--radius-pill: 999px;
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(31, 41, 51, 0.05);
--shadow-md: 0 8px 24px rgba(31, 41, 51, 0.08);
--shadow-lg: 0 20px 48px rgba(31, 41, 51, 0.10);
```

Do not use harsh black shadows.

---

## 3. Typography Tokens

```css
--font-sans: Inter, "Nunito Sans", "Source Sans 3", system-ui, sans-serif;

--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 32px;

--leading-tight: 1.2;
--leading-normal: 1.5;
--leading-relaxed: 1.7;
--leading-editor: 1.8;
```

---

## 4. Layout Rules

### Desktop App Layout
```txt
sidebar / top nav
main workspace
right assistant/check panel
```

### Mobile App Layout
```txt
top header
main content
bottom action bar
collapsible panels
```

### Maximum Widths

| Area | Max width |
|---|---:|
| Form content | 720px |
| Writing editor | 760px |
| Dashboard grid | 1200px |
| Reading preview | 430px |

---

## 5. Core Components

## 5.1 Button

### Primary
Use for main action.

```txt
Buat Fondasi Cerita
Generate Bab
Terima Versi Ini
```

Style:
- background primary,
- white text,
- rounded 12–16px,
- medium weight.

### Secondary
Use for alternate action.

```txt
Buat lebih emosional
Cek cerita
```

Style:
- primary soft background,
- primary text.

### Ghost
Use for low emphasis.

```txt
Lihat detail
Batal
```

---

## 5.2 Card

Use cards for:
- story bible sections,
- character cards,
- chapter cards,
- warnings,
- publish package.

Style:
- white surface,
- subtle border,
- rounded 20px,
- padding 20–24px,
- soft shadow optional.

---

## 5.3 Status Badge

Examples:

```txt
Aman
Perlu Dicek
Rahasia Bocor
Siap Publish
Draft
```

Color:
- success for safe,
- warning for review,
- danger for blocking,
- neutral for draft.

---

## 5.4 Warning Panel

Structure:

```txt
Title
Short explanation
Suggested action button
```

Example:

```txt
Rahasia terlalu cepat terbuka

Pembaca seharusnya baru tahu hal ini di bab 20.
Saran: ubah menjadi petunjuk kecil.

[Perbaiki Otomatis]
```

---

## 5.5 Prose Editor

Style:
- paper-like surface,
- comfortable line-height,
- no dense toolbar,
- mobile preview option.

CSS direction:

```css
.prose-editor {
  background: #FFFFFF;
  color: #1F2933;
  font-size: 17px;
  line-height: 1.8;
  border: 1px solid #E6DDE2;
  border-radius: 20px;
  padding: 24px;
}
```

---

## 5.6 Model Tier Selector

User-facing labels:

```txt
Hemat
Draft cepat dan murah.

Seimbang
Rekomendasi utama untuk bab normal.

Terbaik
Untuk bab penting seperti opening, reveal, atau ending.
```

Never show raw model ID in Beginner Mode.

---

## 6. Screen Design Guidelines

## 6.1 Dashboard
Goal:
User immediately knows where to continue.

Sections:
- Continue project.
- Recent projects.
- Usage summary.
- Quick start.

Visual:
- clean cards,
- no heavy charts in MVP,
- one clear CTA.

---

## 6.2 Story Intake
Goal:
Feels like guided chat, not a form.

Layout:
- chat area,
- progress sidebar,
- concept cards.

Progress labels:
```txt
Genre
Tokoh utama
Konflik utama
Rahasia cerita
Target pembaca
```

---

## 6.3 Story Bible
Goal:
Make structure understandable.

Use cards:
- Tentang Cerita
- Tokoh Utama
- Konflik Utama
- Janji ke Pembaca
- Rahasia Cerita

Avoid raw JSON in Beginner Mode.

---

## 6.4 Outline
Goal:
Show roadmap without overwhelming.

Use:
- chapter cards,
- beat accordion,
- reveal/mini victory badges.

---

## 6.5 Writer
Goal:
Help user write next beat confidently.

Layout:
```txt
Left: chapter/beat list
Center: prose editor
Right: cek otomatis / action suggestions
```

Mobile:
- beat list collapses,
- validation becomes bottom sheet.

---

## 6.6 Retention Panel
Goal:
Make unlockability actionable.

Show:
```txt
✅ Ada hook
⚠️ Mini victory belum terasa
⚠️ Ending bisa diperkuat
```

Do not show complex scores first.

---

## 7. Accessibility

- Minimum body text 16px.
- Maintain contrast.
- Do not rely on color only.
- Buttons must have clear labels.
- Warnings must include text.
- Avoid tiny tap targets.

Minimum tap target:
```txt
44px height
```

---

## 8. Responsive Rules

### Mobile First
Most target users read/write from HP.

Rules:
- avoid dense table UI on mobile,
- use stacked cards,
- keep main CTA sticky if useful,
- editor must be comfortable on small screens,
- hide advanced technical panels by default.

---

## 9. Visual Anti-Patterns

Do not implement:

```txt
dark neon cyberpunk dashboard
hot pink/purple gradient overload
tiny developer-style settings
all content in dense tables
raw JSON shown to beginner
too many emojis
floating AI robot mascot everywhere
```

---

## 10. Implementation Notes for Coding Agents

When creating UI:
1. Use design tokens from this document.
2. Do not invent random colors.
3. Keep spacing generous.
4. Use plain Indonesian labels.
5. Beginner Mode hides technical details.
6. Advanced Mode can show details, but still readable.
7. Prefer cards and panels over dense tables.
8. Update this document if new UI patterns are added.

---

## TODO
- TODO: convert tokens to actual CSS variables in app.
- TODO: create component library.
- TODO: add screenshots/mockups.
