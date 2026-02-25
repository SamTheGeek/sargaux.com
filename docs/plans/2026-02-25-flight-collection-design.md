# F-013: Guest Flight Collection & Flighty Sync

## Context

Guests traveling to the NYC (Oct 11, 2026) and France (May 28-30, 2027) weddings need to coordinate arrivals and departures. Sam wants to track all guest flights in real time using the Flighty app on his Mac Mini — especially critical for France, where guests are arriving from various countries for a multi-day weekend event.

This feature adds flight collection to the RSVP flow (and as a standalone updatable page), stores flight data in Notion, and automates daily syncing of new/updated flights into Flighty via AppleScript UI scripting on the Mac Mini.

---

## Architecture

Three components:

1. **Web** — Optional flight section in RSVP form + standalone `/travel` page (event-agnostic, one page for all events guest is invited to)
2. **Notion** — New "Guest Flights" database (separate from RSVP Responses) for clean automation queries
3. **Mac Mini script** — Daily TypeScript cron job that reads unsynced flights from Notion and drives Flighty via AppleScript (`osascript` + System Events UI scripting)

---

## Notion Data Model

### New Database: Guest Flights

| Property | Type | Notes |
|---|---|---|
| `Title` | Formula (title) | `"{Guest} — {Type} — {Event}"` |
| `Guest` | Relation → Guest List | Who this flight belongs to |
| `Event` | Select: NYC, France | Which wedding |
| `Type` | Select: Arrival, Departure | Which leg |
| `Airline` | Rich Text | e.g. "Air France" or "AA" |
| `Flight Number` | Rich Text | e.g. "AF 007" or "AA 123" |
| `Date` | Date | Flight date (no time required — Flighty looks it up) |
| `Flighty Synced` | Checkbox | false until Mac Mini script processes |
| `Last Updated` | Last Edited Time | Auto; triggers re-sync on update |

**New env var**: `NOTION_GUEST_FLIGHTS_DB` — data source ID for this database.

---

## Web: Flight Collection

### RSVP Form (`/nyc/rsvp`, `/france/rsvp`)

Add an optional "Travel Details" section after attendance confirmation, visible only for attending guests:

- Arrival: Airline, Flight Number, Date
- Departure: Airline, Flight Number, Date
- Note: *"Not sure yet? You can add or update your travel info anytime at your travel page."*

Flight data is written to the Guest Flights database on submit, as a separate parallel write (does not affect the RSVP response itself).

### Standalone Travel Page (`/travel`)

- Single event-agnostic page at `/travel`
- Protected route (existing auth middleware)
- Shows one section per event the guest is invited to (NYC, France, or both)
- Pre-populated from Guest Flights database
- On submit: upserts arrival + departure records; resets `Flighty Synced = false` for updated records
- Linked from RSVP confirmation email: *"Add your flight details →"*

### New API Endpoint: `/api/flights`

- `GET ?event=nyc|france` — fetch existing flights for the logged-in guest
- `POST` — upsert arrival + departure records; resets `Flighty Synced = false` on update

### New Notion functions in `src/lib/notion.ts`

- `getGuestFlights(guestId, event)` — fetch flight records for pre-fill
- `upsertGuestFlights(guestId, event, flights)` — create or update arrival/departure records

---

## Mac Mini Automation

### Script: `scripts/sync-flighty.ts`

Follows the same pattern as `scripts/sync-contacts.ts`.

**Logic:**
1. Fetch all Guest Flights rows where `Flighty Synced = false`
2. Also re-fetch rows where `Last Updated` > last successful run timestamp (stored in a local `scripts/.flighty-sync-state.json`)
3. For each flight: run `osascript` to drive Flighty's macOS UI via System Events:
   - Open Flighty / bring to foreground
   - Navigate to Friends' Flights tab
   - Tap "+" to add new friend's flight
   - Enter airline + flight number + date
   - Save
4. If the flight was previously synced (update scenario): first attempt to find and remove the old flight number in Flighty before adding the updated one. Log a warning if removal fails (requires manual cleanup), but still add the new entry.
5. On success: mark `Flighty Synced = true` in Notion
6. On failure: log error, leave `Flighty Synced = false` for retry next run

**`DRY_RUN=true` mode**: logs all actions without touching Flighty. Use this to verify the Notion query before running live.

**Required env vars:**
- `NOTION_API_KEY`
- `NOTION_GUEST_FLIGHTS_DB`

### AppleScript (`scripts/add-flighty-friend.applescript`)

Separate AppleScript file invoked per flight. Uses `tell application "System Events" to tell process "Flighty"` (UI scripting). Exact button names/UI paths must be verified against the installed Flighty macOS version before deployment.

Parameters passed as positional argv: `airline flightNumber date`

### Scheduling: `launchd`

File: `scripts/com.sargaux.sync-flighty.plist`

```xml
<!-- runs daily at 08:00 local time on Mac Mini -->
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key><integer>8</integer>
  <key>Minute</key><integer>0</integer>
</dict>
```

Setup instructions in `scripts/README.md`: `launchctl load ~/Library/LaunchAgents/com.sargaux.sync-flighty.plist`

---

## Feature Flags

Following the 4-step checklist in CLAUDE.md:

| Flag | Env Var | Default |
|---|---|---|
| `nyc.flightCollection` | `FEATURE_NYC_FLIGHT_COLLECTION` | false |
| `france.flightCollection` | `FEATURE_FRANCE_FLIGHT_COLLECTION` | false |

Add both to `netlify.toml` `[context.deploy-preview.environment]`.

---

## Milestone & Versioning

**Feature ID**: F-013
**Milestone**: M5.5 — between NYC launch (M5, Oct 2026) and France RSVP open (~Feb 2027)
**Target**: January 2027
**Rationale**: France is the essential use case. Feature must be live before France RSVPs open so guests can enter flights as they book.

Version bump: **minor** (0.x.0) on completion, as this completes a full new feature epic.

---

## Implementation Plan (phases)

### Phase 1: Notion Setup & Secrets Bootstrap
- Create Guest Flights database in Notion with schema above
- Print the new database's data source ID (from the Notion URL or API) — **Sam must add this to the Notion integration's "Connections" in Notion settings so the API key has access**
- Bootstrap `NOTION_GUEST_FLIGHTS_DB` everywhere it's needed:
  - Append to local `.env` file: `NOTION_GUEST_FLIGHTS_DB=<value>`
  - Add to GitHub Secrets: `gh secret set NOTION_GUEST_FLIGHTS_DB`
  - Add to Netlify environment: `netlify env:set NOTION_GUEST_FLIGHTS_DB <value> --context production` and `--context deploy-preview`
  - Print the value clearly so Sam can copy it into the Notion API integration's "Connections" page
- Add `NOTION_GUEST_FLIGHTS_DB` to env types (`src/env.d.ts`)
- Add `getGuestFlights()` and `upsertGuestFlights()` to `src/lib/notion.ts`

### Phase 2: Feature Flags
- Add `nyc.flightCollection` and `france.flightCollection` to `src/config/features.ts` and `src/env.d.ts`
- Add to `netlify.toml` preview environment

### Phase 3: API Endpoint
- Create `src/pages/api/flights.ts` (GET + POST)
- Add flight types to new `src/types/flight.ts`
- Tests: new flight API tests in `tests/flights.spec.ts`

### Phase 4: RSVP Form Integration
- Add optional Travel Details section to RSVP form components (NYC + France)
- Only visible when `flightCollection` flag is enabled for the event

### Phase 5: Standalone `/travel` Page
- Create `src/pages/travel.astro` (protected, event-agnostic)
- Pre-populates from Guest Flights via GET `/api/flights`
- Update RSVP confirmation email template to include travel page CTA link

### Phase 6: Mac Mini Script
- `scripts/sync-flighty.ts` — Notion query + state management
- `scripts/add-flighty-friend.applescript` — UI automation (requires manual verification against installed Flighty version)
- `scripts/com.sargaux.sync-flighty.plist` — launchd configuration
- `scripts/README.md` — Mac Mini setup instructions

---

## Verification

**Web + API:**
- Enable `FEATURE_FRANCE_FLIGHT_COLLECTION=true` locally
- Log in as a France guest
- Submit RSVP with flight details → verify Guest Flights rows created in Notion
- Visit `/travel` → verify pre-populated with submitted flights
- Update flight on `/travel` → verify `Flighty Synced` reset to false in Notion

**Mac Mini script:**
- `DRY_RUN=true npx tsx scripts/sync-flighty.ts` → verify correct flights logged
- Run live against Flighty on Mac Mini → verify flights appear in Friends' Flights section
- Update a flight on website → re-run script → verify old flight removed and new one added

**Automated tests:**
- Add to `tests/flights.spec.ts`: GET/POST `/api/flights` with auth, without auth (expect redirect), with invalid event
- Ensure existing test suite still passes: `npm run verify`

---

## Critical Files

| File | Role |
|---|---|
| `src/lib/notion.ts` | Add `getGuestFlights()`, `upsertGuestFlights()` |
| `src/pages/api/flights.ts` | New API endpoint (create) |
| `src/pages/travel.astro` | New standalone travel page (create) |
| `src/types/flight.ts` | New flight type definitions (create) |
| `src/config/features.ts` | Add two new flags |
| `src/env.d.ts` | Add flag env vars + `NOTION_GUEST_FLIGHTS_DB` |
| `netlify.toml` | Add flags to deploy-preview environment |
| `src/lib/email-templates.ts` | Add travel CTA to RSVP confirmation |
| `scripts/sync-flighty.ts` | Mac Mini automation script (create) |
| `scripts/add-flighty-friend.applescript` | Flighty UI scripting (create) |
| `scripts/com.sargaux.sync-flighty.plist` | launchd plist (create) |
| `scripts/README.md` | Mac Mini setup docs (create or extend) |
| `package.json` | Add `sync:flighty` npm script; bump minor version |
| `docs/feature plan.md` | Add F-013 entry |
