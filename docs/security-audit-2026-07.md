# Security Audit — July 2026

**Scope:** Public wedding site [sargaux.com](https://sargaux.com) and public GitHub repo `SamTheGeek/sargaux.com`.  
**Date:** 2026-07-11  
**Status:** Hardening implemented on branch `feature/security-audit-hardening` (this document).

## 1. Threat model

### Assets

| Asset | Why it matters |
|-------|----------------|
| Notion Guest List / RSVP Responses / Event Catalog | Write integrity of attendance and guest PII |
| Guest PII (names, emails, attendance, party structure) | Privacy |
| Admin blast radius (bulk email, calendar refresh) | Operational abuse |
| Session integrity | Who can act as whom |

### Attacker profiles

- **Low skill:** Guess guest names, poke public APIs, copy cookies, abuse calendar links forwarded in chats.
- **High skill:** Forge unsigned sessions, decode Notion page IDs from calendar tokens, craft RSVP JSON past the UI, scrape the public repo for ops docs / DB IDs / fallback names, DoS Notion via unauthenticated warm endpoints.

### Public surfaces (assume hostile)

- Live site: https://sargaux.com
- Public repo: architecture docs, secret *names*, historical Notion DB IDs in plans, hardcoded fallback names (now synthetic), admin curl recipes in `CLAUDE.md`

**Deliberate UX tradeoff:** name-only login stays. Hardening is compensating controls (signed sessions, RSVP validation, rate limits, ops lockdown) — not passwords.

## 2. Endpoint inventory

| Endpoint | Method | Auth model | Notes |
|----------|--------|------------|-------|
| `/api/login` | POST | Public | Rate-limited; sets signed `sargaux_auth` |
| `/api/logout` | GET/POST | Cookie clear | Public |
| `/api/rsvp` | POST | Signed session + notionId bind | Rate-limited; roster/event validation |
| `/api/rsvp` | GET | Signed session + notionId bind | Live invitation check |
| `/api/rsvp` | DELETE | Session + feature flag **or** admin Bearer | Off in production by default |
| `/api/warm` | GET | Admin Bearer | No public `guestCount` |
| `/api/calendar/health` | GET | Public | Returns only `{ ok }` |
| `/api/calendar/[token].ics` | GET | Capability URL (HMAC token) | Treat as secret link |
| `/api/calendar/test-seed` | * | Test mode only | `CALENDAR_TEST_MODE` |
| `/api/admin/refresh-calendars` | POST | Admin Bearer + rate limit | |
| `/api/admin/send-stds` | POST | Admin Bearer + rate limit | |
| `/api/admin/send-email` | POST | Admin Bearer + rate limit | |

Protected pages (`/nyc/*`, `/france/*`, `/registry`, `/couple`) require a valid signed session cookie.

## 3. Findings (pre-hardening)

### P0 — Critical

| ID | Finding | Impact |
|----|---------|--------|
| P0-1 | `sargaux_auth` was unsigned base64 JSON | Anyone who could set a cookie could forge a session |
| P0-2 | No guest↔notionId bind on RSVP | Calendar token prefix leaks `notionId`; combine with forged cookie → RSVP as that guest |
| P0-3 | RSVP `guestsAttending` / `eventsAttending` not roster-validated | Crafted POST could pollute Notion with foreign names / events |
| P0-4 | `DELETE /api/rsvp` open to any authenticated guest; used cookie invitations | Stale-cookie / test-endpoint abuse |

### P1 — High

| ID | Finding | Impact |
|----|---------|--------|
| P1-1 | No app-level rate limits on login / RSVP / admin | Name enumeration, abuse |
| P1-2 | `GET /api/warm` unauthenticated, returned `guestCount` | Recon + Notion cost DoS |
| P1-3 | `GET /api/calendar/health` leaked `hasSecret` / `hasNotionKey` / `blobsOk` | Config recon |
| P1-4 | `details: error.message` on client 500s | Info leak |
| P1-5 | Missing CSP / frame-ancestors / Referrer-Policy / Permissions-Policy | Clickjacking / XSS impact surface |

### P2 — Medium

| ID | Finding | Impact |
|----|---------|--------|
| P2-1 | Notion data-source UUIDs in committed plans | Public-repo recon |
| P2-2 | Real family names in hardcoded auth fallback | Name-guess hints when Notion down |
| P2-3 | Admin Bearer used string `!==` compare | Minor timing side channel |
| P2-4 | Calendar URLs are capability secrets (prefix = notionId) | Shared-link schedule leakage |

### P3 — Low / out of scope this pass

- Full Notion workspace IAM, Resend account takeover, Netlify/GitHub MFA (ops checklist below).

## 4. Strengths (keep)

- Runtime secrets via `process.env`; `.env.example` placeholders only
- Calendar tokens HMAC-signed with constant-time compare (`src/lib/calendar.ts`)
- RSVP already required `notionId` + live invitation check + party-scoped emails
- Astro `security.checkOrigin` in production
- Auth cookie `httpOnly` + `Secure` (prod) + `SameSite=Lax`
- CDN `Netlify-Vary` on auth/lang cookies
- Fonts CORS scoped to `https://withjoy.com`
- Admin endpoints Bearer-gated

## 5. Remediation roadmap (shipped)

| Phase | Work |
|-------|------|
| 2 | Signed `sargaux_auth` (`SESSION_HMAC_SECRET`), notionId binding, RSVP roster/event/size validation, DELETE gate |
| 3 | Rate limits (login/RSVP/admin), auth-gate `/api/warm`, minimal calendar health, strip 500 details, security headers (CSP Report-Only) |
| 4 | Redact DB UUIDs, synthetic fallback guests, timing-safe admin compare + audit log, env docs, secret-scan script |

### P1-5 implementation note (revised after review)

The security headers were first shipped as a `[[headers]] for = "/*"` block in
`netlify.toml`. That implementation was **wrong**: Netlify header rules apply
only to statically-served files, never to function responses, and under the
Netlify adapter every SSR page is served by a function — so the headers landed
on static assets (useless) and were absent from HTML (where they matter). The
block was removed and the headers now ship from `src/middleware.ts` on every
non-API page response, including redirects, via the same code path as
`Netlify-Vary`.

Header set (see `SECURITY_HEADERS` in `src/middleware.ts`):

- `X-Frame-Options: SAMEORIGIN` — changed from `DENY`, which contradicted the
  CSP's `frame-ancestors 'self'`. XFO is kept alongside `frame-ancestors`
  because `frame-ancestors` is ignored in a Report-Only policy.
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Content-Security-Policy-Report-Only` — still report-only. There is no
  `report-to`/`report-uri` endpoint yet, so violations are visible only in
  guests' devtools; enforcement should wait until reporting is wired up.

Regression coverage: `tests/security-headers.spec.ts`.

### Deploy-preview RSVP delete flag (revised after review)

`FEATURE_GLOBAL_RSVP_DELETE_ENABLED = "true"` has been removed from the
`[context.deploy-preview.environment]` section of `netlify.toml` — it enabled
a guest-facing destructive RSVP DELETE path on public deploy previews that run
against production Notion data. The flag remains enabled for local Playwright
runs via the `webServer.env` defaults in `playwright.config.ts`.

## 6. Test cases

See `tests/security.spec.ts` and updates to `tests/auth-unit.spec.ts`:

- Unsigned / tampered cookie → rejected
- Forged cookie with stolen notionId + wrong name → RSVP 401
- Foreign `guestsAttending` name → 400
- Invalid `eventsAttending` → 400
- Oversized `details` → 400
- `/api/warm` 401 without Bearer; no `guestCount`
- `/api/calendar/health` → `{ ok }` only

## 7. Monitoring checklist

- Alert on login **401** spikes (name guessing)
- Alert on admin **401** spikes (secret probing)
- Watch `/api/warm` volume (should be CI/cron only)
- Confirm `CALENDAR_TEST_MODE` unset in production
- Confirm `FEATURE_NYC_RSVP_PREVIEW` is preview/local only and `FEATURE_GLOBAL_RSVP_DELETE_ENABLED` is local-test only (removed from deploy previews — they run against production Notion data)
- Enable MFA on GitHub, Netlify, and Notion (ops)

## 8. Manual ops after deploy

1. Set `SESSION_HMAC_SECRET` in Netlify (production + deploy-preview + branch-deploy) — `openssl rand -hex 32`
2. Set the same value in GitHub Actions secrets for CI builds/tests
3. Update cache-warmup workflow to send `Authorization: Bearer ${{ secrets.RESEND_ADMIN_SECRET }}` to `/api/warm`
4. Expect all guests to **re-login once** (unsigned cookies fail closed)

## Appendix A — Phase 0 evidence (redacted)

Probes against https://sargaux.com on 2026-07-11:

### Security headers (homepage)

Present: `strict-transport-security: max-age=31536000`, `x-content-type-options: nosniff`  
Absent (pre-hardening): CSP, `X-Frame-Options` / `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`

### `GET /api/warm`

Unauthenticated `200` with body shape `{ "warmed": true, "guestCount": <N> }` (exact count redacted in public discussion; observed live).

### `GET /api/calendar/health`

`{ "ok": true, "hasSecret": true, "hasNotionKey": true, "blobsOk": true }`

### Login burst

Three rapid `POST /api/login` with unknown names → all `401` with uniform message; no `429` (no app-level rate limit).

### Cookie forge

Unsigned `sargaux_auth = base64url({guest, notionId: fake-uuid, created})`:

- `GET /nyc` → **200** HTML (middleware accepted unsigned cookie)
- `POST /api/rsvp` with fake notionId → **500** party load failure (not a hard auth reject)

### Calendar token prefix

`base64url(notionId)` prefix of `base64url(id).hmac` is decodable without verifying HMAC (demo with synthetic id `test-notion-id`).
