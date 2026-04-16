# ScentWise Design System

Inspired by Apple's product page design language — cinematic dark backgrounds, generous whitespace, depth through 3D layering, and spring-physics motion. Adapted for a luxury fragrance brand with gold accent tones.

---

## Brand Identity

**Positioning:** Premium AI fragrance advisor. Feels like a high-end perfumery, not a SaaS tool.
**Tone:** Sophisticated, sensory, intimate. Like a knowledgeable friend who works at a luxury boutique.
**Design metaphor:** A perfectly lit glass perfume bottle on a dark surface — the product glows, the surroundings recede.

---

## Color Palette

```
/* Backgrounds */
--hp-bg:      #0c0a09   /* Deep warm black — richer than pure black */
--hp-surface: #1a1714   /* Elevated surface */
--hp-border:  #2e2922   /* Subtle separator */
--hp-border2: #3d3529   /* Hover / active border */

/* Text */
--hp-cream:   #f5f0e8   /* Primary text — warm white, not clinical */
--hp-cream2:  #d4cfc5   /* Secondary text */
--hp-cream3:  #a8a29e   /* Tertiary / muted text */

/* Gold accent — ScentWise signature */
--hp-gold:    #c8a55a   /* Primary accent */
--hp-gold2:   #b8944d   /* Hover / secondary accent */
--hp-gold3:   #e8d5a0   /* Light gold for italic emphasis */
```

**Rules:**
- Never use pure `#000000` or `#ffffff` — always warm variants
- Gold is used sparingly: section kickers, active states, price, key emphasis words in italic
- Backgrounds layer: `--hp-bg` → `--hp-surface` → glass panels (backdrop-filter)

---

## Typography

```
Heading serif:  'Cormorant Garamond', Georgia — light (300) for display, italic for emotion
Body sans-serif: 'DM Sans', -apple-system — clean, modern, versatile
```

**Type scale:**
| Role | Size | Weight | Tracking |
|---|---|---|---|
| Hero H1 | clamp(3rem, 7vw, 5.5rem) | 300 | -0.01em |
| Section heading | clamp(2rem, 4vw, 3rem) | 300 | normal |
| CTA heading | clamp(2.2rem, 5vw, 3.5rem) | 300 | normal |
| Section kicker | 0.7rem | 500 | 0.3em |
| Body copy | 0.95–1.05rem | 400 | normal |
| Small / meta | 0.72–0.82rem | 400–500 | 0.04em |

**Rules:**
- Use `em` italic within serif headings to inject warmth and fragrance-world sensibility
- Section kickers are ALL-CAPS, wide-tracked, gold — like a luxury brand label
- Never use serif for UI chrome (buttons, nav items, labels)

---

## Spacing System

8pt base grid. All padding/margin/gap values are multiples of 8px.

| Token | Value | Use |
|---|---|---|
| xs | 8px | Gap between inline elements |
| sm | 16px | Card internal padding (mobile), row gap |
| md | 24px | Card internal padding (desktop), section gap |
| lg | 40px | Between sections |
| xl | 56px–80px | Hero padding, CTA sections |
| 2xl | 112px (7rem) | Full sections |

---

## 3D Motion System (Apple-inspired)

### Core Principles
- **Depth, not drama** — 3D enhances spatial understanding, it never distracts
- **Spring physics** — `cubic-bezier(0.16, 1, 0.3, 1)` (Expo.Out) for all reveals
- **Interruptible** — all hover animations reset instantly on mouseleave
- **Reduced motion** — all transforms disable under `prefers-reduced-motion`
- **GPU only** — only animate `transform` and `opacity`, never layout properties

### Card 3D Tilt (Mode Items)
```js
// On mousemove:
tiltX = (y - 0.5) * -10  // degrees
tiltY = (x - 0.5) * 10   // degrees
transform: perspective(900px) rotateX(tiltX) rotateY(tiltY) translateZ(4px)
// Shine overlay: radial-gradient follows cursor position via CSS vars
```

### Hero Parallax
```js
// Mouse position drives depth layers at different speeds:
eyebrow: translate(x * -8px, y * -8px)   // slowest
h1:      translate(x * -12px, y * -10px) // medium
sub:     translate(x * -6px, y * -6px)   // slow
bottle:  translate(x * 20px, y * 10px)   // opposite direction (depth)
```

### Magnetic Buttons
```js
// CTA buttons follow cursor slightly:
dx = (cursorX - centerX) * 0.12
dy = (cursorY - centerY) * 0.12
transform: translate(dx, dy)
// Plus radial gradient shine follows cursor
```

### Scroll Reveals
```css
opacity: 0;
transform: translateY(32px) scale(0.97);
transition: opacity 0.7s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
/* Stagger: mode cards get 60ms delay per item */
```

### 3D Perfume Bottle (Hero)
CSS-only, `transform-style: preserve-3d`, continuous `rotateY` + `rotateX` oscillation.
Consists of: cap, neck, body (with glass highlight and label lines), floating ring halos.

### Floating Orbs (Hero Background)
Blurred radial gradients (`filter: blur(40px)`) in gold tones, animated `translate` + `scale` on 8–15s loops. Creates ambient depth without being distracting.

---

## Component Patterns

### Navigation
- Fixed, transparent on scroll=0 → `rgba(12,10,9,.92) + backdrop-filter: blur(20px)` on scroll
- Logo: serif, letter-spaced, gold on brand name initial
- Links: small (0.82rem), light weight, subtle gold pill CTA on the right

### Hero Section
- Full viewport height, centered content
- 3D floating bottle element (desktop only, hidden <900px)
- Gold background grid (1px lines, extremely subtle, masked radial)
- Animated entrance: staggered `hpFadeUp` (eyebrow→h1→sub→actions→stats)
- Stats strip: subtle top border separator

### Mode Cards (Bento Grid)
- 2-column grid, first card spans full width
- `background: var(--hp-surface)` / `border: 1px solid var(--hp-border)`
- 3D tilt + shine on hover (desktop)
- `contain: layout style paint` for performance
- Mode number in serif, name in serif, desc in sans, tag as pill

### Steps
- 3-column grid, top border only separator
- Large serif number, low opacity (0.4) — brightens on hover
- Card lifts `translateY(-4px)` on hover with spring easing

### Pricing Cards
- Side by side, flex wrap
- Premium card: 2px gold border + `background: var(--gl)` + "Most Popular" chip
- Free card: muted border, near-transparent background

### Dividers
- `linear-gradient(90deg, transparent, border-color 20%, 80%, transparent)`
- Never use full-width solid lines — always gradient fade

### Celebrity Cards
- Horizontal scroll strip, `scroll-snap-type: x mandatory`
- Lift + scale on hover: `translateY(-6px) scale(1.02)`
- Box shadow appears on hover

---

## Animation Tokens

```css
/* Easing */
--ease-spring:  cubic-bezier(0.16, 1, 0.3, 1)  /* Expo.Out — for reveals, hover */
--ease-smooth:  cubic-bezier(0.4, 0, 0.2, 1)   /* Material standard */
--ease-out:     cubic-bezier(0, 0, 0.2, 1)      /* For exits */

/* Durations */
--dur-micro:    150ms   /* State changes: hover, active */
--dur-short:    300ms   /* Button hover, small transitions */
--dur-med:      400ms   /* Card hover, panel transitions */
--dur-reveal:   700ms   /* Scroll-triggered reveals */
--dur-orbit:    8–16s   /* Looping ambient (bottle spin, orb float) */
```

---

## CSS Architecture

```
:root variables   → design tokens (colors, radii, shadows)
--hp-* variables  → homepage-specific tokens
inline styles     → dynamic values only (JS-driven transforms, counts)
class utilities   → .hp-reveal, .hp-anim, .hp-grain, .fi
```

**Never:**
- Use raw hex values inside component CSS — always CSS variables
- Animate `width`, `height`, `top`, `left`, `margin` — always `transform`
- Use emoji as icons in UI chrome — text/number characters and SVG only
- Apply `transition: all` broadly — always specify properties

---

## Performance Rules

- `will-change: transform` on animated cards and bottle
- `contain: layout style paint` on cards (already applied)
- `content-visibility: auto` on below-fold sections (already applied)
- All 3D JS code gated behind `!isTouchDevice()` check
- Orb animations use `filter: blur()` which composites on GPU
- `prefers-reduced-motion` disables all transforms and animations

---

## Accessibility

- All interactive elements: min 44×44px touch target
- Focus rings: `outline: 2px solid var(--g); outline-offset: 2px`
- Reduced motion: `animation-duration: 0.01ms` (already in global CSS)
- Color contrast: cream text on dark bg always ≥7:1
- Gold on dark: ≥4.5:1 (verified: `#c8a55a` on `#0c0a09` = ~6.8:1)
- Skip nav link at top of DOM
- `aria-label` on all icon-only and visual-only interactive elements
