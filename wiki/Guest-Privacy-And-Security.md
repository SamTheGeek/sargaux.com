# Guest Privacy & Security

## This repo is public — guest privacy rules

**Never write a real guest's name into anything that lands in the repo or on GitHub.** That includes source and test files, code comments, commit messages, PR titles and descriptions, PR review comments, issues, and this wiki. The repository is public, so all of it is world-readable and indexed.

This is easy to violate by accident — a guest reports a login problem, the invitation CSVs are open, and the household that reproduces the bug gets pasted into a fixture or a commit message without thinking. Guests never consented to appear in a public repo.

- **Test fixtures use invented names.** Copy the *shape* that matters (hyphenated given name, two-word given name, multi-word surname, two members sharing a first name, mixed surnames within a household) — never the real name that exhibited it.
- **Commit messages and PR text describe shapes, not people** — "a two-surname household where one member carries a title," not the household.
- **Guest data files stay untracked.** `scripts/output/` is gitignored and must remain so; it holds names, postal addresses, and USPS serials. `scripts/data/usps-imb-serials.json` is tracked but safe — its keys are SHA-256 hashes, never plaintext.
- **The couple's own names are fine** (Sam Gross, Margaux Ancel) — it's their wedding site. The rule protects third-party guests.
- Redacting after a push is only a partial fix: force-pushing a branch removes names from the tip, but orphaned commits stay reachable by SHA on GitHub, and PR description edits keep a visible edit history. Get it right before pushing.

### Synthetic test guest

All Playwright/CI/local authenticated testing uses a dedicated synthetic party in the real Notion Guest List — **never** the couple's records or any real guest's. See [Testing Guide](Testing-Guide) for the full details (`isTestGuest()`, exclusion from production operations, and the rule against ever deleting the synthetic pages).

## Secrets & API keys

Runtime secrets are read via `process.env`, never `import.meta.env` — Vite's `import.meta.env` only includes vars present at build time, while Netlify Dashboard vars are runtime-only and server-side only (never exposed to browser bundles).

| Secret | Purpose |
|---|---|
| `NOTION_API_KEY` | Notion integration token |
| `NOTION_GUEST_LIST_DB` / `NOTION_EVENT_CATALOG_DB` / `NOTION_RSVP_RESPONSES_DB` | Database page IDs |
| `CALENDAR_HMAC_SECRET` | Signs calendar subscription tokens — must stay stable across deploys, or every `webcal://` link breaks. Never delete-and-recreate a guest's Notion page for the same reason (the page ID is baked into their token). |
| `SESSION_HMAC_SECRET` | Signs `sargaux_auth` session cookies — distinct from the calendar secret; rotating it forces every guest to re-login |
| `RESEND_ADMIN_SECRET` | Bearer token for `/api/admin/*` and `GET /api/warm` — stored write-only in Netlify (readable copy lives in `.env.local`; `netlify env:get` returns an unusable placeholder) |
| `CALENDAR_TEST_MODE` | When `"true"`, calendar endpoints use a mock blob store — must stay unset/off in production |

All secrets live in the Netlify Dashboard and/or GitHub Secrets — never in `netlify.toml`, committed `.env` files, or source code.

## Threat model (July 2026 security audit)

**Assets**: the Notion Guest List / RSVP Responses / Event Catalog write integrity, guest PII, admin blast radius (bulk email, calendar refresh), and session integrity (who can act as whom).

**Attacker profiles considered**:

- *Low skill*: guessing guest names, poking public APIs, copying cookies, abusing forwarded calendar links.
- *High skill*: forging unsigned sessions, decoding Notion page IDs from calendar tokens, crafting RSVP JSON past the UI, scraping the public repo for ops docs / DB IDs / fallback names, DoS-ing Notion via unauthenticated warm endpoints.

**Deliberate tradeoff**: name-only login stays (see [Authentication & Sessions](Authentication-And-Sessions)) — hardening is compensating controls (signed sessions, RSVP validation, rate limits, ops lockdown), not a password wall.

## Findings and remediation (shipped)

The audit found and fixed, in three phases:

- **P0 (critical)**: an unsigned `sargaux_auth` cookie (forgeable sessions) → fixed with HMAC signing; no guest↔Notion-ID binding on RSVP (a leaked calendar token's ID could be paired with a forged cookie) → fixed with session binding; RSVP `guestsAttending`/`eventsAttending` weren't roster-validated (a crafted POST could pollute Notion with foreign names/events) → fixed with validation; `DELETE /api/rsvp` was open to any authenticated guest → fixed by gating behind a feature flag or admin Bearer.
- **P1 (high)**: no app-level rate limits on login/RSVP/admin → added; `GET /api/warm` was unauthenticated and leaked a guest count → auth-gated, count removed from the public response; `GET /api/calendar/health` leaked config flags (`hasSecret`, `hasNotionKey`, `blobsOk`) → trimmed to `{ ok }` only; client 500s leaked `error.message` → stripped; missing CSP/frame-ancestors/Referrer-Policy/Permissions-Policy → added.
- **P2 (medium)**: Notion data-source UUIDs committed in plan docs → redacted going forward; real family names in the hardcoded auth fallback → replaced with synthetic guests (see [Testing Guide](Testing-Guide)); admin Bearer comparison used non-constant-time `!==` → switched to a timing-safe compare with an audit log.

### Security headers implementation note

Security headers were first shipped as a `[[headers]]` block in `netlify.toml`, which was **wrong** — Netlify header rules only apply to statically-served files, never to function responses, and under the Netlify adapter every SSR page is served by a function. The block was removed; headers now ship from `src/middleware.ts` on every non-API page response (including redirects), the same code path as the `Netlify-Vary` header. Current header set (`SECURITY_HEADERS` in `src/middleware.ts`):

- `X-Frame-Options: SAMEORIGIN` (not `DENY`, since that would contradict the CSP's `frame-ancestors 'self'`; XFO is kept alongside it because `frame-ancestors` is ignored while the CSP is Report-Only)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Content-Security-Policy-Report-Only` — still report-only pending a `report-to` endpoint
- `Strict-Transport-Security: max-age=15552000; includeSubDomains` (180 days, deliberately **no `preload`** — preload-list inclusion is effectively irreversible; `includeSubDomains` is safe because the only subdomain in use, `www`, is a Netlify auto-HTTPS 301 to the apex)

Regression coverage: `tests/security-headers.spec.ts`.

### Login geo allowlist

`netlify/edge-functions/login-geo-gate.ts` gates `/api/login` by request country per the couple's explicit request (see [Authentication & Sessions](Authentication-And-Sessions) for the mechanics). Allowlist: US, CA, GB, IE, the EU 27, CH/NO/IS/LI plus MC/AD/SM/VA, and BR, AR, JP, TW, IN. Missing geo data fails open. Deliberately **not** applied to page browsing — an edge function in front of content pages would bypass the per-guest CDN cache and would break traveling guests and link-preview fetchers.

## Monitoring checklist

- Alert on login 401 spikes (name guessing) and admin 401 spikes (secret probing).
- Watch `/api/warm` volume — should be CI/cron only.
- Confirm `CALENDAR_TEST_MODE` is unset in production.
- Confirm `nyc.rsvpPreview`/`france.rsvpPreview` are preview/local only, and `global.rsvpDeleteEnabled` is local-test only.
- MFA enabled on GitHub, Netlify, and Notion.

## Ops after any secret rotation

1. Set the new secret in Netlify (production + deploy-preview + branch-deploy contexts).
2. Set the same value in GitHub Actions secrets.
3. Expect all guests to re-login once if it was `SESSION_HMAC_SECRET` (unsigned cookies fail closed by design).
