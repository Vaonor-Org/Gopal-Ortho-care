# Gopal Ortho — Hospital Website with Booking System
## Project Overview for AI Agent

---

## AGENT RULES (READ FIRST — NON-NEGOTIABLE)

1. **DO NOT edit** `overview.md`, `prompt.md`, or `feature.json` under any circumstance.
2. **Only `progress.md` may be updated** — mark a feature as `done` when it is fully implemented.
3. **Once a feature is marked `done` in `progress.md`, never touch that feature's code again.** Move immediately to the next pending feature.
4. **Work on one feature at a time.** Complete it fully before moving to the next.
5. **Zero emoji rule.** No Unicode emoji anywhere in HTML, JSX, CSS, or rendered content. Use only inline SVG or Lucide/Phosphor icons.
6. **Follow the design system exactly** as defined in this document. No deviation from the color palette, typography, spacing, or animation rules.
7. **All animations must use `will-change: transform` or `will-change: opacity` only.** Wrap all animations in `@media (prefers-reduced-motion: no-preference)`.
8. **Never use generic hospital blue** (`#0077B6` etc.). The palette is deep forest green + gold only.

---

## Project Identity

| Field | Value |
|---|---|
| **Hospital Name** | Gopal Ortho |
| **Tagline** | Restoring Movement. Rebuilding Lives. |
| **Sub-tagline** | Your trusted orthopaedic & physiotherapy centre in South Tamil Nadu |
| **Address** | 195/3, Parakkai Road Junction, Kottar, Nagercoil, Tamil Nadu 629002 |
| **Phone / Emergency** | 095970 40918 |
| **Email** | info@gopalortho.com |
| **WhatsApp** | 9597040918 |
| **Weekday Hours** | Mon–Sat: 9:00 AM – 7:00 PM |
| **Sunday Hours** | 10:00 AM – 2:00 PM |
| **Emergency** | 24/7 |
| **Framework** | Antigravity (multi-page) |
| **Language** | English primary, Tamil secondary |

---

## Design Aesthetic

**Medical Precision Luxury** — refined clinical authority with human warmth. Inspired by premium European medical institutes. NOT generic Indian hospital blue-white. Think: Hermès-level restraint applied to orthopaedic medicine.

- Mood: Authoritative, calm, trustworthy, modern, approachable
- The site must feel like a specialist clinic that costs more but is worth every rupee
- Clean white space, controlled green tones, gold accents for trust signals

---

## Color Palette (CSS Custom Properties)

```css
:root {
  --color-primary:           #0B3D2E;
  --color-primary-light:     #1A5C44;
  --color-primary-ultralight:#EAF2EE;
  --color-secondary:         #F5F0E8;
  --color-accent-gold:       #C8973A;
  --color-accent-gold-light: #E8B85C;
  --color-text-dark:         #111827;
  --color-text-medium:       #374151;
  --color-text-light:        #6B7280;
  --color-text-muted:        #9CA3AF;
  --color-white:             #FFFFFF;
  --color-surface-card:      #F9F6F0;
  --color-surface-dark:      #071F17;
  --color-border-light:      #E5E0D8;
  --color-border-medium:     #D1CBC0;
  --color-success:           #15803D;
  --color-error:             #B91C1C;
  --color-warning:           #D97706;
  --color-overlay:           rgba(7,31,23,0.6);
}
```

---

## Typography

```css
/* Google Fonts import */
/* https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap */

--font-display: 'Cormorant Garamond', serif;   /* ALL headings, hero text */
--font-body:    'DM Sans', sans-serif;          /* ALL body, nav, UI labels */
--font-mono:    'DM Mono', monospace;           /* ONLY numbers and stats */
```

### Type Scale
| Token | Value |
|---|---|
| `--text-hero` | `clamp(3.5rem, 7.5vw, 7rem)` |
| `--text-section` | `clamp(2rem, 4.5vw, 3.75rem)` |
| `--text-sub` | `clamp(1.25rem, 2.5vw, 1.75rem)` |
| `--text-card-title` | `1.125rem` |
| `--text-body-lg` | `1.125rem` |
| `--text-body` | `1rem` |
| `--text-body-sm` | `0.9375rem` |
| `--text-label` | `0.75rem` |
| `--text-micro` | `0.6875rem` |

### Letter Spacing
- Display: `-0.03em`
- Heading: `-0.02em`
- Label caps (eyebrow text): `0.12em`
- Nav links: `0.03em`

### Line Heights
- Display: `1.05`, Heading: `1.15`, Body: `1.7`, Tight: `1.3`

---

## Spacing System

```css
--space-section-y:    clamp(5rem, 10vw, 10rem);
--space-section-y-sm: clamp(3rem, 6vw, 6rem);
--container-max:      1320px;
--container-px:       clamp(1.25rem, 5vw, 5rem);
--card-padding:       clamp(1.5rem, 2.5vw, 2.5rem);
--grid-gap:           1.5rem;
--grid-gap-lg:        2.5rem;
```

---

## Border Radius Tokens

```css
--radius-xs: 6px;  --radius-sm: 10px;  --radius-md: 16px;
--radius-lg: 24px; --radius-xl: 32px;  --radius-pill: 9999px; --radius-circle: 50%;
```

---

## Shadow Tokens

```css
--shadow-sm:   0 1px 4px rgba(11,61,46,0.06);
--shadow-md:   0 4px 24px rgba(11,61,46,0.08);
--shadow-lg:   0 16px 48px rgba(11,61,46,0.12);
--shadow-xl:   0 32px 80px rgba(11,61,46,0.16);
--shadow-gold: 0 4px 20px rgba(200,151,58,0.35);
--shadow-gold-lg: 0 8px 40px rgba(200,151,58,0.45);
```

---

## Transition Tokens

```css
--transition-fast:    all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
--transition-default: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow:    all 0.65s cubic-bezier(0.4, 0, 0.2, 1);
--transition-spring:  all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
--transition-reveal:  all 0.75s cubic-bezier(0.16, 1, 0.3, 1);
```

---

## Breakpoints

| Token | Value |
|---|---|
| xs | 480px |
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| xxl | 1440px |

---

## Animation Rules

> Every animation must feel like medical precision instruments at work — controlled, purposeful, no bounce, no wobble. Think: MRI machine movement, surgical robot precision, ECG heartbeat rhythm.

### Performance Rules
- All animations use `will-change: transform` or `will-change: opacity` ONLY
- Use `IntersectionObserver` for ALL scroll-triggered animations
- Wrap ALL animations in `@media (prefers-reduced-motion: no-preference)`
- GPU-accelerated properties only: `transform`, `opacity`, `filter`

### Core Keyframes
```css
@keyframes clipReveal {
  from { clip-path: inset(100% 0 0 0); transform: translateY(12px); opacity: 0 }
  to   { clip-path: inset(0% 0 0 0);   transform: translateY(0);    opacity: 1 }
}
@keyframes fadeUp {
  from { transform: translateY(24px); opacity: 0 }
  to   { transform: translateY(0);    opacity: 1 }
}
@keyframes sweepDown {
  0%   { top: -2px; opacity: 0 }
  5%   { opacity: 1 }
  90%  { opacity: 0.6 }
  100% { top: 100%; opacity: 0 }
}
@keyframes anatomyFloat {
  0%, 100% { transform: translateY(0px)  }
  50%       { transform: translateY(-10px) }
  /* duration: 7s, ease-in-out, infinite */
}
@keyframes ringWave {
  0%   { transform: scale(0.8); opacity: 0.8 }
  100% { transform: scale(2.2); opacity: 0   }
  /* stagger 0.5s per ring, duration 3s, infinite */
}
@keyframes kneePulse {
  0%, 100% { opacity: 0.85 }
  50%       { opacity: 1    }
  /* duration: 2.5s, ease-in-out, infinite */
}
@keyframes waRing {
  0%   { transform: scale(1);   opacity: 0.8 }
  70%  { transform: scale(1.5); opacity: 0   }
  100% { transform: scale(1.5); opacity: 0   }
  /* duration: 2.5s, infinite */
}
@keyframes liveRing {
  0%   { transform: scale(1);   opacity: 1 }
  100% { transform: scale(2.5); opacity: 0 }
  /* two rings stacked, stagger 0.8s */
}
@keyframes scrollDot {
  0%   { transform: translateY(0);   opacity: 1 }
  80%  { transform: translateY(20px); opacity: 0 }
  100% { transform: translateY(0);   opacity: 0 }
  /* duration: 1.8s, infinite */
}
```

### Page Load Sequence (total 1400ms)
| Element | Delay | Animation |
|---|---|---|
| emergency_bar | 0ms | slideDown 400ms ease-out |
| navbar | 100ms | fadeIn 400ms ease-out |
| hero_eyebrow | 300ms | fadeUp 500ms ease-out |
| hero_headline words | 450/540/630ms | clipReveal 600ms each |
| hero_subtext | 750ms | fadeUp 500ms ease-out |
| hero_cta_buttons | 900ms | fadeUp 500ms ease-out |
| hero_trust_badges | 1050ms | fadeUp 400ms ease-out |
| hero_figure_svg | 200ms | fadeIn 800ms + floatStart |
| scan_line | 500ms | sweepDown 1800ms once |

### Navbar Scroll Behaviour
- Trigger: `window.scrollY > 70`
- Before: `background: transparent; height: 80px; box-shadow: none`
- After: `background: rgba(249,246,240,0.96); backdrop-filter: blur(12px); height: 66px; box-shadow: 0 2px 24px rgba(0,0,0,0.06)`
- Transition: `all 0.4s cubic-bezier(0.4, 0, 0.2, 1)`

---

## Icon System

- **Primary library:** Lucide Icons (stroke-based, 24px viewBox, 1.5px stroke)
- **Custom medical icons:** Inline SVG for bone, joint, vertebrae, physio figure
- **ABSOLUTE RULE:** No Unicode emoji anywhere. Every visual indicator must be an SVG icon.
- Default stroke: `#0B3D2E` | On dark: `rgba(255,255,255,0.8)` | Accent: `#C8973A` | Muted: `#9CA3AF`

---

## Pages

### 1. Home (`/`)
Sections in order:
1. Emergency Bar (top, 40px, dark green)
2. Navbar (transparent → sticky on scroll)
3. Hero — full viewport split (55% content / 45% SVG anatomy figure)
4. Stats Bar — 4-stat dark green strip with count-up animation
5. About Preview — two-column (image left, content right)
6. Body Map Services — interactive SVG anatomy hotspot map
7. Orthopaedic Services Grid — 3-col, 6 service cards
8. Physiotherapy Section — asymmetric split (dark green left / white right)
9. Why Choose Us — 2×2 feature card grid
10. CTA Banner — diagonal clip-path split (green/gold)
11. Testimonials Carousel — 3-visible cards, autoplay 5s
12. Contact + Map — 60% Google Maps / 40% dark green info panel
13. Footer — 4-column dark green footer + bottom bar
14. Floating WhatsApp Button (global, fixed)
15. Scroll-to-top Button (global, fixed)

### 2. Booking (`/booking`)
- Two-column layout: 65% multi-step form / 35% sticky info panel
- 3-step form: Step 1 (Service), Step 2 (Date & Doctor), Step 3 (Details)
- Step indicator with progress bar
- Custom inline calendar with time slot grid
- Success state with animated SVG checkmark

### 3. Services (`/services`)
- Inner hero (dark green)
- Tabbed interface: Orthopaedic Care / Physiotherapy

### 4. About (`/about`)
- Sections: Our Story, Mission & Vision, Core Values, Our Team

### 5. Doctors (`/doctors`)
- 3-column card grid
- Hover overlay with Book Appointment CTA

### 6. Patient Stories (`/testimonials`)
- Full testimonials page

### 7. Contact (`/contact`)
- Inner hero (dark green)
- Contact form + map

---

## SVG Assets Required

### Hero Anatomy Figure
- Running human figure (medical scan aesthetic), translucent blue body fill (`#1A4080` at opacity 0.85)
- Bone structure visible as white/light blue skeleton lines
- Knee joint = radial gradient `#FF6B35` → `#E53E3E`
- 8 concentric rings radiating from knee, animated to expand and fade (3s stagger)
- Full figure floats up 10px and back (7s loop)
- ViewBox: `0 0 600 700`

### Scan Line (Hero)
- 1px horizontal gold line sweeps top-to-bottom once on page load
- `linear-gradient(90deg, transparent, rgba(200,151,58,0.8), transparent)`
- Duration: 1800ms, plays once, ease-in-out

### Bone Grid Background Pattern
- Tiny bone/cross shapes at 8% opacity
- Used in stats bar and CTA sections as SVG `<pattern>`

### Service Icons (40×40, stroke-only, stroke `#0B3D2E`, stroke-width 1.5)
- fracture_bone, knee_joint, spine_vertebrae, sports_medicine, arthritis, paediatric_ortho, physiotherapy, pain_management, rehabilitation, hip_replacement

### Body Map SVG
- Front-facing medical line-art human figure
- 5 hotspot gold circles: shoulder, spine, hip, knee, ankle
- Hover: region highlights gold, service label appears

---

## Accessibility Requirements
- WCAG AA color contrast minimum on all text
- Focus ring: `2px solid #C8973A, offset 2px`
- All icon-only buttons have `aria-label`
- All images have descriptive `alt` text
- Fully keyboard navigable

---

## SEO
- Title: `Gopal Ortho – Orthopaedic & Physiotherapy Hospital | Kottar, Nagercoil`
- Meta description: Expert bone, joint, and spine care in Nagercoil...
- Schema.org `MedicalOrganization` structured data on every page
- Open Graph tags on all pages
- `preconnect` to Google Fonts, `font-display: swap`
- All images: WebP with JPEG fallback, `srcset`, `loading="lazy"` below fold

---

## Global Components (Present on Every Page)

### Floating WhatsApp Button
- Fixed, bottom-right, z-index 900
- 56×56px circle, bg `#25D366`
- Two pulse rings (`::before`, `::after`), animation `waRing 2.5s infinite`, stagger 0.8s
- Tooltip "Chat with us" on hover
- Link: `https://wa.me/919597040918?text=Hello%2C%20I%20would%20like%20to%20book%20an%20appointment%20at%20Gopal%20Ortho`

### Scroll-to-top Button
- Appears after 400px scroll
- Fixed, bottom-right (offset from WhatsApp button)
- 44×44px, bg `#0B3D2E`, hover: `#C8973A`

### Cookie Notice
- Bottom bar, compact, accept button

---

## Developer Priority Notes
1. Build the animated SVG anatomy hero figure first — it is the centrepiece.
2. The 3-step booking form step transitions are critical to user trust.
3. WhatsApp floating button is the #1 conversion driver — non-optional.
4. Replace every emoji with proper SVG — no exceptions.
5. Navbar scroll transition must be perfectly smooth.
6. Cormorant Garamond = ALL headings. DM Sans = ALL body/UI. DM Mono = ONLY numbers.
7. Hero anatomy SVG: stacks below text on mobile, scaled to 90vw.
8. Body map section: simplifies to vertical list on mobile.
