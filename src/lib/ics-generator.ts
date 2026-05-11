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
