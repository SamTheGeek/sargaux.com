# Login And Routing Behavior

This note documents the current homepage login interaction and the default event-routing behavior so future changes do not accidentally regress them.

## Homepage Login Control

Relevant implementation:

- `src/pages/index.astro`

Current behavior:

- The homepage login is a single inline control, not a modal.
- Default state shows the `Entrée` trigger button.
- Clicking `Entrée` adds `is-active` to `#inline-entry-control`.
- In the active state, `.inline-name-shell` changes from `display: none` to `display: flex`.
- The text input `#name` is then focused in `requestAnimationFrame`.
- The hidden-state accessibility fix depends on `display: none`, not `aria-hidden`.

Important visual caveat:

- The active state is intentionally very subtle.
- The input shell occupies the exact same position and dimensions as the `Entrée` button.
- Visually, the dark bar mostly stays the same; the main visible change is that `ENTRÉE` becomes the `Your name` placeholder with the orange submit arrow.
- This can make the control look unchanged at a glance even when it is working correctly.
- This is not currently a z-index bug.

Observed click-through result:

- Clicking `Entrée` reveals the inline input and focuses `#name`.
- Submitting a valid guest name logs in successfully and navigates to the guest's default event route.

## Disc Transition Behavior

Relevant implementation:

- `src/layouts/WireframeLayout.astro`
- `src/pages/index.astro`
- `src/pages/nyc/index.astro`
- `src/pages/france/index.astro`

Current behavior:

- Astro `ClientRouter` is enabled in the shared layout.
- The homepage hero disc, NYC disc, and France disc all use `transition:name="event-disc"`.
- This is intended to let Astro/browser view transitions animate the shared amber disc between pages.
- Homepage login does not call `astro:transitions/client` directly anymore.
- Post-login navigation uses a temporary anchor click so the client router can intercept the navigation.

## Header Transition Behavior

Relevant implementation:

- `src/styles/base.css`
- `src/pages/nyc/index.astro`
- `src/pages/france/index.astro`

Current behavior:

- The `Chez Sargaux` header logo is a shared transition target between NYC and France.
- The event toggle (`NYC | France`) is also a shared transition target between those pages.
- The top-right RSVP button is also a shared transition target between those pages.
- The header row uses a grid layout so the right-side controls stay pinned to the same right edge regardless of logo font metrics.
- The event toggle slots and RSVP button width are intentionally normalized to reduce visible jumping during NYC/France transitions.

Design intent:

- Switching between NYC and France should feel like the same header transforming, not two unrelated headers crossfading.
- The logo text may still change appearance because the underlying event pages use different typography, but its position and transition identity should remain stable.

## SVG Asset Pitfalls

Relevant implementation:

- `src/pages/nyc/index.astro`
- `src/layouts/WireframeLayout.astro`
- `src/pages/index.astro`

Important rule:

- When an SVG is used as an image source or favicon URL, import it with `?url`.
- Example: `import skylineFill from '../../assets/nyc/skyline-fill.svg?url'`
- Do not assume a bare `.svg` import will always behave like a URL string in Astro.

Failure mode observed:

- Bare SVG imports can be treated as component-like values instead of URL strings.
- If one of those values is passed into `<img src={...}>`, the browser can end up requesting nonsense function-like paths.
- In dev, this produced bizarre 404s that looked like `/(...args) => { ... }`.
- The visible symptom on the NYC page was that the skyline disappeared entirely.

Debugging guidance:

- If the NYC skyline disappears, inspect the actual rendered `src` of `.nyc-skyline-fill` and `.nyc-skyline-outline`.
- Correct behavior is an Astro-managed asset URL such as `/src/assets/nyc/skyline-fill.svg?...` in dev or a hashed asset path in build output.
- If the page is still requesting `/images/nyc/skyline-fill.svg` after the source code changed, suspect a stale local server process first.

Dev-console guidance:

- Not every Astro console error in dev comes from the page implementation.
- Astro's dev toolbar and audit overlay can emit noisy errors unrelated to the page's real runtime behavior.
- Distinguish between page-breaking asset errors and dev-toolbar-only errors before changing application code.

Important debugging note:

- If the browser console shows `failed to load resource: unsupported URL` for `astro:transitions/client`, treat that as a stale bundle or stale dev session first.
- The current source should not ship a direct `astro:transitions/client` import from the homepage script.
- Before debugging further, restart the local server and hard refresh the page.

## Default Event Routing

Relevant implementation:

- `src/lib/event-routing.ts`
- `src/pages/api/login.ts`
- `src/pages/index.astro`
- `src/middleware.ts`

Current rule:

- Guests invited only to NYC default to `/nyc`.
- Guests invited only to France default to `/france`.
- Guests invited to both events default to `/nyc` through October 14, 2026.
- Starting October 15, 2026, guests invited to both events default to `/france`.
- The routing cutoff is evaluated in the `America/New_York` time zone.

Why this matters:

- The same helper must be used everywhere default routing is decided.
- Homepage auto-redirect, login API redirect, and middleware fallbacks should remain aligned.

## Deep-Link Return (`?next=`)

Relevant implementation:

- `src/lib/return-to.ts`
- `src/middleware.ts`
- `src/pages/api/login.ts`
- `src/pages/index.astro`

Current rule:

- An unauthenticated request for a protected page redirects to
  `/?next=<encoded path>` instead of a bare `/`.
- A successful login — one-step, or two-step through the identity picker —
  lands the guest on that page instead of their default event route.
- The default event route is still the fallback: for no `next`, for a `next`
  that fails validation, and for a `next` pointing at an event the guest is not
  invited to (silently, since the two guest lists barely overlap and a
  forwarded link for the wrong event is routine).
- Only `/nyc/*`, `/france/*`, `/couple` and `/registry` are returnable — the
  same set `PROTECTED_ROUTES` guards.
- Only the unauthenticated branch attaches `next`. The redirects that *delete*
  the session cookie (descoped guest, name/record mismatch, empty invitations)
  stay on a bare `/`; they are repair paths.

Why this matters:

- `sanitizeReturnTo` is the open-redirect gate. It must keep failing closed on
  scheme-bearing, protocol-relative (`//host`), backslash and control-character
  inputs, and on anything outside the returnable prefixes.
- The destination is validated **server-side** in `/api/login`, where the
  guest's real event invitations are known. The client sends `next`; it is never
  trusted.
- The login page's `Netlify-Vary` includes `query=next` because the language
  switcher server-renders the param into its hrefs. Dropping that would let the
  first visitor who warms the cached homepage pin their destination into every
  other guest's language links.

## Regression Checks

When touching login or routing, verify all of the following:

- Clicking `Entrée` reveals and focuses `#name`.
- The hidden login shell is not exposed as focusable while collapsed.
- Valid login still reaches the default route for that guest.
- Dual-invite guests route to NYC before October 15, 2026 and France on/after October 15, 2026.
- A logged-out hit on a protected page lands on `/?next=…`, and logging in from
  there returns the guest to that page — including through the identity picker.
- The shared amber disc still animates into its destination position on that
  post-login navigation (compare against the equivalent in-site navigation).
- The homepage script does not reintroduce a direct inline import of `astro:transitions/client`.

Useful verification commands:

```bash
npm run build
npx playwright test tests/event-routing.spec.ts tests/auth.spec.ts tests/access-control.spec.ts tests/return-to-unit.spec.ts
```
