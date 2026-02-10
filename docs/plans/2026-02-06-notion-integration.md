# Notion Integration Plan

## Overview

Replace the hardcoded guest list with Notion-backed authentication, create RSVP submission endpoints that write to Notion, make optional events Notion-driven, and move from day-level to event-level guest invitations.

**Key decisions:**
- Full guest party appears in RSVP form (via Related Guests relation)
- Re-submissions replace the previous response (overwrite, not append)
- RSVP data: hybrid storage — key fields as Notion properties, event-specific details as JSON
- Optional events: new "Event Catalog" database linked to Wedding Timeline days
- **Event-level invitations** replace day-level — guests are invited to specific events, not just days
- Guests only see events they're invited to on their RSVP form
- Bidirectional relation between Guest List and Event Catalog
- Build-time data fetching for reads; runtime writes for RSVP only

---

## Notion Schema Changes

### Modify: Guest List Database

Changes:
- **Remove** `Days Invited` relation (replaced by Events Invited)
- **Add** `Events Invited` (bidirectional relation → Event Catalog) — which specific events this guest is invited to
- **Add** `Event Invitations` (multi-select: `NYC`, `France`) — high-level which wedding(s), used for auth routing

Keep as-is: `Full Name` formula, `Related Guests` relation, `+1` checkbox, `RSVP` status, `Country`, `Group`, `Guest Of`, `Meal Preference`, `Guest Email`, etc.

### Modify: Wedding Timeline Database

Add page:
- **NYC Event** (October 11, 2026, Location: `NYC`)

Change `Location` property from text to select: `NYC`, `France`

This database stays as the "day" level. Event Catalog links to it for day grouping.

### Create: Event Catalog Database

| Property | Type | Notes |
|----------|------|-------|
| Event Name (title) | Title | e.g. "Friday Welcome Dinner" |
| Day | Relation → Wedding Timeline | Which day this belongs to |
| Event Type | Select | `Core`, `Optional` |
| Wedding | Select | `NYC`, `France` |
| Time | Text | e.g. "7:00 PM" |
| Location | Text | Venue name or TBD |
| Description | Rich Text | Event details for website |
| Show on Website | Checkbox | Controls visibility on public pages |
| Guests Invited | Relation → Guest List | **Bidirectional** with `Events Invited` on Guest List |

Initial pages:
- **NYC:** Dinner (Core), Dancing (Core), Friday Welcome Drinks (Optional), Sunday Brunch (Optional)
- **France:** Friday Welcome Dinner (Core), Saturday Ceremony & Reception (Core), Sunday Farewell Brunch (Core), Saturday Morning Excursion (Optional)

> **Note:** "Dinner & Dancing" was split into separate "Dinner" and "Dancing" events so that Dancing can be offered as a standalone digital invite add-on.

### Create: RSVP Responses Database

| Property | Type | Notes |
|----------|------|-------|
| Response (title) | Title | "{Guest Name} — {Event}" |
| Guest | Relation → Guest List | Primary guest who submitted |
| Event | Select | `NYC`, `France` |
| Submitted At | Date | Datetime of submission |
| Status | Select | `Attending`, `Declined`, `Partial` |
| Guests Attending | Text | Comma-separated names of attending party members |
| Dietary Needs | Text | Free text |
| Message | Text | Guest message |
| Details | Text | JSON blob for event-specific fields (allergens, accommodation, transport, song request, selected event IDs) |

---

## Phase 1: Notion Foundation & Auth ✅ COMPLETE

**Goal:** Install Notion SDK, replace hardcoded guest list with Notion-backed auth.
**Status:** Merged in PR #25 (`bc1198c`).

### Notion setup (manual, before coding)
- Create Notion integration at https://www.notion.so/my-integrations
- Share Guest List database with the integration
- Share Wedding Timeline database with the integration
- Note the API key and database IDs

### Files to create

- `src/lib/notion.ts` — Notion client wrapper + query helpers
- `src/types/guest.ts` — GuestRecord type

### Files to modify

- `package.json` — add `@notionhq/client`
- `src/lib/auth.ts` — remove hardcoded list, accept GuestRecord[], add notionId to session token
- `src/pages/api/login.ts` — fetch guests from Notion, find by normalized name, include notionId in token
- `src/middleware.ts` — parse notionId from token, set `Astro.locals.guestId`
- `src/env.d.ts` — add NOTION_API_KEY, NOTION_GUEST_LIST_DB, update App.Locals type
- `src/config/features.ts` — add `global.notionBackend` flag
- `netlify.toml` — add feature flag for preview deploys

### Implementation details

**Notion client (`src/lib/notion.ts`):**
```typescript
import { Client } from '@notionhq/client';

const notion = new Client({ auth: import.meta.env.NOTION_API_KEY });

// Module-level cache — populated once per cold start
let guestCache: GuestRecord[] | null = null;

export async function fetchAllGuests(): Promise<GuestRecord[]> {
  if (guestCache) return guestCache;
  // Query Guest List database, paginate through all results
  // Map Notion page properties → GuestRecord
  // Normalize names for auth matching
  guestCache = result;
  return result;
}
```

**GuestRecord type (`src/types/guest.ts`):**
```typescript
export interface GuestRecord {
  id: string;                    // Notion page ID
  name: string;                  // Full Name
  normalizedName: string;        // lowercase, no accents, for auth matching
  eventInvitations: ('nyc' | 'france')[];  // which wedding(s)
  isPlusOne: boolean;
  relatedGuestIds: string[];     // Notion IDs of party members
}
```

**Auth changes (`src/lib/auth.ts`):**
- `validateGuest(name, guests: GuestRecord[])` → returns GuestRecord | null
- Session token: `{ guest: string, notionId: string, created: number }`
- `getAuthenticatedGuest()` returns `{ name: string, notionId: string }` or null
- Keep hardcoded list as fallback when `notionBackend` flag is off (local dev without keys)

**Middleware changes:**
- `Astro.locals.guest` stays as string (backward compat with all page templates)
- `Astro.locals.guestId` added as string (Notion page ID)
- Update `App.Locals` interface

### Verification
- All 34 existing Playwright tests pass
- Login works with names from Notion database
- Local dev without Notion keys still works (falls back to hardcoded list)

---

## Phase 2: Event Catalog & RSVP Endpoints ✅ COMPLETE

**Goal:** Create Event Catalog in Notion, build RSVP submission endpoints.
**Status:** Code implementation complete. Notion schema setup done in earlier work.

### Notion setup (manual) ✅ COMPLETE

- ✅ Created Event Catalog database (data source: `dc1fe06b-5729-4ea9-af65-a32e6eab0151`)
- ✅ Created bidirectional relation between Event Catalog (`Guests Invited`) and Guest List (`Events Invited`)
- ✅ Added `Event Invitations` multi-select (`NYC`, `France`) to Guest List
- ✅ Added `Wedding` select (`NYC`, `France`) to Event Catalog
- ✅ Updated Wedding Timeline: `Location` property changed from text to select, NYC Event page added
- ✅ Populated all 8 events (4 NYC + 4 France) with guest assignments via `Guests Invited` relation
- ✅ Set `Event Invitations` on all active guests: 37 dual-invited (`NYC, France`), 101 NYC-only (`NYC`), 161 France (`France`)
- ✅ Created RSVP Responses database (data source: `de976342-07ce-422a-892b-73d46832bf6f`)
- ✅ Shared both new databases with the Notion integration
- ✅ Added `NOTION_EVENT_CATALOG_DB` and `NOTION_RSVP_RESPONSES_DB` to Netlify Dashboard and GitHub Secrets
- ⏳ `Days Invited` relation kept for now (not yet removed) — `Events Invited` is the canonical source

> **Note:** 9 archived guest pages could not have `Event Invitations` set. These are likely deleted/removed guests and can be ignored unless they need to be restored.

### Files to create

- `src/types/rsvp.ts` — RSVPSubmission and RSVPResponse types
- `src/types/event.ts` — EventRecord type
- `src/pages/api/rsvp.ts` — POST (submit) and GET (fetch existing) endpoint

### Files to modify

- `src/lib/notion.ts` — add `submitRSVP()`, `getLatestRSVP()`, `getGuestEvents()`, `getEventCatalog()`
- `src/env.d.ts` — add NOTION_RSVP_RESPONSES_DB, NOTION_EVENT_CATALOG_DB
- `src/config/features.ts` — add `nyc.rsvpEnabled`, `france.rsvpEnabled`

### Implementation details

**Event types (`src/types/event.ts`):**
```typescript
export interface EventRecord {
  id: string;
  name: string;
  type: 'Core' | 'Optional';
  time?: string;
  location?: string;
  description?: string;
  dayId: string;       // Wedding Timeline page ID
  wedding: 'nyc' | 'france';
}
```

**Notion functions (`src/lib/notion.ts`):**
```typescript
// Fetch events a specific guest is invited to
export async function getGuestEvents(guestId: string): Promise<EventRecord[]>

// Fetch all events for a location (for landing pages)
export async function getEventCatalog(wedding: 'nyc' | 'france'): Promise<EventRecord[]>

// Submit or update RSVP
export async function submitRSVP(data: RSVPSubmission): Promise<string>

// Fetch existing RSVP for pre-fill
export async function getLatestRSVP(guestId: string, event: 'nyc' | 'france'): Promise<RSVPResponse | null>
```

**RSVP endpoint (`src/pages/api/rsvp.ts`):**
- POST: validate auth → parse body → upsert RSVP Response in Notion → update guest RSVP status → return success
- GET: validate auth → query by guestId + event → return latest response data
- On re-submission: find existing page by guest relation + event select, update it

### Implementation Complete ✅

**Files created:**
- `src/types/event.ts` — EventRecord type definition
- `src/types/rsvp.ts` — RSVPSubmission, RSVPResponse, and RSVPDetails types
- `src/pages/api/rsvp.ts` — POST (submit), GET (fetch), DELETE (reset) endpoints

**Files modified:**
- `src/lib/notion.ts` — Added functions: `getEventCatalog()`, `getGuestEvents()`, `getGuestParty()`, `submitRSVP()`, `getLatestRSVP()`, `deleteRSVP()`, `clearEventCache()`
- `src/env.d.ts` — Added `NOTION_EVENT_CATALOG_DB` and `NOTION_RSVP_RESPONSES_DB` to ProcessEnv
- `src/config/features.ts` — Added `nyc.rsvpEnabled` and `france.rsvpEnabled` feature flags
- `netlify.toml` — Added `FEATURE_NYC_RSVP_ENABLED` and `FEATURE_FRANCE_RSVP_ENABLED` to deploy-preview context

**Tests created:**
- `tests/rsvp-api.spec.ts` — 14 tests covering POST/GET/DELETE endpoints, validation, auth checks, submission and updates
- `tests/rsvp.spec.ts` — UI tests (mostly placeholders for Phase 3) covering form structure, submission flow, pre-fill behavior, email capture

### Resetting RSVPs for Testing

To test the "new RSVP" flow vs. updating an existing RSVP:

**Option 1: DELETE endpoint (recommended)**
```bash
# Get auth cookie from browser DevTools or login flow
curl -X DELETE 'http://localhost:1213/api/rsvp?event=nyc' \
  -H 'Cookie: sargaux_auth=YOUR_COOKIE_HERE'
```

**Option 2: Direct Notion manipulation**
- Open Notion → RSVP Responses database
- Find the response page for the guest + event
- Archive or delete the page manually

**Option 3: Programmatic via Playwright tests**
```typescript
await request.delete('http://localhost:1213/api/rsvp?event=nyc', {
  headers: { Cookie: `sargaux_auth=${authCookie}` },
});
```

The DELETE endpoint archives the Notion page (Notion API doesn't support true deletion), so it won't appear in queries but remains recoverable in Notion's trash.

### Verification
- ✅ POST with valid auth → creates page in RSVP Responses database
- ✅ POST again → updates same page (not duplicate)
- ✅ GET returns the previously submitted data
- ✅ POST without auth → 401
- ✅ DELETE removes RSVP (archives Notion page)
- ✅ Tests cover all endpoints and validation scenarios

---

## Phase 3: Dynamic RSVP Forms

**Goal:** Wire up RSVP pages to show guest-specific events and submit to the API.

### Files to modify

- `src/lib/notion.ts` — add `getGuestParty(guestId)` function
- `src/pages/nyc/rsvp.astro` — replace wireframe with dynamic form
- `src/pages/france/rsvp.astro` — same

### Implementation details

**Guest party fetch (`src/lib/notion.ts`):**
```typescript
export async function getGuestParty(guestId: string): Promise<GuestRecord[]> {
  // 1. Fetch primary guest
  // 2. Fetch Related Guests via relation
  // 3. Return [primary, ...related] sorted (primary first, +1s last)
}
```

**RSVP page changes (both NYC and France):**

Frontmatter:
```astro
---
const guestId = Astro.locals.guestId;
const party = await getGuestParty(guestId);
const events = await getGuestEvents(guestId);  // only events this guest is invited to
const existingRSVP = await getLatestRSVP(guestId, 'nyc'); // or 'france'

const coreEvents = events.filter(e => e.type === 'Core');
const optionalEvents = events.filter(e => e.type === 'Optional');
---
```

Template:
- Guest toggles rendered dynamically from `party`
- Core events shown as info (pre-checked)
- Optional events shown as checkboxes (only the ones this guest is invited to)
- Event-specific sections (France: accommodation, allergens, transport; NYC: song request)
- Pre-fill from `existingRSVP` if it exists
- +1 guests: dashed border, editable name, unchecked by default
- Remove all `disabled` attributes
- `<script is:inline>` handles form submission via fetch to `/api/rsvp`

**Form submission payload includes:**
- `event`: 'nyc' or 'france'
- `guestsAttending`: array of `{ name, attending }`
- `eventsAttending`: array of event IDs the guest is attending
- `dietary`, `message`, and event-specific `details` JSON

### Verification
- Login → RSVP page shows only events you're invited to
- A guest invited to "Dancing only" sees only that event
- Submit → Notion gets the response
- Reload → pre-filled
- Re-submit → updates, not duplicates
- All 34 tests pass

---

## Phase 4: Notion-Driven Event Display

**Goal:** Landing pages and schedule pages show events from Notion instead of static content.

### Files to modify

- `src/pages/nyc/index.astro` — optional events section from Notion
- `src/pages/france/index.astro` — same
- `src/pages/nyc/details.astro` — schedule/timeline from Event Catalog
- `src/pages/france/schedule.astro` — same

### Implementation details

**Landing pages:**
- Fetch `getEventCatalog('nyc')` / `getEventCatalog('france')`
- Filter by `showOnWebsite === true`
- Replace static "Optional events will be listed here" with actual events
- Core events shown in main schedule
- Optional events shown in "More to Explore" section

**Schedule/details pages:**
- Timeline items driven by Event Catalog data
- Each event shows name, time, location, description from Notion

### Verification
- Add an event in Notion with Show on Website checked → rebuild → appears on site
- Uncheck Show on Website → rebuild → disappears
- Events appear in correct order by time

---

## Environment Variables

**Netlify Dashboard** (secrets):
- `NOTION_API_KEY`
- `NOTION_GUEST_LIST_DB` = `2c604b63ea2781d797d7000b48670e7e`
- `NOTION_WEDDING_TIMELINE_DB` = `2cf04b63ea2780a2b200000bed73f404`
- `NOTION_RSVP_RESPONSES_DB` = `de97634207ce422a892b73d46832bf6f`
- `NOTION_EVENT_CATALOG_DB` = `dc1fe06b57294ea9af65a32e6eab0151`

**netlify.toml** (feature flags for preview):
- `FEATURE_GLOBAL_NOTION_BACKEND = "true"`
- `FEATURE_NYC_RSVP_ENABLED = "true"`
- `FEATURE_FRANCE_RSVP_ENABLED = "true"`

**Local dev** without Notion keys: `notionBackend` flag off → hardcoded guest list fallback.

---

## New Feature Flags

| Flag | Env var | Default |
|------|---------|---------|
| `global.notionBackend` | `FEATURE_GLOBAL_NOTION_BACKEND` | false |
| `nyc.rsvpEnabled` | `FEATURE_NYC_RSVP_ENABLED` | false |
| `france.rsvpEnabled` | `FEATURE_FRANCE_RSVP_ENABLED` | false |

---

## Execution Order

1. **Phase 1** — foundation, everything depends on it ✅
2. **Phase 2** — endpoints + Event Catalog setup (depends on Phase 1 for auth) ✅
3. **Phase 3** — dynamic forms (depends on Phase 2 for endpoints + events) ⏳ NEXT
4. **Phase 4** — Notion-driven display (depends on Phase 2 for event data) ⏳

Each phase gets its own branch and PR.

---

## Future Enhancements (Post-MVP)

### Email Confirmation System

**Goal:** Send email confirmations when guests submit RSVPs, and capture email addresses if not already on file.

**Requirements:**
1. **Email capture in RSVP form**
   - If guest record lacks `Guest Email` property in Notion, show email input field
   - Validate email format client-side and server-side
   - Save email to Guest List database when RSVP is submitted

2. **Resend integration**
   - Use existing Resend account (for save-the-dates)
   - Create RSVP confirmation email template
   - Include: guest name, event details, attendance summary, dietary notes, optional events selected
   - Add "Update RSVP" link back to the website

3. **Email sending logic**
   - Send on initial RSVP submission (not on updates, or include "This is an update" note)
   - Handle Resend API errors gracefully (log, don't block RSVP submission)
   - Add `RESEND_API_KEY` to Netlify environment variables

4. **Testing**
   - Test with real email addresses in local dev
   - Verify email delivery in Netlify preview deploys
   - Add Playwright tests for email field validation

**Implementation notes:**
- Add to Phase 3 or create separate Phase 5
- Requires `resend` npm package
- Email template can be HTML or plain text (prefer HTML with plain text fallback)
- Consider rate limiting if concerned about spam (unlikely for wedding RSVPs)
