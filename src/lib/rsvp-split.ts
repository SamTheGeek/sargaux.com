/**
 * Splitting a shared RSVP response when a household is split apart.
 *
 * RSVP responses are party-level: one row per party + event, related to every
 * member (see CLAUDE.md → Party-level RSVP responses). A household can be split
 * *after* it has already responded — people invited together are deliberately
 * separated into their own `Related Guests` groups when they should RSVP
 * separately, and that edit lands in Notion long after the invitation went out.
 * Grown children invited on their parents' envelope are the usual case: they may
 * well attend a different subset of the weekend than their parents.
 *
 * That leaves a stale row related to more people than any current party. Left
 * alone, the next submission from either side finds it — `getLatestRSVPForParty`
 * matches on ANY member — and `submitRSVP` overwrites it in place, so one
 * household's answer silently replaces the other's and the losing side drops out
 * of the relation entirely.
 *
 * The repair is lazy and happens on submit: detach the submitting party from the
 * old row, leaving it to whoever remains, and give the submitting party a row of
 * its own. Both sides converge on separate rows as each one responds.
 */

import { normalize } from './normalize';

export type RSVPStatus = 'Attending' | 'Declined' | 'Partial';

/**
 * The members of an existing response who are not in the submitting party —
 * i.e. everyone the response should be left to once this party detaches.
 * Empty when the response covers exactly this party, which is the normal case
 * and means the row can be updated in place as before.
 */
export function strandedGuestIds(
  existingGuestIds: readonly string[],
  partyIds: readonly string[]
): string[] {
  const inParty = new Set(partyIds);
  return Array.from(new Set(existingGuestIds)).filter((id) => !inParty.has(id));
}

/**
 * Rebuild the attendee list and status a shared response should carry once the
 * submitting party is removed from it.
 *
 * Attendance is re-derived from the stranded members themselves rather than by
 * subtracting names from the old string: responses only ever list attendees, so
 * a member still named in the old list was attending and one absent from it was
 * not. Rebuilding this way also drops any duplicate or unrecognised name the old
 * row had accumulated.
 *
 * Returns null when there is nobody left to strand, which the caller treats as
 * "nothing to rewrite".
 */
export function planDetachedResponse(
  stranded: readonly { name: string; normalizedName: string }[],
  previousGuestsAttending: string
): { guestsAttending: string; status: RSVPStatus } | null {
  if (stranded.length === 0) return null;

  const wasAttending = new Set(
    previousGuestsAttending
      .split(',')
      .map((name) => normalize(name))
      .filter(Boolean)
  );

  const stillAttending = stranded.filter((member) =>
    wasAttending.has(member.normalizedName)
  );

  return {
    guestsAttending: stillAttending.map((member) => member.name).join(', '),
    status:
      stillAttending.length === 0
        ? 'Declined'
        : stillAttending.length === stranded.length
          ? 'Attending'
          : 'Partial',
  };
}
