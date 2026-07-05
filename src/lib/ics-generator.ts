import { fetchAllGuests, fetchAllRSVPs, getEventCatalog, getLatestRSVP } from './notion';
import { buildICS } from './calendar';
import { setICS } from './ics-store';
import type { EventRecord, GuestRecord, RSVPResponse, RSVPRecord } from '../types';

async function getEventCatalogMap(): Promise<Map<string, EventRecord>> {
  const [nycEvents, franceEvents] = await Promise.all([
    getEventCatalog('nyc'),
    getEventCatalog('france'),
  ]);
  const map = new Map<string, EventRecord>();
  for (const event of [...nycEvents, ...franceEvents]) map.set(event.id, event);
  return map;
}

/**
 * An event only belongs on a guest's personal calendar once they've
 * confirmed it: Core events follow the overall wedding RSVP, Optional
 * events require that specific event to be in eventsAttending.
 */
function isEventConfirmed(
  event: EventRecord,
  rsvp: { status: string; eventsAttending: string[] } | undefined
): boolean {
  if (!rsvp || rsvp.status === 'Declined') return false;
  if (event.type === 'Optional') return rsvp.eventsAttending.includes(event.id);
  return true;
}

function toConfirmedEvents(
  guest: GuestRecord,
  eventMap: Map<string, EventRecord>,
  rsvpsByWedding: Map<'nyc' | 'france', RSVPResponse | null>
): EventRecord[] {
  return guest.eventInvitedIds
    .map((id) => eventMap.get(id))
    .filter((e): e is EventRecord => e !== undefined)
    .filter((event) => {
      const rsvp = rsvpsByWedding.get(event.wedding);
      return isEventConfirmed(
        event,
        rsvp ? { status: rsvp.status, eventsAttending: rsvp.eventsAttending ?? [] } : undefined
      );
    });
}

/**
 * Regenerate and store ICS files for an entire RSVP party in one pass,
 * filtered to events each member has actually confirmed attending.
 *
 * Uses the in-memory guest cache and cached event catalog (both already
 * warm by the time this runs from the RSVP trigger), and looks up each
 * invited wedding's RSVP once for the whole party — not once per member —
 * instead of the per-guest, per-event Notion page retrievals this used to
 * do. That avoids an O(party size × invited events) burst of Notion calls
 * in the RSVP response's critical path.
 *
 * rsvpOwnerId is the guest whose Notion page ID the RSVP was submitted
 * under (the party's authenticated submitter) — a single RSVP covers the
 * whole party regardless of which member is generating a calendar.
 */
export async function generateICSForParty(party: GuestRecord[], rsvpOwnerId: string): Promise<void> {
  const eventMap = await getEventCatalogMap();

  const weddings = Array.from(
    new Set(
      party
        .flatMap((member) => member.eventInvitedIds.map((id) => eventMap.get(id)?.wedding))
        .filter((w): w is 'nyc' | 'france' => w !== undefined)
    )
  );

  const rsvpsByWedding = new Map<'nyc' | 'france', RSVPResponse | null>();
  await Promise.all(
    weddings.map(async (wedding) => {
      rsvpsByWedding.set(wedding, await getLatestRSVP(rsvpOwnerId, wedding));
    })
  );

  await Promise.all(
    party.map((member) => setICS(member.id, buildICS(toConfirmedEvents(member, eventMap, rsvpsByWedding))))
  );
}

/**
 * Full refresh: regenerate ICS for all guests, filtered to confirmed events.
 * Used by scheduled functions.
 *
 * Makes a handful of Notion calls total regardless of guest count:
 * - fetchAllGuests(): 2–3 paginated queries
 * - getEventCatalog('nyc') + getEventCatalog('france'): 2–4 queries
 * - fetchAllRSVPs(): 1–2 paginated queries
 * No per-guest Notion calls.
 *
 * Returns a summary { total, succeeded, failed }.
 */
export async function refreshAllICS(): Promise<{ total: number; succeeded: number; failed: number }> {
  const [guests, eventMap, rsvps] = await Promise.all([
    fetchAllGuests(),
    getEventCatalogMap(),
    fetchAllRSVPs(),
  ]);

  // Keep only the latest RSVP per (submitter guestId, wedding)
  const latestRSVPByKey = new Map<string, RSVPRecord>();
  for (const rsvp of rsvps) {
    const key = `${rsvp.guestId}|${rsvp.event}`;
    const existing = latestRSVPByKey.get(key);
    if (!existing || rsvp.submittedAt > existing.submittedAt) {
      latestRSVPByKey.set(key, rsvp);
    }
  }

  // A guest's RSVP may have been submitted under any party member's ID.
  function findRSVP(guest: GuestRecord, wedding: 'nyc' | 'france'): RSVPRecord | undefined {
    for (const candidateId of [guest.id, ...guest.relatedGuestIds]) {
      const rsvp = latestRSVPByKey.get(`${candidateId}|${wedding}`);
      if (rsvp) return rsvp;
    }
    return undefined;
  }

  let succeeded = 0;
  let failed = 0;

  for (const guest of guests) {
    try {
      const invitedEvents = guest.eventInvitedIds
        .map((id) => eventMap.get(id))
        .filter((e): e is EventRecord => e !== undefined);

      const confirmedEvents = invitedEvents.filter((event) =>
        isEventConfirmed(event, findRSVP(guest, event.wedding))
      );

      const ics = buildICS(confirmedEvents);
      await setICS(guest.id, ics);
      succeeded++;
    } catch (err) {
      console.error(`[ics-refresh] Failed for guest ${guest.id}:`, err);
      failed++;
    }
  }

  return { total: guests.length, succeeded, failed };
}
