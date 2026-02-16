# Design Sprint Plan

**Goal:** A top-to-bottom redesign of the wedding site — from visual identity and typography to layout, interactions, and color. This is an interactive, collaborative sprint: before any implementation, Sam and Margaux work with the agent to make key design decisions, review inspiration, and select a direction. Only then does implementation begin.

**Process:** The sprint begins with a structured design conversation (Phase 0) that must be completed before any code is written. The agent drives this conversation by asking targeted questions, surfacing font and color options, and proposing 2–3 distinct design directions. Implementation follows only after direction is confirmed.

**Tech Stack:** Astro 5.x, TypeScript, CSS custom properties, `prefers-color-scheme`, licensed web fonts (loaded via `@font-face` or font service)

---

## Phase 0: Design Discovery (Collaborative — No Code)

This phase is a structured conversation between Sam (and optionally Margaux) and the agent. It must be completed in order. Do not skip ahead to implementation.

> **For Claude:** When starting this sprint, work through Phase 0 interactively. Ask one cluster of questions at a time, wait for answers, then move to the next. Synthesize answers into 2–3 named design directions at the end and present them for selection before writing any code.

---

### Step 0.1: Gather Inspiration

Ask Sam to share 3–5 wedding websites (or non-wedding sites with the right vibe) that they love. For each one, ask:
- What specifically do you like about it? (typography, whitespace, colors, photos, motion, tone)
- What would you keep vs. change for your own site?

Suggested sources to prompt discussion if needed:
- The Knot / Zola for conventional wedding site conventions to intentionally break or follow
- Editorial / magazine sites (e.g. NYT Weddings, Vogue) for a more elevated typographic reference
- Luxury hotel or restaurant sites for a refined, minimal feel
- Personal portfolio sites for anything unconventional

---

### Step 0.2: Vibe & Tone Questions

Ask the following, one cluster at a time:

**Mood:**
- If the site had a soundtrack, what would it be?
- Words that should describe the site's feeling: (e.g. romantic, playful, minimal, editorial, warm, cool, timeless, modern, French, New York)
- Words that should NOT describe it:

**Color:**
- Do you lean warm (cream, champagne, blush, terracotta) or cool (white, slate, sage, navy)?
- Is there a color from the wedding palette (flowers, invitations, outfits) the site should echo?
- Dark, light, or neutral background?

**Photography:**
- Will the site eventually have photos of Sam and Margaux (engagement photos, venue shots)?
- How prominent should photography be vs. typography-forward design?

**French / NYC duality:**
- Should the two events feel visually distinct (different color accents?) or unified under one aesthetic?

---

### Step 0.3: Font Discovery & Selection

The site will license a font that fits the selected vibe. This is a real purchase, so the decision should be deliberate.

Ask:
- Serif or sans-serif for body text? Or a serif display + sans-serif body pairing?
- Do you have any existing font references you love (from a magazine, book, or brand)?
- Script / calligraphy for any accent text (e.g. the couple's names in the hero)?
- Hard budget for font licensing? (Most quality type foundry licenses are $50–$300 for a web license)

**Agent should then research and propose 3–5 font options** across these categories, with notes on:
- Foundry and licensing model (per-pageview vs. flat fee, perpetual vs. annual)
- Closest free alternative (so we can prototype before purchasing)
- Example of the font in use at wedding or luxury scale
- Why it fits the vibe described in Step 0.2

Recommended foundries to consider:
- **Klim Type Foundry** — refined, contemporary serifs (Signifier, Domaine, Tiempos)
- **Grilli Type** — Swiss modernist sans-serifs (GT Alpina, GT Super, GT Flexa)
- **Sharp Type** — editorial American type (Söhne, Canela)
- **Commercial Type** — literary serifs (Publico, Guardian, Brunel)
- **Google Fonts** — free, perpetual, no license needed (but fewer distinguished options)
- **Adobe Fonts** — included in Creative Cloud subscription if Sam/Margaux have it

---

### Step 0.4: Design Direction Proposals

Based on Steps 0.1–0.3, the agent synthesizes and presents **2–3 named design directions**, each including:

- **Name** (e.g. "Parisian Editorial", "New York Modern", "Soft Garden")
- **Palette** — 3–4 hex values with labels
- **Type pairing** — display font + body font, with a sample rendering described in words
- **Layout personality** — generous whitespace vs. rich content, centered vs. asymmetric, etc.
- **Dark mode character** — what does this direction look like at night?
- **Photo treatment** — full-bleed, framed, or restrained?

Sam (and Margaux if available) selects one direction, or a hybrid. The agent records the decision and the rationale before proceeding.

---

## Phase 1: Design Foundations (Implementation)

> **Blocked on Phase 0 completion.** Do not start until a design direction is confirmed.

### Task 1: Establish CSS Design Tokens

**Goal:** Encode the confirmed design direction as CSS custom properties — the single source of truth for all colors, typography, and spacing across the site.

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/layouts/WireframeLayout.astro` (import tokens)

**Steps:**

1. Create `src/styles/tokens.css` with light-mode tokens derived from the confirmed palette:
   ```css
   :root {
     /* Colors — replace with confirmed palette */
     --color-bg: #ffffff;
     --color-text: #1a1a1a;
     --color-text-muted: #666666;
     --color-border: #e5e5e5;
     --color-surface: #f9f9f9;
     --color-accent: #1a1a1a;
     --color-accent-hover: #333333;

     /* Typography — replace with confirmed fonts */
     --font-display: /* confirmed display font */, Georgia, serif;
     --font-body: /* confirmed body font */, system-ui, sans-serif;
     --font-size-base: 1rem;
     --line-height-base: 1.6;

     /* Spacing */
     --space-xs: 0.25rem;
     --space-sm: 0.5rem;
     --space-md: 1rem;
     --space-lg: 2rem;
     --space-xl: 3rem;

     /* Borders */
     --radius-sm: 0.25rem;
     --radius-md: 0.5rem;
   }
   ```

2. Import the licensed font via `@font-face` (self-hosted from foundry files) or via the font service's `<link>` tag.
3. Import `tokens.css` into `WireframeLayout.astro`.
4. Verify no visual regression: `npm run dev`, check all pages.

---

### Task 2: Dark Mode Support

**Goal:** Make the entire site respond to the user's OS/browser dark mode preference using the modern `prefers-color-scheme` media query. No JavaScript toggle required — pure CSS, automatic, respects system preference.

**Files:**
- Modify: `src/styles/tokens.css` (add dark-mode token overrides)
- Audit: all `src/pages/**/*.astro`, `src/layouts/**/*.astro`, `src/components/**/*.astro` for hardcoded colors

**Steps:**

1. Add dark-mode token overrides in `tokens.css`. Values should come from the confirmed design direction's dark palette — not just a mechanical inversion:
   ```css
   @media (prefers-color-scheme: dark) {
     :root {
       /* Replace with confirmed dark palette */
       --color-bg: #0f0f0f;
       --color-text: #f0f0f0;
       --color-text-muted: #999999;
       --color-border: #2a2a2a;
       --color-surface: #1a1a1a;
       --color-accent: #f0f0f0;
       --color-accent-hover: #cccccc;
     }
   }
   ```

2. Audit every `.astro` file for hardcoded color values (hex, `rgb()`, named colors). Replace each with the appropriate CSS token.
   - Key culprits to find: `color: #666`, `background: #f9f9f9`, `border: 1px solid #e5e5e5`, `color: white`, `background: #1a1a1a`

3. Add `<meta name="color-scheme" content="light dark">` to the layout `<head>` — tells the browser to style native UI controls (scrollbars, form inputs) in the system theme.

4. Add `color-scheme: light dark;` to the `:root` CSS declaration.

5. Test in both modes:
   - macOS: System Preferences → Appearance → Dark
   - Chrome DevTools: Rendering panel → "Emulate CSS media feature `prefers-color-scheme`"
   - Verify: text contrast, borders, backgrounds, buttons, login modal, footer

6. Run build and tests:
   ```bash
   npm run build
   npm test
   ```

**Acceptance criteria:**
- All pages look correct in light and dark mode with no hardcoded colors leaking through
- `<meta name="color-scheme" content="light dark">` is present in the HTML `<head>`
- `color-scheme: light dark` is set on `:root`
- No JavaScript is used to detect or toggle dark mode — purely CSS

---

## Phase 2: Full Site Redesign (Implementation)

> **Blocked on Phase 0 completion.** Scope and ordering of tasks here will be finalized once a design direction is confirmed. Update this section after Phase 0.

### Task 3: Layout & Typography System

Apply the confirmed typographic scale and layout personality globally. Define heading hierarchy, body text, and spacing system in `src/styles/base.css`.

### Task 4: Homepage Redesign

Redesign `src/pages/index.astro` — hero, login CTA, teaser section — using the new tokens, fonts, and layout direction.

### Task 5: Event Landing Pages

Apply the new design to `/nyc/index.astro` and `/france/index.astro`. Determine if the two events get distinct accent colors.

### Task 6: Interior Pages

Redesign all interior pages (schedule, details, travel, RSVP, registry) consistently.

### Task 7: Components

Redesign shared components: login modal, footer, navigation, auth state display.

### Task 8: Responsive & Accessibility Audit

Full audit at 375px / 768px / 1280px. Verify color contrast in both light and dark modes meets WCAG 2.1 AA (4.5:1 for body, 3:1 for large text).

---

## Summary

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Design discovery — inspiration, vibe, fonts, direction | Not started |
| Phase 1 | Design foundations — tokens + dark mode | Blocked on Phase 0 |
| Phase 2 | Full site redesign — layout, pages, components | Blocked on Phase 0 |
