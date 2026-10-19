# Ledger — Design System

**Status:** Locked. Implementation begins when the Next.js 16 scaffold lands.
**Visual direction:** Quiet premium.
**Theme:** Respect system preference, default light, user choice persisted.
**Accent:** The existing lime in `globals.css` is the brand accent.

---

## 1. Design principles

1. **Restraint reads as seriousness.** A finance tool that shouts is a finance
   tool nobody trusts with their invoices. Colour is used to mark state and to
   draw the eye to the one action that matters, and for almost nothing else.
2. **Data is the interface.** Numbers are the product. Typography, spacing and
   contrast all serve legibility of tabular data far more than they serve
   decoration.
3. **One accent, used sparingly.** Lime appears on primary actions, active
   states, and focus rings. If lime is visible on more than roughly 5% of a
   viewport, it has stopped being an accent.
4. **The demo is the marketing.** Show the real product in the landing page
   rather than describing it. A judge should understand the value proposition
   from the hero alone.
5. **Honest chrome.** Runtime banner, quota warnings and privacy states are
   designed as first-class UI, not error afterthoughts.

---

## 2. Colour — token audit

Your existing `globals.css` is used **as-is, unmodified**. Every token is
already mapped through `@theme inline`, so all of this is pure Tailwind class
usage. The audit below is measured, not assumed: contrast ratios are computed
from the actual `oklch` values in your file.

### 2.1 Measured contrast

| Pair | Hexes | Ratio | Verdict |
|---|---|---|---|
| `--primary` on `--background` (light) | `#9ae600` on `#ffffff` | **1.54:1** | **FAILS AA** |
| `--primary-foreground` on `--background` (light) | `#35530e` on `#ffffff` | **8.72:1** | Passes AA |
| `--primary-foreground` on `--primary` (light, button) | `#35530e` on `#9ae600` | **5.66:1** | Passes AA |
| `--primary` on `--background` (dark) | `#7ccf00` on `#0c0c09` | **9.97:1** | Passes AA |
| `--primary-foreground` on `--primary` (dark, button) | `#35530e` on `#7ccf00` | **4.44:1** | **Fails AA by 0.06** |
| `--foreground` on `--background` (light) | `#0c0c09` on `#ffffff` | **19.59:1** | Passes AAA |
| `--muted-foreground` on `--background` (light) | `#7c7c67` on `#ffffff` | **4.26:1** | **Fails AA** |
| `--muted-foreground` on `--background` (dark) | `#abab9c` on `#0c0c09` | **8.43:1** | Passes AA |
| `--ring` on `--background` (light) | `#abab9c` on `#ffffff` | **2.32:1** | **Fails the 3:1 focus requirement** |
| `--ring` on `--background` (dark) | `#7c7c67` on `#0c0c09` | **4.60:1** | Passes |

### 2.2 The lime rule

**In light mode, lime is a surface colour. Never a text colour.**
`#9ae600` on white is 1.54:1 — unusable as type.

**In dark mode lime is excellent as text** at 9.97:1, so the accent role swaps
between themes. That is exactly what `dark:` is for:

| Role | Classes |
|---|---|
| Link / accent text | `text-primary-foreground dark:text-primary` |
| Accent surface (button fill) | `bg-primary text-primary-foreground` |
| Accent wash (badge, highlight) | `bg-primary/15 text-primary-foreground dark:bg-primary/20 dark:text-primary` |
| Active indicator | `bg-primary` |
| Secondary body text | `text-secondary-foreground dark:text-muted-foreground` |
| Focus ring | `ring-foreground` — see 2.3 |
| Destructive | `text-destructive`, `bg-destructive text-white` |

Rule of thumb: if it is type, it is `primary-foreground` in light and
`primary` in dark. If it is a fill, `bg-primary` in both.

### 2.3 Focus rings

`--ring` is 2.32:1 on white, which fails the 3:1 requirement for focus
indicators. Lime as a ring would be worse (1.54:1).

**Use `ring-foreground` instead** — 19.59:1 on white, and the dark-theme
foreground is near-white so it also reads correctly on dark.

```tsx
className="focus-visible:ring-2 focus-visible:ring-foreground
           focus-visible:ring-offset-2 focus-visible:ring-offset-background"
```

This also fits the design language better: black hairline focus, lime for
surfaces. Restraint reads as seriousness.

### 2.4 One pre-existing issue to be aware of

Dark-mode primary buttons sit at **4.44:1**, which is 0.06 short of AA. The
cause is that dark `--primary` is slightly darker (`oklch(0.768 …)`) than light
`--primary` (`oklch(0.841 …)`), while `--primary-foreground` is identical in
both.

You asked for no changes to `globals.css`, so this ships as-is. It is a
rounding-edge shortfall, not a visible problem. If you ever want it fixed, the
one-line change is to raise dark `--primary` to `oklch(0.78 0.233 130.85)` —
still lime, just a touch brighter. Flagged in the writeup as a real finding
rather than quietly ignored.

### 2.5 Charts

All five `--chart-*` tokens sit within hue 126–131 — a monochromatic green
ramp. That is elegant for a single series and unusable for distinguishing
several. Encode by **luminance**, not hue:

| Series | Token |
|---|---|
| TabPFN prediction | `chart-1` (lightest lime) |
| Client-mean baseline | `muted-foreground` |
| Global-mean baseline | `border` |

Bright lime for the model, neutral grey for baselines. Reads instantly and
stays inside the existing palette.

### 2.6 Neutrals

Your greys carry a subtle warm cast (`hue 106–107`), which suits the
"quiet premium" direction. Use them unmodified:

```
background        bg-background
surface           bg-card
border            border-border
foreground        text-foreground
```

Hairline borders do the structural work. Shadows are reserved for genuinely
floating layers: dialogs, popovers, dropdowns, sheets.

Radius is already a full scale (`--radius-sm` through `--radius-4xl` at
0.45rem base). Use `rounded-md` for controls, `rounded-lg` for cards,
`rounded-xl` for large panels.

### 2.7 Type

`--font-sans` and `--font-heading` are both mapped in `@theme inline`, so
`font-heading` is available and intended. Use it for display and section
headings; `--font-sans` for body and UI. That pairing is the quickest way to
make the page read as designed rather than assembled.

`tw-animate-css` is already imported — use it for dialog, accordion and sheet
transitions rather than hand-rolling keyframes.

---

## 3. Typography

| Role | Family | Notes |
|---|---|---|
| Display | The scaffold's sans, at large sizes | Tight tracking, `-0.02em` at display sizes |
| Body | The scaffold's sans | 16px base, `1.6` line height |
| Numeric / tabular | Monospace | **All monetary values and day counts** |
| Code / schema | Monospace | Same family as tabular, smaller |

**Tabular numerals are non-negotiable.** Any column of money, dates or counts
must use `font-variant-numeric: tabular-nums`, otherwise digits jitter between
rows and the table reads as unprofessional. Monospace for numeric columns is
acceptable and often clearer for a finance product.

Type scale, restrained:

```
display   48 / 56   hero only
h1        36 / 44
h2        28 / 36   section headings
h3        20 / 28
body      16 / 26
small     14 / 20
micro     12 / 16   labels, axis text
```

Line length capped around 65 characters for prose blocks.

---

## 4. Layout

- Max content width `72rem` (1152px), with a narrower `48rem` measure for prose.
- Vertical section rhythm: `6rem` desktop, `4rem` mobile.
- Generous whitespace is the primary visual signal. Cramped layouts read cheap.
- One column on mobile, two on tablet, three on desktop for feature grids.

---

## 5. Theming

- `next-themes` with `attribute="class"`, `defaultTheme="system"`,
  `disableTransitionOnChange`.
- Tailwind dark variant driven by the `.dark` class on `<html>`.
- **Inline script in the document head** to set the class before first paint,
  otherwise there is a visible flash of the wrong theme.
- Theme toggle in the header, three-state would be ideal (light / dark /
  system) but two-state is acceptable under time pressure — default to
  two-state with a `Sun`/`Moon` icon and an `aria-label` that states the
  current action, not the current state.
- Every surface must be defined in both themes. A hardcoded colour anywhere is
  a bug.

---

## 6. Components

Built on **shadcn/ui (Base UI variant)** so component code stays owned by the
project rather than a dependency.

### 6.1 Core primitives to install

`button` `card` `badge` `separator` `tabs` `table` `input` `label`
`textarea` `select` `dialog` `dropdown-menu` `tooltip` `accordion`
`progress` `switch` `skeleton` `sheet` `alert` `scroll-area` `toggle-group`

### 6.2 Composed components specific to Ledger

| Component | Purpose |
|---|---|
| `RuntimeBanner` | Names the active path: local / hosted / demo / blocked. Shows remaining hosted quota. Never claims a path that will fail. |
| `UploadDropzone` | Drag-drop, multi-file, per-file state: queued / processing / done / failed |
| `BatchProgress` | Per-document queue with honest per-item timing |
| `InvoiceTable` | The review table. Inline-editable cells, confidence wash, dirty-state tracking |
| `ConfidenceBadge` | Review-priority score. **Label it a score, not a probability.** |
| `ProvenanceTag` | Which runtime and which OCR path produced a row |
| `ChaseList` | Sorted worst-first. Prediction, q10–q90 interval bar, baseline comparison |
| `AccuracyTable` | The `EVAL.md` results rendered for real, with `_TBD_` cells visibly marked as pending rather than faked |
| `DataFlowDiagram` | The privacy flow, rendered as a component rather than a static image |
| `ThemeToggle` | Light / dark switch |
| `SiteHeader` | Sticky, blurred backdrop, nav, theme toggle, primary CTA |
| `SiteFooter` | Multi-column: product, project, attribution, licence |

### 6.3 Accessibility requirements

- Every interactive element reachable and operable by keyboard.
- Visible focus rings everywhere — lime ring plus a dark offset so it is
  visible on both light and dark surfaces.
- Tables use real `<table>` markup with `<th scope>`.
- Confidence and provenance are never conveyed by colour alone; pair with an
  icon or text.
- The runtime banner uses `role="status"` and `aria-live="polite"` so state
  changes are announced.
- Target WCAG AA. Check contrast on every text/background pair actually used.

---

## 7. Motion

CSS-first. No animation library — it costs bundle size, install time and
debugging surface, and none of it is load-bearing here.

Permitted:

- `transition` on `background-color`, `color`, `border-color`, `opacity`,
  `transform` — 150–200ms, `ease-out`.
- Hover elevation on interactive cards: 1px translate, slight shadow.
- Accordion and dialog transitions via shadcn defaults.

Forbidden:

- Scroll-jacking, parallax, autoplaying carousels.
- Anything that delays content or blocks interaction.
- Anything that ignores `prefers-reduced-motion`.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Scroll-triggered reveals, if used at all: one IntersectionObserver, fade plus
8px translate, once only, unobserve after firing. Optional, not required.

---

## 8. Landing page structure

Route `/`. The application lives at `/app`. A real product separates the two,
and a judge should land on a page that explains before asking them to act.

| # | Section | Purpose | Priority |
|---|---|---|---|
| 1 | Header | Sticky, blur backdrop, nav, theme toggle, "Open the app" | **Required** |
| 2 | Hero | Headline, subheadline, two CTAs, product visual, cost framing | **Required** |
| 3 | Problem | Three cost cards: accountant fees, hours lost, privacy risk | **Required** |
| 4 | How it works | Four steps, real screenshots, the OCR fallback shown honestly | **Required** |
| 5 | Product preview | Live interactive demo embedded, or a scripted sequence | **Required** |
| 6 | Accuracy study | The real results table. **Cells marked pending stay pending.** | **Required** |
| 7 | Privacy | Data-flow diagram, the zero-external-requests claim, how to verify it | **Required** |
| 8 | Payment prediction | The chase list, with the naive baseline shown | Required if TabPFN lands |
| 9 | Pricing | Two tiers, honest, no checkout | **Required** |
| 10 | FAQ | 5–7 entries. Accordion. The awkward ones answered. | Recommended |
| 11 | Closing CTA | Reprise the hero | Recommended |
| 12 | Footer | Product, project, attribution, licence, challenge link | **Required** |

### 8.1 Hero copy direction

Headline names the outcome and the constraint together. Something in the shape
of: a local invoice sorter that keeps client data on your machine.

Subheadline carries the cost comparison and the open-model claim in one or two
sentences. No feature list above the fold — that is what the nav is for.

CTAs: primary "Open the app", secondary "See the accuracy study" scrolling to
section 6.

### 8.2 Section 6 is the differentiator

Every AI product claims accuracy. Almost none publish a per-field table with
their own failures in it. Rendering `EVAL.md` directly — including the
per-field breakdown and the models that lost — is the strongest thing on the
page and the thing most likely to be remembered by a judge.

Do not soften it. The page is more credible with the 31% field visible than
without it.

---

## 9. App route structure

```
/                 landing page
/app              upload, runtime banner, batch queue
/app/review       editable results table, export
/app/chase        TabPFN payment predictions
/app/methodology  the accuracy study, full
/app/privacy      data flow, verification checklist
```

The methodology and privacy pages are app routes, not just landing sections —
they are linked from the footer and are citable references in the writeup.

---

## 10. Performance

- Landing page should render without JavaScript-dependent content above the
  fold.
- No web fonts blocking render; use `next/font` with a sane `display` swap.
- Images: use `next/image` where a real screenshot is placed.
- Target: meaningful content visible on first paint, no layout shift on the
  hero.

---

## 11. Definition of done — design

- [ ] Light and dark both correct across every route, no hardcoded colours
- [ ] Theme respects system on first visit, persists explicit choice, no flash
- [ ] All 12 shadcn primitives installed and used, not hand-rolled
- [ ] Every interactive element keyboard reachable with a visible focus ring
- [ ] All tabular numerals use `tabular-nums`
- [ ] Lime never used as light-mode text colour without a darkening step
- [ ] `prefers-reduced-motion` honoured
- [ ] Runtime banner announces state changes to assistive tech
- [ ] Accuracy table renders `_TBD_` cells as pending, never as zeros
- [ ] Footer carries full attribution and MIT licence notice
- [ ] No horizontal scroll at 320px width
