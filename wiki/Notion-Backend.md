# Notion Backend

Notion is the system of record for guest data and event details. The site fetches most of it at build time and does targeted runtime lookups/writes for login and RSVP.

## Data model

Three Notion databases (data source IDs stored as env vars — see [Guest Privacy & Security](Guest-Privacy-And-Security)):

### Guest List

Key properties: `Full Name` (formula), `Related Guests` (relation — used for household grouping), `+1` (checkbox), `RSVP` (status: Attending / Declined / Partial), `Country`, `Group`, `Guest Of`, `Meal Preference`, `Guest Email`, `Events Attending` (relation → Event Catalog, reverse of `Guests Attending`), `Dietary Needs`, `Last RSVP` (date), `Envelope Names` (rich text, see [Authentication & Sessions](Authentication-And-Sessions)), invite-status fields (`NYC Invite Sent`, `France Save the Date Sent`), `Event Invitations` (multi-select: `NYC`, `France` — drives auth routing).

**`Events Invited` (the old relation to Event Catalog) is deprecated** — never read it. The RSVP form lists the full Event Catalog for each wedding filtered by the guest's `Event Invitations` multi-select.

### Event Catalog

One page per event (e.g. "Dinner", "Dancing", "Friday Welcome Dinner", "Saturday Ceremony & Reception"). Properties: `Event Name` (title), `Day` (relation → Wedding Timeline), `Event Type` (`Core`/`Optional`), `Wedding` (`NYC`/`France`), `Time`, `Location`, `Description`, `Event Date`, `Show on Website` (checkbox), `Guests Invited` (relation → Guest List, bidirectional with the deprecated `Events Invited`). Optional French display fields: `Event Name FR`, `Time FR`, `Location FR`, `Description FR` — see [Localization (i18n)](Localization-i18n).

"Dinner & Dancing" is split into two separate events specifically so Dancing can be offered as a standalone digital-invite add-on.

### RSVP Responses

**Party-level, not per-guest**: one row per party + event, with the `Guest` relation set to every party member. Pre-fill matches responses related to any member, so a partner returning to update the RSVP sees the submitted state instead of a blank form; submission matches the existing row via any member so updates converge on one row rather than forking.

## Caching layers (`src/lib/notion.ts`)

Layered lookup: in-memory → Netlify Blobs (`guest-cache` store, 15-minute TTL) → targeted Notion fetches.

- `getGuestById` / `getGuestParty` / `getGuestEvents` / `submitRSVP` never trigger a full guest-list scan — only `fetchAllGuests` does (login fallback, `/api/warm`, admin/scheduled jobs), and it persists the result to the blob for other instances.
- `clearGuestCache()` deletes the blob too.
- A login miss on a cached list falls through to a live title-filter query, so newly added guests can always log in even mid-TTL.

This caching pass (part of the [Astro 7 upgrade](Architecture-Overview)) dropped the local Playwright suite's runtime from ~1.4 minutes to ~30 seconds as a side effect.

## Guest List write-back on RSVP

`submitRSVP` writes one merged update to **every party member's** Guest List row after each submission, then calls `clearGuestCache()` so reads don't lag the 15-minute cache:

1. **`RSVP` status** — resolved from personal attendance across the latest response per invited event: all attending → Attending, none → Declined, mixed → Partial.
2. The submitted event's invite status (`NYC Invite Sent` / `France Save the Date Sent`) → `Received`, advance-forward only.
3. `Last RSVP` date.
4. `Events Attending` relation → the specific Event Catalog pages they're attending.
5. `Dietary Needs` text (party-level).

Attendance for the submitted event resolves by **member page ID** (not name), so a name edit doesn't misresolve it; other events still resolve by name against the stored row.

## RSVP name persistence

The RSVP form threads each member's page ID via `data-guest-id` on their row, so an edited `guest-name` input persists correctly. If a submitted entry's `guestId` maps to a party member whose typed name differs, `submitRSVP` writes `First Name`/`Last Name` (last whitespace-delimited token as surname — it drives the `Full Name` login formula) and the `Name of Guest` title. The API validates a `guestId`-bearing entry against the party roster by ID (allowing the rename) and caps names at a max length; entries without a `guestId` keep the legacy name-in-roster check. If the *authenticated* guest renames themselves, the RSVP POST handler re-signs the session cookie with the refreshed canonical name so session binding doesn't 401 on the next request.

## Notion SDK version

Uses `@notionhq/client` v5.x targeting Notion API v2025-09-03. The key difference from older SDK versions: `dataSources.query()` replaces `databases.query()`, using `data_source_id` instead of `database_id`. See Notion's [upgrade guide](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03).

## Project history

See [Project History](Project-History) for the original Notion-integration plan (Feb 2026) that introduced this schema in four phases: foundation + auth, Event Catalog + RSVP endpoints, dynamic RSVP forms, and Notion-driven event display on landing/schedule pages.
