# Testing Guide

## Test suites (run in parallel in CI)

1. **Accessibility** (`tests/accessibility.spec.ts`) — WCAG 2.0/2.1 AA compliance, document structure, color contrast, keyboard nav, semantic HTML.
2. **Auth** (`tests/auth.spec.ts` + `tests/auth-unit.spec.ts`) — homepage inline login, valid/invalid names, session cookie properties, login API response shapes, protected-route redirects, logout, session token round-trips, name normalization, guest validation.
3. **Best Practices** (`tests/best-practices.spec.ts`) — valid HTML, meta tags, responsive viewport, no JS errors, no broken links.
4. **Performance** (`tests/performance.spec.ts`) — Core Web Vitals, TTI, DOM Content Loaded, page size, JS execution time.
5. **Pages** (`tests/pages.spec.ts`) — back links present on all sub-pages, NYC hotel section content, RSVP preview-mode rendering, couple-page gallery card count.
6. **Email Unit Tests** (`tests/email-unit.spec.ts`) — `withRecipient` attaches `to` and can't be overridden by a template; every template in `TEMPLATES` composes into a complete, sendable payload. Runs with `global.emailEnabled` off, which is exactly why it catches what `tests/admin.spec.ts` can't — see [Admin Endpoints](Admin-Endpoints) for the payload contract this covers.

CI only runs these when a PR is marked **"Ready for review"** — draft PRs skip them to conserve resources. Markdown/YAML/`LICENSE`/`.gitignore`/`playwright.config.ts`-only PRs also skip CI, since they can't affect site behavior.

**Always run `npm test` locally before pushing.** Draft PRs don't run CI, so a PR marked ready without local verification fails publicly.

```bash
npm run build          # always verify build works
npm run typecheck       # astro check — must be 0 errors, gated in CI, no browsers needed
npm test                # or npm run test:quick for a faster accessibility-only pass
npm run test:install    # if Playwright browsers aren't installed
```

## Type checking

`npm run typecheck` (`astro check`) is a separate, faster CI gate from the Playwright suites above — `.github/workflows/typecheck.yml` runs it on every non-draft PR with the same draft/docs-only skips. It must stay at 0 errors (and currently 0 warnings). Key things that trip people up:

- `astro build` does **not** type-check — Vite/Rolldown strips types without checking them, so a passing build says nothing about type correctness. `npx tsc --noEmit` is also not a substitute, since it misses `.astro` files entirely.
- `astro check` is the only thing that checks `.astro` files and their bundled `<script>` blocks (not `<script is:inline>`, which ships verbatim and errors at runtime instead of build time on any TS syntax).
- The most common error class: `querySelector('.x')` returns `Element`, which has no `.value`/`.checked`/`.dataset` — use `querySelector<HTMLInputElement>('.x')` instead of a cast.
- Type narrowing doesn't survive into a callback — a nullable variable checked before a `.forEach` is still nullable inside it; assign to a local `const` first.

**TypeScript is pinned to 6.x** (see [Architecture Overview](Architecture-Overview)) specifically because `astro check` and the Netlify bundler both embed the TS compiler, and TS 7's Go rewrite ships no compiler API for them to use yet.

Port **1213** is used everywhere (the engagement date, 12/13) and must never change.

## Delegate full-suite runs to a subagent

A complete `npm test` run prints ~270 progress lines. Spawn a `general-purpose` agent whose only job is to run the suite and report a summary (total passed/failed/skipped, and for each failure the test name, file:line, and assertion diff) — never to fix anything, and never two suites concurrently (Playwright binds port 1213 and rebuilds `dist/`). The agent must run in the primary working directory, not a worktree, since `dist/` is rebuilt from the checked-out branch.

## The synthetic test guest

Playwright, CI, and local authenticated testing all use a **dedicated synthetic party** in the real Notion Guest List — a robot-icon (🤖) party of two, invited to both NYC and France, Country USA. **Never** the couple's or any real guest's records.

- `LOCAL_TESTING_USERNAME` (`.env.local`) and `TEST_GUEST_NAME` (`tests/fixtures.ts`) point at this synthetic primary guest. It must match the Notion Guest List's `Full Name` value exactly — display-style names may not work.
- The RSVP test suites write to and delete this party's real RSVP Responses rows on every run, and rewrite its Guest List `RSVP` status. That churn is expected and isolated.
- The same names exist in the hardcoded dev fallback list in `src/lib/auth.ts`, so login works in both backend modes.
- `isTestGuest()` / `excludeTestGuests()` (`src/lib/test-guests.ts`) exclude the synthetic party from: `POST /api/admin/send-stds` and `send-email`, `refreshAllICS()` reporting totals (calendars still refresh for test tokens), `scripts/sync-contacts.ts`, and the invitation/reporting scripts (`count-*-invitations.mjs`, `generate-invitation-csv.mjs`, `find-missing-addresses.mjs`, `check-usps-imb-status.mjs`).

### Rules

1. **Never delete** the synthetic Notion guest pages — their page IDs are baked into calendar subscription tokens; deletion invalidates those URLs permanently.
2. **Never** add real guest PII to the repo — extend the synthetic party, or add new synthetic records with the **Test Guest** checkbox checked.
3. When adding a new synthetic guest, update `TEST_GUEST_DISPLAY_NAMES` in `src/lib/test-guests.ts` and `TEST_GUEST_NORMALIZED_NAMES` in `scripts/lib/test-guests.mjs`.

A prior regression wiped the couple's real RSVP when a test accidentally used Sam's own record instead of the synthetic party — this is the reason the rule exists.

## Logging in during local testing

```bash
curl -s -X POST http://localhost:1213/api/login \
  -H "Origin: http://localhost:1213" \
  --data-urlencode "name=$(grep '^LOCAL_TESTING_USERNAME' .env.local | cut -d= -f2-)" \
  -c cookies.txt
```

The login endpoint only accepts form-encoded bodies (`application/x-www-form-urlencoded` or `multipart/form-data`) — a JSON body returns a 500.

## Useful targeted commands

```bash
# Auth, event routing, and middleware access-control
npx playwright test tests/event-routing.spec.ts tests/auth.spec.ts tests/access-control.spec.ts

# Accessibility-only quick pass
npm run test:quick
```

## Test infrastructure notes

- Tests use a `BASE_URL = 'http://localhost:1213'` constant.
- API tests requiring the Notion backend `test.skip()` gracefully when `FEATURE_GLOBAL_NOTION_BACKEND` is off.
- `beforeAll` hooks fetch auth cookies once and reuse them across a suite.
