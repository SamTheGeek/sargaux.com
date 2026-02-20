# Calendar Subscriptions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Guests get a personalized `webcal://` URL that subscribes their calendar app to all their invited events, served from `/api/calendar/[token].ics`.

**Architecture:** Token = `base64url(guestId) + "." + HMAC-SHA256(secret, guestId)[0:32]`. Endpoint resolves token → guestId → guest's events → fetches each event's Day page for the actual date → builds RFC 5545 ICS. Calendar apps poll the URL directly (no cookies, no auth required).

**Tech Stack:** Astro SSR endpoint, Node.js `crypto` (built-in), Notion REST API, RFC 5545 iCalendar format.

---

## Prerequisite: Set CALENDAR_HMAC_SECRET

Before implementing, Sam must generate and store a secret. This is a one-time setup step.

**Generate the secret:**
```bash
openssl rand -hex 32
# Example output: a3f8c2d1e4b79f3a2c6d8e1b4f7a0c5d9e2f1b3a...
```

**Store it:**
```bash
# Netlify (production + previews)
netlify env:set CALENDAR_HMAC_SECRET "your-generated-value"

# GitHub (CI tests)
gh secret set CALENDAR_HMAC_SECRET
# Paste the value when prompted
```

This value never goes in code or config files. Treat it like `NOTION_API_KEY`.

---

## Context Notes

- `nyc.calendarSubscribe` and `france.calendarSubscribe` feature flags **already exist** in `features.ts`, `env.d.ts`, and `netlify.toml` — no new flag work needed.
- Both `/nyc/index.astro` and `/france/index.astro` already have a `<section class="calendar-subscribe">` with a disabled `<button>` and note text. We're replacing those with active links when the flag + guestId are available.
- Dates live in the **Wedding Timeline** database (related via `Day` property on each event). The Notion property name is `"Date"` (type: date). Raw REST API returns it at `page.properties['Date'].date.start` → `"2026-10-11"`.
- Timezones: NYC events → `America/New_York`; France events → `Europe/Paris`.
- `getGuestEvents(guestId)` already exists in `src/lib/notion.ts` and returns `EventRecord[]` including `dayId`.

---

## Task 1: Add CALENDAR_HMAC_SECRET to env.d.ts

**Files:**
- Modify: `src/env.d.ts`

**Step 1: Add the ProcessEnv declaration**

In `src/env.d.ts`, find the `NodeJS.ProcessEnv` interface and add:

```typescript
declare namespace NodeJS {
  interface ProcessEnv {
    NOTION_API_KEY?: string;
    NOTION_GUEST_LIST_DB?: string;
    NOTION_EVENT_CATALOG_DB?: string;
    NOTION_RSVP_RESPONSES_DB?: string;
    CALENDAR_HMAC_SECRET?: string; // ← add this line
  }
}
```

**Step 2: Verify build still passes**

```bash
npm run build
```
Expected: Build succeeds with no TypeScript errors.

**Step 3: Commit**

```bash
git add src/env.d.ts
git commit -m "chore: add CALENDAR_HMAC_SECRET to ProcessEnv types"
```

---

## Task 2: Create src/lib/calendar.ts

This file owns all calendar logic: token generation/verification, time parsing, and ICS generation.

**Files:**
- Create: `src/lib/calendar.ts`

**Step 1: Write the file**

```typescript
/**
 * Calendar subscription utilities.
 *
 * Generates HMAC-signed tokens for personalized .ics calendar feeds.
 * Tokens are URL-safe and do not require session cookies — designed
 * for webcal:// subscription URLs that calendar apps poll directly.
 *
 * CALENDAR_HMAC_SECRET is a runtime secret (process.env, never committed).
 */

import { createHmac } from 'crypto';
import type { EventRecord } from '../types/event';

/**
 * Encode a Buffer or string as URL-safe base64 (no padding).
 */
function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode a base64url string back to a UTF-8 string.
 * Returns null if decoding fails.
 */
function fromBase64Url(input: string): string | null {
  try {
    // Re-pad and convert back from URL-safe base64
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4;
    const b64 = pad === 0 ? padded : padded + '='.repeat(4 - pad);
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Compute HMAC-SHA256 of guestId using CALENDAR_HMAC_SECRET.
 * Returns first 32 hex characters.
 */
function computeHmac(guestId: string): string {
  const secret = process.env.CALENDAR_HMAC_SECRET;
  if (!secret) throw new Error('CALENDAR_HMAC_SECRET is not set.');
  return createHmac('sha256', secret).update(guestId).digest('hex').slice(0, 32);
}

/**
 * Generate a calendar subscription token for a guest.
 * Format: base64url(guestId).hmac[0:32]
 */
export function generateToken(guestId: string): string {
  const encoded = toBase64Url(guestId);
  const hmac = computeHmac(guestId);
  return `${encoded}.${hmac}`;
}

/**
 * Verify a calendar token and return the guestId, or null if invalid.
 */
export function verifyToken(token: string): string | null {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return null;

  const encoded = token.slice(0, dotIndex);
  const providedHmac = token.slice(dotIndex + 1);

  const guestId = fromBase64Url(encoded);
  if (!guestId) return null;

  let expectedHmac: string;
  try {
    expectedHmac = computeHmac(guestId);
  } catch {
    return null;
  }

  // Constant-time comparison to prevent timing attacks
  if (providedHmac.length !== expectedHmac.length) return null;
  const a = Buffer.from(providedHmac);
  const b = Buffer.from(expectedHmac);
  if (a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0 ? guestId : null;
}

/**
 * Parse a time string like "6:00 PM" or "14:00" into { hour, minute }.
 * Returns undefined if the string cannot be parsed.
 */
export function parseTime(time: string): { hour: number; minute: number } | undefined {
  // Try 12-hour format: "6:00 PM", "11:30 AM"
  const match12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    return { hour, minute };
  }

  // Try 24-hour format: "14:00", "09:30"
  const match24 = time.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return {
      hour: parseInt(match24[1], 10),
      minute: parseInt(match24[2], 10),
    };
  }

  return undefined;
}

/**
 * Format a Date as an ICS datetime string: "20261011T180000"
 */
function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}00`
  );
}

/**
 * Format a date-only value as an ICS date string: "20261011"
 */
function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Current UTC timestamp in ICS format: "20260220T120000Z"
 */
function dtstamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

/**
 * Escape special characters in ICS text fields (RFC 5545 §3.3.11).
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export interface EventWithDate extends EventRecord {
  date?: string; // "YYYY-MM-DD" from the Day relation page
}

/**
 * Build an RFC 5545 ICS calendar string from a list of events.
 * Events without a date get a DATE-only DTSTART (no time).
 */
export function buildICS(events: EventWithDate[]): string {
  const stamp = dtstamp();

  const vevents = events
    .map((event) => {
      const timezone = event.wedding === 'nyc' ? 'America/New_York' : 'Europe/Paris';
      const uid = `${event.id}@sargaux.com`;

      let dtstart: string;
      let dtend: string;

      if (event.date) {
        const parsed = event.time ? parseTime(event.time) : undefined;
        if (parsed) {
          // Build a local date in the right timezone by constructing an ISO string
          // and letting the server parse it correctly. Since we're on a server that
          // may not be in the target timezone, we use explicit date+time components.
          const [year, month, day] = event.date.split('-').map(Number);
          // Construct local time manually (not using new Date() to avoid UTC shift)
          const pad = (n: number) => String(n).padStart(2, '0');
          const localStr = `${year}${pad(month)}${pad(day)}T${pad(parsed.hour)}${pad(parsed.minute)}00`;
          const endHour = parsed.hour + 2;
          const endStr = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(parsed.minute)}00`;
          dtstart = `DTSTART;TZID=${timezone}:${localStr}`;
          dtend = `DTEND;TZID=${timezone}:${endStr}`;
        } else {
          // Date-only event (no time)
          const d = formatDate(event.date);
          dtstart = `DTSTART;VALUE=DATE:${d}`;
          dtend = `DTEND;VALUE=DATE:${d}`;
        }
      } else {
        // No date at all — skip this event
        return null;
      }

      const lines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        dtstart,
        dtend,
        `SUMMARY:${escapeICS(event.name)}`,
      ];

      if (event.description) lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
      if (event.location) lines.push(`LOCATION:${escapeICS(event.location)}`);

      lines.push('END:VEVENT');
      return lines.join('\r\n');
    })
    .filter(Boolean)
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sargaux Wedding//sargaux.com//EN',
    'X-WR-CALNAME:Sargaux Wedding',
    'X-WR-CALDESC:Your personal schedule for Sam & Margaux\'s wedding',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n');
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/calendar.ts
git commit -m "feat: add calendar token and ICS generation utilities"
```

---

## Task 3: Add fetchDayDate to src/lib/notion.ts

The `Day` relation on events points to Wedding Timeline pages. Each has a Notion property named `"Date"` (type: date) with the actual event date.

**Files:**
- Modify: `src/lib/notion.ts`

**Step 1: Add the cache and function**

At the bottom of `src/lib/notion.ts`, before the closing line, add:

```typescript
// Day date cache — maps Wedding Timeline page ID to "YYYY-MM-DD"
const dayDateCache: Map<string, string | undefined> = new Map();

/**
 * Fetch the date from a Wedding Timeline page (the "Day" relation target).
 * Returns "YYYY-MM-DD" or undefined if the page has no date.
 * Results are cached in memory for the lifetime of the server process.
 */
export async function fetchDayDate(dayId: string): Promise<string | undefined> {
  if (dayDateCache.has(dayId)) {
    return dayDateCache.get(dayId);
  }

  const notion = getClient();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = await notion.pages.retrieve({ page_id: dayId });
    const dateProp = page.properties?.['Date'];
    const dateStr = dateProp?.date?.start ?? undefined;
    dayDateCache.set(dayId, dateStr);
    return dateStr;
  } catch (error) {
    console.error(`Failed to fetch Day page ${dayId}:`, error);
    dayDateCache.set(dayId, undefined);
    return undefined;
  }
}

/**
 * Clear the day date cache (useful for testing).
 */
export function clearDayDateCache(): void {
  dayDateCache.clear();
}
```

**Step 2: Verify build**

```bash
npm run build
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/notion.ts
git commit -m "feat: add fetchDayDate to resolve event dates from Wedding Timeline"
```

---

## Task 4: Create the ICS endpoint

**Files:**
- Create: `src/pages/api/calendar/[token].ics.ts`

**Step 1: Write the endpoint**

```typescript
/**
 * GET /api/calendar/[token].ics
 *
 * Personalized calendar subscription endpoint.
 * Token encodes the guest's Notion page ID, signed with CALENDAR_HMAC_SECRET.
 * Calendar apps subscribe to this URL directly — no auth cookies needed.
 *
 * Returns 404 (not 401) for invalid tokens to avoid leaking information.
 */

import type { APIRoute } from 'astro';
import { verifyToken } from '../../../lib/calendar';
import { generateToken, buildICS } from '../../../lib/calendar';
import { getGuestEvents, fetchDayDate } from '../../../lib/notion';
import type { EventWithDate } from '../../../lib/calendar';

export const GET: APIRoute = async ({ params }) => {
  const token = params.token;

  if (!token) {
    return new Response('Not found', { status: 404 });
  }

  // Verify token and extract guestId
  const guestId = verifyToken(token);
  if (!guestId) {
    return new Response('Not found', { status: 404 });
  }

  // Fetch events this guest is invited to
  let events: EventWithDate[];
  try {
    const rawEvents = await getGuestEvents(guestId);

    // Resolve dates from Day pages in parallel
    events = await Promise.all(
      rawEvents.map(async (event) => {
        const date = event.dayId ? await fetchDayDate(event.dayId) : undefined;
        return { ...event, date };
      })
    );
  } catch (error) {
    console.error('Calendar: failed to fetch events for guest', guestId, error);
    return new Response('Internal server error', { status: 500 });
  }

  const ics = buildICS(events);

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sargaux-wedding.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
```

**Step 2: Build and verify**

```bash
npm run build
```
Expected: No errors. Astro generates the dynamic route.

**Step 3: Commit**

```bash
git add src/pages/api/calendar/[token].ics.ts
git commit -m "feat: add personalized calendar ICS endpoint"
```

---

## Task 5: Wire up the Add to Calendar button

Both landing pages already have the calendar section with a disabled button. Replace it with a live `<a>` link when the flag is on and `guestId` is available.

**Files:**
- Modify: `src/pages/nyc/index.astro`
- Modify: `src/pages/france/index.astro`

**Step 1: Update /nyc/index.astro frontmatter**

Add these imports/variables at the top of the frontmatter (after the existing imports):

```typescript
import { features } from '../../config/features';
import { generateToken } from '../../lib/calendar';

const guestId = Astro.locals.guestId;
const calendarToken = (features.nyc.calendarSubscribe && guestId)
  ? generateToken(guestId)
  : null;
```

**Step 2: Replace the calendar section in /nyc/index.astro**

Find the `<section class="calendar-subscribe">` block (lines 69–76) and replace it with:

```astro
<!-- Calendar Subscribe (Prominent) -->
<section class="calendar-subscribe">
  <div class="calendar-content">
    <h2>Save the Date</h2>
    <p>Add our event to your calendar so you don't miss a thing.</p>
    {calendarToken ? (
      <a
        href={`webcal://sargaux.com/api/calendar/${calendarToken}.ics`}
        class="calendar-btn-prominent"
      >
        Add to Calendar
      </a>
    ) : (
      <>
        <button class="calendar-btn-prominent" disabled>Add to Calendar</button>
        <p class="calendar-note">Personalized calendar link available after RSVP</p>
      </>
    )}
  </div>
</section>
```

**Step 3: Update /france/index.astro frontmatter**

Same pattern — add to frontmatter:

```typescript
import { features } from '../../config/features';
import { generateToken } from '../../lib/calendar';

const guestId = Astro.locals.guestId;
const calendarToken = (features.france.calendarSubscribe && guestId)
  ? generateToken(guestId)
  : null;
```

**Step 4: Replace the calendar section in /france/index.astro**

Find the `<section class="calendar-subscribe">` block (lines 112–119) and replace it with:

```astro
<!-- Calendar Subscribe (Prominent) -->
<section class="calendar-subscribe">
  <div class="calendar-content">
    <h2>Save the Dates</h2>
    <p>Add the full weekend to your calendar.</p>
    {calendarToken ? (
      <a
        href={`webcal://sargaux.com/api/calendar/${calendarToken}.ics`}
        class="calendar-btn-prominent"
      >
        Add to Calendar
      </a>
    ) : (
      <>
        <button class="calendar-btn-prominent" disabled>Add to Calendar</button>
        <p class="calendar-note">Personalized calendar link available after RSVP</p>
      </>
    )}
  </div>
</section>
```

**Step 5: Build and smoke-test**

```bash
npm run build && node ./dist/server/entry.mjs &
# In another terminal or wait a moment:
# Log in as Sam Gross on http://localhost:1213/nyc
# Check: "Add to Calendar" link appears and starts with webcal://
kill %1
```

**Step 6: Commit**

```bash
git add src/pages/nyc/index.astro src/pages/france/index.astro
git commit -m "feat: wire up personalized Add to Calendar button on event pages"
```

---

## Task 6: Write tests

**Files:**
- Create: `tests/calendar.spec.ts`

**Step 1: Write the test file**

```typescript
/**
 * Calendar subscription endpoint tests
 *
 * Tests for GET /api/calendar/[token].ics
 *
 * NOTE: These tests require:
 * - Notion backend enabled (FEATURE_GLOBAL_NOTION_BACKEND=true)
 * - FEATURE_NYC_CALENDAR_SUBSCRIBE=true or FEATURE_FRANCE_CALENDAR_SUBSCRIBE=true
 * - CALENDAR_HMAC_SECRET set
 * - Valid NOTION_API_KEY, NOTION_GUEST_LIST_DB, NOTION_EVENT_CATALOG_DB env vars
 * - Test guest (Sam Gross) exists in Notion Guest List database
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE_URL = 'http://localhost:1213'; // December 13th - engagement date!
const TEST_GUEST_NAME = 'Sam Gross'; // Must exist in Notion Guest List

const notionEnabled =
  process.env.FEATURE_GLOBAL_NOTION_BACKEND === 'true' &&
  !!process.env.CALENDAR_HMAC_SECRET;

const calendarEnabled =
  process.env.FEATURE_NYC_CALENDAR_SUBSCRIBE === 'true' ||
  process.env.FEATURE_FRANCE_CALENDAR_SUBSCRIBE === 'true';

test.describe('Calendar ICS Endpoint', () => {
  let calendarToken: string | undefined;

  test.skip(
    !notionEnabled || !calendarEnabled,
    'Notion backend or calendar feature not configured'
  );

  test.beforeAll(async ({ browser }) => {
    // Log in as Sam Gross and extract the calendar token from the page
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`);
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.click('#submit-btn');
    await page.waitForURL(`${BASE_URL}/nyc`);

    // Extract the webcal:// href from the Add to Calendar link
    const href = await page.locator('a.calendar-btn-prominent').getAttribute('href');
    if (href) {
      // href = "webcal://sargaux.com/api/calendar/TOKEN.ics"
      const match = href.match(/\/api\/calendar\/(.+)\.ics$/);
      calendarToken = match?.[1];
    }

    await context.close();
  });

  test('valid token returns 200 with text/calendar content type', async ({ request }) => {
    test.skip(!calendarToken, 'Could not extract calendar token');
    const response = await request.get(`${BASE_URL}/api/calendar/${calendarToken}.ics`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');
  });

  test('valid token ICS starts with BEGIN:VCALENDAR', async ({ request }) => {
    test.skip(!calendarToken, 'Could not extract calendar token');
    const body = await request.get(`${BASE_URL}/api/calendar/${calendarToken}.ics`).then(r => r.text());
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');
  });

  test('ICS contains calendar name Sargaux Wedding', async ({ request }) => {
    test.skip(!calendarToken, 'Could not extract calendar token');
    const body = await request.get(`${BASE_URL}/api/calendar/${calendarToken}.ics`).then(r => r.text());
    expect(body).toContain('X-WR-CALNAME:Sargaux Wedding');
  });

  test('ICS contains at least one VEVENT', async ({ request }) => {
    test.skip(!calendarToken, 'Could not extract calendar token');
    const body = await request.get(`${BASE_URL}/api/calendar/${calendarToken}.ics`).then(r => r.text());
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain('END:VEVENT');
  });

  test('invalid token returns 404', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/calendar/not-a-real-token.ics`);
    expect(response.status()).toBe(404);
  });

  test('tampered HMAC returns 404', async ({ request }) => {
    test.skip(!calendarToken, 'Could not extract calendar token');
    // Take valid token and corrupt the HMAC portion
    const dotIndex = calendarToken!.indexOf('.');
    const encoded = calendarToken!.slice(0, dotIndex);
    const tamperedToken = `${encoded}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
    const response = await request.get(`${BASE_URL}/api/calendar/${tamperedToken}.ics`);
    expect(response.status()).toBe(404);
  });
});
```

**Step 2: Run the tests**

```bash
npm run build && npm test -- tests/calendar.spec.ts
```

If `CALENDAR_HMAC_SECRET` is set locally and Notion backend is configured, tests should pass. If not configured, they skip gracefully.

**Step 3: Commit**

```bash
git add tests/calendar.spec.ts
git commit -m "test: add calendar ICS endpoint tests"
```

---

## Task 7: Version bump and full verify

**Step 1: Bump version in package.json**

Change `"version"` from `"0.6.1"` to `"0.6.2"`.

**Step 2: Run full verify**

```bash
npm run verify
```
Expected: Build succeeds, all tests pass (calendar tests skip if env not set, that's fine).

**Step 3: Commit and push**

```bash
git add package.json
git commit -m "chore: bump version to 0.6.2"
```

**Step 4: Create draft PR**

```bash
git push -u origin feature/calendar-subscriptions
gh pr create --draft --title "feat: personalized calendar subscriptions (F-004)" --body "$(cat <<'EOF'
## Summary

- Adds `/api/calendar/[token].ics` endpoint returning personalized RFC 5545 ICS for each guest
- Token = `base64url(guestId).HMAC-SHA256(secret, guestId)[0:32]` — stable, unforgeable, no DB storage needed
- Both event landing pages now show an active "Add to Calendar" link (webcal://) when `nyc.calendarSubscribe` / `france.calendarSubscribe` flags are on and guest has a Notion ID
- Calendar name: "Sargaux Wedding"
- Dates pulled from Wedding Timeline relation (Day pages); times parsed from Event Catalog Time field
- Requires `CALENDAR_HMAC_SECRET` in Netlify + GitHub Secrets (see design doc for generation instructions)

## Test plan

- [ ] Set `CALENDAR_HMAC_SECRET` in Netlify dashboard and GitHub secrets
- [ ] Verify "Add to Calendar" link appears on /nyc and /france when logged in with Notion backend
- [ ] Subscribe via webcal:// link — events should appear in Apple Calendar / Google Calendar
- [ ] Change an event time in Notion, rebuild site, re-fetch calendar — should update
- [ ] Playwright calendar tests pass in CI

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
