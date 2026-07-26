> **This page is a generated mirror**, published purely so the instructions coding agents follow are browsable by humans. It is synced automatically from `.agents/CLAUDE.md` and root `AGENTS.md` in the repo — **edit those files, not this page**. Direct edits here are overwritten on the next sync (see `.github/workflows/wiki-sync.yml`).
>
> These files are load-bearing for coding agents: Claude Code (and similarly, tools that read `AGENTS.md`) load them automatically into context at the start of every session. The wiki is not fetched automatically by any agent runtime, which is why the content has to live in the repo itself rather than only here.

---

# CLAUDE.md (`.agents/CLAUDE.md`)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the wedding website repository for Sam & Margaux (sargaux.com), built with Astro.

### Who You're Talking To

The primary user is **Sam Gross**, one half of the couple getting married. Margaux Ancel is the other half and may review work or provide input.

### Wedding Details

Two separate events with distinct guest lists (minimal overlap):

- **NYC Event**: October 11, 2026 — Dinner + Dancing (separate events) in New York City
- **France Event**: May 28-30, 2027 — Weekend at Village De Sully

### Key Architecture Decisions

- **Notion Backend**: Guest data and event details stored in Notion, fetched at build-time
- **Hybrid SSR**: Static pages + Astro server endpoints for RSVP writes
- **Netlify Adapter**: @astrojs/netlify for server endpoints
- **Auth**: Cookie-based sessions + localStorage for preferences
- **Email**: Resend for transactional emails (save-the-dates, RSVP confirmations)
- **URL Structure**: Event-centric (`/nyc/`, `/france/`) with shared pages (`/registry`)

### Full Documentation

This file covers the operational rules you need loaded every session. Deeper design rationale, historical implementation plans, and a topic-by-topic explanation of how the site works live in the [project wiki](Home) — start at the Home page. The wiki is generated from the `wiki/` folder in this repo; it is not fetched automatically, so don't rely on it being in context unless you fetch it yourself.

### Product Documentation

See the wiki's [Feature Plan / Product Spec](Feature-Plan-Product-Spec) page for the full original product specification including:

- Feature list (F-001 through F-013)
- Information architecture and URL structure
- Milestones and timeline
- Risks and mitigations

## License

The website source code (HTML, CSS, JavaScript) is licensed under **Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)**:

- ✅ You may reuse and adapt the code for non-commercial purposes
- ✅ Attribution is required
- ❌ Commercial use is not permitted

**Important**: Website text, photos, and media are not licensed and remain © Sam Gross. Do not generate, include, or commit any placeholder content, images, or text without explicit user direction.

## Tech Stack

- **Framework**: Astro v7.x with SSR server mode (Vite 8 / Rolldown, Rust compiler)
- **Adapter**: @astrojs/node v11 (standalone mode for local dev/tests); @astrojs/netlify v8 for production
- **CDN caching**: Astro route caching with `@astrojs/netlify/cache` provider (see Architecture Notes)
- **Language**: TypeScript **6.x**, strict mode enabled — pinned, see below
- **CSS**: Astro scoped styles (Tailwind optional for design phase)
- **Backend**: Notion API v2025-09-03 via `@notionhq/client` v5.x
- **Email**: Resend (transactional)
- **Hosting**: Netlify
- **Node.js**: v24.12.0 (LTS v22.x recommended)
- **Package Manager**: npm v11.6.2

### TypeScript must stay on 6.x

**Do not upgrade to TypeScript 7.** TS 7.0 is the native Go rewrite and **ships no compiler API** — its package `main` entry is `./lib/version.cjs`, a version string, with everything else under `./unstable/*`. Tools that embed the compiler break outright:

- `@astrojs/check` peer-requires `^5 || ^6`, and the Netlify bundler's `ts-api-utils` (via `@netlify/zip-it-and-ship-it` → `precinct` → `@typescript-eslint/typescript-estree`) reads compiler internals that no longer exist. Both `astro build` and `astro check` fail at config load with `Cannot read properties of undefined (reading 'Intrinsic')`.
- Microsoft explicitly lists **Astro** (with Vue, Svelte, MDX, Angular) among the ecosystems that must stay on 6.x, and plans the replacement API for **7.1** (reported for ~October 2026).

`.github/dependabot.yml` ignores `typescript` `7.0.x` — scoped to 7.0 deliberately, so 7.1 still gets proposed when it ships. Re-evaluate then, and verify with `npm run build`, not `tsc` alone, since the failure is in config loading rather than type-checking.

## Environment Setup

To set up a fresh Mac for development, run:

```bash
./scripts/setup.sh
```

This installs everything from scratch (Xcode CLT, Homebrew, nvm, Node.js, npm deps, Playwright browsers, Netlify CLI, GitHub CLI). It also configures the user's shell for Homebrew and `nvm`, and offers to create `.env.local` for local Notion-backed flows. The only prerequisite is a stock macOS install.

After setup, authenticate once:

```bash
netlify login      # Authenticate with Netlify
gh auth login      # Authenticate with GitHub
```

The `.nvmrc` file pins Node.js to the LTS v22.x line. Run `nvm use` to switch to the correct version.

## Development Commands

**Collaborative Sessions**: When working together on code changes, always start the dev server (`npm run dev`) and open <http://localhost:1213> in a browser. This allows watching changes in real time as edits are made.

**IMPORTANT - Port 1213**: The development server and all tests use port **1213** (December 13th - the engagement date). This is a sentimental choice and must NEVER be changed. Do not use port 4321 or any other port.

**Server choice guidance**:

- Prefer the built server path used by Playwright when validating production behavior. `npm test` and targeted Playwright runs are the most reliable source of truth for route transitions, auth redirects, and asset loading.
- `npm run dev` can be less reliable in this repo because the Netlify adapter may attempt writes outside the workspace during local startup.
- If browser behavior and source code disagree, rebuild first and then verify against the built app before assuming the code is wrong.

```bash
# Start development server (http://localhost:1213 - engagement date!)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Type-check the whole repo (.ts, .astro, and bundled <script> blocks)
# Must stay at 0 errors — CI gates on this
npm run typecheck

# Run all tests (accessibility, best practices, auth, and performance)
# Note: This automatically installs Playwright browsers if needed
# Tests run against the built server configured in playwright.config.ts
npm test

# Quick verification (build + all tests)
npm run verify

# Run specific test suites
npx playwright test tests/accessibility.spec.ts
npx playwright test tests/best-practices.spec.ts
npx playwright test tests/performance.spec.ts

# Quick accessibility-only test
npm run test:quick

# Manually install Playwright browsers
npm run test:install
```

**Note**: The `npm test` command includes a `pretest` hook that automatically checks for and installs Playwright browsers if they're not already installed, so you don't need to run `test:install` manually in most cases.

**Cloud sessions (Claude Code on the web) — do NOT run `playwright install`.** These images ship a pre-installed Chromium under `PLAYWRIGHT_BROWSERS_PATH` (`/opt/pw-browsers/chromium`) whose build number often won't match the `@playwright/test` version, so `npm run test:install` fails to download and is unnecessary. `playwright.config.ts` auto-detects that pre-installed browser and points `launchOptions.executablePath` at it (via `resolvePreinstalledChromium()`); the detection is a no-op on local Macs, so the normal managed-browser flow is unaffected there. Just run the tests directly (e.g. `npx playwright test …`).

## Type Checking

**`npm run typecheck` (`astro check`) must report 0 errors.** `.github/workflows/typecheck.yml` gates every non-draft PR on it, using the same draft-PR and docs-only skips as the test workflows. It needs no Playwright browsers, so it's the cheapest job in CI — run it before `npm test`.

Things worth knowing:

- **`astro build` does not type-check.** Vite/Rolldown strips types without checking them, so a build passing says nothing about type correctness. `astro check` is the only thing that checks `.astro` files and the `<script>` blocks inside them.
- **`npx tsc --noEmit` is not a substitute** — it misses `.astro` files entirely and reports different (fewer) errors. Always use `astro check`.
- **Bundled `<script>` blocks are type-checked and may use TypeScript syntax.** Annotations there are stripped at build like any other module. This does *not* apply to `<script is:inline>`, which ships verbatim to the browser — TS syntax in an inline script is a runtime SyntaxError.
- **DOM queries need generics, not casts.** `querySelector('.x')` returns `Element`, which has no `.value`/`.checked`/`.dataset`/`.hidden`/`.style`. Write `querySelector<HTMLInputElement>('.x')`. This is the single most common error class in this repo.
- **Narrowing does not survive into a callback.** A `let x: T | null` checked non-null before a `forEach` is still `T | null` inside it. Assign to a local `const` first and use that (see `preDeclineToggles` in the RSVP pages).
- Warnings and hints do not fail the build (`astro check` fails on errors only), but the repo is currently at 0 errors *and* 0 warnings — keep it there.

## Testing

See the wiki's **[Testing Guide](Testing-Guide)** for the full breakdown of each suite, the synthetic test guest, and local-login instructions.

### Delegate test runs to a subagent (Claude Code)

**Run the full suite in a subagent, not inline.** A complete `npm test` run prints ~270 progress lines; piping that into the main conversation burns context better spent on the actual work. Spawn an agent whose only job is to run the suite and report back a summary.

- Use the `Agent` tool (`subagent_type: "general-purpose"`) with a prompt like: *"Run `npm test` in /Users/sam/Developer/sargaux.com. Report only: total passed/failed/skipped, and for each failure the test name, file:line, and assertion diff. Do not fix anything."*
- Ask for a **summary, not a transcript** — the per-test progress lines are the bloat, and the agent's tool output stays out of the main context.
- **Tell the agent not to fix failures.** Diagnosis and fixes belong in the main session, where the code context lives.
- **Never run two suites concurrently.** Playwright binds port **1213** and rebuilds `dist/`; a second run collides on both. One agent at a time, and never start an inline run while an agent's run is in flight.
- The agent must run in the **primary working directory**, not a worktree — `dist/` is rebuilt from the checked-out branch, so a stale or mismatched tree gives misleading results.
- For a quick single-suite check (`npm run test:quick`, or one spec file), running inline is fine — the output is small.

## Git Workflow

**IMPORTANT**: Direct pushes to the `main` branch are not allowed. All code changes must go through the following process:

1. Create a new branch for your changes
2. Make commits to your branch
3. **BEFORE pushing**: Verify changes locally
   - **Always run**: `npm run typecheck` — must be 0 errors, and it's fast (no browsers)
   - **Always run**: `npm run build` to ensure the build succeeds
   - **Prefer to run**: `npm test` to run all tests (accessibility, best practices, performance)
   - If Playwright browsers aren't installed, run `npm run test:install`
4. Push your branch and create a pull request **in draft mode**
5. Only humans should mark PRs as "Ready for review" via the GitHub website
6. Wait for automated tests to pass (type check, accessibility, best practices, and performance run in parallel)
7. Merge via pull request after approval

**Note**: Always open PRs as drafts initially. Draft PRs do NOT trigger the automated test suite in CI - tests only run when a PR is marked as "Ready for review". This allows for review and iteration before consuming CI resources.

**Local Testing Requirement**: You MUST verify builds and tests locally before creating PRs since draft PRs don't run CI tests. Even for non-code changes (documentation, configuration), always run at least `npm run build` to ensure nothing is broken. Use `npm run verify` for a complete local check (build + all tests), and `npm run typecheck` alongside it — `verify` does not type-check.

**Test Skipping**: Automated tests are automatically skipped for PRs that only modify:

- Markdown files (`*.md`)
- YAML files (`*.yml`, `*.yaml`) - CI/CD and configuration
- LICENSE file
- `.gitignore`
- `playwright.config.ts` - test configuration

## Versioning

The project version in `package.json` follows semantic versioning with wedding milestones:

- **Patch** (`0.5.x`): Bump on every PR merge
- **Minor** (`0.x.0`): Bump when a plan/epic is completed (e.g., Notion integration Phase 1 → 0.6.0)
- **Major**: `1.0` = NYC event launch, `2.0` = France event launch

**IMPORTANT**: Always bump the version BEFORE creating the PR:

- Minor bump when completing a full implementation plan/epic/phase
- Patch bump for smaller PRs (bug fixes, single features, dependency updates)
- Check version is updated before running `git commit`
- **Exception**: Changes confined to `scripts/` (one-off tooling, data exports, guest-list utilities) do not change site behavior and never bump the version, no matter the size of the change.
- **Also add an entry to `CHANGELOG.md`** (top of the file, newest first) in the same PR whenever you bump the version — one or two lines describing the change by shape, not by which guest reported or reproduced it (see Guest Privacy below).

## Project Structure

- `src/pages/` - Astro pages (file-based routing)
- `src/pages/api/` - Server-side API endpoints (login, logout, RSVP)
- `src/lib/auth.ts` - Authentication utilities (name validation, session tokens)
- `src/lib/event-routing.ts` - Shared default event-routing rules
- `src/lib/notion.ts` - Notion client wrapper (guest data fetching)
- `src/types/guest.ts` - GuestRecord type definition
- `src/config/features.ts` - Build-time feature flags
- `src/middleware.ts` - Route protection and auth context
- `src/layouts/` - Page layouts (WireframeLayout, etc.)
- `public/` - Static assets (served at root)
- `tests/` - Playwright test suites
- `docs/` - non-portable assets only (`joy-custom-css/joy-theme.css`, invitation images) — plans and reference docs now live in the [wiki](Home)
- `wiki/` - source for the GitHub wiki, synced by `.github/workflows/wiki-sync.yml` on every push to `main`
- `astro.config.mjs` - Astro configuration
- `tsconfig.json` - TypeScript configuration (extends astro/tsconfigs/strict)

## Architecture Notes

See the wiki's **[Architecture Overview](Architecture-Overview)**, **[View Transitions & UI](View-Transitions-And-UI)**, **[Notion Backend](Notion-Backend)**, and **[Registry Integration](Registry-Integration)** pages for the full detail behind the summaries below — those pages carry the design rationale and history; this section stays as the always-loaded quick reference.

- Uses Astro's minimal template as the base
- TypeScript strict mode is enabled for type safety
- File-based routing: pages in `src/pages/` become routes
- SVGs used by pages should prefer Astro-managed imports from `src/assets/` over hard-coded `/public` paths. This is especially important for critical visual elements like the NYC skyline and favicons.
- SSR enabled with `@astrojs/node` adapter (standalone mode)
- **Script gotcha**: Use `<script is:inline>` for scripts in pages with early returns (e.g., auth redirects) to avoid "Unknown chunk type: script" error
- **Script gotcha**: The Astro 7 Rust compiler strips custom attributes (including `data-astro-rerun`) from `define:vars` inline scripts — the attribute never reaches the browser, so ClientRouter silently stops re-executing the script after swaps. Don't combine `define:vars` with `data-astro-rerun`; pass server values via `data-*` attributes and use the `astro:page-load` + init-guard pattern instead (see the homepage login script).
- **Script gotcha**: Do not add direct `astro:transitions/client` imports inside `is:inline` page scripts. That can break browser execution or produce stale-bundle confusion. Let `ClientRouter` own transition interception, and use normal navigations it can intercept. **Type-only** imports are the exception and are how `src/scripts/transitions.ts` gets `TransitionBeforePreparationEvent` / `TransitionBeforeSwapEvent`: it is a bundled module (not inline), and `import type` is fully erased, so no runtime import reaches the browser. Verify with `grep -r "astro:transitions/client" dist/` after a build — it must return nothing.
- **Script gotcha**: A `.ts` file with no top-level `import`/`export` is a *global script*, not a module, so `declare global { interface Window { … } }` inside it is invalid (`ts(2669)`) and every custom `window.*` property errors. `src/scripts/transitions.ts` is loaded via `import '../scripts/transitions'` but was still script-scoped until a type-only import made it a module. If you add a file with `declare global`, give it at least one import or `export {}`.
- **Script gotcha**: Never suppress view transition animations for named elements using `html[data-astro-transition] ::view-transition-group(name)` CSS — this selector does not reliably fire because `data-astro-transition` may not be set at the right moment relative to pseudo-element creation. Use the `astro:after-preparation` event in JavaScript instead to modify `view-transition-name` on the element directly before the VT snapshot.
- **Transition contract**: The shared amber disc uses `transition:name="event-disc"` (NO `transition:persist`) on all NYC pages (index, details, travel). Removing `transition:persist` was required to let the VT API reliably FLIP between pages. Forward navigation (clicking into sub-pages) suppresses the disc FLIP via `astro:after-preparation` in `WireframeLayout`: if `toDepth > fromDepth` (by URL path segment count), the disc's `view-transition-name` is temporarily set to `none` on the old element before the VT snapshot, preventing an unwanted cross-screen animation. The disc FLIP only plays on backward navigation (returning to a parent page). The NYC/France headers also intentionally share transition targets for `Chez Sargaux`, the event toggle, and the RSVP button.
- **`WireframeLayout` `page` prop**: `WireframeLayout` accepts a `page` prop that sets `data-page` on `<html>` statically, allowing per-page CSS scoping without inline scripts. Currently used by `nyc/travel.astro` (passes `page="travel"`) to position the disc on the right side.
- **Header overscroll fix**: `.site-header::before` in `base.css` extends a 25px panel above the header's top edge (using `position: absolute; top: -25px; background: inherit`) to cover springy overscroll bleed. This is purely cosmetic and does not affect header children layout.
- **CDN caching contract**: Content pages (couple, faq, details, travel, lookbook, schedule, registry, event indexes) are CDN-cached **per guest**: `routeRules` in `astro.config.mjs` sets `maxAge`/`swr`, and middleware sets `Netlify-Vary: cookie=sargaux_auth|sargaux_lang` on every page response *including redirects* so cache variants never leak across sessions and the login wall stays intact. RSVP pages are never cached (`private, no-store`). The logged-out homepage is cached via `Astro.cache.set()` after the auth redirect. `/api/calendar/[token].ics` is cached per-token URL and invalidated by `POST /api/rsvp` via `context.cache.invalidate({ path })`. Use only Astro's built-in cache API — never Netlify `purgeCache()` directly. The provider is only wired for the Netlify adapter; under `ASTRO_ADAPTER=node` caching is inert, so CDN behavior must be verified on deploy previews (`Cache-Status` header).
- **Notion guest cache**: `src/lib/notion.ts` layers in-memory → Netlify Blobs (`guest-cache` store, 15-min TTL) → targeted Notion fetches. `getGuestById`/`getGuestParty`/`getGuestEvents`/`submitRSVP` never trigger a full guest-list scan; only `fetchAllGuests` (login fallback, `/api/warm`, admin/scheduled jobs) does, and it persists the result to the blob for other instances. `clearGuestCache()` also deletes the blob. Login misses on a cached list fall through to a live title-filter query so newly added guests can always log in.
- **Notion SDK**: Uses `@notionhq/client` v5.x targeting Notion API v2025-09-03. Key difference from older versions: `dataSources.query()` replaces `databases.query()`, using `data_source_id` instead of `database_id`. See [upgrade guide](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03).
- **Dark mode token gotcha**: `--color-text` and `--color-surface-text` both resolve to `var(--color-warm-cream)` in dark mode. Never use both as `background` + `color` on the same element — use `--color-bg` for text color on `--color-text`-colored backgrounds in dark mode.
- **Dark mode border visibility**: `--color-border` in dark mode (`#2E3E35`) is nearly invisible against the dark surface `#2F3F36`. Use `--color-text-muted` for interactive UI borders (event rows, custom checkboxes) that must be visible in dark mode.
- **Custom checkbox pattern** (`src/pages/nyc/rsvp.astro`): Native `<input>` is hidden with `position: absolute; opacity: 0; pointer-events: none`; a sibling `<span class="event-check-mark">` drives the visual using the `~` general sibling combinator. `.event-check-mark` has `margin-top: 2px` for `flex-start` containers — reset to `0` inside `align-items: center` containers.
- **RSVP subway bullets**: The RSVP hero uses real NYC subway bullet SVGs (`src/assets/nyc/subway-bullet-m.svg` and `subway-bullet-sf.svg`) as `<img>` elements, positioned and sized with CSS. The M bullet is recolored from subway orange to `--color-burnt-amber` (`#D96A1E`); the SF silver bullet is kept as-is. Source: Wikimedia Commons NYCS Standard Set (public domain).
- **Party-level RSVP responses**: RSVP Responses rows are party-level — one row per party + event, with the `Guest` relation set to **every** party member. Pre-fill (`getLatestRSVPForParty`) matches responses related to any member, so a partner returning to update the RSVP sees the submitted state, never a blank form. `submitRSVP` also matches the existing row via any member so updates converge on one row instead of forking.
- **Guest List write-back on RSVP**: `submitRSVP` (`src/lib/notion.ts`) writes one merged update to **every party member's** Guest List row after each submission, then calls `clearGuestCache()` so reads don't lag the 15-min cache. Per member it writes: (1) **`RSVP` status** — resolved from their personal attendance across the latest response per invited event: all attending → Attending, none → Declined, mixed → Partial (the `Partial` option must exist in the Notion RSVP field — add manually, as DDL can't configure STATUS options via `notion-update-data-source`); (2) the submitted event's **invite status** (`NYC Invite Sent` / `France Save the Date Sent`) → **`Received`**, advance-forward only (skipped when already `Received`; `parseGuestPage` reads these into `GuestRecord.nycInviteStatus`/`franceSaveTheDateStatus`); (3) **`Last RSVP`** date; (4) **`Events Attending`** relation → the specific Event Catalog pages they're attending (reverse `Guests Attending` on Event Catalog); (5) **`Dietary Needs`** text (party-level). Attendance for the submitted event resolves by **member page ID** (`guestsAttending[].guestId`), not name, so a name edit doesn't misresolve it; other events still resolve by name against the stored row.
- **RSVP name persistence**: the RSVP form threads each member's page ID via `data-guest-id` on the guest row, so an edited `guest-name` input persists. When a submitted entry's `guestId` maps to a party member whose typed name differs, `submitRSVP` writes `First Name`/`Last Name` (last whitespace-delimited token is the surname; drives the `Full Name` login formula) and the `Name of Guest` title. The API (`src/pages/api/rsvp.ts`) validates a `guestId`-bearing entry against the party roster by id (allowing the rename) and caps names at `NAME_MAX_CHARS`; entries without a `guestId` keep the legacy name-in-roster check. If the **authenticated** guest renames themselves, the POST handler re-signs the `sargaux_auth` cookie with the refreshed canonical name (re-fetched post-write) so `bindSessionToNotion` doesn't 401 on the next request.
- **Events Invited relation is deprecated**: never read the Guest List `Events Invited` relation. The RSVP form lists the full Event Catalog for each wedding in the guest's `Event Invitations` multi-select (`getGuestEvents`). The personalized calendar ICS contains **only events the guest has RSVP'd to attend** (`getAttendingEvents` / `refreshAllICS` — latest non-declined response per wedding, and only if the guest is named in its attendee list); guests who haven't RSVP'd get a valid empty calendar.
- **Event i18n** (`src/lib/event-i18n.ts`): the Event Catalog carries optional French **display** properties — `Event Name FR`, `Time FR`, `Location FR`, `Description FR`. All event display must go through `localizeEvent(event, lang)`, which falls back per field to English, so partially translated events always render. Timing is deliberately language-neutral: there are **no** FR variants of `Start Time`/`Duration`/`Event Date`, and ICS DTSTART/DTEND always come from the canonical fields. `getEventCatalog` sorts events by `Event Date` then parsed `Start Time`. Personalized ICS calendars are generated in the guest's locale via `getDefaultLocale(guest.country)` (`src/lib/locale-routing.ts`, same rule that seeds the login `sargaux_lang` cookie: FRANCE/CANADA → fr) — `buildICS(events, lang)` localizes only SUMMARY/DESCRIPTION/LOCATION.
- **Joy registry integration** (`src/lib/joy.ts` + `src/pages/registry.astro`): `/registry` renders the couple's withjoy.com registry natively by querying Joy's **unofficial** GraphQL endpoint (`https://withjoy.com/graphql`, `registryItemsByEventId`) server-side with a 15-min in-memory cache. `JOY_EVENT_ID` / `JOY_EVENT_HANDLE` are runtime env vars (`.env.local` + Netlify Dashboard); when unset or when Joy is unreachable, the page falls back to a link-out card — the fetch must never throw. Joy models group-gifted physical items as `donationFund` entries with `fundType: "gift"` (real price, normal item-count semantics); only `fundType: "cash"` items belong in the Funds section. **Per-item deep links**: `https://withjoy.com/{handle}/registry?pid={registryItemId}` opens that item's detail/buy modal directly on Joy (`joyItemUrl()`) — always link cards to their item, not the registry root. Cash-fund `stillNeeded`/`totalRequested` are in cents of the goal, not item counts. The Joy-side theme CSS lives in `docs/joy-custom-css/` (pasted copy in Joy's designer is the live source of truth; fonts load cross-origin from sargaux.com and need the `/fonts/*` CORS header in `netlify.toml`).
- **Registry split by country** (`src/lib/registry-routing.ts`): the registry destination is driven by the Guest List `Country` select. `FRANCE`/`UNITED KINGDOM` guests get the external MilleMercisMariage registry (`FRENCH_REGISTRY_URL`, opens in a new tab; the strip-row arrow rotates to ↗ on hover via the `--external` modifier class); everyone else (`USA`, `CANADA`, unset) gets the native Joy `/registry` page. All registry links must go through `getRegistryLink(Astro.locals.country)` — never hardcode `href="/registry"`. Middleware 302-redirects French-side guests who hit `/registry` directly. `country` flows Notion → `GuestRecord` → `Astro.locals.country` (live lookup in middleware, session-cookie fallback like `eventInvitations`). MilleMercis has **no API** (server-rendered jQuery HTML; only a contribution POST endpoint) — it is always a link-out, never rendered natively.

## Authentication

See the wiki's **[Authentication & Sessions](Authentication-And-Sessions)** page for full detail and history. Quick reference:

- Name-based login (no passwords) — validates against guest list
- When `global.notionBackend` flag is on: validates against Notion Guest List database
- When flag is off (local dev without keys): falls back to hardcoded list in `src/lib/auth.ts`
- Names normalized: lowercase, remove accents (NFD), collapse whitespace
- Cookie: `sargaux_auth` (90-day expiry, httpOnly) — HMAC-signed (`SESSION_HMAC_SECRET`); format `base64url(payload).hmac`. Unsigned/legacy cookies fail closed (guests re-login once after deploy). Payload contains guest name + optional Notion page ID
- **Event invitations are resolved live, never trusted from the cookie**: the cookie's `eventInvitations` snapshot is only a fallback (hardcoded-list mode, transient Notion failures). Middleware and the RSVP API read invitations from the live Notion record (`getGuestById`, served by the 15-min guest cache) so invitation changes take effect without re-login.
- **Session binding**: when `notionId` is present, middleware and RSVP require `normalize(cookie.guest) === liveNotionRecord.normalizedName` so a calendar-leaked page ID cannot be paired with an arbitrary display name
- **Login geo gate**: `netlify/edge-functions/login-geo-gate.ts` blocks `/api/login` from non-allowlisted countries (403, fails open when geo is missing). Edge-runtime only — it never runs under the local node adapter, so verify on deploy previews. Scoped to `/api/login` deliberately: never widen it to pages (would bypass per-guest CDN caching). See the wiki's [Guest Privacy & Security](Guest-Privacy-And-Security) page for the full audit.
- **Envelope-name login** (`src/lib/envelope-name.ts`, flag `global.envelopeLogin`): guests may log in with the addressee line printed on their invitation envelope ("Samuel & Margaux Gross") or any combination of their household's first names plus a household surname. Exact `Full Name` still wins and is still one step — envelope rules only run on a miss. Two match rules: (1) the input's token set equals a stored `Envelope Names` string, (2) every token is a household first or last name, at least one is a first name, and no two tokens claim the same member. A bare surname never matches. Titles, connectors (`and`/`et`/`&`/`+`), periods, and the CSV generator's trailing ` +1` are stripped; collective words ("The", "Family") are deliberately **kept**, since stripping them would reduce "The Gross Family" to "gross" and let a surname alone unlock the household. Households are connected components via union-find over `Related Guests` — never `getGuestParty`, which walks one hop and misses C in a household wired A↔B, B↔C. Ambiguity across households fails closed with a `console.warn`.
- **`Envelope Names` Guest List property** (`rich_text`, newline-separated): the hand-edited envelope strings actually printed, denormalized onto **every** household member so one targeted query finds a match. A household can hold two (NYC and France include different members). Populated by `scripts/import-envelope-names.mjs` from the invitation CSVs; household grouping and envelope formatting are shared with `scripts/generate-invitation-csv.mjs` via `scripts/lib/envelope-csv.mjs` so the import can reproduce the generator's output exactly and join unedited rows back to their household.
- **Two-step login + identity claims**: when a name resolves to ≥2 people, `POST /api/login` returns `{ needsIdentity, claim, candidates }` and sets **no cookie**; the guest picks who they are and posts `claim` + `guestId` back to mint the session. Claims are HMAC-signed with `SESSION_HMAC_SECRET` (10-minute expiry, `typ: 'claim'` for domain separation — a session token can never be redeemed as a claim, and no second secret is needed), and a claim only ever authorizes the member IDs the server put in it. Redemption uses its own `claim:${ip}` rate-limit bucket so a two-step login doesn't consume two of the ten login attempts. The picker is inline on the homepage and uses `hidden` for visibility (CSS scoped to `:not([hidden])`) so it stays out of the focus order while collapsed.
- Protected routes: `/nyc/*`, `/france/*`, `/registry` — middleware redirects to `/` if unauthenticated
- `Astro.locals.guest` (string) — guest display name, available in all protected pages
- `Astro.locals.guestId` (string) — Notion page ID, available when notionBackend is enabled
- Default event routing must be centralized through `src/lib/event-routing.ts`
- Guests invited only to NYC default to `/nyc`
- Guests invited only to France default to `/france`
- Guests invited to both events default to `/nyc` through **October 14, 2026**
- Guests invited to both events default to `/france` starting **October 15, 2026**
- The dual-invite cutoff is evaluated in the `America/New_York` time zone
- Homepage redirect, login API redirect, and middleware fallback redirects must stay aligned with the same shared helper

## Admin Endpoints

See the wiki's **[Admin Endpoints](Admin-Endpoints)** page for the full list, curl gotchas, and scheduled-function detail.

All admin endpoints live under `/api/admin/*` and require an
`Authorization: Bearer {RESEND_ADMIN_SECRET}` header (401 otherwise).

**Outbound email payload contract**: template functions in `src/lib/email-templates.ts` return `EmailTemplate` (`{ subject, html, text }`) and carry **no recipient**. `sendToGuests` requires a full `EmailPayload`, which adds `to`. Always compose the two with `withRecipient(guest, template(...))` from `src/lib/email.ts` — it sets `to` last so a stray recipient on a template can't redirect the mail. Passing a bare template result is a silent failure: Resend rejects it, `sendToGuests` catches the throw, and every guest lands in the `failed` count with nothing logged per-guest.

**Both bulk senders are untestable through the endpoint.** `global.emailEnabled` defaults to `false`, so `/api/admin/send-stds` and `/api/admin/send-email` short-circuit to `{ skipped: true }` before building any payload — `tests/admin.spec.ts` only ever reaches auth and validation. Cover payload assembly at the unit level instead (`tests/email-unit.spec.ts`), where the flag is irrelevant. **Never flip `FEATURE_GLOBAL_EMAIL_ENABLED` to verify a change** — that sends real mail to real guests.

## Guest Privacy — This Repo Is Public

See the wiki's **[Guest Privacy & Security](Guest-Privacy-And-Security)** page for the full threat model, audit findings, and secrets list.

**CRITICAL: never write a real guest's name into anything that lands in the repo or on GitHub.** That includes source and test files, code comments, commit messages, PR titles and descriptions, PR review comments, issues, `docs/`, and the `wiki/` folder / published wiki. The repository is public, so all of it is world-readable and indexed.

- **Test fixtures use invented names.** Copy the *shape* that matters — hyphenated given name, two-word given name, multi-word surname, two members sharing a first name, mixed surnames within a household — never the real name that exhibited it.
- **Commit messages and PR text describe shapes, not people.** "a two-surname household where one member carries a title", not the household.
- **Guest data files stay untracked.** `scripts/output/` is gitignored and must remain so; it holds names, postal addresses, and USPS serials. `scripts/data/usps-imb-serials.json` is tracked but safe — its keys are SHA-256 hashes, never plaintext.
- **The couple's own names are fine** (Sam Gross, Margaux Ancel) — it's their wedding site. The rule protects third-party guests.
- Redacting after a push is only a partial fix: force-pushing a branch removes names from the tip, but orphaned commits stay reachable by SHA on GitHub, and PR description edits keep a visible edit history. Get it right before pushing.

## Secrets & API Keys

See the wiki's **[Guest Privacy & Security](Guest-Privacy-And-Security)** page for the full secrets table.

**CRITICAL: Never commit API keys or secrets to the repository.** All secrets must be added to Netlify Dashboard and/or GitHub Secrets directly — never in `netlify.toml`, `.env` files committed to git, or source code. **Runtime secrets use `process.env`**, not `import.meta.env` — Vite's `import.meta.env` only includes vars present at build time. Netlify Dashboard env vars are runtime-only. `process.env` is server-side only and never exposed to browser bundles.

## Feature Flags

See the wiki's **[Feature Flags](Feature-Flags)** page for the full mechanism, checklist, and current flag list. The site uses a **build-time** feature flag system (`src/config/features.ts`) for gradual rollout and protecting production. Flags are resolved at build time via Vite's static `import.meta.env` replacement — changing a flag requires a rebuild.

The `global.weddingSiteEnabled` flag controls whether the full wedding site is visible: production defaults to a minimal placeholder; local dev and Netlify preview deploys automatically enable it.

**Adding a new feature flag (4-step checklist):**

1. Add to `FeatureFlags` type definition in `src/config/features.ts`
2. Add static `import.meta.env.FEATURE_*` reference in features object
3. Add to `ImportMetaEnv` interface in `src/env.d.ts`
4. Add to `netlify.toml` `[context.deploy-preview.environment]` for preview deploys

---

# AGENTS.md (repo root)

## Astro CSS And Transitions

- Do not `@import` shared site CSS like `src/styles/tokens.css` or `src/styles/base.css` inside inline Astro `<style>` blocks, especially in shared layouts.
- Import shared CSS at the module level instead, for example:
  `import '../styles/tokens.css';`
  `import '../styles/base.css';`
- Reason: during Astro client-side transitions, inline layout style blocks can be left behind as stale duplicates. This previously caused `/nyc/details -> /nyc` to render old typography values after transition even though direct page loads were correct.
- If a page is correct on direct load but wrong only after SPA navigation, inspect the live `<style data-vite-dev-id>` tags in the browser and look for duplicated stale route or layout styles before changing page-level CSS.
- If a transition fix works only on the first navigation but fails on repeated back/forward or sibling navigations, move the transition-critical override out of the layout's inline `<style>` block and into a module-level shared stylesheet imported by the layout. This fixed the France Travel dark-mode info boxes on repeated `/france <-> /france/travel` navigations.
- For repeated-navigation debugging, compare the count/order of `style[data-vite-dev-id]` tags for the page stylesheet versus the shared stylesheet after the first and second visit. A stable shared fix should remain mounted once across navigations even when the route stylesheet is duplicated or replaced.

## Typography Flicker

- If styled text flickers on first load, treat font loading as a likely cause before changing layout CSS.
- In this codebase, branded custom fonts in `src/styles/tokens.css` should use `font-display: block`, not `swap`, when visible fallback text causes a noticeable first-paint flicker.
- When debugging a text flicker, delay the font request in Playwright and compare the text geometry before and after `document.fonts.ready`. A width or height change confirms a font-swap regression.
- Preload the exact custom font files used above the fold for a route. Do not assume a single preload covers neighboring weights.
