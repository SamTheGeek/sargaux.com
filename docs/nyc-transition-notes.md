# NYC transition notes

This documents the non-obvious rules that keep the NYC index -> sub-page transition
working across Chrome and Safari.

## Moss zone invariant

The moving element is `.nyc-page-moss`, not the individual `.details-section` or
`.details-band` children.

That wrapper must keep a solid background in shared layout CSS:

- light mode: `var(--color-dark-moss)`
- dark mode: `var(--color-nyc-skyline-dark)`

If the background only lives on the child sections, the entering animation reads
like a clipped strip at the first cream band instead of one continuous moss field.

## Chrome / Chromium path

For normal view-transition engines, `.nyc-page-moss` gets a temporary
`view-transition-name: nyc-page-moss`.

Requirements:

- keep `::view-transition-group(nyc-page-moss)` at z-index `4`
- keep `::view-transition-old/new(nyc-page-moss)` overflow visible
- remove the temporary VT name on `astro:page-load`

This is what lets the moss layer slide above the disc without staying promoted
after the navigation completes.

For `/nyc` -> `/nyc/*`, do not suppress `event-disc`.

The index disc and the sub-page disc should stay active as a two-sided pair so
the disc translates into the new position instead of crossfading.

## Safari fallback path

Safari does not use the same reliable path for this transition.

On `/nyc` -> `/nyc/*` navigations:

- do not give `.nyc-page-moss` the `nyc-page-moss` VT name
- add `.nyc-page-moss-entering` instead
- animate the real DOM element with `nyc-moss-slide-up`

If Safari gets both the fallback class and the VT name, the browser goes back
through the compositor snapshot path and the travel/details entrance can clip.

## Return-to-index disc rule

Sub-page -> `/nyc` navigations must not use the same disc suppression as sibling
navs.

On return to `/nyc`:

- restore `view-transition-name: event-disc` on the OLD sub-page `.nyc-disc`
- leave the NEW `/nyc` disc active
- suppress header children only

If forward or backward paths suppress the disc on both sides, the disc no longer
FLIPs and will crossfade instead. This regressed once when
forward/backward/sibling NYC navigations were merged into one broad
`isNycSubpageNav` branch.

## Related route-state rule

`<html>` route attributes (`data-event`, `data-page`, `lang`) must be synced from
the incoming document before the new snapshot. Otherwise incoming transition CSS
can resolve against the old route for one frame and produce incorrect layering.

## Shared CSS loading rule

Shared site CSS must not be loaded into `WireframeLayout.astro` via inline-style
`@import`.

Use module imports instead:

- `import '../styles/tokens.css';`
- `import '../styles/base.css';`

Why this matters:

- with inline `@import`, Astro/Vite can leave a stale layout style block in the
  document during client-side navigation
- that stale block can coexist with the new route styles and produce
  transition-only regressions
- this specifically caused `/nyc/details -> /nyc` to reuse old typography tokens
  after the transition while direct `/nyc` loads stayed correct

If a transition-only visual bug appears again, compare direct-load vs SPA
navigation computed styles and inspect `style[data-vite-dev-id]` in DevTools for
duplicate route or layout style tags.

## Verification

When touching this area, verify:

- Chrome: `/nyc` -> `/nyc/details`
- Chrome: `/nyc` -> `/nyc/travel`
- Safari/WebKit: `/nyc` -> `/nyc/details`
- Safari/WebKit: `/nyc` -> `/nyc/travel`
- at least one shorter viewport height, e.g. `1280x640`
