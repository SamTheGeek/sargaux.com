import { getAttendingEvents, getGuestById, fetchAllGuests, fetchAllLatestRSVPs, getEventCatalog } from './notion';
import { memberAttendedResponse } from './rsvp-attendance';
import { buildICS } from './calendar';
import { setICS } from './ics-store';
import { getDefaultLocale } from './locale-routing';
import { excludeTestGuests, isTestGuest } from './test-guests';
import type { EventRecord, RSVPResponse } from '../types';

/**
 * Generate and store an ICS file for a single guest. Returns the ICS content
 * so on-demand callers (the subscription endpoint's blob-miss fallback) can
 * serve it without a second blob read.
 *
 * The calendar contains only the events the guest has RSVP'd to attend
 * (latest non-declined response per wedding) — never the full invitation.
 * Guests who have not RSVP'd get a valid empty calendar.
 * The calendar language follows the guest's locale (Country → locale rule,
 * same as the login default) since subscription feeds are polled without a
 * session.
 * Used by the RSVP trigger, which passes the response it just wrote as
 * `justSubmitted` — Notion's query index can lag a fresh write, so
 * re-querying immediately after submit can regenerate the calendar from the
 * *previous* answer.
 */
export async function generateAndStoreICSForGuest(
  guestId: string,
  justSubmitted?: RSVPResponse
): Promise<string> {
  const [events, guest] = await Promise.all([
    getAttendingEvents(guestId, justSubmitted),
    getGuestById(guestId),
  ]);
  const ics = buildICS(events, getDefaultLocale(guest?.country));
  await setICS(guestId, ics);
  return ics;
}

/**
 * Full refresh: regenerate ICS for all guests.
 * Used by scheduled functions.
 *
 * Makes a bounded number of Notion calls regardless of guest count:
 * - fetchAllGuests(): 2–3 paginated queries
 * - getEventCatalog('nyc') + getEventCatalog('france'): 2–4 queries
 * - fetchAllLatestRSVPs(): 1+ paginated queries over the RSVP Responses DB
 * - No per-guest Notion calls
 *
 * Returns a summary { total, succeeded, failed }.
 */
export async function refreshAllICS(): Promise<{ total: number; succeeded: number; failed: number }> {
  // 1. Fetch all guests — always cold in a Netlify Function invocation
  const guests = await fetchAllGuests();
  const productionGuests = excludeTestGuests(guests);

  // 2. Fetch event catalog for both weddings + latest RSVP per guest/event
  const [nycEvents, franceEvents, latestRSVPs] = await Promise.all([
    getEventCatalog('nyc'),
    getEventCatalog('france'),
    fetchAllLatestRSVPs(),
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
      const attendingIds = new Set(
        (latestRSVPs.get(guest.id) ?? [])
          // Recorded attendance, then Status, then names — see
          // src/lib/rsvp-attendance.ts. Name-only matching emptied the calendar
          // of any guest whose stored name had drifted from their response.
          .filter((rsvp) => memberAttendedResponse(rsvp, guest))
          .flatMap((rsvp) => rsvp.eventsAttending ?? [])
      );

      const guestEvents: EventRecord[] = Array.from(attendingIds)
        .map((id) => eventMap.get(id))
        .filter((e): e is EventRecord => e !== undefined);

      const ics = buildICS(guestEvents, getDefaultLocale(guest.country));
      await setICS(guest.id, ics);
      if (!isTestGuest(guest)) succeeded++;
    } catch (err) {
      console.error(`[ics-refresh] Failed for guest ${guest.id}:`, err);
      if (!isTestGuest(guest)) failed++;
    }
  }

  return { total: productionGuests.length, succeeded, failed };
}
