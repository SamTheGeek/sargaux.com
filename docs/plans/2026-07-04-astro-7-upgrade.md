# Astro 7 Upgrade + CDN Caching + RSVP Performance

**Date:** 2026-07-04
**Status:** Implemented

## Goals

1. Major version upgrade: Astro 6.4 → 7.x, @astrojs/netlify 7 → 8, @astrojs/node 10 → 11 (brings Vite 8 / Rolldown and the Rust compiler)
2. Adopt Astro 7's stable CDN cache provider with `@astrojs/netlify/cache` ([withastro/astro#16335](https://github.com/withastro/astro/pull/16335))
3. Cut login and RSVP-form response times (cold-start Notion round-trips)
4. Show the login form's animated-dots loading indicator on the RSVP buttons — both while the RSVP form page loads and while a submission is in flight

## Decisions (confirmed with Sam)

- **Cache scope:** content pages (couple, faq, details, travel, lookbook, schedule, registry, event indexes) are CDN-cached **per guest** — the cache key varies on the `sargaux_auth` + `sargaux_lang` cookies via `Netlify-Vary`, so the login wall stays intact and the personalized footer/toggle stay server-rendered. RSVP pages are never cached.
- **Built-in API only:** all caching goes through Astro's `routeRules` / `Astro.cache` / `context.cache.invalidate()` — no direct Netlify `purgeCache()` API usage.
- **Perf depth:** targeted Notion fetches **and** a Netlify Blobs-persisted guest cache.
- **French label:** `Saving` / `Enregistrement` (human-provided).
- **compressHTML:** adopt the new `'jsx'` default (audited; no whitespace regressions).
- **Version:** stays at 1.0.0 per Sam.

## What changed

### Upgrade

- `astro@^7`, `@astrojs/netlify@^8`, `@astrojs/node@^11`, Vite 8.1 (Rolldown)
- **Compiler regression found:** the Astro 7 Rust compiler strips custom attributes
  (including `data-astro-rerun`) from `define:vars` inline scripts, so the homepage
  login script silently stopped re-executing after client-side swaps (logout → home
  → `Entrée` did nothing). Fixed by dropping `define:vars`/`data-astro-rerun` and
  moving to the `astro:page-load` + init-guard pattern with server values on
  `data-*` form attributes. Worth reporting upstream.

### CDN caching (`astro.config.mjs`, `src/middleware.ts`)

- `cache: { provider: cacheNetlify() }` — only when building with the Netlify
  adapter. Under `ASTRO_ADAPTER=node` (local dev, Playwright) no provider is set,
  so caching is inert and middleware auth runs on every request.
- `routeRules`: content pages get `{ maxAge: 3600, swr: 86400 }`. Netlify purges
  the CDN (incl. durable cache) on deploys, so staleness is bounded by deploys.
- Middleware sets `Netlify-Vary: cookie=sargaux_auth|sargaux_lang` on every page
  response **including redirects** (a cached 302 must never leak across variants).
- Logged-out homepage: `Astro.cache.set()` in `index.astro` (after the auth
  redirect, so authenticated variants are never cached from there).
- `/api/calendar/[token].ics`: cached durably on 200s only; `POST /api/rsvp`
  invalidates each party member's calendar path via `cache.invalidate({ path })`
  after regenerating their ICS.

### Notion performance (`src/lib/notion.ts`)

- `parseGuestPage()` extracted — one parser for full scans, the login title-filter
  query, and direct page retrieves.
- **Blobs guest cache** (`guest-cache` store, 15-min TTL): cold starts hydrate the
  in-memory guest list from one blob read instead of a full paginated Notion scan.
  Written after every full scan (incl. `/api/warm`), deleted by `clearGuestCache()`.
  Best-effort — silently skipped where Blobs isn't available (local/tests).
- `getGuestById()`: memory → blob → single `pages.retrieve` (deduped, 15-min TTL).
  Never triggers a full scan.
- `getGuestParty()` / `getGuestEvents()` / `submitRSVP()` now use targeted lookups;
  related guests and event pages fetch in parallel. Event pages get a 15-min TTL
  cache. `findGuestByName()` (login) checks memory → blob → title-filter query →
  full-scan fallback; a stale-cache miss falls through to the live query so newly
  added guests can always log in.
- Local test suite runtime dropped from ~1.4m to ~30s as a side effect.

### Loading indicators

- `src/components/LoadingDots.astro` + shared styles in `base.css`
  (`.loading-dots`, `.is-loading`, `.btn-label`/`.btn-progress`, `.loading-hide`),
  mirroring the homepage login dots animation.
- Nav: header RSVP buttons and RSVP strip CTAs on both event index pages carry
  `data-loading-button`; `src/scripts/transitions.ts` adds `.is-loading` on
  `astro:before-preparation` (via `sourceElement`) so dots animate while the
  Notion-backed RSVP page renders. Strip CTAs swap their arrow for the dots.
- Submit: both RSVP forms' submit buttons swap their label for
  `Saving…` / `Enregistrement…` with animated dots while `POST /api/rsvp` runs.

## Verification

- `npm run build` under both adapters
- Full Playwright suite: 167 passed, 13 skipped (includes the previously failing
  logout → re-login flow, root-caused to the compiler regression above)
- Visual checks: dots on NYC/France header buttons, strip CTAs, submit buttons
  (EN + FR); footer `·` separators unaffected by `compressHTML: 'jsx'`
- CDN behavior (cache hits, vary, invalidation) **cannot be exercised locally** —
  verify on the Netlify deploy preview: repeat page loads should show
  `Cache-Status: "Netlify Durable"; hit`, logged-out deep links must still
  redirect to `/`, and an RSVP submit should refresh the calendar ICS.
