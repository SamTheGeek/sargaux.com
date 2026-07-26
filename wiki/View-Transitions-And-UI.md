# View Transitions & UI

The site uses Astro's `ClientRouter` (view transitions) to animate between routes, most notably a shared amber "sun disc" motif (see [Brand & Design](Brand-And-Design)) that appears to move between the homepage, NYC, and France. This turned out to be one of the trickiest parts of the codebase to keep stable, so the rules below are hard-won and load-bearing — see also the login-UI notes in [Authentication & Sessions](Authentication-And-Sessions).

## The disc transition contract

The shared disc uses `transition:name="event-disc"` (**no** `transition:persist`) on all NYC pages (index, details, travel). Removing `transition:persist` was required to let the View Transitions API reliably FLIP between pages.

- **Forward navigation** (clicking into sub-pages): the disc FLIP is suppressed via `astro:after-preparation` in `WireframeLayout` — if `toDepth > fromDepth` (by URL path-segment count), the disc's `view-transition-name` is temporarily set to `none` on the old element before the VT snapshot, preventing an unwanted cross-screen animation.
- **Backward navigation** (returning to a parent page): the disc FLIP plays normally.
- The NYC/France headers intentionally share transition targets for `Chez Sargaux`, the event toggle, and the RSVP button, so switching events feels like the same header transforming rather than two headers crossfading. The header row uses a grid layout so the right-side controls stay pinned to the same right edge regardless of logo font metrics.

### Choosing the right fix for a given case

- If the disc should keep animating independently but some text/UI must stay above it: put that content in its own named view-transition group with a z-index above `event-disc`. (Example: the login page, where the disc still animates but must not cover the entering text.)
- If the disc should remain visually behind a route family's content for the whole transition: suppress the disc's `view-transition-name` on both the old and new documents for that navigation.
- **NYC index → Details/Travel** uses a hybrid: suppress the disc VT name so it stays in the root snapshot, then temporarily assign a named VT group to the incoming sub-page hero *above* `root` so the entering header isn't trapped under the exiting snapshot while the moss/content rises in above it. Inject that VT name during `astro:before-swap` and remove it on `astro:page-load` — don't leave `transition:name` in the page markup itself, or the hero can stay compositor-promoted after the animation and end up layered wrong during normal scrolling.

### Shared z-index scale

Keep the shared scale aligned with the global stack when using named groups: root `1`, disc `2`, content `3`, moss `4`, header `100`. Don't raise groups above this scale just to force visibility — choose the correct strategy above instead.

### Clipping during motion

If a sliding VT snapshot is visually correct at the end state but appears clipped mid-motion, check the transition pseudo-tree before touching z-index. Allowing overflow on `::view-transition-group(...)`/`::view-transition-image-pair(...)` often fixes content that should slide over a neighboring layer but is being cropped to its snapshot box.

### Never suppress via this CSS pattern

`html[data-astro-transition] ::view-transition-group(name)` does not reliably fire, because `data-astro-transition` may not be set at the right moment relative to pseudo-element creation. Use the `astro:after-preparation` JS event to modify `view-transition-name` directly on the element before the VT snapshot instead.

## NYC index ↔ sub-page transition (Chrome vs. Safari)

The moving element is `.nyc-page-moss`, not the individual `.details-section`/`.details-band` children — that wrapper must keep a solid background in shared layout CSS (light: `--color-dark-moss`; dark: `--color-nyc-skyline-dark`), or the entering animation reads as a clipped strip instead of one continuous field.

**Chrome/Chromium**: `.nyc-page-moss` gets a temporary `view-transition-name: nyc-page-moss`. Keep `::view-transition-group(nyc-page-moss)` at z-index `4`, keep old/new overflow visible, and remove the temporary VT name on `astro:page-load`. For `/nyc` → `/nyc/*`, do **not** suppress `event-disc` — the index and sub-page discs should stay active as a two-sided pair so the disc translates rather than crossfades.

**Safari** doesn't use the same reliable path. On `/nyc` → `/nyc/*`: don't give `.nyc-page-moss` the VT name; add `.nyc-page-moss-entering` instead and animate the real DOM element with `nyc-moss-slide-up`. If Safari gets both the fallback class and the VT name, it goes back through the compositor snapshot path and the entrance can clip.

**Return to index**: sub-page → `/nyc` must not reuse the same suppression as sibling navs — restore `view-transition-name: event-disc` on the OLD sub-page disc, leave the NEW `/nyc` disc active, and suppress header children only. This regressed once when forward/backward/sibling NYC navigations were merged into one broad `isNycSubpageNav` branch.

`<html>` route attributes (`data-event`, `data-page`, `lang`) must be synced from the incoming document *before* the new snapshot, or incoming transition CSS can resolve against the old route for one frame.

### Verification

When touching this area, check: Chrome `/nyc → /nyc/details`, Chrome `/nyc → /nyc/travel`, Safari/WebKit both of the same, and at least one shorter viewport height (e.g. 1280×640).

## Shared CSS loading

Never `@import` shared site CSS (`src/styles/tokens.css`, `src/styles/base.css`) inside inline Astro `<style>` blocks, especially in shared layouts — use module-level imports instead (`import '../styles/tokens.css';`). With inline `@import`, Astro/Vite can leave a stale layout style block in the document during client-side navigation, which can coexist with new route styles and cause transition-only regressions (this specifically caused `/nyc/details → /nyc` to reuse old typography after the transition while direct loads stayed correct). If a transition-only visual bug appears, compare direct-load vs. SPA-navigation computed styles and look for duplicate `style[data-vite-dev-id]` tags in DevTools.

If a transition fix works on the first navigation but fails on repeated back/forward or sibling navigations, move the transition-critical override out of the layout's inline `<style>` block and into a module-level shared stylesheet — this fixed the France Travel dark-mode info boxes on repeated navigations.

## Typography flicker

If styled text flickers on first load, suspect font loading before touching layout CSS. Branded custom fonts should use `font-display: block`, not `swap`, when visible fallback text causes a noticeable flicker. Preload the exact font files used above the fold for a route — one preload does not cover neighboring weights. To debug, delay the font request in Playwright and compare text geometry before/after `document.fonts.ready`; a width/height change confirms a font-swap regression.

## SVG asset pitfalls

When an SVG is used as an image source or favicon URL, import it with `?url` (e.g. `import skylineFill from '../../assets/nyc/skyline-fill.svg?url'`) — a bare `.svg` import can be treated as a component-like value instead of a URL string, which can produce bizarre function-like 404 paths in dev and make the NYC skyline disappear entirely. If the browser console shows `failed to load resource: unsupported URL` for `astro:transitions/client`, suspect a stale bundle/dev session first — restart the local server and hard refresh before debugging further. Not every Astro dev-console error is real: the dev toolbar/audit overlay can emit noise unrelated to actual runtime behavior.
