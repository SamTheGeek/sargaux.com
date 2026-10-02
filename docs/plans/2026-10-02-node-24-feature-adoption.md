# Node 24 Feature Adoption

**Date written:** 2026-10-02
**Status:** Planned. **Blocked on** [the Node 22 → 24 upgrade](2026-10-01-node-24-upgrade.md):
don't start until that upgrade is in production **and** its 7-day watch period has passed cleanly.
**Version bump:** patch per PR, except PRs confined to `scripts/`, which never bump (per CLAUDE.md).

## Context

The runtime upgrade is deliberately behavior-neutral and adopts nothing. This plan is the
follow-up: it adopts the features that are new between Node 22 and Node 24 **where they improve
this codebase**, and records which features were considered and rejected so the question doesn't
get reopened.

The bar is still **zero guest-facing impact**. Each item ships as its own PR so it can be reverted
on its own. The one item that touches the auth wall (URLPattern) has its own freeze window.

### The one rule that shapes everything below

**Node 24 APIs are server-only.** Source under `src/lib/` and `src/scripts/` is shared between the
SSR function and browser bundles, and the type environment includes both DOM and Node typings. That
means `astro check` **cannot** catch a Node 24 API that leaks into a client bundle. `URLPattern`, for
example, only reached Safari in version 26, so on older iPhones a leaked call would be a runtime crash.
Item 0 adds a build-output guard for exactly this. Until it lands, nothing else in this plan ships.

## Sequencing and timing

| # | Item | PR scope | Bumps version |
|---|---|---|---|
| 0 | Types pinned to the runtime + client-bundle guard | `package.json`, `.github/dependabot.yml`, `tests/` | yes |
| 1 | `URLPattern` for route matching | `src/lib/`, `src/middleware.ts`, `tests/` | yes |
| 2 | Native TypeScript for dependency-free scripts | `package.json`, `scripts/` | yes (touches `package.json`) |
| 3 | Permission model for PII-writing scripts | `scripts/` only | no |
| 4 | `RegExp.escape` | `tests/` | yes |

- Item 0 comes first. Items 2–4 are independent of each other and can land in any order after it.
- **Freeze: 2027-04-15 → 2027-06-01** (France RSVP crunch, the daily ICS window, and the weekend itself).
  Item 1 changes how the auth wall classifies paths. If it isn't in production by **2027-03-31**,
  defer it until after the freeze rather than squeezing it in. Items 2–4 never touch the guest
  request path, but follow the freeze anyway.

## Item 0 — Pin `@types/node` to the runtime, and guard client bundles

**Problem today:** `@types/node` isn't a direct dependency. It arrives transitively, through
`@astrojs/netlify` → … → `@types/yauzl`, at **26.1.2**. The code type-checks against Node 26 APIs
while production runs Node 22, and after the upgrade, Node 24. A Node 25/26-only API, such as
`Uint8Array.fromBase64`, would type-check cleanly and then throw in production.

1. Add `"@types/node": "^24"` to `devDependencies` so npm dedupes the type environment onto the
   runtime's major version.
2. `.github/dependabot.yml`: ignore `@types/node` major versions above 24 (`versions: [">=25"]`), with a
   comment in the style of the TypeScript 7 entry: *the major tracks `.nvmrc`; bump both together*.
3. CLAUDE.md, under Tech Stack: one line saying `@types/node`'s major must equal `.nvmrc`.
4. **Client-bundle guard**: add a static check to `tests/best-practices.spec.ts`, or a new
   `tests/client-bundle-unit.spec.ts`. After `npm run build`, scan `dist/_astro/*.js` and fail if any
   file references a server-only global from a denylist: `URLPattern`, `RegExp.escape`,
   `process.permission`, `Error.isError`. This follows the precedent of the
   `grep -r "astro:transitions/client" dist/` rule. It's a cheap, string-level check that catches
   what the type checker structurally can't.
   - Calibrate the denylist first: build `main` and confirm the scan is clean, so the guard starts green.
     If a dependency legitimately ships one of these names behind feature detection, allowlist that
     file explicitly with a comment explaining why.

**Verify:** `npm run typecheck` stays at 0 errors and 0 warnings (the type downgrade from 26 to 24 could
surface code using newer APIs, and any hit is a real bug to fix). `npm ls @types/node` shows a
single 24.x. The full suite passes. To prove the guard works, temporarily add
`console.log(typeof URLPattern)` to `src/scripts/transitions.ts`, rebuild, see the test fail, then revert.

## Item 1 — `URLPattern` for route classification (server-only)

`URLPattern` became a global in Node 24. Route classification is currently hand-rolled prefix logic,
spread across two files that each have their own idea of a path boundary:

- `src/middleware.ts`: `PROTECTED_ROUTES.some(route => pathname.startsWith(route))` (line ~158),
  and the invitation gates `pathname.startsWith('/nyc')` / `startsWith('/france')` (lines ~249–253).
  These are **segment-blind**, so `/nycfoo` counts as an NYC route.
- `src/lib/return-to.ts`: `RETURNABLE_PREFIXES` with a manual `=== prefix || startsWith(prefix + '/')`
  boundary check in `sanitizeReturnTo`, then segment-blind `startsWith('/nyc')` again in
  `resolveLoginDestination`.

**Change:** add `src/lib/route-patterns.ts`. It exports one `URLPattern` per route family
(`new URLPattern({ pathname: '/nyc{/*}?' })`, and likewise for `/france`, `/couple`, `/registry`), plus
helpers `isProtectedPath()` and `eventForPath(): 'nyc' | 'france' | null`. Middleware and
`return-to.ts` both use these helpers, so there is one definition of what counts as an NYC path instead of three.
While editing `sanitizeReturnTo`, replace its `try { new URL(…) } catch` with `URL.parse(value, base)`,
which returns null on invalid input. This one dates from Node 22.1, but it's the same lines.

**Constraints:**
- `route-patterns.ts` must never be imported by `src/scripts/*` or any `<script>` block. Item 0's guard
  enforces this. `src/scripts/transitions.ts` keeps its `startsWith` logic: it runs in the browser.
- Construct the patterns **once at module scope**, not per request.
- **The one intentional semantic change:** `/nycfoo`-style paths, which aren't real routes, stop counting as
  protected. A logged-out visitor gets the 404 page instead of a redirect to `/`. Every real route
  behaves exactly as before. Call this out in the PR. If Sam prefers bit-for-bit parity, make the
  patterns `/nyc*` to keep the prefix semantics. That's a one-character change, so decide in review.

**Verify:**
- New `tests/route-patterns-unit.spec.ts`: an equivalence table running **old logic vs new** over a
  corpus. Include every real route from `src/pages/`, trailing slashes, `/nyc/../api/logout`, encoded
  segments (`/nyc%2Ftravel`), case variants (`/NYC`, which stays case-sensitive like `startsWith`), and
  `/nycfoo`. The test fails on any difference except the documented `/nycfoo` row.
- Existing suites: `return-to-unit`, `access-control`, `event-routing`, `auth`, `security`.
- Deploy preview, logged out: `/nyc/travel` → `/?next=%2Fnyc%2Ftravel`, `/france` → login,
  `/registry` → login, `/` and `/api/login` open. Logged in as Sam (invited to both): every protected
  route renders, and a `next` deep link lands correctly. Check the header set on a redirect still includes
  `Netlify-Vary` (CDN contract).
- Production: repeat the logged-out checks within 10 minutes of deploy. Rollback is a Netlify
  "Publish deploy" of the previous build.

## Item 2 — Run dependency-free TypeScript scripts natively

Node 24 strips TypeScript types by default, with no flag and no loader. Two scripts have **no imports
from `src/`** and use only erasable syntax, so they can drop `tsx`:

- `scripts/generate-icons.ts`: runs as **`prebuild`** on every Netlify build, so this takes `tsx`
  (and its esbuild startup) out of the production build path. Also replace the
  `dirname(fileURLToPath(import.meta.url))` dance with `import.meta.dirname`.
- `scripts/test-email.ts`.

**Change:** in `package.json`, `"icons"`/`"prebuild"` → `node scripts/generate-icons.ts`. Update any doc
that mentions `tsx` for these two. Node requires explicit file extensions on relative imports for native
TS. Neither script has relative imports, which is why these two qualify and the others don't.

**Explicitly not converted:** every script that imports `../src/lib/*` (`record-manual-rsvp.ts`,
`list-event-attendees.ts`, `sync-contacts.ts`, `backfill-rsvp-guest-list.ts`). `src/` uses
extensionless imports, as Vite/Astro expect, and native stripping can't resolve those. Converting them
would mean rewriting `src/` import style for scripts' sake. `tsx` stays a devDependency for them.

**Verify:** `npm run build` locally and on the deploy preview. The Netlify deploy log shows
`prebuild` running under `node`. The generated icons in `dist/` are **byte-identical** to the
previous build (`shasum` both), and `npx tsx scripts/test-email.ts` → `node scripts/test-email.ts`
behaves the same (it sends to Sam only, so run it only if a test send is wanted anyway).

## Item 3 — Permission model for scripts that write guest PII

The Node permission model is stable as of Node 23.5, so Node 24 is the first LTS where it's stable.
This repo's strongest rule is that guest PII must never land in a tracked file. Today that relies on
`scripts/output/` being gitignored plus care. The permission model can turn it into a runtime guarantee:
a script started with `--permission --allow-fs-write=./scripts/output` **cannot** write anywhere else,
even through a bug or a bad path join.

**Scope:** the `.mjs` exporters that write names, addresses, or serials:
`generate-invitation-csv.mjs`, `generate-rsvp-followup-{nyc,france}.mjs`, `find-missing-addresses.mjs`,
`generate-iv-mtr-manifest.mjs`, `check-usps-imb-status.mjs`, and the read-only `count-*-invitations.mjs`
(which get `--allow-fs-write` with no paths at all).

1. **Inventory first:** run each script with `--permission --allow-fs-read=.` and **no** write grant, and
   record every `ERR_ACCESS_DENIED`. That gives each script's true write set. Expected:
   `scripts/output/`, plus `scripts/data/usps-imb-serials.json` for the USPS serial registry. Anything
   else that turns up is a finding in its own right.
2. Encode the grants in each script's shebang (`#!/usr/bin/env -S node --permission --allow-fs-read=. --allow-fs-write=./scripts/output`),
   `chmod +x`, and document `./scripts/<name>.mjs` as the invocation. Grants are cwd-relative, and the
   scripts are always run from the repo root. They already resolve `.env.local` that way.
3. Add a one-line guard in a shared helper (`scripts/lib/`): if `process.permission` is undefined, print
   a warning that the script is running without the permission model, so `node scripts/x.mjs` still
   works but doesn't run silently unguarded.
4. Note in CLAUDE.md's guest-privacy section that these scripts run sandboxed.

**Limits to state honestly:** Node 24's permission model doesn't restrict **network** access (`--allow-net`
arrived in Node 25), so this guards the disk, not exfiltration. `tsx`-run scripts are out of scope:
the model blocks the child processes and workers `tsx` relies on.

**Verify:** each script produces identical output (diff the `.csv`/`.xlsx` against a pre-change run on the
same day's Notion data), and a deliberately mis-pointed output path fails with `ERR_ACCESS_DENIED`.
This PR is confined to `scripts/` plus a CLAUDE.md line, so it needs no version bump and runs no site tests.
Still run `npm run build`, per repo rules.

## Item 4 — `RegExp.escape`

`tests/auth.spec.ts:~526` builds `new RegExp(\`name="${field}"…\`)` by interpolating a value without
escaping. The values are constants today, so this is hygiene rather than a live bug. Use
`RegExp.escape(field)`. `return-to.ts`'s `UNSAFE_PATH_CHARS` is a fixed character class, not an
interpolation, so it stays. Fold this into Item 0's PR if convenient.

## Free with the runtime (no code, just measure)

- **`AsyncLocalStorage` on `AsyncContextFrame`**, the Node 24 default, makes Astro's per-request context
  cheaper. **Undici 7** backs `fetch` for the Notion, Resend, and Joy calls. **V8 13.6**.
  Measure rather than assume: during the runtime upgrade's watch period, compare SSR function p50/p95
  duration in Netlify's function metrics against the Node 22 baseline recorded in that plan's Phase 0.
  Record the numbers in the PR for Item 1. No action unless they regress.

## Considered and not adopting

| Feature | Why not |
|---|---|
| `using` / `await using` (explicit resource management) | No disposable resources in the codebase: no file handles held open, temp dirs, or locks. The Notion and Resend clients are stateless HTTP. |
| `Promise.try`, `Error.isError` | One `instanceof Error` in the codebase, same realm. Nothing would read better. |
| `Intl.DurationFormat` | Event durations (`parseDuration`, `src/lib/calendar.ts`) only feed ICS `DTEND`. They're never shown to guests. |
| `Float16Array`, `Atomics.pause`, Wasm Memory64, `node:sqlite` | No use case. |
| `fs.glob`, `import.meta.main` | No directory walks, and no script modules that are both imported and executed. |
| `URLPattern` in `src/scripts/transitions.ts` | Runs in the browser. Safari < 26 lacks it. |
| Native TS for scripts that import `src/` | Extensionless imports in `src/` (see Item 2). |
| Migrating `*-unit.spec.ts` to `node --test` | Same extensionless-import blocker, so it would still need a loader. Playwright already runs them fine. Not a Node 24 feature anyway. |
| `Uint8Array.fromBase64` / `toBase64` (would replace `Buffer` base64url in `src/lib/hmac.ts` and `auth.ts`) | **Node 25+** (V8 14), not 24. Revisit at the Node 26 upgrade. Item 0's type pin is what keeps it from being used early. |
| `--allow-net` for script sandboxing | Node 25+. Extend Item 3 at the next upgrade. |

### Related, but not Node 24

Eight scripts hand-roll a `.env.local` parser (`readFileSync(envPath)` + split, in `count-*`,
`generate-invitation-csv`, `import-envelope-names`, `find-missing-addresses`, `check-usps-imb-status`,
`scripts/lib/rsvp-followup.mjs`, `record-manual-rsvp.ts`). `process.loadEnvFile()` replaces all of them,
but it has been available since Node 20.12, so it doesn't belong in this plan. It's a worthwhile
`scripts/`-only cleanup PR on its own. Check quoting and `=`-in-value parity before switching.
