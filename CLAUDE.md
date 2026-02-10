# CLAUDE.md

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

### Product Documentation

See `docs/feature plan.md` for the full product specification including:

- Feature list (F-001 through F-012)
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

- **Framework**: Astro v5.x with SSR hybrid mode
- **Adapter**: @astrojs/node (standalone mode for local dev; Netlify for production)
- **Language**: TypeScript with strict mode enabled
- **CSS**: Astro scoped styles (Tailwind optional for design phase)
- **Backend**: Notion API v2025-09-03 via `@notionhq/client` v5.x
- **Email**: Resend (transactional)
- **Hosting**: Netlify
- **Node.js**: v24.12.0 (LTS v22.x recommended)
- **Package Manager**: npm v11.6.2

## Environment Setup

To set up a fresh Mac for development, run:

```bash
./scripts/setup.sh
```

This installs everything from scratch (Xcode CLT, Homebrew, nvm, Node.js, npm deps, Playwright browsers, Netlify CLI, GitHub CLI). The only prerequisite is a stock macOS install.

After setup, authenticate once:

```bash
netlify login      # Authenticate with Netlify
gh auth login      # Authenticate with GitHub
```

The `.nvmrc` file pins Node.js to the LTS v22.x line. Run `nvm use` to switch to the correct version.

## Development Commands

**Collaborative Sessions**: When working together on code changes, always start the dev server (`npm run dev`) and open <http://localhost:1213> in a browser. This allows watching changes in real time as edits are made.

**IMPORTANT - Port 1213**: The development server and all tests use port **1213** (December 13th - the engagement date). This is a sentimental choice and must NEVER be changed. Do not use port 4321 or any other port.

```bash
# Start development server (http://localhost:1213 - engagement date!)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run all tests (accessibility, best practices, auth, and performance)
# Note: This automatically installs Playwright browsers if needed
# Tests run against built server: node ./dist/server/entry.mjs
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

## Testing

The project includes 51 automated tests that run on every PR:

### Test Suites (run in parallel)

1. **Accessibility Tests** (`tests/accessibility.spec.ts`)
   - WCAG 2.0/2.1 AA compliance
   - Proper document structure (h1, lang, meta tags)
   - Color contrast requirements
   - Keyboard navigation support
   - Semantic HTML structure

2. **Auth Tests** (`tests/auth.spec.ts` + `tests/auth-unit.spec.ts`)
   - Login modal behavior (open, close, escape, backdrop)
   - Login with valid/invalid names, case sensitivity, whitespace
   - Session cookie properties (httpOnly, base64 JSON payload)
   - Login API response shapes (200, 400, 401)
   - Protected route redirects and logout flow
   - Session token round-trip with and without notionId
   - Name normalization (case, accents, whitespace)
   - Guest validation against GuestRecord lists

3. **Best Practices Tests** (`tests/best-practices.spec.ts`)
   - Valid HTML structure, meta tags, responsive viewport
   - No JavaScript errors, no broken links

4. **Performance Tests** (`tests/performance.spec.ts`)
   - Core Web Vitals (LCP, FCP, CLS)
   - Time to Interactive (TTI), DOM Content Loaded
   - Page size, JavaScript execution time, resource loading

All test suites run simultaneously in CI. **Important**: CI tests only run when PRs are marked as "Ready for review" - draft PRs are skipped to conserve resources.

## Git Workflow

**IMPORTANT**: Direct pushes to the `main` branch are not allowed. All code changes must go through the following process:

1. Create a new branch for your changes
2. Make commits to your branch
3. **BEFORE pushing**: Verify changes locally
   - **Always run**: `npm run build` to ensure the build succeeds
   - **Prefer to run**: `npm test` to run all tests (accessibility, best practices, performance)
   - If Playwright browsers aren't installed, run `npm run test:install`
4. Push your branch and create a pull request **in draft mode**
5. Only humans should mark PRs as "Ready for review" via the GitHub website
6. Wait for automated tests to pass (accessibility, best practices, and performance run in parallel)
7. Merge via pull request after approval

**Note**: Always open PRs as drafts initially. Draft PRs do NOT trigger the automated test suite in CI - tests only run when a PR is marked as "Ready for review". This allows for review and iteration before consuming CI resources.

**Local Testing Requirement**: You MUST verify builds and tests locally before creating PRs since draft PRs don't run CI tests. Even for non-code changes (documentation, configuration), always run at least `npm run build` to ensure nothing is broken. Use `npm run verify` for a complete local check (build + all tests).

**Test Skipping**: Automated tests are automatically skipped for PRs that only modify:

- Markdown files (`*.md`)
- YAML files (`*.yml`, `*.yaml`) - CI/CD and configuration
- LICENSE file
- `.gitignore`
- `playwright.config.ts` - test configuration

These changes are build configuration and documentation that don't affect the website's accessibility or functionality.

Example workflow:

```bash
git checkout -b feature/my-changes
# Make your changes and commit
git commit -m "Your changes"

# BEFORE pushing, verify locally:
npm run build          # Always verify build works
npm test              # Run all tests (or npm run test:quick for faster check)

# If tests fail due to missing browsers:
npm run test:install  # Install Playwright browsers

# After tests pass locally:
git push -u origin feature/my-changes
gh pr create --draft --title "Your title" --body "Your description"
```

## Versioning

The project version in `package.json` follows semantic versioning with wedding milestones:

- **Patch** (`0.5.x`): Bump on every PR merge
- **Minor** (`0.x.0`): Bump when a plan/epic is completed (e.g., Notion integration Phase 1 → 0.6.0)
- **Major**: `1.0` = NYC event launch, `2.0` = France event launch

Always bump the patch version as part of each PR.

## Project Structure

- `src/pages/` - Astro pages (file-based routing)
- `src/pages/api/` - Server-side API endpoints (login, logout, RSVP)
- `src/lib/auth.ts` - Authentication utilities (name validation, session tokens)
- `src/lib/notion.ts` - Notion client wrapper (guest data fetching)
- `src/types/guest.ts` - GuestRecord type definition
- `src/config/features.ts` - Build-time feature flags
- `src/middleware.ts` - Route protection and auth context
- `src/layouts/` - Page layouts (WireframeLayout, etc.)
- `public/` - Static assets (served at root)
- `tests/` - Playwright test suites
- `docs/plans/` - Implementation plans
- `astro.config.mjs` - Astro configuration
- `tsconfig.json` - TypeScript configuration (extends astro/tsconfigs/strict)

## Architecture Notes

- Uses Astro's minimal template as the base
- TypeScript strict mode is enabled for type safety
- File-based routing: pages in `src/pages/` become routes
- Static assets in `public/` are served at root path
- SSR enabled with `@astrojs/node` adapter (standalone mode)
- **Script gotcha**: Use `<script is:inline>` for scripts in pages with early returns (e.g., auth redirects) to avoid "Unknown chunk type: script" error
- **Notion SDK**: Uses `@notionhq/client` v5.x targeting Notion API v2025-09-03. Key difference from older versions: `dataSources.query()` replaces `databases.query()`, using `data_source_id` instead of `database_id`. See [upgrade guide](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03).

## Authentication

- Name-based login (no passwords) — validates against guest list
- When `global.notionBackend` flag is on: validates against Notion Guest List database
- When flag is off (local dev without keys): falls back to hardcoded list in `src/lib/auth.ts`
- Names normalized: lowercase, remove accents (NFD), collapse whitespace
- Cookie: `sargaux_auth` (90-day expiry, httpOnly) — contains guest name + optional Notion page ID
- Protected routes: `/nyc/*`, `/france/*`, `/registry` — middleware redirects to `/` if unauthenticated
- `Astro.locals.guest` (string) — guest display name, available in all protected pages
- `Astro.locals.guestId` (string) — Notion page ID, available when notionBackend is enabled

## Secrets & API Keys

**CRITICAL: Never commit API keys or secrets to the repository.**

- `NOTION_API_KEY` — Notion integration token. Store in:
  - **Netlify Dashboard** → Site settings → Environment variables (for builds/deploys)
  - **GitHub Secrets** → Repository settings → Secrets and variables (for CI)
- `NOTION_GUEST_LIST_DB` — Notion **data source** ID (Notion API v2025-09-03 uses data sources, not database IDs)
- `NOTION_EVENT_CATALOG_DB` — Event Catalog data source ID
- `NOTION_RSVP_RESPONSES_DB` — RSVP Responses data source ID
- All secrets must be added to Netlify Dashboard and/or GitHub Secrets directly — never in `netlify.toml`, `.env` files committed to git, or source code
- The `.gitignore` already excludes `.env` files, but always double-check before committing
- **Runtime secrets use `process.env`**, not `import.meta.env` — Vite's `import.meta.env` only includes vars present at build time. Netlify Dashboard env vars are runtime-only. `process.env` is server-side only and never exposed to browser bundles.

## Feature Flags

The site uses a **build-time** feature flag system (`src/config/features.ts`) for gradual rollout and protecting production. Flags are resolved at build time via Vite's static `import.meta.env` replacement — changing a flag requires a rebuild.

### Master Switch

The `global.weddingSiteEnabled` flag controls whether the full wedding site is visible:

- **Production (default: `false`)**: Only shows a minimal "Chez Sargaux" placeholder
- **Development (`npm run dev`)**: Automatically enabled — you always see the full site locally
- **Netlify Preview Deploys**: Automatically enabled via `netlify.toml`

### Running Locally

```bash
# Standard development - wedding site is automatically enabled
npm run dev

# To test with specific flags, set environment variables:
FEATURE_NYC_CALENDAR_SUBSCRIBE=true npm run dev

# To test production behavior (site disabled):
FEATURE_GLOBAL_WEDDING_SITE_ENABLED=false npm run dev
```

### Environment Variable Format

Flags use the format `FEATURE_{AREA}_{FLAG_NAME}`:

- `global.weddingSiteEnabled` → `FEATURE_GLOBAL_WEDDING_SITE_ENABLED`
- `nyc.calendarSubscribe` → `FEATURE_NYC_CALENDAR_SUBSCRIBE`
- `france.euAllergens` → `FEATURE_FRANCE_EU_ALLERGENS`

**Important**: Each flag must be a **static** `import.meta.env.FEATURE_*` reference in `features.ts` so Vite can replace it at build time. Dynamic access like `import.meta.env[key]` does NOT work.

### Available Flags

See `src/config/features.ts` for the full list. Key flags:

- `global.weddingSiteEnabled` — Master switch for the entire wedding site
- `global.notionBackend` — Use Notion Guest List for auth (requires `NOTION_API_KEY` and `NOTION_GUEST_LIST_DB`). When off, falls back to hardcoded guest list.
- `global.i18n` — French language support
- `nyc.*` / `france.*` — Event-specific features
- `registry.enabled` — Registry page visibility

### For Netlify Preview Deploys

When developing new features, add their flags to `netlify.toml` so preview deploys show them:

```toml
[context.deploy-preview.environment]
  FEATURE_GLOBAL_WEDDING_SITE_ENABLED = "true"
  FEATURE_NYC_CALENDAR_SUBSCRIBE = "true"  # example
```

Always add new feature flags to the deploy-preview environment in `netlify.toml` when developing them.
