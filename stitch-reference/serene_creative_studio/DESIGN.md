---
name: Serene Creative Studio
colors:
  surface: '#FFFFFF'
  surface-dim: '#d1dbe8'
  surface-bright: '#f7f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#edf4ff'
  surface-container: '#e4effd'
  surface-container-high: '#dfe9f7'
  surface-container-highest: '#d9e3f1'
  on-surface: '#121d26'
  on-surface-variant: '#534346'
  inverse-surface: '#27313c'
  inverse-on-surface: '#e8f2ff'
  outline: '#857276'
  outline-variant: '#d8c1c5'
  surface-tint: '#93455e'
  primary: '#823850'
  on-primary: '#ffffff'
  primary-container: '#9f4f68'
  on-primary-container: '#ffe2e7'
  inverse-primary: '#ffb1c5'
  secondary: '#6d528e'
  on-secondary: '#ffffff'
  secondary-container: '#dbbcff'
  on-secondary-container: '#624883'
  tertiary: '#1e5b3f'
  on-tertiary: '#ffffff'
  tertiary-container: '#397456'
  on-tertiary-container: '#b8f7d2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e1'
  primary-fixed-dim: '#ffb1c5'
  on-primary-fixed: '#3e011b'
  on-primary-fixed-variant: '#762e46'
  secondary-fixed: '#eedbff'
  secondary-fixed-dim: '#d9b9fd'
  on-secondary-fixed: '#270c46'
  on-secondary-fixed-variant: '#543a74'
  tertiary-fixed: '#b2f0cc'
  tertiary-fixed-dim: '#96d4b1'
  on-tertiary-fixed: '#002112'
  on-tertiary-fixed-variant: '#115136'
  background: '#FBF8F6'
  on-background: '#121d26'
  surface-variant: '#d9e3f1'
  surface-soft: '#FFF7F8'
  primary-dark: '#7A334C'
  primary-soft: '#F6E7EC'
  accent-soft: '#EFE9F7'
  muted-text: '#6B7280'
  subtle-text: '#9CA3AF'
  border: '#E6DDE2'
  warning: '#B7791F'
  warning-soft: '#FFF4D8'
  danger: '#B94A48'
  danger-soft: '#FCE8E7'
  success-soft: '#E7F3EC'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-editor:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: '1.8'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max-form: 720px
  container-max-editor: 760px
  container-max-dashboard: 1200px
---

## Brand & Style

The design system is built for a premium, warm, and supportive AI-assisted writing environment. It avoids the cold, technical aesthetic typical of AI tools, instead favoring a "Soft Premium Editorial" style that feels like a high-end physical writing studio. The target audience—primarily creative writers—should feel guided and safe, rather than overwhelmed by technology.

**Design Style: Minimalism with Tactile Softness**
- **Warmth over Tech:** Uses a palette of ivory, muted rose, and deep plum to create a comforting workspace.
- **Editorial Focus:** Typography and spacing prioritize readability and the "flow" of storytelling.
- **Mobile-First Utility:** Elements are sized for comfortable touch targets, acknowledging that much of the creative process happens on mobile devices.
- **Calm Authority:** The UI is structured and professional, using generous whitespace and soft shadows to provide a sense of order without being rigid.

## Colors

The color strategy uses "Warm Neutrals" as the foundation to reduce eye strain during long writing sessions. Chromatic colors are used intentionally to denote hierarchy and emotional state:
- **Primary (Deep Rose):** Used for the main narrative thread and primary actions. It is sophisticated, not neon.
- **Secondary (Soft Lavender):** Used for auxiliary creative tools and secondary accents.
- **Surface & Background:** The background is a warm ivory (`#FBF8F6`) rather than pure white to mimic high-quality paper.
- **Functional Colors:** Success, Warning, and Danger colors are slightly desaturated to maintain the "calm" atmosphere, even when highlighting issues.

## Typography

This design system utilizes **Inter** for its exceptional legibility and neutral, professional character. It ensures the UI stays "out of the way" of the author's creativity.

- **Editor Experience:** The `body-editor` style is specifically tuned for long-form writing with a 1.8 line-height to prevent visual crowding, especially on mobile.
- **Hierarchy:** Titles use semi-bold weights with tighter letter spacing to feel anchored and editorial.
- **Language Support:** All typography is optimized for Indonesian text, ensuring that descenders and accents are clear.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model with strict maximum widths to maintain readability. 

- **Responsive Strategy:** 
  - **Desktop:** A three-pane architecture (Sidebar, Main Workspace, Assistant Panel). The Assistant Panel should be collapsible to allow for "Focus Mode."
  - **Mobile:** Single-column stacked cards. Navigation moves to a top header or a bottom navigation bar for high-frequency actions.
- **Whitespace:** Use generous margins (minimum 24px on desktop, 16px on mobile) to maintain the "premium editorial" feel.
- **Editor Centering:** The writing area is always constrained to 760px and centered to mimic a physical manuscript.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layers** and **Ambient Shadows** rather than harsh borders.

- **Base Layer:** Background (`#FBF8F6`) is the lowest level.
- **Surface Layer:** Cards and main content areas use Surface White (`#FFFFFF`).
- **Elevation Shadows:** Shadows must be soft and tinted with the Ink color (`#1F2933`).
  - *Small (Static cards):* 0 1px 2px rgba(31, 41, 51, 0.05).
  - *Medium (Interactive elements/Hover):* 0 8px 24px rgba(31, 41, 51, 0.08).
- **Outlines:** Use a subtle border (`#E6DDE2`) for structural definition on mobile screens where shadows might become cluttered.

## Shapes

The shape language is "Friendly & Organic." High border radii are used to soften the digital interface.

- **Large Containers (Cards, Modals):** Use a 20px-24px radius (`rounded-xl` or `rounded-2xl`). This defines the primary visual container style.
- **Standard Elements (Buttons, Inputs):** Use a 12px-16px radius.
- **Status Indicators:** Pill-shaped (fully rounded) to differentiate them from interactive buttons.

## Components

### Buttons
- **Primary:** Filled with Primary color, white text. Min-height 48px for mobile accessibility.
- **Secondary:** Primary Soft background with Primary text. Used for "supportive" AI actions like "Make more emotional."
- **Ghost:** No background, border-only or text-only. Used for "Cancel" or "View Details."

### Cards (Story Bible, Chapters)
- Background: Surface White.
- Radius: 20px.
- Padding: 24px (Desktop), 16px (Mobile).
- Must include clear headers and "Status Badges" in the top right corner.

### Prose Editor (Paper-like)
- Background: `#FFFFFF`.
- Border: 1px solid `#E6DDE2`.
- Padding: 32px for a generous "sheet of paper" look.
- Toolbar should be minimal or floating to avoid distractions.

### Status Badges & Warnings
- **Pill Shape:** Use soft background variants (e.g., Success Soft).
- **Warning Panels:** Use a distinct "Warning Soft" background with a 1px "Warning" border. Structure: Icon + Bold Title + Descriptive Text + Action Button.

### App Shell
- **Top Nav:** Clean, persistent branding and "Publish" CTA.
- **Sidebar:** Lightweight, focused on navigation between "Bible," "Outline," and "Manuscript."
- **Assistant Panel:** Slides in from the right. It should feel like a "Drawer" over the main content on mobile.