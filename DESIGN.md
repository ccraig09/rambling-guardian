# DESIGN.md — Rambling Guardian Visual Identity

> This document defines the visual personality of Rambling Guardian. All new screens, components, and UI decisions should reference this guide. Dark mode is primary — design there first, adapt to light.

**Figma:** [Rambling Guardian — Design System](https://www.figma.com/design/Uz6f5n15ifMizZTbxj8Grw)

---

## Brand Personality

**Rambling Guardian** is an ADHD speech coach that lives in your pocket. It monitors, nudges, and trains — but never nags. The visual language should feel like a focused late-night journal session: calm, clear, and quietly encouraging.

**Voice:** Calm but energizing. Supportive, not clinical.
**Feeling:** A late-night journal session with good lighting — deep focus, warm indigo glow, everything in its place.

### Personality Attributes

| Attribute | Expression |
|-----------|------------|
| Focused | Indigo-tinted surfaces, one hero element per screen, minimal competing visuals |
| Supportive | Generous spacing, friendly type, no alarmist language (even in alerts) |
| Encouraging | Streak celebrations, progress acknowledgment, playful micro-moments |
| Premium | Thoughtful depth via surface stepping, no visible borders, warm shadows |
| ADHD-aware | Large touch targets, clear hierarchy, skippable flows, no walls of text |

### Personality Blend

The design sits at the intersection of two archetypes:
- **Mindful Coach (primary):** Breathable layouts, calm surfaces, whitespace as a feature. Think Headspace meets Apple Health.
- **Playful Companion (accent):** Personality shows in micro-moments — streak milestones, exercise completion, connection animations. The delight is earned, not constant. The chrome is calm; the moments are warm.

---

## Color System

All colors defined in HSL for predictable manipulation. Adjusting lightness creates tints/shades. Adjusting saturation controls vibrancy.

### Primary: Warm Indigo

Indigo communicates focus, introspection, and depth. It sits opposite the alert spectrum (green → red) on the color wheel, giving zero hue collision between brand identity and speech feedback.

| Token | HSL | Usage |
|-------|-----|-------|
| `primary.950` | `hsl(255, 50%, 22%)` | Darkest brand tint, pressed states on dark |
| `primary.900` | `hsl(255, 48%, 28%)` | Dark emphasis |
| `primary.800` | `hsl(255, 46%, 35%)` | Active states |
| `primary.700` | `hsl(255, 45%, 42%)` | Pressed states on light |
| `primary.600` | `hsl(255, 45%, 48%)` | Dark mode interactive hover |
| `primary.500` | `hsl(255, 45%, 55%)` | **Base — buttons, active tab, brand accents** |
| `primary.400` | `hsl(255, 45%, 65%)` | Light mode interactive hover |
| `primary.300` | `hsl(255, 42%, 75%)` | Muted accents, icon fills |
| `primary.200` | `hsl(255, 38%, 82%)` | Light tint, tag backgrounds |
| `primary.100` | `hsl(255, 35%, 90%)` | Subtle tint, light mode surfaces |
| `primary.50` | `hsl(255, 30%, 96%)` | Faintest tint, light mode backgrounds |

### Alert Levels — Speech Duration Feedback

These colors are functional, not decorative. They map 1:1 to the firmware's escalating alert system. The user sees these change in real time as they speak.

| Token | HSL | Firmware Level | Threshold |
|-------|-----|---------------|-----------|
| `alert.safe` | `hsl(142, 52%, 45%)` | ALERT_NONE | < 7s |
| `alert.gentle` | `hsl(45, 85%, 52%)` | ALERT_GENTLE | 7s |
| `alert.moderate` | `hsl(25, 80%, 52%)` | ALERT_MODERATE | 15s |
| `alert.urgent` | `hsl(0, 68%, 52%)` | ALERT_URGENT | 30s |
| `alert.critical` | `hsl(0, 68%, 42%)` | ALERT_CRITICAL | 60s+ (pulsing) |

**Design note:** Alert colors are used in the real-time indicator ring, timeline bars, and notification badges. They should never be used for decorative purposes outside the alert context — keep the association strong.

### Semantic Colors

Distinct from alert colors. Success green is shifted toward teal (152° vs 142°) to avoid confusion with alert.safe.

| Token | HSL | Usage |
|-------|-----|-------|
| `success` | `hsl(152, 45%, 45%)` | Exercise complete, BLE connected, positive feedback |
| `warning` | `hsl(38, 80%, 52%)` | Low battery nudge, pending states |
| `error` | `hsl(0, 65%, 55%)` | Failed connection, destructive actions |

### Semantic Surfaces

Tinted backgrounds for inline feedback areas.

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `success.surface` | `hsla(152, 45%, 45%, 0.12)` | `hsl(152, 40%, 95%)` | Success feedback areas |
| `warning.surface` | `hsla(38, 80%, 52%, 0.12)` | `hsl(38, 70%, 95%)` | Warning feedback areas |
| `error.surface` | `hsla(0, 65%, 55%, 0.12)` | `hsl(0, 60%, 96%)` | Error feedback areas |

---

## Surfaces

### Dark Mode (Primary)

All dark surfaces share hue 260°. Saturation decreases as lightness increases — deeper surfaces are more richly indigo, elevated surfaces are subtler. This is the "twilight gradient."

| Token | HSL | Saturation | Usage |
|-------|-----|------------|-------|
| `bg` | `hsl(260, 18%, 8%)` | 18% | Page/screen background |
| `surface` | `hsl(260, 16%, 11%)` | 16% | Tab bars, section backgrounds |
| `card` | `hsl(260, 14%, 15%)` | 14% | Cards, list items |
| `elevated` | `hsl(260, 12%, 20%)` | 12% | Modals, dropdowns, popovers |
| `overlay` | `hsl(260, 10%, 26%)` | 10% | Tooltips, toasts |

**Separation principle:** Cards are lighter than their parent surface. No borders needed — the lightness step creates the edge. If two surfaces are adjacent and need separation, step lightness by at least 4%.

### Light Mode (Adaptation)

Light surfaces carry a faint indigo tint so the app still feels like one product across themes. Saturation increases slightly at higher lightness to keep the tint perceptible.

| Token | HSL | Usage |
|-------|-----|-------|
| `bg` | `hsl(255, 20%, 97%)` | Page/screen background |
| `surface` | `hsl(255, 22%, 95%)` | Tab bars, section backgrounds |
| `card` | `hsl(255, 25%, 99%)` | Cards, list items |
| `elevated` | `hsl(0, 0%, 100%)` | Modals (pure white for contrast) |
| `overlay` | `hsl(0, 0%, 100%)` | Tooltips, toasts |

---

## Text

### Dark Mode

| Token | HSL | Usage |
|-------|-----|-------|
| `text.primary` | `hsl(0, 0%, 95%)` | Headings, hero numbers, primary content |
| `text.secondary` | `hsl(0, 0%, 78%)` | Body text, descriptions |
| `text.tertiary` | `hsl(255, 15%, 58%)` | Metadata, secondary labels (use at 16sp+ for AA compliance) |
| `text.muted` | `hsl(255, 12%, 42%)` | Timestamps, placeholders, disabled (decorative only — never sole info carrier) |
| `text.onColor` | `hsl(0, 0%, 100%)` | Text on primary/alert/semantic backgrounds |
| `text.brand` | `hsl(255, 80%, 78%)` | Brand name, accent text, links |

### Light Mode

| Token | HSL | Usage |
|-------|-----|-------|
| `text.primary` | `hsl(260, 25%, 12%)` | Headings, hero numbers, primary content |
| `text.secondary` | `hsl(255, 15%, 35%)` | Body text, descriptions |
| `text.tertiary` | `hsl(255, 12%, 50%)` | Metadata, secondary labels (use at 16sp+ for AA compliance) |
| `text.muted` | `hsl(255, 10%, 65%)` | Timestamps, placeholders, disabled (decorative only — never sole info carrier) |
| `text.onColor` | `hsl(0, 0%, 100%)` | Text on primary/alert/semantic backgrounds |
| `text.brand` | `hsl(255, 55%, 48%)` | Brand name, accent text, links |

---

## Typography

**Typeface:** Plus Jakarta Sans — geometric sans-serif with slightly rounded terminals. Friendly but professional. Beautiful weight range from light to extrabold.

| Token | Size | Weight | Tracking | Usage |
|-------|------|--------|----------|-------|
| `hero` | 44sp | ExtraBold (800) | -2 | One per screen — the number/state that matters most |
| `title` | 28sp | ExtraBold (800) | -1 | Screen headers |
| `heading` | 20sp | Bold (700) | -0.5 | Section headers within a screen |
| `subtitle` | 16sp | SemiBold (600) | 0 | Card titles, row labels |
| `body` | 15sp | Medium (500) | 0 | Primary content, descriptions |
| `small` | 13sp | Medium (500) | 0.1 | Secondary content, metadata |
| `caption` | 12sp | Medium (500) | 0.2 | Timestamps, footnotes |

**Rules:**
- One `hero` per screen, maximum. It is the single most important piece of data.
- `title` appears once at the top of each screen.
- Line height: 1.5 for multi-line body/small text. Single-line labels use default.
- Negative tracking on large sizes creates density; positive tracking on small sizes aids readability.

---

## Spacing & Layout

**Grid:** 4-point. Every spacing value is a multiple of 4.

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4dp | Tight gaps (icon-to-label, badge padding) |
| `sm` | 8dp | Compact spacing (list item internal, chip gaps) |
| `md` | 12dp | Default internal padding (card sections, input padding) |
| `base` | 16dp | Screen horizontal margins, standard card padding |
| `lg` | 24dp | Section gaps, generous card padding |
| `xl` | 32dp | Major section separators |
| `2xl` | 48dp | Screen-level vertical breathing room |
| `3xl` | 64dp | Hero area vertical padding |

**Principles:**
- Start with too much whitespace. Compress only when content demands it.
- Horizontal screen margins: always `base` (16dp).
- Section gaps: default `lg` (24dp), use `xl` (32dp) between major sections.
- Cards use `base` (16dp) internal padding, `lg` (24dp) for spacious cards.

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 6dp | Small elements (badges, tags, progress bar segments) |
| `md` | 8dp | Buttons, inputs, compact cards |
| `lg` | 12dp | Standard cards, list items |
| `xl` | 16dp | Large cards, modal sheets |
| `full` | 9999dp | Circles (avatars, status dots, FABs) |

Rounded shapes reinforce the "friendly" side of the personality. Nothing should have sharp corners.

---

## Shadows

Dark mode relies primarily on surface stepping for depth. Shadows are subtle reinforcement, not the primary separation mechanism.

| Token | Value | Usage |
|-------|-------|-------|
| `shadow.sm` | `0 1px 3px hsla(260, 40%, 4%, 0.3)` | Subtle card lift, input focus |
| `shadow.md` | `0 4px 12px hsla(260, 40%, 4%, 0.4)` | Floating cards, dropdowns |
| `shadow.lg` | `0 8px 24px hsla(260, 40%, 4%, 0.5)` | Modals, toasts, overlays |

**Light mode shadows** use the same structure but with `hsla(255, 30%, 30%, 0.08/0.12/0.16)` — lighter, warmer.

**Rule:** If you need a shadow to tell two surfaces apart, the surfaces are too close in lightness. Fix the surface stepping first.

---

## Component Patterns

### Buttons

| Variant | Dark Mode | Light Mode | Usage |
|---------|-----------|------------|-------|
| `primary` | `primary.500` bg, white text | `primary.600` bg, white text | Main CTA per screen (one max) |
| `secondary` | `elevated` bg, `text.secondary` text | `surface` bg, `text.secondary` text | Supporting actions |
| `destructive` | `error` bg at 15% opacity, `error` text | `error.surface` bg, `error` text | Delete, disconnect, reset |
| `ghost` | Transparent, `text.tertiary` text | Transparent, `text.tertiary` text | Tertiary actions, filter toggles |

- Minimum height: 48dp (44dp touch + 2dp visual padding)
- Border radius: `md` (8dp)
- No borders on any variant — use background fill or transparency
- Pressed state: darken 10% lightness

### Cards

- Background: `card` surface token
- Border radius: `xl` (16dp)
- Padding: `base` (16dp) standard, `lg` (24dp) spacious
- No visible borders — surface stepping handles separation
- Shadow: `shadow.sm` only when the card is interactive (tappable)

### Badges

Used for alert levels, streak counts, and status indicators.

| Variant | Style |
|---------|-------|
| Alert badges | Alert color bg at 15% opacity, alert color text |
| Streak badge | `primary.500` bg, white text |
| Status dot | 8dp circle, semantic color fill |

### Inputs

- Filled style: `elevated` background, no border
- Focus: `primary.500` bottom border (2dp) or glow
- Border radius: `md` (8dp)
- Height: 48dp
- Placeholder text: `text.muted`

### Toggle / Switch

- Track (off): `overlay` surface
- Track (on): `primary.500`
- Thumb: white
- Height: 28dp, width: 48dp

---

## Alert Level Indicator

The core real-time feedback element. This appears on the dashboard as a prominent ring or arc.

**Design:** A circular progress ring that fills and changes color as speech duration increases. The ring is the hero element on the dashboard screen.

| State | Ring Color | Background Glow | Animation |
|-------|-----------|-----------------|-----------|
| Safe | `alert.safe` | None | Steady |
| Gentle | `alert.gentle` | Faint yellow ambient | Steady |
| Moderate | `alert.moderate` | Faint orange ambient | Steady |
| Urgent | `alert.urgent` | Red ambient glow | Slow pulse |
| Critical | `alert.critical` | Strong red glow | Fast pulse |

The ambient glow is a large, blurred shadow behind the ring in the alert color at low opacity. It creates urgency without being jarring.

---

## Empty States

Every screen that could be empty gets a designed empty state. Never show a blank page.

**Pattern:**
- Centered vertically in the available space
- Muted illustration or icon (indigo-tinted, `text.tertiary` color)
- Short encouraging headline (`subtitle` size)
- One-line description (`small` size, `text.tertiary`)
- Optional CTA button

**Examples:**
- No sessions yet: "Your first session is waiting. Connect your device to get started."
- No exercises today: "You've completed today's practice. See you tomorrow."
- No streaks: "Complete your first exercise to start your streak."

---

## Do's and Don'ts

### Do

- Use `primary.500` for the single most important action on each screen
- Let spacing do the work — generous whitespace is a feature, not waste
- Use surface stepping for depth (lighter = higher)
- Keep hierarchy clear: one hero, one primary button, supporting cast below
- Design empty states as part of the feature, not an afterthought
- Use the alert colors only for alert-related UI (keep the association strong)
- Test both themes side by side — the light mode should feel like the same app

### Don't

- Use pure black (`#000`) or pure white (`#fff`) for backgrounds
- Add visible borders to cards — surface stepping and shadows handle separation
- Use alert colors decoratively (green for "good" badges, red for "bad" labels)
- Have competing hero elements — if two things feel equally important, one must yield
- Over-animate — motion should be purposeful and brief. Earned delight, not constant
- Mix warm and cool tones in the same surface (stay in the indigo hue family)
- Use thin text (< 500 weight) below 14sp — readability matters for ADHD users
- Put critical actions behind long flows — every action should be reachable in 2 taps max

---

## Accessibility

- WCAG 2.1 AA minimum contrast ratios: 4.5:1 for body text, 3:1 for large text and UI components
- `text.primary` on `bg`: target AA (verify during implementation)
- `text.secondary` on `bg`: target AA (verify during implementation)
- `text.tertiary` on `bg`: target AA for large text only (16sp+) — do not use for small body text
- All interactive elements: 44dp minimum touch target
- Alert feedback is never color-only — always paired with text labels and/or haptic patterns
- Reduce Motion: respect `prefers-reduced-motion` — disable pulse animations, use instant transitions

---

## Future Considerations

- **Celebratory animations:** Confetti/particle effects for streak milestones (Phase C.4.5)
- **Custom illustrations:** Line-art style with indigo palette if illustration is added
- **Widget design:** Apple Watch complication and iOS widget use `primary.500` + alert colors on system backgrounds
- **Marketing assets:** The indigo-tinted dark surfaces work well for App Store screenshots and social media
