import { test, expect } from '@playwright/test';
import { strandedGuestIds, planDetachedResponse } from '../src/lib/rsvp-split';
import { normalize } from '../src/lib/normalize';

/**
 * Unit-style tests for splitting a shared RSVP response when a household is
 * split apart after it has already responded. These run in the Playwright Node
 * context (not the browser) against the module directly.
 *
 * Names here are synthetic. Real guest names live in Notion.
 *
 * The shape under test: four people invited on one envelope respond together as
 * one party, and are afterwards separated into three households — a couple, and
 * two grown children who should answer for themselves because they may attend a
 * different subset of the weekend.
 */

function member(name: string) {
  return { name, normalizedName: normalize(name) };
}

const PARENT_A = 'guest-parent-a';
const PARENT_B = 'guest-parent-b';
const CHILD_A = 'guest-child-a';
const CHILD_B = 'guest-child-b';

const SHARED_RELATION = [PARENT_A, PARENT_B, CHILD_A, CHILD_B];

test.describe('strandedGuestIds', () => {
  test('returns nothing when the response covers exactly this party', () => {
    expect(strandedGuestIds([PARENT_A, PARENT_B], [PARENT_A, PARENT_B])).toEqual([]);
  });

  test('ignores party members who are not on the response', () => {
    // A newly added partner submits with an existing member — the response is
    // still theirs to update, not somebody else's to inherit.
    expect(strandedGuestIds([PARENT_A], [PARENT_A, PARENT_B])).toEqual([]);
  });

  test('returns the members left behind when the household has been split', () => {
    expect(strandedGuestIds(SHARED_RELATION, [CHILD_A])).toEqual([
      PARENT_A,
      PARENT_B,
      CHILD_B,
    ]);
  });

  test('deduplicates a relation that lists the same member twice', () => {
    expect(strandedGuestIds([PARENT_A, PARENT_A, CHILD_A], [CHILD_A])).toEqual([PARENT_A]);
  });
});

test.describe('planDetachedResponse', () => {
  const allFour = 'Margot Vantrelle, Olivier Vantrelle, Noé Vantrelle, Salomé Vantrelle';

  test('keeps only the stranded members on the response', () => {
    const plan = planDetachedResponse(
      [member('Margot Vantrelle'), member('Olivier Vantrelle')],
      { status: 'Attending', guestsAttending: allFour }
    );

    expect(plan).toEqual({
      guestsAttending: 'Margot Vantrelle, Olivier Vantrelle',
      status: 'Attending',
    });
  });

  test('drops a repeated name rather than carrying it over', () => {
    // A self-referencing Related Guests row used to render a duplicate form row,
    // which reached the response as the same name twice and a double headcount.
    const plan = planDetachedResponse(
      [member('Margot Vantrelle'), member('Olivier Vantrelle')],
      {
        status: 'Attending',
        guestsAttending:
          'Margot Vantrelle, Margot Vantrelle, Olivier Vantrelle, Noé Vantrelle',
      }
    );

    expect(plan?.guestsAttending).toBe('Margot Vantrelle, Olivier Vantrelle');
    expect(plan?.status).toBe('Attending');
  });

  test('an Attending row survives a stranded member whose stored name has drifted', () => {
    // The whole point of reading Status first. This member's Guest List surname
    // no longer matches the name they submitted under — resolving by name alone
    // would downgrade an all-attending household to Partial and drop them from
    // the list, and would then persist that to Notion behind their back.
    const plan = planDetachedResponse(
      [member('Margot Combrelle'), member('Olivier Vantrelle')],
      { status: 'Attending', guestsAttending: allFour }
    );

    expect(plan).toEqual({
      guestsAttending: 'Margot Combrelle, Olivier Vantrelle',
      status: 'Attending',
    });
  });

  test('a Declined row stays Declined without consulting names', () => {
    const plan = planDetachedResponse(
      [member('Noé Vantrelle'), member('Salomé Vantrelle')],
      { status: 'Declined', guestsAttending: '' }
    );

    expect(plan).toEqual({ guestsAttending: '', status: 'Declined' });
  });

  test('a Declined row ignores a stale name left in the attendee list', () => {
    const plan = planDetachedResponse([member('Noé Vantrelle')], {
      status: 'Declined',
      guestsAttending: 'Noé Vantrelle',
    });

    expect(plan).toEqual({ guestsAttending: '', status: 'Declined' });
  });

  test('splits a Partial row by name, the only case where members differ', () => {
    const plan = planDetachedResponse(
      [member('Margot Vantrelle'), member('Noé Vantrelle')],
      { status: 'Partial', guestsAttending: 'Margot Vantrelle, Olivier Vantrelle' }
    );

    expect(plan).toEqual({ guestsAttending: 'Margot Vantrelle', status: 'Partial' });
  });

  test('a Partial row becomes Attending when every stranded member was named', () => {
    // The partial-ness belonged to the party that just left.
    const plan = planDetachedResponse(
      [member('Margot Vantrelle')],
      { status: 'Partial', guestsAttending: 'Margot Vantrelle' }
    );

    expect(plan).toEqual({ guestsAttending: 'Margot Vantrelle', status: 'Attending' });
  });

  test('a Partial row becomes Declined when no stranded member was named', () => {
    const plan = planDetachedResponse(
      [member('Salomé Vantrelle')],
      { status: 'Partial', guestsAttending: 'Margot Vantrelle' }
    );

    expect(plan).toEqual({ guestsAttending: '', status: 'Declined' });
  });

  test('matches names through accents and casing', () => {
    const plan = planDetachedResponse([member('Noé Vantrelle')], {
      status: 'Partial',
      guestsAttending: 'noe vantrelle, Margot Vantrelle',
    });

    expect(plan?.status).toBe('Attending');
  });

  test('ignores an attendee name matching nobody left on the response', () => {
    // The departing party may have submitted a name that never matched a record
    // — it must not keep the stranded members' row looking fuller than it is.
    const plan = planDetachedResponse([member('Margot Vantrelle')], {
      status: 'Partial',
      guestsAttending: 'Margot Vantrelle, Guest +1 TBC',
    });

    expect(plan).toEqual({ guestsAttending: 'Margot Vantrelle', status: 'Attending' });
  });

  test('returns null when there is nobody to strand', () => {
    expect(
      planDetachedResponse([], { status: 'Attending', guestsAttending: allFour })
    ).toBeNull();
  });
});
