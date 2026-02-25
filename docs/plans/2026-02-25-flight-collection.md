# F-013: Guest Flight Collection & Flighty Sync — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow guests to enter flight info on their RSVP / a standalone `/travel` page, store it in a Notion "Guest Flights" database, and sync it daily to Flighty on the Mac Mini via AppleScript UI automation.

**Architecture:** Three components — (1) Web: optional flight form in RSVPs + event-agnostic `/travel` page + `/api/flights` endpoint; (2) Notion: new "Guest Flights" database separate from RSVP Responses; (3) Mac Mini: `scripts/sync-flighty.ts` cron that uses `osascript` to drive Flighty's UI via System Events.

**Tech Stack:** Astro SSR, TypeScript, `@notionhq/client` v5 (Notion API v2025-09-03), Node `child_process.execFile` (no shell — safe subprocess), `launchd` for scheduling, AppleScript UI scripting.

---

## Task 1: Create Guest Flights Notion Database

**Files:**
- No code files — Notion UI action + env var bootstrap

**Step 1: Create the database in Notion**

Open Notion and create a new database called **"Guest Flights"** inside the same workspace as the Guest List. Add these properties:

| Property | Type | Notes |
|---|---|---|
| `Name` | Title (formula) | Formula: `prop("Guest") + " — " + prop("Type") + " — " + prop("Event")` |
| `Guest` | Relation → Guest List | Who this flight belongs to |
| `Event` | Select | Options: `NYC`, `France` |
| `Type` | Select | Options: `Arrival`, `Departure` |
| `Airline` | Rich Text | e.g. "Air France" |
| `Flight Number` | Rich Text | e.g. "AF 007" |
| `Date` | Date | Flight date only (no time) |
| `Flighty Synced` | Checkbox | Starts unchecked |
| `Last Updated` | Last Edited Time | Auto-managed by Notion |

**Step 2: Get the database ID**

Copy the database URL from Notion. The database ID is the UUID in the URL:
`https://notion.so/workspace/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx?v=...`

Copy the ID portion (with dashes).

**Step 3: Add the Notion integration to this database**

In Notion, open the database → `...` menu → **Add connections** → select your Sargaux integration.

**Step 4: Bootstrap the env var everywhere**

```bash
# 1. Append to local .env (never commit this file)
echo "NOTION_GUEST_FLIGHTS_DB=<paste-id-here>" >> .env

# 2. Add to GitHub Secrets
gh secret set NOTION_GUEST_FLIGHTS_DB

# 3. Add to Netlify (production + deploy-preview)
netlify env:set NOTION_GUEST_FLIGHTS_DB <paste-id-here> --context production
netlify env:set NOTION_GUEST_FLIGHTS_DB <paste-id-here> --context deploy-preview
```

Print the value clearly for the Notion Connections step:
```
NOTION_GUEST_FLIGHTS_DB = <paste-id-here>
```

**Step 5: Commit (no code changes yet — just note that bootstrap is done)**

```bash
git commit --allow-empty -m "chore: bootstrap NOTION_GUEST_FLIGHTS_DB env var"
```

---

## Task 2: Feature Flags

**Files:**
- Modify: `src/config/features.ts`
- Modify: `src/env.d.ts`
- Modify: `netlify.toml`

**Step 1: Write failing test**

```typescript
// In tests/auth.spec.ts or a new tests/flights.spec.ts — add a placeholder skip:
test.skip('flight collection flag exists', () => {
  // Will be enabled in Task 6
});
```

**Step 2: Add flags to `src/config/features.ts`**

Find the `FeatureFlags` type and the `features` object. Add two entries following the existing pattern:

```typescript
// In FeatureFlags type:
'nyc.flightCollection': boolean;
'france.flightCollection': boolean;

// In features object (static import.meta.env references):
'nyc.flightCollection': flag(import.meta.env.FEATURE_NYC_FLIGHT_COLLECTION),
'france.flightCollection': flag(import.meta.env.FEATURE_FRANCE_FLIGHT_COLLECTION),
```

**Step 3: Add to `src/env.d.ts`**

Find the `ImportMetaEnv` interface and add:

```typescript
FEATURE_NYC_FLIGHT_COLLECTION?: string;
FEATURE_FRANCE_FLIGHT_COLLECTION?: string;
```

Also add to the `ProcessEnv` interface:

```typescript
NOTION_GUEST_FLIGHTS_DB?: string;
```

**Step 4: Add to `netlify.toml` deploy-preview environment**

```toml
[context.deploy-preview.environment]
  # existing flags...
  FEATURE_NYC_FLIGHT_COLLECTION = "true"
  FEATURE_FRANCE_FLIGHT_COLLECTION = "true"
```

**Step 5: Run build to verify no TypeScript errors**

```bash
npm run build
```

Expected: build succeeds with no errors.

**Step 6: Commit**

```bash
git add src/config/features.ts src/env.d.ts netlify.toml
git commit --no-gpg-sign -m "feat(F-013): add flightCollection feature flags"
```

---

## Task 3: Flight Type Definitions

**Files:**
- Create: `src/types/flight.ts`

**Step 1: Create the type file**

```typescript
// src/types/flight.ts

export type FlightEvent = 'nyc' | 'france';
export type FlightType = 'Arrival' | 'Departure';

/**
 * A single flight leg (arrival or departure) for a guest.
 */
export interface FlightRecord {
  id: string;           // Notion page ID
  guestId: string;      // Guest List relation ID
  event: FlightEvent;
  type: FlightType;
  airline: string;
  flightNumber: string;
  date: string;         // ISO date string (YYYY-MM-DD)
  flightySynced: boolean;
  lastUpdated: string;  // ISO datetime string
}

/**
 * Payload for creating/updating a flight pair (arrival + departure).
 * Both fields are optional — guests may only know one leg.
 */
export interface FlightSubmission {
  event: FlightEvent;
  arrival?: {
    airline: string;
    flightNumber: string;
    date: string; // YYYY-MM-DD
  };
  departure?: {
    airline: string;
    flightNumber: string;
    date: string; // YYYY-MM-DD
  };
}

/**
 * Response shape from GET /api/flights
 */
export interface FlightsResponse {
  arrival: FlightRecord | null;
  departure: FlightRecord | null;
}
```

**Step 2: Build to verify types compile**

```bash
npm run build
```

Expected: succeeds.

**Step 3: Commit**

```bash
git add src/types/flight.ts
git commit --no-gpg-sign -m "feat(F-013): add flight type definitions"
```

---

## Task 4: Notion Helper Functions

**Files:**
- Modify: `src/lib/notion.ts`

**Step 1: Read existing patterns first**

Open `src/lib/notion.ts`. Key reference patterns:
- `queryDatabase()` — REST helper for reading rows: `GET /v1/databases/{id}/query`
- `getClient()` — returns the `@notionhq/client` SDK client for writes
- `getLatestRSVP()` — example of filtering with `and` filter array
- `submitRSVP()` — example of `pages.create()` and `pages.update()` via SDK client

**Step 2: Add `getGuestFlights()` to `src/lib/notion.ts`**

Add after the existing RSVP helper functions:

```typescript
/**
 * Fetch existing flight records for a guest + event.
 * Returns { arrival: FlightRecord | null, departure: FlightRecord | null }
 */
export async function getGuestFlights(
  guestId: string,
  event: 'nyc' | 'france'
): Promise<{ arrival: FlightRecord | null; departure: FlightRecord | null }> {
  const dbId = process.env.NOTION_GUEST_FLIGHTS_DB;
  if (!dbId) throw new Error('NOTION_GUEST_FLIGHTS_DB not set');

  const eventValue = event === 'nyc' ? 'NYC' : 'France';

  const data = await queryDatabase(dbId, {
    filter: {
      and: [
        { property: 'Guest', relation: { contains: guestId } },
        { property: 'Event', select: { equals: eventValue } },
      ],
    },
  });

  const rows = (data.results ?? []) as any[];

  const toRecord = (row: any): FlightRecord => ({
    id: row.id,
    guestId,
    event,
    type: row.properties.Type?.select?.name as FlightType,
    airline: row.properties.Airline?.rich_text?.[0]?.plain_text ?? '',
    flightNumber: row.properties['Flight Number']?.rich_text?.[0]?.plain_text ?? '',
    date: row.properties.Date?.date?.start ?? '',
    flightySynced: row.properties['Flighty Synced']?.checkbox ?? false,
    lastUpdated: row.properties['Last Updated']?.last_edited_time ?? '',
  });

  const arrival = rows.find((r) => r.properties.Type?.select?.name === 'Arrival');
  const departure = rows.find((r) => r.properties.Type?.select?.name === 'Departure');

  return {
    arrival: arrival ? toRecord(arrival) : null,
    departure: departure ? toRecord(departure) : null,
  };
}
```

Also add the import at the top of `src/lib/notion.ts`:
```typescript
import type { FlightRecord, FlightType, FlightSubmission } from '../types/flight.js';
```

**Step 3: Add `upsertGuestFlights()` to `src/lib/notion.ts`**

```typescript
/**
 * Create or update arrival/departure flight records for a guest + event.
 * Resets Flighty Synced to false on any update.
 */
export async function upsertGuestFlights(
  guestId: string,
  event: 'nyc' | 'france',
  submission: FlightSubmission
): Promise<void> {
  const dbId = process.env.NOTION_GUEST_FLIGHTS_DB;
  if (!dbId) throw new Error('NOTION_GUEST_FLIGHTS_DB not set');

  const client = getClient();
  const eventValue = event === 'nyc' ? 'NYC' : 'France';

  // Fetch existing records to find IDs for update vs create
  const existing = await getGuestFlights(guestId, event);

  const upsertLeg = async (
    type: 'Arrival' | 'Departure',
    leg: FlightSubmission['arrival'] | FlightSubmission['departure']
  ) => {
    if (!leg) return;

    const properties: Record<string, any> = {
      Airline: { rich_text: [{ text: { content: leg.airline } }] },
      'Flight Number': { rich_text: [{ text: { content: leg.flightNumber } }] },
      Date: { date: { start: leg.date } },
      'Flighty Synced': { checkbox: false },
    };

    const existingRecord = type === 'Arrival' ? existing.arrival : existing.departure;

    if (existingRecord) {
      // Update existing page
      await client.pages.update({
        page_id: existingRecord.id,
        properties,
      });
    } else {
      // Create new page
      await client.pages.create({
        parent: { database_id: dbId },
        properties: {
          ...properties,
          Guest: { relation: [{ id: guestId }] },
          Event: { select: { name: eventValue } },
          Type: { select: { name: type } },
        },
      });
    }
  };

  await Promise.all([
    upsertLeg('Arrival', submission.arrival),
    upsertLeg('Departure', submission.departure),
  ]);
}
```

**Step 4: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: succeeds.

**Step 5: Commit**

```bash
git add src/lib/notion.ts src/types/flight.ts
git commit --no-gpg-sign -m "feat(F-013): add getGuestFlights and upsertGuestFlights to notion.ts"
```

---

## Task 5: API Endpoint `/api/flights`

**Files:**
- Create: `src/pages/api/flights.ts`
- Create: `tests/flights.spec.ts`

**Step 1: Write the failing tests first**

```typescript
// tests/flights.spec.ts
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:1213';

// Skip all Notion-backed tests when backend is not enabled
const skipIfNoNotion = process.env.FEATURE_GLOBAL_NOTION_BACKEND !== 'true';

test.describe('GET /api/flights', () => {
  test('returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/flights?event=france`);
    expect(res.status()).toBe(401);
  });

  test('returns 400 with invalid event', async ({ request, context }) => {
    // This test needs a valid auth cookie — skip in CI without Notion
    test.skip(skipIfNoNotion, 'Requires Notion backend');
    // ... (set up auth cookie via login API, then hit /api/flights?event=invalid)
    const res = await request.get(`${BASE_URL}/api/flights?event=invalid`);
    expect(res.status()).toBe(401); // No auth, expect 401
  });
});

test.describe('POST /api/flights', () => {
  test('returns 401 without auth', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/flights`, {
      data: { event: 'france', arrival: { airline: 'AF', flightNumber: 'AF007', date: '2027-05-28' } },
    });
    expect(res.status()).toBe(401);
  });
});
```

**Step 2: Run tests to verify they fail for the right reason**

```bash
npm run build && npx playwright test tests/flights.spec.ts -v
```

Expected: 401 tests pass (endpoint doesn't exist → 404 which is not 401, so they fail). That's the red state.

**Step 3: Create `src/pages/api/flights.ts`**

Mirror the pattern from `src/pages/api/rsvp.ts` exactly. Auth check → parse params → Notion call → response.

```typescript
/**
 * Flight collection API endpoint
 *
 * GET  /api/flights?event=nyc|france  — fetch existing flights for logged-in guest
 * POST /api/flights                   — upsert arrival/departure; resets Flighty Synced
 */

import type { APIRoute } from 'astro';
import { getAuthenticatedGuest } from '../../lib/auth';
import { getGuestFlights, upsertGuestFlights } from '../../lib/notion';
import type { FlightSubmission } from '../../types/flight';

/**
 * GET - Fetch existing flights for pre-fill
 */
export const GET: APIRoute = async ({ request, cookies }) => {
  const authCookie = cookies.get('sargaux_auth');
  if (!authCookie) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = getAuthenticatedGuest(cookies);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const guestId = auth.notionId;
  if (!guestId) {
    return new Response(
      JSON.stringify({ error: 'Notion backend required for flight data' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(request.url);
  const event = url.searchParams.get('event');

  if (!event || !['nyc', 'france'].includes(event)) {
    return new Response(
      JSON.stringify({ error: 'Invalid event (must be "nyc" or "france")' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!auth.eventInvitations.includes(event as 'nyc' | 'france')) {
    return new Response(JSON.stringify({ error: 'Forbidden for this event' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const flights = await getGuestFlights(guestId, event as 'nyc' | 'france');
    return new Response(JSON.stringify({ flights }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Flight fetch error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch flights',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST - Upsert flight records
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const authCookie = cookies.get('sargaux_auth');
  if (!authCookie) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = getAuthenticatedGuest(cookies);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const guestId = auth.notionId;
  if (!guestId) {
    return new Response(
      JSON.stringify({ error: 'Notion backend required for flight data' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: FlightSubmission;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.event || !['nyc', 'france'].includes(body.event)) {
    return new Response(
      JSON.stringify({ error: 'Invalid event (must be "nyc" or "france")' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!auth.eventInvitations.includes(body.event)) {
    return new Response(JSON.stringify({ error: 'Forbidden for this event' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await upsertGuestFlights(guestId, body.event, body);
    return new Response(
      JSON.stringify({ success: true, message: 'Flights saved successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Flight save error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to save flights',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

**Step 4: Run tests**

```bash
npm run build && npx playwright test tests/flights.spec.ts -v
```

Expected: 401 unauthenticated tests pass.

**Step 5: Commit**

```bash
git add src/pages/api/flights.ts tests/flights.spec.ts
git commit --no-gpg-sign -m "feat(F-013): add /api/flights endpoint (GET + POST)"
```

---

## Task 6: Protect `/travel` in Middleware

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Add `/travel` to `PROTECTED_ROUTES`**

In `src/middleware.ts`, find:

```typescript
const PROTECTED_ROUTES = [
  '/nyc',
  '/france',
  '/registry',
];
```

Change to:

```typescript
const PROTECTED_ROUTES = [
  '/nyc',
  '/france',
  '/registry',
  '/travel',
];
```

**Step 2: Build and verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit --no-gpg-sign -m "feat(F-013): protect /travel route in middleware"
```

---

## Task 7: Standalone `/travel` Page

**Files:**
- Create: `src/pages/travel.astro`

**Step 1: Create the page**

This is an SSR page. Pattern from `src/pages/france/rsvp.astro`:
- Frontmatter: get `guestId` from `Astro.locals`, fetch flights per event
- Template: one section per invited event, pre-populated with existing flight data
- Client script: `<script is:inline>` to handle form submission via `fetch` to `/api/flights`

```astro
---
// src/pages/travel.astro
export const prerender = false;

import { getAuthenticatedGuest } from '../lib/auth';
import { getGuestFlights } from '../lib/notion';
import type { FlightsResponse } from '../types/flight';

const auth = getAuthenticatedGuest(Astro.cookies);
if (!auth || !auth.notionId) {
  return Astro.redirect('/');
}

const guestId = auth.notionId;
const eventInvitations = auth.eventInvitations;

// Fetch existing flights for each invited event
const flightsByEvent: Record<string, FlightsResponse> = {};
for (const event of eventInvitations) {
  try {
    flightsByEvent[event] = await getGuestFlights(guestId, event as 'nyc' | 'france');
  } catch {
    flightsByEvent[event] = { arrival: null, departure: null };
  }
}

const eventLabels: Record<string, string> = {
  nyc: 'New York (October 11, 2026)',
  france: 'France (May 28–30, 2027)',
};
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your Travel Details — Chez Sargaux</title>
  </head>
  <body>
    <main>
      <h1>Your Travel Details</h1>
      <p>Add or update your flight information below. We'll use this to coordinate arrivals.</p>

      {eventInvitations.map((event) => {
        const flights = flightsByEvent[event];
        const label = eventLabels[event] ?? event;
        return (
          <section data-event={event}>
            <h2>{label}</h2>

            <form class="flight-form" data-event={event}>
              <fieldset>
                <legend>Arrival Flight</legend>
                <label>
                  Airline
                  <input
                    type="text"
                    name="arrival-airline"
                    value={flights?.arrival?.airline ?? ''}
                    placeholder="e.g. Air France"
                  />
                </label>
                <label>
                  Flight Number
                  <input
                    type="text"
                    name="arrival-flightNumber"
                    value={flights?.arrival?.flightNumber ?? ''}
                    placeholder="e.g. AF 007"
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    name="arrival-date"
                    value={flights?.arrival?.date ?? ''}
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend>Departure Flight</legend>
                <label>
                  Airline
                  <input
                    type="text"
                    name="departure-airline"
                    value={flights?.departure?.airline ?? ''}
                    placeholder="e.g. Air France"
                  />
                </label>
                <label>
                  Flight Number
                  <input
                    type="text"
                    name="departure-flightNumber"
                    value={flights?.departure?.flightNumber ?? ''}
                    placeholder="e.g. AF 007"
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    name="departure-date"
                    value={flights?.departure?.date ?? ''}
                  />
                </label>
              </fieldset>

              <button type="submit">Save Flight Details</button>
              <p class="status-msg" aria-live="polite"></p>
            </form>
          </section>
        );
      })}
    </main>

    <script is:inline>
      document.querySelectorAll('.flight-form').forEach((form) => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const event = form.dataset.event;
          const statusEl = form.querySelector('.status-msg');

          const get = (name) => form.querySelector(`[name="${name}"]`)?.value?.trim() || undefined;

          const arrival =
            get('arrival-airline') || get('arrival-flightNumber') || get('arrival-date')
              ? {
                  airline: get('arrival-airline') ?? '',
                  flightNumber: get('arrival-flightNumber') ?? '',
                  date: get('arrival-date') ?? '',
                }
              : undefined;

          const departure =
            get('departure-airline') || get('departure-flightNumber') || get('departure-date')
              ? {
                  airline: get('departure-airline') ?? '',
                  flightNumber: get('departure-flightNumber') ?? '',
                  date: get('departure-date') ?? '',
                }
              : undefined;

          try {
            const res = await fetch('/api/flights', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event, arrival, departure }),
            });

            if (res.ok) {
              statusEl.textContent = 'Saved!';
            } else {
              const data = await res.json();
              statusEl.textContent = data.error ?? 'Something went wrong.';
            }
          } catch {
            statusEl.textContent = 'Network error. Please try again.';
          }
        });
      });
    </script>
  </body>
</html>
```

**Step 2: Build to verify**

```bash
npm run build
```

Expected: succeeds.

**Step 3: Manual verification**

```bash
# Start dev server with flags enabled
FEATURE_FRANCE_FLIGHT_COLLECTION=true npm run dev
```

Open http://localhost:1213/travel while logged in as a France guest. Verify:
- Travel page loads with France section
- Form pre-populates if flights already exist
- Submitting saves to Notion (check Notion dashboard)

**Step 4: Commit**

```bash
git add src/pages/travel.astro
git commit --no-gpg-sign -m "feat(F-013): add standalone /travel page"
```

---

## Task 8: Update RSVP Confirmation Email

**Files:**
- Modify: `src/lib/email-templates.ts`
- Modify: `src/pages/api/rsvp.ts`

**Step 1: Add `travelUrl` to the email template**

In `src/lib/email-templates.ts`, find the `rsvpConfirmation()` function's params interface. Add:

```typescript
travelUrl?: string;
```

In the HTML template body, after the calendar link block (or after the update link), add a travel details CTA. Find a natural location in the template after RSVP confirmation content and add:

```html
<!-- Inside the existing template HTML, after calendarUrl block -->
${travelUrl ? `
<p style="margin-top: 24px;">
  <a href="${travelUrl}" style="...existing link styles...">Add your flight details →</a>
</p>
<p style="font-size: 14px; color: #666;">
  Not sure yet? You can add or update your travel info anytime.
</p>
` : ''}
```

**Step 2: Pass `travelUrl` from `src/pages/api/rsvp.ts`**

In the RSVP POST handler, find where `rsvpConfirmation()` is called (~line 179). Add `travelUrl`:

```typescript
const travelUrl = `https://sargaux.com/travel`;

const template = rsvpConfirmation({
  guestName: auth.guest,
  event: body.event,
  attending,
  guestsAttending: guestsAttendingStr,
  eventNames,
  dietary: body.dietary,
  updateUrl,
  calendarUrl,
  travelUrl: attending ? travelUrl : undefined, // Only show if attending
});
```

**Step 3: Build to verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/lib/email-templates.ts src/pages/api/rsvp.ts
git commit --no-gpg-sign -m "feat(F-013): add travel page CTA to RSVP confirmation email"
```

---

## Task 9: RSVP Form Integration (France)

**Files:**
- Modify: `src/pages/france/rsvp.astro`

**Step 1: Add Travel Details section to France RSVP**

In `src/pages/france/rsvp.astro`, after the existing optional events / dietary sections (inside the attending-guest conditional), add:

```html
<!-- Travel Details section — only visible when flag is enabled AND guest is attending -->
{isEnabled('france.flightCollection') && (
  <div id="travel-details" style="display: none;">
    <h3>Travel Details (Optional)</h3>
    <p>
      Not sure yet? You can add or update your flight info anytime at your
      <a href="/travel">travel page</a>.
    </p>

    <fieldset>
      <legend>Arrival Flight</legend>
      <label>
        Airline
        <input type="text" name="arrival-airline" placeholder="e.g. Air France" />
      </label>
      <label>
        Flight Number
        <input type="text" name="arrival-flightNumber" placeholder="e.g. AF 007" />
      </label>
      <label>
        Date
        <input type="date" name="arrival-date" />
      </label>
    </fieldset>

    <fieldset>
      <legend>Departure Flight</legend>
      <label>
        Airline
        <input type="text" name="departure-airline" placeholder="e.g. AF" />
      </label>
      <label>
        Flight Number
        <input type="text" name="departure-flightNumber" placeholder="e.g. AF 008" />
      </label>
      <label>
        Date
        <input type="date" name="departure-date" />
      </label>
    </fieldset>
  </div>
)}
```

In the existing `<script is:inline>` for the form, show/hide the travel section based on attending status:

```javascript
// After existing attendance toggle logic, add:
function updateTravelVisibility() {
  const anyAttending = [...document.querySelectorAll('[name$="-attending"]')]
    .some(el => el.value === 'true' || el.checked);
  const travelSection = document.getElementById('travel-details');
  if (travelSection) {
    travelSection.style.display = anyAttending ? 'block' : 'none';
  }
}
// Call on load and on attendance change
updateTravelVisibility();
// Hook into existing attendance change listeners
```

In the existing form submit handler, collect flight data and send it in parallel (fire-and-forget, don't block RSVP):

```javascript
// After successful RSVP submission, fire flight data as separate request:
const flightPayload = collectFlightData('france'); // helper to read form fields
if (flightPayload.arrival || flightPayload.departure) {
  fetch('/api/flights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'france', ...flightPayload }),
  }).catch(err => console.warn('Flight save failed (non-blocking):', err));
}
```

**Step 2: Add `isEnabled` import to frontmatter if not already present**

```astro
---
import { isEnabled } from '../../config/features';
---
```

**Step 3: Build and test**

```bash
FEATURE_FRANCE_FLIGHT_COLLECTION=true npm run dev
```

Navigate to `/france/rsvp`. Verify travel section appears when attendance is confirmed.

**Step 4: Repeat for NYC RSVP**

Same changes in `src/pages/nyc/rsvp.astro` with `isEnabled('nyc.flightCollection')` and `event: 'nyc'`.

**Step 5: Commit**

```bash
git add src/pages/france/rsvp.astro src/pages/nyc/rsvp.astro
git commit --no-gpg-sign -m "feat(F-013): add optional travel details section to RSVP forms"
```

---

## Task 10: Mac Mini Sync Script

**Files:**
- Create: `scripts/sync-flighty.ts`

> **Note on subprocess safety:** Use `execFile` (promisified) from `child_process`, NOT `exec` or `execSync`. `execFile` passes args as an array — no shell is spawned, so there is no shell injection risk. The signature is `execFileAsync('osascript', [scriptPath, arg1, arg2, arg3])`.

**Step 1: Create `scripts/sync-flighty.ts`**

```typescript
#!/usr/bin/env tsx
/**
 * Sync unsynced Guest Flights from Notion → Flighty (Mac Mini only).
 *
 * Run manually:   DRY_RUN=true npx tsx scripts/sync-flighty.ts
 * Run via launchd: daily at 08:00 local time
 *
 * Required env vars:
 *   NOTION_API_KEY           — Notion integration token
 *   NOTION_GUEST_FLIGHTS_DB  — Guest Flights database page ID
 *
 * DRY_RUN=true: logs actions without touching Flighty.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

// ─── Config ──────────────────────────────────────────────────────────────────

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_GUEST_FLIGHTS_DB = process.env.NOTION_GUEST_FLIGHTS_DB;
const DRY_RUN = process.env.DRY_RUN === 'true';
const NOTION_VERSION = '2022-06-28';

if (!NOTION_API_KEY) { console.error('❌ NOTION_API_KEY is not set'); process.exit(1); }
if (!NOTION_GUEST_FLIGHTS_DB) { console.error('❌ NOTION_GUEST_FLIGHTS_DB is not set'); process.exit(1); }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '.flighty-sync-state.json');
const APPLESCRIPT = path.join(__dirname, 'add-flighty-friend.applescript');

// ─── Types ───────────────────────────────────────────────────────────────────

interface FlightRow {
  id: string;
  guestName: string;
  airline: string;
  flightNumber: string;
  date: string;
  flightySynced: boolean;
  lastUpdated: string;
}

interface SyncState {
  lastRun: string; // ISO datetime
}

// ─── State management ────────────────────────────────────────────────────────

function loadState(): SyncState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { lastRun: new Date(0).toISOString() };
  }
}

function saveState(state: SyncState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Notion REST helper ───────────────────────────────────────────────────────

async function notionFetch(path: string, body: object): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function notionPatch(path: string, body: object): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion PATCH error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Fetch unsynced flights ───────────────────────────────────────────────────

async function fetchUnsyncedFlights(): Promise<FlightRow[]> {
  const data = await notionFetch(`/databases/${NOTION_GUEST_FLIGHTS_DB}/query`, {
    filter: {
      property: 'Flighty Synced',
      checkbox: { equals: false },
    },
  });

  return (data.results ?? []).map((row: any): FlightRow => ({
    id: row.id,
    guestName:
      row.properties.Guest?.relation?.[0]?.id ?? 'Unknown Guest',
    airline: row.properties.Airline?.rich_text?.[0]?.plain_text ?? '',
    flightNumber: row.properties['Flight Number']?.rich_text?.[0]?.plain_text ?? '',
    date: row.properties.Date?.date?.start ?? '',
    flightySynced: row.properties['Flighty Synced']?.checkbox ?? false,
    lastUpdated: row.properties['Last Updated']?.last_edited_time ?? '',
  }));
}

// ─── Flighty automation ───────────────────────────────────────────────────────

async function addToFlighty(flight: FlightRow): Promise<void> {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would add to Flighty: ${flight.flightNumber} on ${flight.date}`);
    return;
  }

  // execFile — no shell, args passed as array (safe, no injection risk)
  await execFileAsync('osascript', [
    APPLESCRIPT,
    flight.airline,
    flight.flightNumber,
    flight.date,
  ], { timeout: 30_000 });
}

// ─── Mark synced in Notion ────────────────────────────────────────────────────

async function markSynced(pageId: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would mark ${pageId} as Flighty Synced = true`);
    return;
  }
  await notionPatch(`/pages/${pageId}`, {
    properties: { 'Flighty Synced': { checkbox: true } },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n🛫 sync-flighty — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  const state = loadState();
  console.log(`Last run: ${state.lastRun}`);

  const flights = await fetchUnsyncedFlights();
  console.log(`Found ${flights.length} unsynced flight(s)\n`);

  if (flights.length === 0) {
    console.log('Nothing to sync. Done.');
    return;
  }

  let synced = 0;
  let failed = 0;

  for (const flight of flights) {
    console.log(`→ ${flight.flightNumber} on ${flight.date} (${flight.airline})`);
    try {
      await addToFlighty(flight);
      await markSynced(flight.id);
      synced++;
      console.log(`  ✅ synced`);
    } catch (err) {
      failed++;
      console.error(`  ❌ failed:`, err instanceof Error ? err.message : err);
    }

    // Rate limit — be kind to Flighty UI
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\nDone: ${synced} synced, ${failed} failed`);

  if (!DRY_RUN) {
    saveState({ lastRun: new Date().toISOString() });
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

**Step 2: Add `.flighty-sync-state.json` to `.gitignore`**

```bash
echo "scripts/.flighty-sync-state.json" >> .gitignore
```

**Step 3: Verify with dry run (no Flighty needed)**

```bash
DRY_RUN=true npx tsx scripts/sync-flighty.ts
```

Expected: logs "Found 0 unsynced flight(s)" (or lists actual unsynced flights if database has data).

**Step 4: Commit**

```bash
git add scripts/sync-flighty.ts .gitignore
git commit --no-gpg-sign -m "feat(F-013): add sync-flighty.ts Mac Mini automation script"
```

---

## Task 11: AppleScript — Add Flighty Friend's Flight

**Files:**
- Create: `scripts/add-flighty-friend.applescript`

> **Critical**: The exact UI element names (button labels, field names, tab names) must be verified against the Flighty version installed on the Mac Mini before this script is deployed. The script below is a template — run it in dry-run against Flighty's accessibility tree first.

**Step 1: Create the AppleScript**

```applescript
-- add-flighty-friend.applescript
-- Adds a flight to Flighty's Friends' Flights section via UI scripting.
-- Usage: osascript add-flighty-friend.applescript <airline> <flightNumber> <date>
-- Date format: YYYY-MM-DD
--
-- IMPORTANT: UI element names must be verified against the installed Flighty version.
-- Run: osascript -e 'tell application "System Events" to tell process "Flighty" to get entire contents'
-- to inspect the current UI tree.

on run argv
  set flightAirline to item 1 of argv
  set flightNumber to item 2 of argv
  set flightDate to item 3 of argv

  -- Ensure Flighty is running and in foreground
  tell application "Flighty"
    activate
  end tell

  delay 1

  tell application "System Events"
    tell process "Flighty"
      -- Navigate to Friends' Flights tab
      -- TODO: Verify exact tab button name in installed Flighty version
      click button "Friends" of toolbar 1 of window 1

      delay 0.5

      -- Tap "+" to add new friend's flight
      -- TODO: Verify exact button name/position
      click button "Add Flight" of window 1

      delay 0.5

      -- Enter flight number (Flighty looks up airline from number)
      -- TODO: Verify field accessibility label
      set value of text field "Flight Number" of window 1 to flightNumber

      delay 0.3

      -- Enter date
      -- TODO: Verify date field label and format expected by Flighty UI
      set value of text field "Date" of window 1 to flightDate

      delay 0.3

      -- Save
      -- TODO: Verify save/add button label
      click button "Add" of window 1

      delay 0.5
    end tell
  end tell
end run
```

**Step 2: Verify against actual Flighty UI (Mac Mini only)**

SSH into the Mac Mini and run:

```bash
osascript -e 'tell application "System Events" to tell process "Flighty" to get entire contents'
```

This dumps the full accessibility tree. Update button/field names in the AppleScript based on actual output.

**Step 3: Test the script manually**

```bash
osascript scripts/add-flighty-friend.applescript "Air France" "AF 007" "2027-05-28"
```

Verify the flight appears in Flighty Friends' Flights.

**Step 4: Commit**

```bash
git add scripts/add-flighty-friend.applescript
git commit --no-gpg-sign -m "feat(F-013): add Flighty AppleScript UI automation"
```

---

## Task 12: launchd Scheduling

**Files:**
- Create: `scripts/com.sargaux.sync-flighty.plist`

**Step 1: Create the plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.sargaux.sync-flighty</string>

  <key>ProgramArguments</key>
  <array>
    <!-- Use full paths — launchd doesn't inherit user PATH -->
    <string>/usr/local/bin/npx</string>
    <string>tsx</string>
    <string>/Users/sam/Developer/sargaux.com/scripts/sync-flighty.ts</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <!-- Load secrets from environment — do NOT hardcode values here -->
    <!-- Set these via: launchctl setenv NOTION_API_KEY <value> -->
    <key>NOTION_API_KEY</key>
    <string>PLACEHOLDER_SET_VIA_LAUNCHCTL</string>
    <key>NOTION_GUEST_FLIGHTS_DB</key>
    <string>PLACEHOLDER_SET_VIA_LAUNCHCTL</string>
  </dict>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>8</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>/tmp/sync-flighty.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/sync-flighty.error.log</string>

  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
```

**Step 2: Commit**

```bash
git add scripts/com.sargaux.sync-flighty.plist
git commit --no-gpg-sign -m "feat(F-013): add launchd plist for daily Flighty sync"
```

---

## Task 13: Mac Mini Setup Documentation

**Files:**
- Modify: `scripts/README.md` (create if it doesn't exist)

**Step 1: Add Flighty Sync section to `scripts/README.md`**

Add a new section:

```markdown
## sync-flighty — Flighty Friends' Flights Sync (Mac Mini)

Runs daily at 08:00 on the Mac Mini. Reads unsynced guest flights from Notion
and adds them to Flighty's Friends' Flights section via AppleScript UI automation.

### One-time Mac Mini Setup

1. **Enable Accessibility for Terminal**
   System Settings → Privacy & Security → Accessibility → add Terminal (or your terminal app).

2. **Enable Accessibility for Flighty**
   Same panel → add Flighty.

3. **Set environment variables for launchd**
   ```bash
   launchctl setenv NOTION_API_KEY "your-key-here"
   launchctl setenv NOTION_GUEST_FLIGHTS_DB "your-db-id-here"
   ```
   Run these after every reboot (or add to a login script).

4. **Install the launchd job**
   ```bash
   cp scripts/com.sargaux.sync-flighty.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.sargaux.sync-flighty.plist
   ```

5. **Verify the job is loaded**
   ```bash
   launchctl list | grep sargaux
   ```

### Manual Runs

```bash
# Dry run — no Flighty changes, shows what would sync
DRY_RUN=true npx tsx scripts/sync-flighty.ts

# Live run
npx tsx scripts/sync-flighty.ts
```

### Logs

```bash
tail -f /tmp/sync-flighty.log
tail -f /tmp/sync-flighty.error.log
```

### Verifying the AppleScript

Before first live run, verify UI element names match the installed Flighty version:
```bash
osascript -e 'tell application "System Events" to tell process "Flighty" to get entire contents'
```
Update `scripts/add-flighty-friend.applescript` button/field names if needed.
```

**Step 2: Commit**

```bash
git add scripts/README.md
git commit --no-gpg-sign -m "docs(F-013): add Mac Mini setup instructions to scripts/README.md"
```

---

## Task 14: Update `package.json` + Version Bump

**Files:**
- Modify: `package.json`

**Step 1: Add `sync:flighty` script and bump minor version**

In `package.json`:

1. Add to `"scripts"`:
   ```json
   "sync:flighty": "npx tsx scripts/sync-flighty.ts"
   ```

2. Bump version from `0.7.0` → `0.8.0` (minor bump — new complete feature epic)

**Step 2: Build to verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add package.json
git commit --no-gpg-sign -m "chore: bump to v0.8.0; add sync:flighty npm script"
```

---

## Task 15: Update Feature Plan Doc

**Files:**
- Modify: `docs/feature plan.md`

**Step 1: Add F-013 entry**

Open `docs/feature plan.md`. Find the feature list section. Add:

```markdown
### F-013: Guest Flight Collection & Flighty Sync
**Milestone**: M5.5 (January 2027)
**Status**: Planned

Allow guests to enter arrival and departure flight details on the RSVP form and a
standalone `/travel` page. Flight data is stored in a Notion "Guest Flights" database
and synced daily to Flighty (Mac Mini) via AppleScript UI automation.

See full design doc: `docs/plans/2026-02-25-flight-collection-design.md`
```

**Step 2: Commit**

```bash
git add "docs/feature plan.md"
git commit --no-gpg-sign -m "docs(F-013): add F-013 entry to feature plan"
```

---

## Task 16: Build, Test, and Push

**Step 1: Full build + tests**

```bash
npm run verify
```

Expected: all 51+ tests pass.

**Step 2: If any tests fail**

Read the failure output carefully. Common issues:
- Missing import — fix the import
- TypeScript error — fix the type
- Broken link in best-practices — check new pages have correct links

**Step 3: Push and open PR**

```bash
git push -u origin claude/eager-liskov
```

The draft PR #45 already exists. Verify all commits are pushed.

**Step 4: Post-merge Mac Mini steps (manual)**

After the PR is merged and deployed:
1. SSH into Mac Mini
2. Pull latest: `git pull origin main`
3. Follow `scripts/README.md` setup instructions
4. Run `DRY_RUN=true npm run sync:flighty` to verify Notion query
5. Enable `FEATURE_FRANCE_FLIGHT_COLLECTION=true` on Netlify production when ready to open flight collection to guests

---

## Verification Checklist

**Web + API:**
- [ ] `FEATURE_FRANCE_FLIGHT_COLLECTION=true` locally → `/travel` shows France section
- [ ] Log in as France guest → `/travel` pre-populates if flights exist in Notion
- [ ] Submit flight form → new rows in Notion Guest Flights database, `Flighty Synced = false`
- [ ] Submit RSVP → confirmation email includes "Add your flight details →" link
- [ ] Update flight on `/travel` → `Flighty Synced` resets to `false` in Notion

**Mac Mini script:**
- [ ] `DRY_RUN=true npx tsx scripts/sync-flighty.ts` → logs correct flights
- [ ] AppleScript UI elements verified against installed Flighty
- [ ] Live run adds flights to Flighty Friends' Flights section
- [ ] Updated flight: old entry removed (or warning logged), new entry added

**Tests:**
- [ ] `tests/flights.spec.ts` — GET/POST `/api/flights` unauthenticated returns 401
- [ ] Full suite: `npm run verify` passes
