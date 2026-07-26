# Authentication & Sessions

- Name-based login (no passwords) — validates against the guest list. This was a deliberate, documented UX tradeoff (see [Guest Privacy & Security](Guest-Privacy-And-Security)): hardening is compensating controls, not passwords.
- When the `global.notionBackend` flag is on: validates against the Notion Guest List database.
- When the flag is off (local dev without keys): falls back to a hardcoded list in `src/lib/auth.ts`.
- Names are normalized: lowercase, accents removed (NFD), whitespace collapsed.

## Session cookie

`sargaux_auth` (90-day expiry, httpOnly) — HMAC-signed (`SESSION_HMAC_SECRET`), format `base64url(payload).hmac`. Unsigned/legacy cookies fail closed (guests re-login once after a deploy that introduces signing). The payload contains the guest's display name and optional Notion page ID.

- **Event invitations are resolved live, never trusted from the cookie**: the cookie's `eventInvitations` snapshot is only a fallback (hardcoded-list mode, transient Notion failures). Middleware and the RSVP API read invitations from the live Notion record (15-minute guest cache) so invitation changes take effect without re-login.
- **Session binding**: when a Notion page ID is present, middleware and the RSVP API require the cookie's guest name to normalize-match the live Notion record's name — this stops a calendar-leaked page ID from being paired with an arbitrary display name.

## Login geo gate

`netlify/edge-functions/login-geo-gate.ts` blocks `/api/login` from non-allowlisted countries (403, fails open when geo data is missing). This is edge-runtime only — it never runs under the local Node adapter, so it must be verified on deploy previews. It's scoped to `/api/login` deliberately: widening it to pages would bypass the per-guest CDN cache.

## Envelope-name login

Flag: `global.envelopeLogin`. Guests may log in using the addressee line printed on their invitation envelope ("Samuel & Margaux Gross") or any combination of their household's first names plus a household surname — not just their own exact `Full Name`.

- Exact `Full Name` still wins and is still a one-step login; envelope rules only run on a miss.
- Two match rules: (1) the input's token set equals a stored `Envelope Names` string, or (2) every token is a household first or last name, at least one is a first name, and no two tokens claim the same household member. A bare surname never matches on its own.
- Titles, connectors (`and`/`et`/`&`/`+`), periods, and the CSV generator's trailing ` +1` are stripped. Collective words ("The", "Family") are deliberately kept — stripping them would let "The Gross Family" reduce to "gross" and unlock the household on a surname alone.
- Households are connected components via union-find over the `Related Guests` relation, not `getGuestParty` (which only walks one hop and would miss a third member wired A↔B, B↔C).
- Ambiguity across households fails closed with a `console.warn`.
- The `Envelope Names` Guest List property (`rich_text`, newline-separated) holds the hand-edited strings actually printed on invitations, denormalized onto every household member so one query finds a match. A household can hold two entries (NYC and France may include different members). It's populated by `scripts/import-envelope-names.mjs`, sharing formatting logic with `scripts/generate-invitation-csv.mjs` via `scripts/lib/envelope-csv.mjs`.

## Two-step login + identity claims

When a name resolves to two or more people, `POST /api/login` returns `{ needsIdentity, claim, candidates }` and sets **no cookie** — the guest picks who they are and posts the `claim` plus their chosen `guestId` back to mint the session.

- Claims are HMAC-signed with `SESSION_HMAC_SECRET` (10-minute expiry, `typ: 'claim'` for domain separation from a real session token — no second secret needed, and a session token can never be redeemed as a claim).
- A claim only ever authorizes the member IDs the server put in it at issuance time.
- Redemption uses its own `claim:${ip}` rate-limit bucket, so a two-step login doesn't burn two of the ten login attempts.
- The identity picker is inline on the homepage, using `hidden` for visibility (CSS scoped to `:not([hidden])`) so it stays out of the focus order while collapsed.

## Routing after login

- Protected routes: `/nyc/*`, `/france/*`, `/registry` — middleware redirects unauthenticated visitors to `/`.
- `Astro.locals.guest` (string) — guest display name, available on all protected pages.
- `Astro.locals.guestId` (string) — Notion page ID, available when the Notion backend is enabled.
- Default routing is centralized in `src/lib/event-routing.ts` and must stay in sync across the homepage redirect, the login API redirect, and the middleware fallback:
  - Guests invited only to NYC default to `/nyc`.
  - Guests invited only to France default to `/france`.
  - Guests invited to both default to `/nyc` through **October 14, 2026**, and to `/france` starting **October 15, 2026**.
  - The cutoff is evaluated in the `America/New_York` time zone.

## Homepage login UI

Implementation: `src/pages/index.astro`.

- The login control is a single inline control, not a modal. Default state shows the `Entrée` trigger button.
- Clicking `Entrée` adds `is-active` to `#inline-entry-control`; `.inline-name-shell` goes from `display: none` to `display: flex`; `#name` is focused in `requestAnimationFrame`.
- The hidden-state accessibility fix depends on `display: none`, not `aria-hidden` — regressions here surface in the accessibility test suite.
- The active state is **intentionally subtle**: the dark bar stays in the same place, and the most visible change is `ENTRÉE` becoming the `Your name` placeholder plus the orange submit arrow. This can look like nothing happened even when it worked — inspect focus/DOM state before assuming the click handler is broken.
- Post-login navigation uses a temporary anchor click so the client router (`ClientRouter`) can intercept the navigation, rather than an inline `astro:transitions/client` import.

### Regression checklist when touching login or routing

- Clicking `Entrée` reveals and focuses `#name`.
- The hidden login shell is never focusable while collapsed.
- Valid login reaches the guest's default route.
- Dual-invite guests route to NYC before October 15, 2026 and France on/after.
- The homepage script doesn't reintroduce a direct inline `astro:transitions/client` import.

```bash
npm run build
npx playwright test tests/event-routing.spec.ts tests/auth.spec.ts tests/access-control.spec.ts
```
