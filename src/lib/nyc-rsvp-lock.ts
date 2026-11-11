/**
 * The NYC post-event RSVP lock (`features.nyc.rsvpLocked`).
 *
 * Once the event has happened, RSVPs are read-only: the form is gone, the API
 * refuses NYC submissions, and the header RSVP button becomes a link to the
 * guest's saved confirmation — shown only to parties that have one.
 *
 * Server-only (reads Notion).
 */
import { features } from '../config/features';
import { getGuestParty, getLatestRSVPForParty } from './notion';

export const NYC_RSVP_FORM_PATH = '/nyc/rsvp';
export const NYC_RSVP_CONFIRMED_PATH = '/nyc/rsvp/confirmed';

// Nothing can write an NYC response while the lock is on, so a party's answer
// can't change under this cache; the TTL only bounds staleness from edits made
// directly in Notion. Only consulted while locked.
const CACHE_TTL_MS = 15 * 60 * 1000;
const onRecordCache = new Map<string, { value: boolean; expires: number }>();

/** True when this guest's party has an NYC response (attending or declined). */
export async function partyHasNycRsvp(guestId: string): Promise<boolean> {
  const cached = onRecordCache.get(guestId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const party = await getGuestParty(guestId);
  const ids = party.length > 0 ? party.map((member) => member.id) : [guestId];
  const value = (await getLatestRSVPForParty(ids, 'nyc')) !== null;
  onRecordCache.set(guestId, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

/**
 * Where the NYC header RSVP button points, or null to hide it.
 *
 * Unlocked: always the form. Locked: the confirmation page, but only for a
 * party with a response on record. A failed lookup still shows the link —
 * the confirmation page reports load errors itself, and a hidden button would
 * otherwise be frozen into the CDN-cached page for the whole cache window.
 */
export async function nycRsvpButtonHref(guestId: string | undefined): Promise<string | null> {
  if (!features.nyc.rsvpLocked) return NYC_RSVP_FORM_PATH;
  if (!guestId) return null;
  try {
    return (await partyHasNycRsvp(guestId)) ? NYC_RSVP_CONFIRMED_PATH : null;
  } catch (error) {
    console.error('NYC RSVP lookup for header button failed:', error);
    return NYC_RSVP_CONFIRMED_PATH;
  }
}
