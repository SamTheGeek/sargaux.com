# Design: Personalized Calendar Subscriptions (F-004)

**Date:** 2026-02-20
**Status:** Approved
**Epic:** M2 — Calendar Subscriptions

---

## Goal

Guests can subscribe to a personalized `.ics` calendar feed from their event landing page. The calendar updates automatically when event details change in Notion and the site is republished. Each guest's calendar shows only the events they are invited to.

---

## Architecture

### Token Design

Calendar apps (iOS Calendar, Google Calendar, Outlook) do **not** send auth cookies when fetching a subscribed calendar URL. Session cookies cannot be used for authentication. Instead, we embed a guest-specific token directly in the URL.

**Token format:**

```
[base64url(guestId)].[hmac-sha256(CALENDAR_HMAC_SECRET, guestId, first 32 hex chars)]
```

- The server splits on `.`, decodes the guestId from the first segment, recomputes the HMAC, and compares — O(1), no guest list scan required.
- Tokens are stable for a guest's lifetime (same guestId = same token).
- If `CALENDAR_HMAC_SECRET` is rotated, all existing calendar links break (guests must re-subscribe). Treat it like a permanent credential.

**New environment variable: `CALENDAR_HMAC_SECRET`**

This is a random secret string used to sign calendar tokens. Without it, anyone who knows a guest's Notion page ID could construct a valid token. With it, tokens are unforgeable.

**What it is:** A random string, at least 32 characters. It does not need to be human-readable. Think of it like a password that only the server knows.

**How to generate one:**

```bash
# Option 1: openssl (recommended)
openssl rand -hex 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This outputs something like: `a3f8c2d1e4b7...` (64 hex characters). Copy that value.

**Where to store it (same pattern as `NOTION_API_KEY`):**

```bash
# Netlify (for production/preview deploys)
netlify env:set CALENDAR_HMAC_SECRET "your-generated-value"
# Or in Netlify Dashboard → Site settings → Environment variables

# GitHub (for CI tests)
gh secret set CALENDAR_HMAC_SECRET
# Paste the value when prompted
```

**Never commit it to the repository.** Add to `.gitignore` check habits. It follows the same rules as `NOTION_API_KEY`.

---

### Endpoint

`GET /api/calendar/[token].ics`

**Request flow:**
1. Parse token from URL: split on `.` → `[encodedGuestId, hmac]`
2. Decode `encodedGuestId` from base64url → `guestId`
3. Recompute expected HMAC: `HMAC-SHA256(CALENDAR_HMAC_SECRET, guestId).slice(0, 32)`
4. Compare with `hmac` from token — if mismatch, return 404 (not 401, to avoid leaking info)
5. Call `getGuestEvents(guestId)` → list of `EventRecord` with `dayId`s
6. For each event with a `dayId`, call `fetchDayDate(dayId)` → ISO date string (`"2026-10-11"`)
7. Parse `event.time` (e.g. `"6:00 PM"`) → hours + minutes
8. Build ICS response and return with `Content-Type: text/calendar; charset=utf-8`

**Response headers:**
```
Content-Type: text/calendar; charset=utf-8
Content-Disposition: attachment; filename="sargaux-wedding.ics"
Cache-Control: no-cache
```

---

### ICS Format (RFC 5545)

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sargaux Wedding//sargaux.com//EN
X-WR-CALNAME:Sargaux Wedding
X-WR-CALDESC:Your personal schedule for Sam & Margaux's wedding
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:{eventId}@sargaux.com
DTSTAMP:{current UTC timestamp}
DTSTART;TZID=America/New_York:20261011T180000
DTEND;TZID=America/New_York:20261011T200000
SUMMARY:NYC Dinner
DESCRIPTION:Cocktails, dinner, and dancing in New York City
LOCATION:TBD
END:VEVENT
...
END:VCALENDAR
```

**Key decisions:**
- `UID`: `{eventId}@sargaux.com` — stable across rebuilds, required by RFC 5545
- `DTEND`: `DTSTART + 2 hours` (default, no end time in Notion)
- Timezone: `America/New_York` for NYC events, `Europe/Paris` for France events
- Events with no date (no `dayId` or Day page missing a date): **include with just a DATE** (`DTSTART;VALUE=DATE:20261011`), no time component
- `Show on Website` checkbox is **not** used as a filter here — if a guest is invited, they get it in their calendar regardless

---

### Notion: `fetchDayDate(dayId)`

New function in `src/lib/notion.ts`:

```ts
// Returns "YYYY-MM-DD" or undefined if Day page has no date
export async function fetchDayDate(dayId: string): Promise<string | undefined>
```

- Fetches the Wedding Timeline page by ID using `notion.pages.retrieve()`
- Extracts `props['date:Date:start']` — but note: the raw Notion API returns this as a `date` property named `Date`, not `date:Date:start` (that's the MCP format). The actual property name in Notion is `Date`.
- Cache results in a module-level `Map<string, string>` to avoid repeat fetches within a request.

---

### `src/lib/calendar.ts` (new file)

Responsibilities:
- `generateToken(guestId: string): string` — builds the URL-safe token
- `verifyToken(token: string): string | null` — returns guestId or null
- `buildICS(events: EventRecord[]): string` — builds the full ICS string
- `parseTime(time: string): { hour: number; minute: number } | undefined` — parses "6:00 PM" → `{ hour: 18, minute: 0 }`
- `formatDTSTAMP(): string` — current UTC time in ICS format

---

### UI Changes

**"Add to Calendar" button** on `/nyc/index.astro` and `/france/index.astro`:

```
webcal://sargaux.com/api/calendar/[token].ics
```

- Token computed server-side from `Astro.locals.guestId`
- Only visible when `features.global.calendarSubscribe` flag is on **and** `Astro.locals.guestId` is set (i.e. Notion backend is enabled and guest is authenticated with a known ID)
- If `guestId` is not set (fallback auth mode), button is hidden

---

### Feature Flag

New flag: `global.calendarSubscribe`

Four-step checklist:
1. Add to `FeatureFlags` type in `src/config/features.ts`
2. Add static `import.meta.env.FEATURE_GLOBAL_CALENDAR_SUBSCRIBE` reference in features object
3. Add `FEATURE_GLOBAL_CALENDAR_SUBSCRIBE` to `ImportMetaEnv` in `src/env.d.ts`
4. Add to `netlify.toml` `[context.deploy-preview.environment]` section

---

### Tests (`tests/calendar.spec.ts`)

New test suite using Playwright's `request` fixture:

1. **Valid token returns ICS** — GET `/api/calendar/[validToken]` → 200, `Content-Type: text/calendar`, body starts with `BEGIN:VCALENDAR`
2. **Invalid token returns 404** — GET `/api/calendar/not-a-real-token` → 404
3. **Tampered token returns 404** — valid structure but wrong HMAC → 404
4. **ICS contains VEVENTs** — body contains `BEGIN:VEVENT` and `END:VEVENT`
5. **ICS calendar name** — body contains `X-WR-CALNAME:Sargaux Wedding`

Test runs behind `FEATURE_GLOBAL_CALENDAR_SUBSCRIBE` + `FEATURE_GLOBAL_NOTION_BACKEND` — skip gracefully if either is off.

---

## Files Changed

| File | Action |
|------|--------|
| `src/pages/api/calendar/[token].ics.ts` | Create |
| `src/lib/calendar.ts` | Create |
| `src/lib/notion.ts` | Modify — add `fetchDayDate()` |
| `src/types/event.ts` | Modify — add `date?: string` field |
| `src/config/features.ts` | Modify — add `global.calendarSubscribe` flag |
| `src/env.d.ts` | Modify — add `FEATURE_GLOBAL_CALENDAR_SUBSCRIBE` |
| `netlify.toml` | Modify — add flag to deploy-preview |
| `src/pages/nyc/index.astro` | Modify — add "Add to Calendar" button |
| `src/pages/france/index.astro` | Modify — add "Add to Calendar" button |
| `tests/calendar.spec.ts` | Create |

---

## Version Bump

Patch bump on merge: `0.6.1` → `0.6.2`
