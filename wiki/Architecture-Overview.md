# Architecture Overview

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Astro v7.x, SSR server mode (Vite 8 / Rolldown, Rust compiler) |
| Adapter | `@astrojs/node` (standalone, local dev/tests); `@astrojs/netlify` (production) |
| CDN caching | Astro route caching via the `@astrojs/netlify/cache` provider |
| Language | TypeScript, strict mode |
| CSS | Astro scoped styles |
| Backend | Notion API v2025-09-03 via `@notionhq/client` v5.x |
| Email | Resend (transactional) |
| Hosting | Netlify |

## Key architecture decisions

These were set early ([Architecture Design, Feb 2026](Project-History)) and have held:

- **Notion as backend**: guest data and event details live in Notion, fetched at build time (reads) with targeted runtime lookups (writes — RSVP submissions).
- **Hybrid SSR**: static pages plus Astro server endpoints for RSVP writes. Chosen over Netlify Edge Functions for the API layer because the code lives alongside the rest of the app, shares the same TypeScript config, works under `npm run dev`, and stays portable if hosting ever changes.
- **Netlify adapter** for the production server endpoints.
- **Auth**: cookie-based sessions (httpOnly, HMAC-signed) plus `localStorage` for non-sensitive preferences.
- **Email**: Resend, chosen for its free tier (covers the wedding's total expected volume), simple API, and good deliverability. Requires SPF/DKIM on the `sargaux.com` domain.
- **URL structure**: event-centric — `/nyc/*` and `/france/*` mirror each other, with shared pages like `/registry` living at the top level.

## URL structure

```
/                       # Homepage — hero, login CTA
/registry               # Shared registry (or a country-based redirect — see Registry Integration)

/nyc/                   # NYC event landing page
/nyc/schedule
/nyc/details
/nyc/travel
/nyc/rsvp
/nyc/calendar.ics       # personalized, see RSVP & Calendar

/france/                # France event landing page
/france/schedule
/france/details
/france/travel
/france/rsvp
/france/calendar.ics

/api/rsvp               # Server endpoint for RSVP submissions
/api/login, /api/logout
/api/admin/*            # ops endpoints, see Admin Endpoints
```

An early "dream feature" of `pushState()`-based seamless toggling between events was superseded by Astro's `ClientRouter` view-transitions system — see [View Transitions & UI](View-Transitions-And-UI).

## Project structure

- `src/pages/` — Astro pages (file-based routing)
- `src/pages/api/` — server-side API endpoints (login, logout, RSVP, admin)
- `src/lib/auth.ts` — authentication utilities (name validation, session tokens)
- `src/lib/event-routing.ts` — shared default event-routing rules
- `src/lib/notion.ts` — Notion client wrapper (guest/event data fetching, caching)
- `src/types/guest.ts` — `GuestRecord` type
- `src/config/features.ts` — build-time feature flags (see [Feature Flags](Feature-Flags))
- `src/middleware.ts` — route protection and auth context
- `src/layouts/` — page layouts (`WireframeLayout`, etc.)
- `public/` — static assets
- `tests/` — Playwright test suites
- `astro.config.mjs`, `tsconfig.json` — build/type config

## Notable gotchas

- SVGs used by pages should prefer Astro-managed imports from `src/assets/` over hard-coded `/public` paths — especially for critical visual elements like the NYC skyline and favicons.
- Use `<script is:inline>` for scripts on pages with early returns (e.g. auth redirects) to avoid an "Unknown chunk type: script" build error.
- The Astro 7 Rust compiler strips custom attributes (including `data-astro-rerun`) from `define:vars` inline scripts — don't combine the two; pass server values via `data-*` attributes and use the `astro:page-load` + init-guard pattern instead.
- Don't add direct `astro:transitions/client` imports inside `is:inline` page scripts — let `ClientRouter` own transition interception.
- The `WireframeLayout` `page` prop sets `data-page` on `<html>` statically, allowing per-page CSS scoping without inline scripts (used by `nyc/travel.astro` to position the shared disc).
- `.site-header::before` extends a 25px panel above the header's top edge to cover springy-overscroll bleed — purely cosmetic.

## CDN caching contract

Content pages (couple, faq, details, travel, lookbook, schedule, registry, event indexes) are CDN-cached **per guest**: `routeRules` in `astro.config.mjs` sets `maxAge`/`swr`, and middleware sets `Netlify-Vary: cookie=sargaux_auth|sargaux_lang` on every page response including redirects, so cache variants never leak across sessions and the login wall stays intact. RSVP pages are never cached (`private, no-store`). The logged-out homepage is cached via `Astro.cache.set()` after the auth redirect. The personalized calendar endpoint is cached per-token URL and invalidated by `POST /api/rsvp`. Only Astro's built-in cache API is used — never Netlify's `purgeCache()` directly. The provider is only wired for the Netlify adapter; under `ASTRO_ADAPTER=node`, caching is inert, so CDN behavior must be verified on deploy previews (`Cache-Status` header).

## The Astro 6 → 7 upgrade (July 2026)

Upgraded `astro@^7`, `@astrojs/netlify@^8`, `@astrojs/node@^11` (Vite 8.1 / Rolldown), and adopted the stable CDN cache provider described above at the same time as a Notion-performance and RSVP-loading-indicator pass. Decisions:

- Cache scope: the content pages listed above, per-guest; RSVP is never cached.
- All caching goes through Astro's built-in API — no direct Netlify `purgeCache()`.
- Notion perf: targeted fetches **and** a Netlify Blobs-persisted guest cache (see [Notion Backend](Notion-Backend)).
- `compressHTML` adopted the new `'jsx'` default after an audit found no whitespace regressions.

**Compiler regression found during the upgrade**: the Astro 7 Rust compiler strips custom attributes (including `data-astro-rerun`) from `define:vars` inline scripts, so the homepage login script silently stopped re-executing after client-side swaps (logout → home → `Entrée` did nothing). Fixed by dropping `define:vars`/`data-astro-rerun` and moving to the `astro:page-load` + init-guard pattern with server values passed via `data-*` attributes — this is now the standing convention (see the gotcha above). Local test suite runtime dropped from ~1.4 minutes to ~30 seconds as a side effect of the Notion caching work.

CDN behavior (cache hits, vary, invalidation) cannot be exercised locally — verify on a Netlify deploy preview.
