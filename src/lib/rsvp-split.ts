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
 * `Status` decides the unanimous cases, and names are not consulted for them.
 * submitRSVP derives Status from the whole party, so 'Attending' means every
 * member on the relation came and 'Declined' means none did — which settles
 * every stranded member without reading a single name.
 *
 * That ordering is the correctness argument, not a shortcut. A stored Guest
 * List name can legitimately differ from the name a guest submitted under — a
 * maiden or married surname, an `Also Known As` form, a plus-one who was never
 * named (see src/lib/envelope-name.ts). Resolving by name alone would read that
 * drift as "this member wasn't attending", and unlike the read-only follow-up
 * export, the verdict here is *written back to Notion*: a whole household's
 * Attending row downgraded to Partial or Declined, with the drifted member
 * dropped from the attendee list. The row being rewritten belongs to the
 * household that did **not** just submit, so nobody is present to notice.
 * `resolveGuestRSVP` in scripts/lib/rsvp-followup.mjs leans on Status first for
 * exactly the same reason.
 *
 * Only 'Partial' needs the attendee list, because only there do members differ
 * from one another. Drift can still mis-assign an individual in that branch,
 * which nothing stored on the response can currently resolve. Rebuilding from
 * the stranded members also drops any duplicate or unrecognised name the old row
 * had accumulated.
 *
 * Returns null when there is nobody left to strand, which the caller treats as
 * "nothing to rewrite".
 */
export function planDetachedResponse(
  stranded: readonly { name: string; normalizedName: string }[],
  previous: { status: RSVPStatus; guestsAttending: string }
): { guestsAttending: string; status: RSVPStatus } | null {
  if (stranded.length === 0) return null;

  if (previous.status === 'Attending') {
    return {
      guestsAttending: stranded.map((member) => member.name).join(', '),
      status: 'Attending',
    };
  }
  if (previous.status === 'Declined') {
    return { guestsAttending: '', status: 'Declined' };
  }

  const wasAttending = new Set(
    previous.guestsAttending
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
