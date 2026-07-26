# Brand & Design

## Positioning

Two events, one system. The design system is architectural and restrained — it should feel like a cultural institution, not a wedding suite.

**Tone**: structured, urban, restrained, confident, warm (but not sentimental). **Not**: romantic script, ornate, floral-heavy, rustic, playful.

**The connective thread**: Burnt Amber (`#D96A1E`) appears in both event identities without exception — it references the cover of the 1970 NYCTA Graphics Standards Manual, the livery of early TGV trains, and home, simultaneously. The shared motif is a **sun disc**: a perfect geometric circle, flat color, no texture or gradient, often cropped by the composition edge. It's structural, never decorative, and is the single graphic motif shared across both event identities (see [View Transitions & UI](View-Transitions-And-UI) for how it animates between routes).

## Shared system rules

- 8px baseline grid, non-negotiable across both events. Content max-width 960px; page margins 64px desktop / 24px mobile; 12-column grid, 24px gutters.
- Body typeface: Neue Haas Grotesk (or Helvetica Neue) across both events. Tracking 0. ALL CAPS headings only — no mixed-case display. Line height 1.2 headings / 1.6 body. No italics, no decorative weights.
- No pure black, no pure white, no gradients, no ornamentation, no bright red, no pastel tones. Horizontal hairline rules divide sections, never doubled. Whitespace is structural, not decorative — every element must serve a structural purpose.
- QR codes use the event's primary text color, no box background, no reversal, minimum 0.25in clear space.
- Copy: direct, declarative sentences ("Together with their families," "Invite you to celebrate their marriage," "Cocktail Attire"). Avoid poetic metaphors, "happily ever after"/"to follow"/ceremony language, and exclamation marks — see [Localization (i18n)](Localization-i18n) for the parallel French rules.
- Print specs: uncoated warm white stock, minimum 110lb cover, matte finish only, matte ink, no gloss coating.
- **System integrity checklist** for any new design element: is it geometric? restrained? urban? free of decoration? does it respect the 8px grid? If something feels ornamental, remove it.

## NYC event identity

**October 11, 2026 — New York City.** Grounded in the 1970 NYCTA Graphics Standards Manual (Massimo Vignelli / Bob Noorda) — intentional and precise, never on the nose.

- Typeface: Neue Haas Grotesk only. Type scale (all multiples of 8px): H1 64px/0.08em, H2 32px/0.08em, H3 20px/0.05em, body 16px/0, caption 12px/0.05em. Headings ALL CAPS, body sentence case.
- Palette: Warm Cream `#F1ECE3` (background), Dark Moss `#2F3F36` (primary text/headings), Burnt Amber `#D96A1E` (accent), Espresso Brown `#3A2E26` (secondary text/borders). No other colors.
- Motifs: **station disc** (8–16px solid circle bullet marker for date/venue/time, Dark Moss or Burnt Amber); **information band** (full-width hairline above/below key content zones, at most once per section); **skyline block** (abstract NYC skyline, rectangular geometry only, no curves/windows/linework, Dark Moss, 25–35% page height, footer only).

## France event identity

**May 28–30, 2027 — Village de Sully.** Grounded in the golden age of glamorous international travel — SNCF/PLM railway posters, transatlantic ocean-liner advertising, early Air France (1920s–1950s: Cassandre, Broders, the PLM poster tradition).

- Display typeface: **Peignot** (A.M. Cassandre, 1937, Adobe Fonts) — its lowercase renders as geometric small caps, so it reads as entirely uppercase even in mixed case; period-correct without being costume-y. Body typeface stays Neue Haas Grotesk per the parent brand. Type scale: H1 Peignot 64px/0.05em Bold, H2 Peignot 32px/0.05em Regular, H3/body/caption Neue Haas Grotesk as NYC.
- Palette: Warm Cream `#F1ECE3` (background, same as NYC), Prussian Blue `#1B3A6B` (primary text/headings), Burnt Amber `#D96A1E` (accent — TGV livery, sun disc), Dark Moss `#2F3F36` (tertiary accent only). The swap from Dark Moss to Prussian Blue as primary text is the visual signal of France — it evokes ocean-liner hulls, railway night skies, and PLM/SNCF poster blues.
- Motifs: **destination header** (location name in Peignot, ALL CAPS, thin rule above/below, once per page); **route arc** (a single ~90° curved line, at most once per page, never decorative).

## Derived system colors (CSS tokens)

Not new brand colors — each is a tint/shade of a core color. Derivation rules: card surfaces invert (event's primary text color as background, cream as card text; dark mode lightens ~8%); borders match primary text in light mode, lighten background ~12% in dark; muted text uses the secondary brand color in light mode, desaturated/lightened primary at ~60% brightness in dark; dark-mode background darkens the primary text color ~85% rather than going neutral gray.

| Token | NYC light | NYC dark | France light | France dark |
|---|---|---|---|---|
| Background | `#F1ECE3` | `#1A2420` | `#F1ECE3` | `#0F1A2E` |
| Text | `#2F3F36` | `#F1ECE3` | `#1B3A6B` | `#F1ECE3` |
| Text muted | `#3A2E26` | `#8A9484` | `#2F3F36` | `#7B8FAA` |
| Accent | `#D96A1E` | `#D96A1E` | `#D96A1E` | `#D96A1E` |
| Surface | `#2F3F36` | `#243530` | `#1B3A6B` | `#162040` |
| Surface text | `#F1ECE3` | `#F1ECE3` | `#F1ECE3` | `#F1ECE3` |
| Border | `#2F3F36` | `#2E3E35` | `#1B3A6B` | `#1A2844` |

> **Dark mode gotcha** (also in the repo's agent instructions): `--color-text` and `--color-surface-text` both resolve to warm cream in dark mode — never use both as `background` + `color` on the same element; use `--color-bg` for text color on a `--color-text`-colored background instead. `--color-border` in dark mode (`#2E3E35`) is nearly invisible against the dark surface — use `--color-text-muted` for interactive UI borders (event rows, custom checkboxes) that must stay visible.

## Design inspiration references

Every reference site shared one trait: **no bordered content boxes as the primary layout unit** — content organized by whitespace, full-width bands, hairline rules, scale contrast, and color fields, not rectangles with borders. That was identified as the single biggest gap between the pre-redesign site and where it needed to go. Other shared patterns: large type *as* the content (not headers above boxes); full-width sections separated by color/hairline/whitespace; horizontal reading motion; personality through scale contrast (a 64px heading next to 12px caption); and no rounded corners, drop shadows, gradients, or icon-in-a-box clichés.

Reference sites reviewed and their relevance: **Jones Bar-B-Q** (most relevant to NYC — full-width alternating sections, editorial bold headlines, no cards); **Jus Jus Verjus** (most relevant to France — refined minimalism plus illustration warmth, hairline dividers, alternating text/image); **Thirsty Dumpling** (sub-page information structure — numbered steps without boxes); **Mack & Pouya** (immersive hero-first landing page reference); **byMarkLange** (asymmetric/layered composition — elements overlap and float rather than stack); **diana.lu / yelena-sophia.webflow.io** (editorial whitespace, text-as-navigation); **Johnny Harris** (structured-but-not-boxed editorial credibility).

This translated into concrete implications: all bordered `.content-box`/`.travel-card`/`.info-card`/`.day-card`/`.timeline-item` containers were removed in favor of full-width bands separated by hairline rules; the 64px ALL-CAPS H1 was made to dominate rather than being overridden smaller; the sun disc became a rendered CSS circle on event landing pages rather than a concept. NYC pages read like a subway information panel (fixed-width columns, station-disc bullets, hairlines dividing zones); France pages read like a vintage travel poster (Peignot destination header at full scale, route-arc motif at most once); interior pages read as single-column editorial narrative (schedule as a train-timetable layout — time left-aligned, event name large, location small below — rather than timeline boxes).

## How the direction was chosen: the design sprint process

Rather than the agent unilaterally picking a direction, the redesign used a structured collaborative process:

1. **Phase 0 — design discovery** (no code): gather 3–5 reference sites Sam and Margaux loved and what specifically they liked about each; a round of vibe/tone/color/photography questions; font discovery across several type foundries (Klim, Grilli Type, Sharp Type, Commercial Type, Google Fonts, Adobe Fonts) with licensing notes and free-alternative prototyping options; then 2–3 named, fully specified design directions (palette, type pairing, layout personality, dark-mode character, photo treatment) presented for selection.
2. **Phase 1 — design foundations**: CSS design tokens (`src/styles/tokens.css`) encoding the confirmed palette/type as the single source of truth; dark mode via `prefers-color-scheme` only (no JS toggle), including a full hardcoded-color audit across every `.astro` file and `<meta name="color-scheme" content="light dark">` in the layout head.
3. **Phase 2 — full site redesign**: typography/layout system, homepage, event landing pages (NYC vs. France distinct accents), interior pages, shared components, then a responsive/accessibility audit at 375px/768px/1280px against WCAG 2.1 AA contrast (4.5:1 body, 3:1 large text).

An earlier **wireframe review session** preceded the visual redesign — an interactive page-by-page walkthrough (homepage, both event landing pages, all sub-pages, registry) to settle information-architecture and content questions (dress code, two-venue flow, accommodation pricing display, registry service choice) before any styling work, so wireframes wouldn't need to be redesigned twice. The subsequent **wireframe updates** implementation applied those decisions across global cleanup, homepage, and both events' sub-pages.

This document (the brand/design system above) itself notes it was a working draft pending that Phase 0 conversation — font licensing, final color values, and motif refinements were confirmed during the sprint.
