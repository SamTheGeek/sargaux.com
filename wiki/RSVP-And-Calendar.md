# RSVP & Calendar

## RSVP flow

Guests log in, see a form pre-filled with their party (via the Guest List `Related Guests` relation) and only the events they're invited to (via `Event Invitations` + the Event Catalog), and submit. See [Notion Backend](Notion-Backend) for the underlying data model and write-back behavior, and [Testing Guide](Testing-Guide) for how to safely test RSVP writes without touching real guest data.

- Full guest party appears in the RSVP form; +1 guests are shown with a dashed border, editable name, unchecked by default.
- Re-submissions **replace** the previous response (overwrite, not append) — one row per party per event.
- Core events are shown as pre-checked info; optional events are checkboxes, limited to the ones that guest is invited to.
- Event-specific sections vary: France adds accommodation/allergen/transport fields, NYC adds a song request.
- `POST /api/rsvp` validates auth, upserts the response, updates the Guest List write-back fields, and (see below) regenerates the guest's calendar.
- `DELETE /api/rsvp` (archives the Notion page) exists for test cleanup — gated by `global.rsvpDeleteEnabled` or an admin Bearer token.

### RSVP feature flags

`nyc.rsvpEnabled` / `france.rsvpEnabled` gate the dynamic form per event, following the standard [feature-flag checklist](Feature-Flags).

## Calendar subscriptions

Guests can subscribe to a personalized `.ics` calendar feed (`webcal://sargaux.com/api/calendar/[token].ics`) from their event landing page, showing only the events they're attending. This shipped in two stages.

### Stage 1 — live Notion query (Feb 2026, F-004)

The original design: a token embeds the guest's Notion page ID, since calendar apps don't send session cookies when polling a subscribed URL.

**Token format**: `base64url(guestId).hmac-sha256(CALENDAR_HMAC_SECRET, guestId)[:32 hex chars]`. The server splits on `.`, decodes the guest ID, recomputes the HMAC, and compares — O(1), no guest-list scan. Tokens are stable for a guest's lifetime. **Rotating `CALENDAR_HMAC_SECRET` breaks every existing calendar link** — treat it like a permanent credential.

On each poll, the endpoint called Notion live: verify token → `getGuestEvents(guestId)` → resolve each event's date → build an RFC 5545 ICS response (`Content-Type: text/calendar`). Key ICS decisions: `UID = {eventId}@sargaux.com` (stable across rebuilds), `DTEND = DTSTART + 2 hours` when Notion has no end time, timezone `America/New_York` for NYC / `Europe/Paris` for France, and an invited-but-dateless event still appears as an all-day `VALUE=DATE` entry.

### Stage 2 — pre-generated blobs (May 2026 refactor)

**The problem**: calendar apps (especially iOS) poll every few hours; if a cold-start Notion round-trip pushed the response past ~5 seconds, iOS would silently drop the subscription until the URL responded quickly again.

**The fix**: pre-generate an `.ics` file per guest (keyed by their stable Notion page ID) and store it in Netlify Blobs (site-scoped store `"ics"`, persistent across deploys). The endpoint became a pure read path: token verify → blob lookup → serve directly, **no Notion calls on poll ever**. A redirect-to-CDN-URL approach was considered and rejected — Netlify Blobs CDN URLs aren't guaranteed stable, iOS is known to cache redirect destinations and poll them directly forever after, and it would cost two round trips instead of one.

**Regeneration triggers** (three paths write/update blobs; the endpoint itself never does):

1. **On RSVP** — awaited (not fire-and-forget, since Netlify terminates the function once the response is sent) regeneration for every party member.
2. **Weekly scheduled function** (`ics-refresh-weekly`, Sundays 03:00 UTC) — full refresh of all guests, every week.
3. **Daily scheduled function** (`ics-refresh-daily`, 03:00 UTC) — full refresh, but only inside the pre-wedding windows (Sep 27–Oct 13 2026 for NYC, May 14–May 31 2027 for France); exits immediately outside those windows.

If a blob is missing, the endpoint returns 503 (calendar apps retry) rather than falling back to Notion — the scheduled jobs are the backstop, and since the URL is never surfaced before a guest RSVPs, the gap is rare in practice. Neither scheduled function is invoked over HTTP in production; **`POST /api/admin/refresh-calendars`** exists specifically for on-demand refreshes (see [Admin Endpoints](Admin-Endpoints)).

Bulk refresh is cheap (~6–8 Notion calls total for every guest): fetch all guests once, fetch both event catalogs once, build an in-memory event map, then loop guests purely in-memory to build and store each ICS.

### Personalized calendars only include events the guest RSVP'd to attend

The ICS contains only events a guest has RSVP'd to attend (latest non-declined response per wedding, and only if they're named in that event's attendee list) — guests who haven't RSVP'd yet get a valid, empty calendar.

### i18n

Personalized ICS calendars are generated in the guest's locale (derived from their `Country`, the same rule that seeds the login language cookie): SUMMARY/DESCRIPTION/LOCATION are localized; DTSTART/DTEND always come from the canonical (language-neutral) date/time fields. See [Localization (i18n)](Localization-i18n).

### Verifying calendar behavior

CDN/Blobs behavior can't be exercised locally:

- `GET /api/calendar/health` → `{ ok: true }` confirms `CALENDAR_HMAC_SECRET` is live without needing a real token.
- Submitting a test RSVP should write a blob (check the Netlify dashboard).
- Subscribing via `webcal://` should return a fast 200 with valid ICS; subsequent polls should be fast (no Notion call).
- Changing an event in Notion should propagate after the next scheduled run (or via the admin endpoint).

**Calendar subscription URLs are capability secrets**: anyone with the link can read that guest's attending schedule, and the token prefix is a decodable Notion page ID — avoid forwarding calendar links in group chats.
