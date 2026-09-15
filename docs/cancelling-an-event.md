# Cancelling an event

How to take an Event Catalog event off the site and tell the guests who had
already said yes to it.

## The mechanism: `Show on Website`

Uncheck **`Show on Website`** on the event's Event Catalog row in Notion. That
is the whole kill switch.

`parseEventPage` (`src/lib/notion.ts`) drops unchecked rows, and every surface
reads its events through `getEventCatalog`, so one checkbox removes the event
from all of them at once:

- the NYC and France RSVP forms (`src/pages/{nyc,france}/rsvp.astro`)
- the post-submission confirmation pages (`.../rsvp/confirmed.astro`)
- the RSVP confirmation email (`POST /api/rsvp` builds its event lists from the
  same catalog)
- every guest's personalized ICS feed — `getAttendingEvents` and `refreshAllICS`
  resolve stored event IDs *against the catalog*, so a cancelled event falls out
  of calendars on the next refresh

The filter lives in `parseEventPage` rather than at each consumer on purpose:
there are five consumers, and forgetting one would leave a cancelled event live
on that surface.

**Do not delete the Notion page.** The page ID is referenced by guests' stored
responses (`eventsAttending` in the response's Details JSON) and by the Guest
List `Events Attending` relation. Unchecking the box is the only "cancel" that
keeps those pointers valid. It is also instantly reversible — re-check the box
and the event comes back.

### What happens to RSVPs that already named the event

Nothing needs cleaning up. Stale IDs are inert:

- Every reader filters through the catalog, so an ID with no catalog row is
  simply skipped.
- A guest who resubmits writes an `eventsAttending` list built from the form
  they were just shown, so the stale ID drops out of their Guest List
  `Events Attending` relation at that point. Guests who never resubmit keep a
  stale relation entry, which nothing reads for display.

### Making it take effect

Two caches sit in front of this:

1. The in-memory event catalog cache — 15 minutes (`EVENT_CATALOG_TTL_MS`).
2. Guests' stored ICS calendars, which only change when regenerated.

```bash
# Rebuild every guest's calendar and invalidate the CDN-cached .ics URLs
curl -X POST https://sargaux.com/api/admin/refresh-calendars \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep '^RESEND_ADMIN_SECRET' .env.local | cut -d= -f2-)"
```

Content pages are CDN-cached per guest, so give it the `maxAge` from
`routeRules` (or hit `GET /api/warm`) before checking a page by eye.

## Empty states

Cancelling every optional event for a wedding is a supported state, not an edge
case:

- **NYC** (`nyc/rsvp.astro`, `nyc/rsvp/confirmed.astro`) — the optional-events
  band and section are wrapped in `{optionalEvents.length > 0 && ...}`, so the
  heading disappears with the list rather than leaving an empty section.
- **France** (`france/rsvp.astro`) — renders a placeholder note
  (`data-testid="no-optional-events"`) instead, since France's optional
  excursion is expected to come back.
- **Core events** — an empty core list renders
  `strings.{nyc,france}.rsvp.form.coreEvents.empty`.
- **A wedding with no events at all** — `POST /api/rsvp` guards its
  "no events selected means decline" normalization on `invitedEventIds.size > 0`,
  so an empty catalog cannot mass-decline a party.
- **The form script** (`src/scripts/rsvp-form.ts`) reads whatever
  `select.event-attending` elements exist and guards `allEventsDeclined()` on
  `eventSelects.length > 0`, so zero events is inert rather than a decline.

`tests/event-catalog-unit.spec.ts` covers the filter, including the
all-optional-events-cancelled case.

## Telling the guests who said yes

`scripts/list-event-attendees.ts` resolves the recipient list. It reads only —
it never writes to Notion and never sends mail.

```bash
# find the event (cancelled events are listed too)
npx tsx scripts/list-event-attendees.ts --list

# who said yes?
npx tsx scripts/list-event-attendees.ts --event "Brooklyn Museum"

# several at once — also reports the overlap between the lists
npx tsx scripts/list-event-attendees.ts --event "Bike Ride" --event "Brooklyn Museum"
```

Two things it does that a Notion filter would not:

1. **It reads cancelled events.** `getEventCatalog` hides them, which would make
   the guests affected by a cancellation unreachable. The script queries the
   Event Catalog directly and includes hidden rows.
2. **It resolves attendance through `memberAttendedResponse`** — the same single
   decision the calendar feeds and the Guest List write-back use: recorded
   per-member attendance, then response `Status` against the `Guest` relation,
   and only then attendee names. A party-level response says the *party* is
   attending; it does not by itself say every member on it attended. Name-only
   matching silently drops guests whose stored name has drifted from the one
   they submitted under.

   The Guest List `Events Attending` relation is an easier read but it is a
   derived write-back that only refreshes when a party resubmits, so the stored
   responses are what the script reads.

It prints a `guestIds` array and the `curl` that mails them, and writes a full
report (names and emails) to `scripts/output/`, which is gitignored and must
stay that way.

### Sending

`POST /api/admin/send-email` with the `reminder-general` template. The endpoint
fills `guestName` per recipient; you supply `subject` and `body`.

```bash
curl -X POST https://sargaux.com/api/admin/send-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep '^RESEND_ADMIN_SECRET' .env.local | cut -d= -f2-)" \
  -d '{
    "templateId": "reminder-general",
    "guestIds": ["<paste from the script>"],
    "templateData": { "subject": "...", "body": "..." }
  }'
```

Send a one-recipient test first — same command with a single `guestId` — and
read the result before the real run.

Things worth knowing before you fire it:

- **Always send `Content-Type: application/json`.** Astro's CSRF check rejects a
  POST without it before routing, so you get a confusing error even for a valid
  endpoint.
- **Don't read the secret with `netlify env:get`** — it is write-only and the CLI
  returns a placeholder the endpoint rejects with a 401. Use `.env.local`.
- **One email per guest.** A household sharing an address gets one message per
  person at it; the script flags shared addresses so this is a decision rather
  than a surprise.
- **Guests with no email are skipped silently** by `sendToGuests`. The script
  lists them by name so they can be told another way.
- Test guests (🤖) are dropped by both the script and the endpoint.
- The response is `{ sent, failed, noEmail, unknownIds }`. `{ skipped: true }`
  means `FEATURE_GLOBAL_EMAIL_ENABLED` is off for that deploy.
