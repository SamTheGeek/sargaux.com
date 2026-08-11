import { test, expect } from '@playwright/test';
import { memberAttendedResponse } from '../src/lib/rsvp-attendance';
import type { StoredAttendance } from '../src/lib/rsvp-attendance';
import { normalize } from '../src/lib/normalize';

/**
 * Unit-style tests for the single "did this member attend" decision, shared by
 * the ICS calendar, the Guest List write-back, the Events Attending relation,
 * and the split planner.
 *
 * Names here are synthetic. Real guest names live in Notion.
 *
 * The cases that matter are the ones where a member's *stored* name no longer
 * matches the name in the response — a maiden or married surname, a nickname
 * typed into the form, an unnamed plus-one. Every wrong answer here is written
 * back to Notion.
 */

function member(name: string, id = `guest-${normalize(name).replace(/\s+/g, '-')}`) {
  return { id, name, normalizedName: normalize(name) };
}

const camille = member('Camille Muller');
const theo = member('Théo Muller');

function response(overrides: Partial<StoredAttendance>): StoredAttendance {
  return {
    status: 'Attending',
    guestIds: [camille.id, theo.id],
    guestsAttending: 'Camille Muller, Théo Muller',
    ...overrides,
  };
}

test.describe('memberAttendedResponse — recorded attendance', () => {
  test('an explicit true wins over a Declined status', () => {
    expect(
      memberAttendedResponse(
        response({ status: 'Declined', guestsAttending: '', attendanceById: { [camille.id]: true } }),
        camille
      )
    ).toBe(true);
  });

  test('an explicit false wins over an Attending status and a matching name', () => {
    expect(
      memberAttendedResponse(
        response({ attendanceById: { [camille.id]: false } }),
        camille
      )
    ).toBe(false);
  });

  test('a member missing from the recorded map falls through to Status', () => {
    expect(
      memberAttendedResponse(response({ attendanceById: { [theo.id]: false } }), camille)
    ).toBe(true);
  });
});

test.describe('memberAttendedResponse — Status against the relation', () => {
  test('Attending settles a member on the relation without reading names', () => {
    // Her Guest List surname has changed since she replied.
    const renamed = member('Camille Garnier', camille.id);
    expect(memberAttendedResponse(response({}), renamed)).toBe(true);
  });

  test('Declined settles a member on the relation even if still named', () => {
    expect(
      memberAttendedResponse(
        response({ status: 'Declined', guestsAttending: 'Camille Muller' }),
        camille
      )
    ).toBe(false);
  });

  test('Partial falls through to the attendee names', () => {
    expect(
      memberAttendedResponse(
        response({ status: 'Partial', guestsAttending: 'Théo Muller' }),
        camille
      )
    ).toBe(false);
    expect(
      memberAttendedResponse(
        response({ status: 'Partial', guestsAttending: 'Théo Muller' }),
        theo
      )
    ).toBe(true);
  });

  test('a Partial row still cannot resolve a renamed member', () => {
    // The one gap names cannot close, and why the recorded map exists.
    const renamed = member('Camille Garnier', camille.id);
    expect(
      memberAttendedResponse(
        response({ status: 'Partial', guestsAttending: 'Camille Muller' }),
        renamed
      )
    ).toBe(false);
  });
});

test.describe('memberAttendedResponse — members off the relation', () => {
  test('Status is not applied to someone the response does not cover', () => {
    // A household can be wider than the party that submitted; an Attending
    // response must not sweep in a member it never asked.
    const cousin = member('Amandine Muller');
    expect(memberAttendedResponse(response({}), cousin)).toBe(false);
  });

  test('but their name still counts if the response lists them', () => {
    const cousin = member('Amandine Muller');
    expect(
      memberAttendedResponse(
        response({ guestsAttending: 'Camille Muller, Amandine Muller' }),
        cousin
      )
    ).toBe(true);
  });

  test('matches names through accents and casing', () => {
    expect(
      memberAttendedResponse(
        response({ guestIds: [], guestsAttending: 'theo muller' }),
        theo
      )
    ).toBe(true);
  });
});
