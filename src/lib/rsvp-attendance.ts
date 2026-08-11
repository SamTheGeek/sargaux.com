/**
 * Did this member attend, according to a stored response?
 *
 * One question, asked from four places — the personalized ICS calendar, the
 * Guest List status write-back, the `Events Attending` relation, and the split
 * planner — which each used to answer it their own way. Every one of those
 * answers is written back to Notion, so a wrong one is silent data loss rather
 * than a wrong pixel.
 *
 * The sources, most to least authoritative:
 *
 * 1. **`attendance` in the response's Details JSON** — per-member `{ guestId,
 *    attending }`, written by submitRSVP since this module existed. Exact, and
 *    immune to every naming problem below. Older rows predate it.
 * 2. **`Status` plus the `Guest` relation** — Status is derived from the whole
 *    party, so 'Attending' means every member on the relation came and
 *    'Declined' means none did. Settles a member without reading any name.
 * 3. **The `Guests Attending` name list** — only consulted for 'Partial', where
 *    members genuinely differ from one another, and for a member who isn't on
 *    the relation at all (a household that has changed shape since).
 *
 * Names are last for a reason. A stored Guest List name legitimately drifts from
 * the name a guest submitted under — a maiden or married surname, an `Also
 * Known As` form, a nickname typed into the form, a plus-one who was never
 * named (see src/lib/envelope-name.ts). Reading names first turns ordinary drift
 * into "this member wasn't attending", which then empties their calendar and
 * downgrades their Guest List status.
 */

import { normalize } from './normalize';

export type RSVPStatus = 'Attending' | 'Declined' | 'Partial';

/** The parts of a stored response this decision needs. */
export interface StoredAttendance {
  status: RSVPStatus;
  /** Every Guest List row the response relates to. */
  guestIds: string[];
  /** Comma-separated attendee names, as submitted. */
  guestsAttending: string;
  /** Per-member attendance by page ID, when the response recorded it. */
  attendanceById?: Record<string, boolean>;
}

/** Every normalized name in a response's attendee list. */
function attendeeNames(guestsAttending: string): Set<string> {
  return new Set(
    guestsAttending
      .split(',')
      .map((name) => normalize(name))
      .filter(Boolean)
  );
}

export function memberAttendedResponse(
  response: StoredAttendance,
  member: { id: string; normalizedName: string }
): boolean {
  const recorded = response.attendanceById?.[member.id];
  if (typeof recorded === 'boolean') return recorded;

  if (response.guestIds.includes(member.id)) {
    if (response.status === 'Attending') return true;
    if (response.status === 'Declined') return false;
  }

  return attendeeNames(response.guestsAttending).has(member.normalizedName);
}
