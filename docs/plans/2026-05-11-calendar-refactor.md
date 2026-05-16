# Calendar Subscriptions Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dynamic Notion-querying `.ics` endpoint with pre-generated `.ics` files stored in Netlify Blobs. Eliminate Notion API calls on every calendar poll so iOS and other calendar apps never time out and drop subscriptions.

**Branch:** `refactor-calendar`

---

## The Problem

`GET /api/calendar/[token].ics` currently calls Notion on every poll. Calendar apps (especially iOS) poll every few hours. When Notion is slow or a cold-start extends the response past ~5s, iOS drops the subscription entirely — the calendar disappears for the user until the URL responds quickly again.

---

## Architecture

### Core Change

Pre-generate a `.ics` file per guest, keyed by their Notion page ID (`guestId`), stored in Netlify Blobs. The endpoint becomes: token verify → blob lookup → serve ICS directly. No Notion calls on poll.

### Storage: Netlify Blobs

- **Store:** site-scoped, named `"ics"` (persistent across all deploys)
- **Key:** `guestId` (the Notion page ID — stable, never changes)
- **Content:** full RFC 5545 ICS text
- **Write access:** server-side only — SSR endpoint and Netlify Functions only; no third-party write path exists in this architecture

### Serving Flow

Calendar app polls webcal://sargaux.com/api/calendar/[token].ics
  → SSR endpoint verifies token → decodes guestId
  → Reads blob from Netlify Blobs (key = guestId)
    → Blob exists:
        → Return ICS content inline (200, text/calendar)
        → Fast: blob read is <50ms, no Notion call
    → Blob missing:
        → 503 Service Unavailable (calendar app retries later)
        → Scheduled job is the backstop; fixes within days
  → No Notion calls from this endpoint, ever

**Why not redirect to a CDN URL?** A 302 redirect approach was considered and rejected:

- Netlify Blobs CDN URLs may include deploy IDs or expiring tokens — not guaranteed stable
- iOS Calendar is known to cache redirect destinations despite 302, then poll the CDN URL directly on future polls; if that URL changes, the subscription silently breaks — same failure mode we're solving
- Two round trips per poll (SSR + CDN) vs. one
- Wasteful: the SSR endpoint would read the blob just to check existence, discard the content, then redirect the client to read it again from CDN
- Content-Type headers may not propagate correctly through raw Netlify Blobs CDN
- Propagation delay: a freshly-written blob might 404 at the CDN for a brief window after the 302 is issued

Direct serving gives single-request delivery, guaranteed Content-Type, and avoids all of these failure modes.

### Regeneration Triggers

Three paths write/update blobs:

1. **On RSVP** (immediate, awaited in RSVP handler): When a guest submits or updates their RSVP, regenerate ICS for all party members. Wrapped in try/catch so it never fails the RSVP response, but **awaited** (not fire-and-forget) because Netlify terminates the function as soon as the response is sent — a detached async IIFE is not guaranteed to complete.

2. **Weekly scheduled function** (`0 3 * * 0` — Sundays at 03:00 UTC): Full refresh of all guests. Runs every week, including during pre-wedding windows (the daily function handles the extra refreshes; the weekly one runs regardless).

3. **Daily scheduled function** (`0 3 * * *` — every day at 03:00 UTC): Exits immediately with no work if today is NOT within a pre-wedding window. Full refresh otherwise.

### Pre-wedding windows

Compared in UTC. Boundaries are generous (no fencepost issues from server-timezone difference)

| Wedding               | Daily starts (UTC).    | Daily ends (UTC)       |
|-----------------------|------------------------|------------------------|
| NYC (Oct 11, 2026).   | `2026-09-27T00:00:00Z` | `2026-10-14T00:00:00Z` |
| France (May 28, 2027) | `2027-05-14T00:00:00Z` | `2027-06-01T00:00:00Z` |

### No pre-seeding, no cache-aside

ICS blobs are created when a guest RSVPs (RSVP trigger) and kept fresh by the scheduled jobs. The calendar endpoint is read-only — it never writes blobs and never calls Notion. If a blob is missing (e.g., RSVP blob write failed during a transient Netlify outage), the endpoint returns 503 and the calendar app retries. The scheduled job fixes any missing blobs within days. The URL isn't surfaced to guests before RSVP, so this edge case is rare.

### Efficient bulk refresh strategy

`EventRecord.date` is already populated from the Event Catalog's `Event Date` property — no Day relation lookups (`fetchDayDate`) needed. Bulk refresh costs only ~6–8 Notion calls total for all guests:

1. `fetchAllGuests()` → full guest list with `eventInvitedIds` (2–3 paginated queries)
2. `getEventCatalog('nyc')` + `getEventCatalog('france')` → all events with dates (2–4 queries)
3. Build `Map<eventId, EventRecord>` in memory
4. For each guest: look up their `eventInvitedIds` in the map → `buildICS()` → `store.set(guestId, ics)`

---

## New Dependencies

```bash
npm install @netlify/blobs
npm install --save-dev @netlify/functions
```

- `@netlify/blobs` — Netlify Blobs SDK; used at runtime in SSR endpoints and Netlify Functions
- `@netlify/functions` — type definitions only (`Config` export for scheduled functions); devDependency

---

## Files Overview

| Action | File                                       |
|--------|--------------------------------------------|
| Create | `src/lib/ics-store.ts`                     |
| Create | `src/lib/ics-generator.ts`                 |
| Create | `netlify/functions/ics-refresh-weekly.mts` |
| Create | `netlify/functions/ics-refresh-daily.mts`  |
| Modify | `src/pages/api/calendar/[token].ics.ts`    |
| Modify | `src/pages/api/rsvp.ts`                    |
| Modify | `src/pages/api/calendar/health.ts`         |
| Modify | `package.json` (dependencies + version)    |

`tsconfig.json` does NOT need updating — it already uses `"include": ["**/*"]` which covers `netlify/functions/`.

---

## Task 1: Install dependencies

```bash
npm install @netlify/blobs
npm install --save-dev @netlify/functions
```

Verify in `package.json`:

- `@netlify/blobs` is under `"dependencies"`
- `@netlify/functions` is under `"devDependencies"`

**Commit:**

```bash
git add package.json package-lock.json
git commit -m "chore: add @netlify/blobs and @netlify/functions"
```

---

## Task 2: Create `src/lib/ics-store.ts`

Thin wrapper over Netlify Blobs. All blob I/O goes through here.

**Critical behavior contract:**

- `getICS` returns `null` when the key is not found — this is NOT an error, it's a cache miss
- `getICS` throws when the blob store itself is unreachable — callers should catch this and return 503
- `@netlify/blobs`'s `store.get()` already follows this contract: returns `null` for missing keys, throws on connectivity failures — so we just propagate it

**Test mode:** When `CALENDAR_TEST_MODE=true`, all blob operations use an in-memory `Map` instead of Netlify Blobs. This allows endpoint behavior (200/503/404 routing) to be tested without Netlify infrastructure. See Task 8 for how this is used.

```typescript
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'ics';

// In-memory store used when CALENDAR_TEST_MODE=true.
// Module-level so it persists across requests within a single server process.
const _testStore = new Map<string, string>();

function store() {
  if (process.env.CALENDAR_TEST_MODE === 'true') {
    return {
      get: async (key: string, _opts?: unknown) => _testStore.get(key) ?? null,
      set: async (key: string, value: string) => { _testStore.set(key, value); },
    };
  }
  return getStore(STORE_NAME);
}

/**
 * Read a stored ICS file for a guest.
 * Returns null if the key does not exist (not an error — caller should 503).
 * Throws if the blob store is unreachable.
 */
export async function getICS(guestId: string): Promise<string | null> {
  const result = await store().get(guestId, { type: 'text' });
  return result ?? null;
}

/**
 * Write an ICS file for a guest.
 */
export async function setICS(guestId: string, content: string): Promise<void> {
  await store().set(guestId, content);
}

/**
 * Check if the blob store is reachable.
 * A null return (key not found) still means the store is up.
 * A thrown error means the store is unreachable.
 */
export async function checkBlobStoreHealth(): Promise<boolean> {
  try {
    await store().get('__health_probe__', { type: 'text' });
    return true;
  } catch {
    return false;
  }
}
```

**Build verify:**

```bash
npm run build
```

**Commit:**

```bash
git add src/lib/ics-store.ts
git commit -m "feat: add ics-store Netlify Blobs wrapper"
```

---

## Task 3: Create `src/lib/ics-generator.ts`

Orchestration: fetch guest events from Notion → build ICS → store blob.

```typescript
import { getGuestEventsById, fetchAllGuests, getEventCatalog } from './notion';
import { buildICS } from './calendar';
import { setICS } from './ics-store';
import type { EventRecord } from '../types';

/**
 * Generate and store an ICS file for a single guest.
 * Uses getGuestEventsById() — fetches guest page + event pages directly,
 * without loading the full guest list. Used by the RSVP trigger.
 */
export async function generateAndStoreICSForGuest(guestId: string): Promise<void> {
  const events = await getGuestEventsById(guestId);
  const ics = buildICS(events);
  await setICS(guestId, ics);
}

/**
 * Full refresh: regenerate ICS for all guests.
 * Used by scheduled functions.
 *
 * Makes ~6–8 Notion calls total regardless of guest count:
 * - fetchAllGuests(): 2–3 paginated queries
 * - getEventCatalog('nyc') + getEventCatalog('france'): 2–4 queries
 * - No per-guest Notion calls — dates are on EventRecord.date directly
 *
 * Returns a summary { total, succeeded, failed }.
 */
export async function refreshAllICS(): Promise<{ total: number; succeeded: number; failed: number }> {
  // 1. Fetch all guests — always cold in a Netlify Function invocation
  const guests = await fetchAllGuests();

  // 2. Fetch event catalog for both weddings
  const [nycEvents, franceEvents] = await Promise.all([
    getEventCatalog('nyc'),
    getEventCatalog('france'),
  ]);

  // 3. Build event lookup map: eventId → EventRecord (date already populated)
  const eventMap = new Map<string, EventRecord>();
  for (const event of [...nycEvents, ...franceEvents]) {
    eventMap.set(event.id, event);
  }

  // 4. Generate and store ICS for every guest (sequential to avoid overwhelming Blobs)
  let succeeded = 0;
  let failed = 0;

  for (const guest of guests) {
    try {
      const guestEvents: EventRecord[] = guest.eventInvitedIds
        .map((id) => eventMap.get(id))
        .filter((e): e is EventRecord => e !== undefined);

      const ics = buildICS(guestEvents);
      await setICS(guest.id, ics);
      succeeded++;
    } catch (err) {
      console.error(`[ics-refresh] Failed for guest ${guest.id}:`, err);
      failed++;
    }
  }

  return { total: guests.length, succeeded, failed };
}
```

**Type note:** `EventRecord` (in `src/types/event.ts`) has `date?: string`. `EventWithDate` from `calendar.ts` extends `EventRecord` with the same optional field — they are structurally identical. `EventRecord[]` is directly assignable to `EventWithDate[]`, so passing it to `buildICS(events: EventWithDate[])` compiles without casting.

**Build verify:**

```bash
npm run build
```

**Commit:**

```bash
git add src/lib/ics-generator.ts
git commit -m "feat: add ics-generator orchestration layer"
```

---

## Task 3b: Create `src/pages/api/calendar/test-seed.ts`

Test-only endpoint for seeding the in-memory blob store. Returns 404 in production — `CALENDAR_TEST_MODE` is never set outside of test runs.

```typescript
/**
 * POST /api/calendar/test-seed
 *
 * Seeds the in-memory blob store for calendar endpoint tests.
 * Only functional when CALENDAR_TEST_MODE=true.
 * Returns 404 in all other environments.
 */

import type { APIRoute } from 'astro';
import { verifyToken } from '../../../lib/calendar';
import { setICS } from '../../../lib/ics-store';

export const POST: APIRoute = async ({ request }) => {
  if (process.env.CALENDAR_TEST_MODE !== 'true') {
    return new Response('Not Found', { status: 404 });
  }

  const { token, ics } = await request.json();
  const guestId = verifyToken(token);
  if (!guestId) {
    return new Response('Bad token', { status: 400 });
  }

  await setICS(guestId, ics);
  return new Response('OK', { status: 200 });
};
```

**Commit:**

```bash
git add src/pages/api/calendar/test-seed.ts
git commit -m "test: add calendar test-seed endpoint for mock blob store"
```

---

## Task 4: Modify `src/pages/api/calendar/[token].ics.ts`

Replace the Notion-querying handler with a blob-first handler that serves ICS content directly.

**Full file replacement:**

```typescript
/**
 * GET /api/calendar/[token].ics
 *
 * Serves pre-generated personalized calendar subscriptions from Netlify Blobs.
 * This endpoint is read-only — it never writes blobs and never calls Notion.
 *
 * Returns 200 with ICS content if the blob exists.
 * Returns 503 if the blob is missing (RSVP not yet processed or blob write
 * failed transiently) — calendar apps retry on 503; the scheduled job is the
 * backstop that fixes missing blobs within days.
 * Returns 404 for invalid tokens (not 401, to avoid leaking information).
 */

import type { APIRoute } from 'astro';
import { verifyToken } from '../../../lib/calendar';
import { getICS } from '../../../lib/ics-store';

const ICS_HEADERS = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'inline; filename="sargaux-wedding.ics"',
  // Allow CDN caching for 1 hour; serve stale for up to 7 days on origin errors
  // to prevent subscriptions from dropping during transient outages.
  'Cache-Control': 'max-age=3600, stale-while-revalidate=7200, stale-if-error=604800',
};

export const GET: APIRoute = async ({ params }) => {
  const token = params.token;

  if (!token) {
    return new Response('Not found', { status: 404 });
  }

  // Missing secret → 503 (transient) not 404 (permanent unsubscribe).
  if (!process.env.CALENDAR_HMAC_SECRET) {
    console.error('Calendar: CALENDAR_HMAC_SECRET not configured');
    return new Response('Service Unavailable', { status: 503 });
  }

  const guestId = verifyToken(token);
  if (!guestId) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const stored = await getICS(guestId);
    if (stored !== null) {
      return new Response(stored, { status: 200, headers: ICS_HEADERS });
    }
    // Blob not yet generated — 503 so calendar app retries; scheduled job is backstop
    return new Response('Service Unavailable', { status: 503 });
  } catch (err: unknown) {
    console.error('Calendar: blob store error for guest', guestId, err);
    return new Response('Service Unavailable', { status: 503 });
  }
};
```

**Build verify:**

```bash
npm run build
```

**Commit:**

```bash
git add src/pages/api/calendar/[token].ics.ts
git commit -m "feat(calendar): serve ICS directly from Netlify Blobs"
```

---

## Task 5: Modify `src/pages/api/rsvp.ts`

After a successful RSVP submission, regenerate ICS for all party members. The key constraints:

- **Awaited, not fire-and-forget.** Netlify terminates the SSR function when the response is sent. A detached `(async () => { ... })()` IIFE is not guaranteed to complete before termination — blobs for party members would silently not be written. Pattern: await it inside a try/catch, matching the existing email block pattern.
- **Errors must never fail the RSVP response** — wrap in try/catch.
- **Party members:** `getGuestParty(guestId)` is already called earlier in the handler (for party contacts). By the time we generate ICS, `fetchAllGuests()` is cached in-process, so `getGuestParty` is a fast lookup. Each `generateAndStoreICSForGuest(member.id)` still calls Notion for that member's events — run these in `Promise.all` to parallelize.

**Add import at the top of `rsvp.ts`** (with the other imports):

```typescript
import { generateAndStoreICSForGuest } from '../../lib/ics-generator';
```

**Find the location:** After `responseId = await submitRSVP(guestId, body)` succeeds (line ~232) and before `// Email logic — non-blocking, never fails the RSVP response`. Add this block:

```typescript
  // ICS regeneration — awaited but errors never fail the RSVP response.
  // Awaited (not fire-and-forget) because Netlify terminates the function
  // when the response is sent — detached promises don't complete reliably.
  try {
    const party = await getGuestParty(guestId);
    await Promise.all(party.map((member) => generateAndStoreICSForGuest(member.id)));
  } catch (err) {
    console.error('ICS regeneration after RSVP failed (non-fatal):', err);
  }
```

**Build verify:**

```bash
npm run build
```

**Commit:**

```bash
git add src/pages/api/rsvp.ts
git commit -m "feat(rsvp): regenerate ICS for party on RSVP submit"
```

---

## Task 6: Update `src/pages/api/calendar/health.ts`

Add blob store connectivity check. Replace the full file:

```typescript
import type { APIRoute } from 'astro';
import { checkBlobStoreHealth } from '../../../lib/ics-store';

export const GET: APIRoute = async () => {
  const hasSecret = !!process.env.CALENDAR_HMAC_SECRET;
  const hasNotionKey = !!process.env.NOTION_API_KEY;
  const blobsOk = await checkBlobStoreHealth();

  const ok = hasSecret && hasNotionKey && blobsOk;
  return new Response(JSON.stringify({ ok, hasSecret, hasNotionKey, blobsOk }), {
    status: ok ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

**Build verify:**

```bash
npm run build
```

**Commit:**

```bash
git add src/pages/api/calendar/health.ts
git commit -m "feat(calendar): add blob store health check"
```

---

## Task 7: Create scheduled Netlify Functions

### 7a. Create the functions directory

```bash
mkdir -p netlify/functions
```

### 7b. Create `netlify/functions/ics-refresh-weekly.mts`

```typescript
import type { Config } from '@netlify/functions';
import { refreshAllICS } from '../../src/lib/ics-generator';

export default async function handler() {
  console.log('[ics-refresh-weekly] Starting weekly ICS refresh');
  try {
    const result = await refreshAllICS();
    console.log(
      `[ics-refresh-weekly] Done: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`
    );
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error('[ics-refresh-weekly] Refresh failed:', err);
    return new Response(String(err), { status: 500 });
  }
}

export const config: Config = {
  schedule: '0 3 * * 0', // Every Sunday at 03:00 UTC
};
```

### 7c. Create `netlify/functions/ics-refresh-daily.mts`

```typescript
import type { Config } from '@netlify/functions';
import { refreshAllICS } from '../../src/lib/ics-generator';

/**
 * Returns true if the current UTC datetime falls within either pre-wedding
 * daily-refresh window.
 *
 * Uses plain UTC Date comparisons — no toLocaleString() or timezone parsing.
 * The boundaries are 1-day generous on each end so server/timezone edge cases
 * don't matter.
 */
function isInPreWeddingWindow(): boolean {
  const now = new Date();
  // NYC: Sep 27 – Oct 13, 2026 (generous: includes Sep 27 00:00Z through Oct 14 00:00Z)
  const nycStart = new Date('2026-09-27T00:00:00Z');
  const nycEnd = new Date('2026-10-14T00:00:00Z');
  // France: May 14 – May 31, 2027
  const franceStart = new Date('2027-05-14T00:00:00Z');
  const franceEnd = new Date('2027-06-01T00:00:00Z');
  return (
    (now >= nycStart && now < nycEnd) ||
    (now >= franceStart && now < franceEnd)
  );
}

export default async function handler() {
  if (!isInPreWeddingWindow()) {
    console.log('[ics-refresh-daily] Outside pre-wedding window — skipping');
    return new Response('Skipped', { status: 200 });
  }

  console.log('[ics-refresh-daily] In pre-wedding window — starting daily ICS refresh');
  try {
    const result = await refreshAllICS();
    console.log(
      `[ics-refresh-daily] Done: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`
    );
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error('[ics-refresh-daily] Refresh failed:', err);
    return new Response(String(err), { status: 500 });
  }
}

export const config: Config = {
  schedule: '0 3 * * *', // Every day at 03:00 UTC
};
```

**Build verify:**

```bash
npm run build
```

**Note on `netlify.toml`:** No changes needed. Scheduled functions in Netlify v2 API declare their schedule via the `config` export. Netlify reads this at deploy time. The existing `[functions]` and `[functions."*"]` blocks in `netlify.toml` are empty and will not conflict.

**If Netlify does not pick up the schedule from the `config` export** (verify after first deploy by checking Netlify dashboard → Functions tab), add to `netlify.toml` as a fallback:

```toml
[functions."ics-refresh-weekly"]
  schedule = "0 3 * * 0"

[functions."ics-refresh-daily"]
  schedule = "0 3 * * *"
```

**Commit:**

```bash
git add netlify/functions/
git commit -m "feat: add weekly/daily scheduled ICS refresh functions"
```

---

## Task 8: Tests

Two test files: unit tests for pure logic (always run, no infrastructure), and updated endpoint tests using the mock blob store.

### 8a: Create `tests/calendar-unit.spec.ts`

Tests `buildICS`, `generateToken`, and `verifyToken` by importing them directly. No server, no Notion, no Blobs. Always runs in CI.

```typescript
/**
 * Unit tests for calendar ICS generation and token logic.
 * No server required — imports src/lib/calendar.ts directly.
 */

import { test, expect } from '@playwright/test';
import { generateToken, verifyToken, buildICS, parseTime, parseDuration } from '../src/lib/calendar';
import type { EventWithDate } from '../src/lib/calendar';

const TEST_SECRET = 'test-hmac-secret-for-unit-tests';
const TEST_GUEST_ID = 'abc123-test-notion-page-id';

// Set the secret for token tests
process.env.CALENDAR_HMAC_SECRET = TEST_SECRET;

const NYC_EVENT: EventWithDate = {
  id: 'event-nyc-1',
  name: 'Wedding Dinner',
  type: 'Core',
  wedding: 'nyc',
  date: '2026-10-11',
  startTime: '6:00 PM',
  duration: '3h',
  location: 'The Venue, New York',
  showOnWebsite: true,
};

const FRANCE_EVENT: EventWithDate = {
  id: 'event-france-1',
  name: 'Cérémonie',
  type: 'Core',
  wedding: 'france',
  date: '2027-05-28',
  showOnWebsite: true,
};

test.describe('buildICS', () => {
  test('produces valid RFC 5545 envelope', () => {
    const ics = buildICS([NYC_EVENT]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('X-WR-CALNAME:Sargaux Wedding');
  });

  test('includes VEVENT for an event with a date', () => {
    const ics = buildICS([NYC_EVENT]);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('SUMMARY:Wedding Dinner');
    expect(ics).toContain('LOCATION:The Venue\\, New York');
  });

  test('DTSTART uses TZID America/New_York for NYC events with time', () => {
    const ics = buildICS([NYC_EVENT]);
    expect(ics).toContain('DTSTART;TZID=America/New_York:20261011T180000');
  });

  test('DTEND is 3 hours after DTSTART for duration=3h', () => {
    const ics = buildICS([NYC_EVENT]);
    expect(ics).toContain('DTEND;TZID=America/New_York:20261011T210000');
  });

  test('DTSTART uses TZID Europe/Paris for France events with time', () => {
    const event: EventWithDate = { ...FRANCE_EVENT, startTime: '14:00', duration: '2h' };
    const ics = buildICS([event]);
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20270528T140000');
  });

  test('DATE-only DTSTART for events without startTime', () => {
    const ics = buildICS([FRANCE_EVENT]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270528');
  });

  test('skips events without a date', () => {
    const eventNoDate: EventWithDate = { ...NYC_EVENT, date: undefined };
    const ics = buildICS([eventNoDate]);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  test('empty event list produces valid calendar with no events', () => {
    const ics = buildICS([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  test('multiple events produce multiple VEVENTs', () => {
    const ics = buildICS([NYC_EVENT, FRANCE_EVENT]);
    const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(count).toBe(2);
  });

  test('UID is stable and unique per event', () => {
    const ics = buildICS([NYC_EVENT]);
    expect(ics).toContain('UID:event-nyc-1@sargaux.com');
  });
});

test.describe('generateToken / verifyToken', () => {
  test('verifyToken recovers the guestId from a valid token', () => {
    const token = generateToken(TEST_GUEST_ID);
    expect(verifyToken(token)).toBe(TEST_GUEST_ID);
  });

  test('verifyToken returns null for a tampered HMAC', () => {
    const token = generateToken(TEST_GUEST_ID);
    const dot = token.indexOf('.');
    const tampered = token.slice(0, dot + 1) + 'a'.repeat(32);
    expect(verifyToken(tampered)).toBeNull();
  });

  test('verifyToken returns null for a token with no dot', () => {
    expect(verifyToken('notavalidtoken')).toBeNull();
  });

  test('verifyToken returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });
});

test.describe('parseTime', () => {
  test('parses 12-hour format', () => {
    expect(parseTime('6:00 PM')).toEqual({ hour: 18, minute: 0 });
    expect(parseTime('12:00 AM')).toEqual({ hour: 0, minute: 0 });
    expect(parseTime('12:30 PM')).toEqual({ hour: 12, minute: 30 });
  });

  test('parses 24-hour format', () => {
    expect(parseTime('14:00')).toEqual({ hour: 14, minute: 0 });
  });

  test('returns undefined for unparseable input', () => {
    expect(parseTime('not a time')).toBeUndefined();
  });
});

test.describe('parseDuration', () => {
  test('parses hours and minutes', () => {
    expect(parseDuration('3h')).toBe(180);
    expect(parseDuration('90m')).toBe(90);
    expect(parseDuration('2h30m')).toBe(150);
  });

  test('returns undefined for empty or invalid input', () => {
    expect(parseDuration('')).toBeUndefined();
    expect(parseDuration('invalid')).toBeUndefined();
  });
});
```

**Run:**

```bash
npm run build && npx playwright test tests/calendar-unit.spec.ts
```

Expected: all tests pass without any server or env vars (except `CALENDAR_HMAC_SECRET` which is set inline in the test file itself).

### 8b: Update `tests/calendar.spec.ts`

Replace the existing Notion-dependent tests with endpoint behavior tests using the mock blob store. These require `CALENDAR_TEST_MODE=true` in the server process and a fixed `CALENDAR_HMAC_SECRET`.

**How to run with test mode:**

The test requires the server to be started with `CALENDAR_TEST_MODE=true` and a known `CALENDAR_HMAC_SECRET`. Add a separate Playwright project in `playwright.config.ts` for calendar endpoint tests, or run manually:

```bash
CALENDAR_TEST_MODE=true CALENDAR_HMAC_SECRET=test-hmac-secret-for-unit-tests \
  node ./dist/server/entry.mjs &
npx playwright test tests/calendar.spec.ts --project=calendar-mock
kill %1
```

Alternatively, add a dedicated project to `playwright.config.ts`:

```typescript
// In playwright.config.ts, inside the projects array:
{
  name: 'calendar-mock',
  testMatch: 'tests/calendar.spec.ts',
  use: {
    ...devices['Desktop Chrome'],
  },
  // webServer override with test env vars (add to the top-level webServer config
  // or restructure as needed — see Playwright docs for per-project webServer)
},
```

Note: Playwright's per-project `webServer` support may be limited depending on version. If the config doesn't support it cleanly, run the calendar endpoint tests separately via the manual command above, or accept that they run against the standard server (in which case they skip when `CALENDAR_TEST_MODE` is not set).

**Full replacement for `tests/calendar.spec.ts`:**

```typescript
/**
 * Calendar endpoint tests.
 *
 * These tests use the mock blob store (CALENDAR_TEST_MODE=true) and a fixed
 * CALENDAR_HMAC_SECRET so they run without Netlify infrastructure or Notion.
 *
 * Skip guard: if CALENDAR_TEST_MODE is not set, all tests skip gracefully.
 */

import { test, expect } from '@playwright/test';
import { generateToken, buildICS } from '../src/lib/calendar';
import type { EventWithDate } from '../src/lib/calendar';

const BASE_URL = 'http://localhost:1213';
const TEST_SECRET = 'test-hmac-secret-for-unit-tests';
const TEST_GUEST_ID = 'abc123-test-notion-page-id';
const UNKNOWN_GUEST_ID = 'ffffffff-0000-no-blob-here';

process.env.CALENDAR_HMAC_SECRET = TEST_SECRET;

const TEST_EVENT: EventWithDate = {
  id: 'event-test-1',
  name: 'Wedding Dinner',
  type: 'Core',
  wedding: 'nyc',
  date: '2026-10-11',
  startTime: '6:00 PM',
  duration: '3h',
  location: 'The Venue',
  showOnWebsite: true,
};

const isMockMode = process.env.CALENDAR_TEST_MODE === 'true';

test.describe('Calendar endpoint (mock blob store)', () => {
  test.skip(!isMockMode, 'Requires CALENDAR_TEST_MODE=true on the server');

  let validToken: string;
  let unknownToken: string;

  test.beforeAll(async ({ request }) => {
    validToken = generateToken(TEST_GUEST_ID);
    unknownToken = generateToken(UNKNOWN_GUEST_ID);
    const testICS = buildICS([TEST_EVENT]);

    // Seed the mock blob store via the test-seed endpoint
    const res = await request.post(`${BASE_URL}/api/calendar/test-seed`, {
      data: { token: validToken, ics: testICS },
    });
    expect(res.status()).toBe(200);
  });

  test('valid token with seeded blob returns 200 text/calendar', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/calendar/${validToken}.ics`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/calendar');
  });

  test('ICS body contains expected calendar envelope', async ({ request }) => {
    const body = await request.get(`${BASE_URL}/api/calendar/${validToken}.ics`).then(r => r.text());
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');
    expect(body).toContain('X-WR-CALNAME:Sargaux Wedding');
  });

  test('ICS body contains the seeded VEVENT', async ({ request }) => {
    const body = await request.get(`${BASE_URL}/api/calendar/${validToken}.ics`).then(r => r.text());
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain('SUMMARY:Wedding Dinner');
    expect(body).toContain('DTSTART;TZID=America/New_York:20261011T180000');
  });

  test('valid token with no blob returns 503', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/calendar/${unknownToken}.ics`);
    expect(res.status()).toBe(503);
  });

  test('invalid token returns 404', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/calendar/not-a-real-token.ics`);
    expect(res.status()).toBe(404);
  });

  test('tampered HMAC returns 404', async ({ request }) => {
    const dot = validToken.indexOf('.');
    const tampered = validToken.slice(0, dot + 1) + 'a'.repeat(32);
    const res = await request.get(`${BASE_URL}/api/calendar/${tampered}.ics`);
    expect(res.status()).toBe(404);
  });

  test('test-seed endpoint returns 404 in non-test mode', async ({ request }) => {
    // This test only makes sense if you're running against a non-test server.
    // Skip it here — it's documented behavior, not worth the setup complexity.
    test.skip(true, 'Requires a separate non-test server instance to verify');
  });
});
```

**Run:**

```bash
npm run build
CALENDAR_TEST_MODE=true CALENDAR_HMAC_SECRET=test-hmac-secret-for-unit-tests \
  node ./dist/server/entry.mjs &
sleep 2
npx playwright test tests/calendar.spec.ts
kill %1
```

**Commit:**

```bash
git add tests/calendar-unit.spec.ts tests/calendar.spec.ts src/pages/api/calendar/test-seed.ts
git commit -m "test: add calendar unit tests and mock-mode endpoint tests"
```

---

## Task 9: Post-deploy verification

After merging and deploying to production, verify the following. Some steps are for the implementing agent (automated checks); others require the human (Sam) to verify in a browser or app.

### Agent checks

```bash
# 1. Health endpoint — must return { ok: true }
curl https://sargaux.com/api/calendar/health

# 2. Scheduled functions registered — check Netlify CLI
netlify functions:list
# Expected: ics-refresh-weekly and ics-refresh-daily appear in the output
```

If `netlify functions:list` does not show the scheduled functions, or the Netlify dashboard (Functions tab) does not show cron schedules next to them, the `config` export was not picked up. In that case, add the schedule to `netlify.toml` explicitly and redeploy:

```toml
[functions."ics-refresh-weekly"]
  schedule = "0 3 * * 0"

[functions."ics-refresh-daily"]
  schedule = "0 3 * * *"
```

```bash
git add netlify.toml
git commit -m "fix: add explicit schedule config for ICS refresh functions"
git push
```

### Human checks (Sam)

1. **Log into the site** and navigate to `/nyc` or `/france`. The "Add to Calendar" button should be present (as before).

2. **Submit or re-save an RSVP** as yourself. This triggers ICS generation via the RSVP handler. Check the Netlify dashboard → Blobs to confirm a blob was written to the `"ics"` store with your Notion guest ID as the key.

3. **Subscribe to the calendar** using the webcal:// link. Confirm events appear in Apple Calendar (or your calendar app).

4. **Verify response speed**: In browser devtools (or `curl -w "%{time_total}"`) hit `/api/calendar/[your-token].ics` directly. Should return in under 200ms (blob read only, no Notion).

5. **Verify the scheduled functions** appear in the Netlify dashboard under Functions → Scheduled. Confirm both `ics-refresh-weekly` and `ics-refresh-daily` are listed with their cron strings.

---

## Task 10: Version bump, full local verify, and PR

### Step 1: Bump version

In `package.json`, update to:

- `"0.10.0"` — minor bump (completing a plan/epic qualifies per versioning guide)

Using the tools provided by astro/the environment

### Step 2: Full local verify

```bash
npm run verify
```

Expected: build succeeds, all tests pass or skip gracefully.

### Step 3: Commit and push

```bash
git add package.json
git commit -m "chore: bump version to 0.9.10"
git push -u origin refactor-calendar
```

### Step 4: Create draft PR

```bash
gh pr create --draft --title "feat(calendar): pre-generate ICS files via Netlify Blobs" --body "$(cat <<'EOF'
## Summary

- Pre-generates `.ics` files per guest in Netlify Blobs (site-scoped, persistent across deploys)
- `/api/calendar/[token].ics` now does token verify → blob read → serve inline (no Notion call on poll)
- Regenerates ICS for all party members on RSVP submit (awaited, errors non-fatal)
- Weekly + daily Netlify Scheduled Functions for background refresh (daily activates 2 weeks before each wedding)
- Health endpoint now checks blob store connectivity
- Fixes iOS dropping calendar subscriptions due to slow/failing Notion responses

## New dependencies

- `@netlify/blobs` — Netlify Blobs SDK (runtime)
- `@netlify/functions` — scheduled function types (devDependency)

## Test plan

- [ ] Verify `GET /api/calendar/health` returns `{ ok: true }` on production
- [ ] Submit test RSVP — confirm blob is written to Netlify Blobs store "ics" (check Netlify dashboard)
- [ ] Subscribe via webcal:// — confirm fast 200 response with ICS in Apple Calendar
- [ ] Refresh calendar app — confirm subsequent polls are fast (no Notion call)
- [ ] Change an event detail in Notion — wait for Sunday scheduled run or trigger manually — confirm ICS updates
- [ ] Verify both scheduled functions appear in Netlify dashboard → Functions tab with their cron schedules
- [ ] `tests/calendar-unit.spec.ts` passes in CI (always runs, no infrastructure needed)
- [ ] Calendar endpoint mock tests pass locally (`CALENDAR_TEST_MODE=true`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Implementation Notes for a Fresh Context

Before starting, read these files to understand the codebase:

- `src/lib/calendar.ts` — ICS utilities: `generateToken`, `verifyToken`, `buildICS`, `EventWithDate`
- `src/lib/notion.ts` — Notion client: `fetchAllGuests`, `getGuestEventsById`, `getGuestParty`, `getEventCatalog`
- `src/pages/api/calendar/[token].ics.ts` — current endpoint (full replacement in Task 4)
- `src/pages/api/rsvp.ts` — insert ICS trigger after `submitRSVP` success (Task 5)
- `src/types/index.ts`, `src/types/guest.ts`, `src/types/event.ts` — type definitions
- `CLAUDE.md` — project conventions: `process.env` for runtime secrets, port 1213, draft PR workflow

**Runtime secrets use `process.env`, not `import.meta.env`.** Netlify Dashboard env vars are runtime-only. `@netlify/blobs` uses `process.env.NETLIFY_BLOBS_CONTEXT` (injected automatically by Netlify in production and `netlify dev`). Do not try to access it via `import.meta.env`.

**`@netlify/blobs` in local dev without Netlify CLI:** When running `npm run dev` (Node adapter, not Netlify), there is no Netlify context and `getStore()` will throw. The calendar endpoint catches this and returns 503. This is acceptable behavior in local dev — the calendar feature is not tested locally against live Blobs. Use `netlify dev` if you need to test Blobs locally.

**Netlify Function cold starts:** Scheduled functions start cold. The module-level caches in `notion.ts` (`guestCache`, `eventCatalogCache`) are always empty on a fresh invocation — `refreshAllICS` always makes full Notion calls. This is expected and fine.

**`getGuestParty` in the RSVP trigger (Task 5):** This function calls `fetchAllGuests()`. By the time ICS generation runs, the RSVP handler has already executed several Notion operations and `guestCache` is warm. The `getGuestParty` call is a fast in-memory lookup. Each subsequent `generateAndStoreICSForGuest(member.id)` still makes Notion calls (per-event page retrieval via `getGuestEventsById`). For a party of 4, running in `Promise.all` adds ~300–600ms to the RSVP response. Acceptable.

**`buildICS` type compatibility:** `buildICS` takes `EventWithDate[]`. `EventRecord` already has `date?: string` (the same field). TypeScript's structural typing makes `EventRecord[]` directly assignable to `EventWithDate[]` — no cast needed.

**Calendar endpoint is read-only:** The endpoint never imports from `ics-generator.ts` and never calls Notion. The only Notion-calling paths are the RSVP trigger (Task 5) and scheduled functions (Task 7). Do not add any Notion calls to the calendar endpoint.

---

## Implementation Log (2026-05-11)

Implemented as planned. Key observations from actual implementation:

**RSVP trigger simplification:** The plan's Task 5 code snippet calls `getGuestParty(guestId)` again inside the ICS block, but `party` is already in scope from earlier in the handler (fetched unconditionally for party contacts validation). Used `party` directly — no second `getGuestParty` call needed.

**`MissingBlobsEnvironmentError` in local tests:** When running `npm run verify` locally (no Netlify CLI), the RSVP API tests trigger the ICS regeneration path, which throws `MissingBlobsEnvironmentError` from `@netlify/blobs`. This is correctly caught by the try/catch in the RSVP handler and logged as non-fatal. All 164 tests pass; 13 skip.

**Calendar unit tests:** All 19 unit tests in `tests/calendar-unit.spec.ts` pass without any server or infrastructure — pure TypeScript import of `src/lib/calendar.ts`.

**Task numbering:** Plan's Task 6 (health endpoint) was implemented as part of the same commit as Task 4 (calendar endpoint) and Task 3b (test-seed) since they're closely related.

**PR:** <https://github.com/SamTheGeek/sargaux.com/pull/148>
