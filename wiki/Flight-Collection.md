# Flight Collection (F-013)

## Context

Guests traveling to NYC (Oct 11, 2026) and France (May 28–30, 2027) need arrival/departure coordination — especially for France, where guests arrive from various countries for a multi-day weekend. This feature adds flight collection to the RSVP flow (and a standalone updatable page), stores flight data in Notion, and automates daily syncing of new/updated flights into the **Flighty** app on a Mac Mini via AppleScript UI scripting, so Sam can track all guest flights in real time.

## Architecture

Three components:

1. **Web** — an optional flight section in the RSVP form, plus a standalone `/travel` page (event-agnostic, one page covering every event the guest is invited to).
2. **Notion** — a new **Guest Flights** database, separate from RSVP Responses, so automation queries stay clean.
3. **Mac Mini script** — a daily job that reads unsynced flights from Notion and drives Flighty via `osascript`/System Events UI scripting.

## Notion data model — Guest Flights

| Property | Type | Notes |
|---|---|---|
| `Title` | Formula | `"{Guest} — {Type} — {Event}"` |
| `Guest` | Relation → Guest List | |
| `Event` | Select: NYC, France | |
| `Type` | Select: Arrival, Departure | |
| `Airline` / `Flight Number` | Rich text | e.g. "Air France" / "AF 007" |
| `Date` | Date | Flighty looks up the rest |
| `Flighty Synced` | Checkbox | false until the Mac Mini script processes it |
| `Last Updated` | Last edited time | triggers re-sync on update |

New env var: `NOTION_GUEST_FLIGHTS_DB`.

## Web

- **RSVP form**: an optional "Travel Details" section (arrival/departure: airline, flight number, date) shown only to attending guests, written as a parallel record — it doesn't affect the RSVP response itself.
- **`/travel`** (protected route): one section per event the guest is invited to, pre-populated from Guest Flights. Submitting upserts arrival/departure records and resets `Flighty Synced = false` for anything changed. Linked from the RSVP confirmation email.
- **`/api/flights`**: `GET ?event=nyc|france` to fetch existing flights for the logged-in guest; `POST` to upsert.

## Mac Mini automation (`scripts/sync-flighty.ts`)

Follows the same pattern as `scripts/sync-contacts.ts`:

1. Fetch Guest Flights rows where `Flighty Synced = false`, plus rows updated since the last successful run (tracked in a local state file).
2. For each flight, run an AppleScript (`scripts/add-flighty-friend.applescript`) that drives Flighty's macOS UI: foreground the app, navigate to Friends' Flights, tap "+", enter airline/flight number/date, save.
3. On an update to a previously-synced flight: attempt to find and remove the old entry first (log a warning and continue if removal fails — requires manual cleanup), then add the new one.
4. On success, mark `Flighty Synced = true` in Notion; on failure, leave it false for retry on the next run.

`DRY_RUN=true` logs all actions without touching Flighty, for verifying the Notion query before a live run. Scheduled via `launchd` (`scripts/com.sargaux.sync-flighty.plist`) daily at 08:00 local time; the exact AppleScript button names/UI paths must be verified against the installed Flighty version before deployment, since UI scripting is inherently fragile to app updates.

## Feature flags

`nyc.flightCollection` / `france.flightCollection`, following the standard [feature-flag checklist](Feature-Flags).

## Milestone

F-013, targeted for M5.5 (between NYC launch and France RSVP opening) — France was the essential use case, since the feature needed to be live before France RSVPs opened so guests could enter flights as they booked.

## Verification

- Web: enable the flag locally, log in as a France guest, submit an RSVP with flight details, confirm Guest Flights rows in Notion, confirm `/travel` pre-populates and that editing resets `Flighty Synced`.
- Script: `DRY_RUN=true npx tsx scripts/sync-flighty.ts` against the Notion query first; then a live run against Flighty on the Mac Mini; then an update-and-re-run to confirm the old entry is removed and the new one added.
