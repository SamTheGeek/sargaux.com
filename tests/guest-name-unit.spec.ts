import { test, expect } from '@playwright/test';
import { splitGuestName, guestNameEdit } from '../src/lib/guest-name';

/**
 * The RSVP name write-back. `tests/rsvp-api.spec.ts` exercises the guestId
 * plumbing but deliberately submits matching names, since triggering a real
 * edit would rename a shared Guest List row — so the decision itself is only
 * covered here.
 *
 * Names are invented. Real guest names live in Notion.
 */

test.describe('splitGuestName', () => {
  test('treats the last token as the surname', () => {
    expect(splitGuestName('Marcus Reed')).toEqual({ first: 'Marcus', last: 'Reed' });
  });

  test('keeps a two-word given name whole', () => {
    expect(splitGuestName('Mary Anne Whitlock')).toEqual({
      first: 'Mary Anne',
      last: 'Whitlock',
    });
  });

  test('keeps a multi-word surname on the last token only', () => {
    // Matches how the Guest List already stores these; the login matcher
    // recombines them, so nothing is lost here.
    expect(splitGuestName('Noor Le Marchand')).toEqual({ first: 'Noor Le', last: 'Marchand' });
  });

  test('a single token is a given name with no surname', () => {
    // How a plus-one known only by their first name is stored
    expect(splitGuestName('Marcus')).toEqual({ first: 'Marcus', last: '' });
  });

  test('returns null when there is no name at all', () => {
    expect(splitGuestName('')).toBeNull();
    expect(splitGuestName('   ')).toBeNull();
  });
});

test.describe('guestNameEdit — naming an unnamed plus-one', () => {
  // The shape that matters: a plus-one whose record carries the host's name
  // plus a suffix, and an empty Last Name.
  const PLUS_ONE = 'Rosalind +1';

  test('fills in a real name over the placeholder', () => {
    expect(guestNameEdit(PLUS_ONE, 'Marcus Reed')).toEqual({
      first: 'Marcus',
      last: 'Reed',
      title: 'Marcus Reed',
    });
  });

  test('accepts a first name only', () => {
    expect(guestNameEdit(PLUS_ONE, 'Marcus')).toEqual({
      first: 'Marcus',
      last: '',
      title: 'Marcus',
    });
  });

  test('leaves the placeholder alone when it comes back untouched', () => {
    // The suffix must not be mistaken for a surname and written to Last Name
    expect(guestNameEdit(PLUS_ONE, PLUS_ONE)).toBeNull();
  });

  test('ignores whitespace the form round-trip may add', () => {
    expect(guestNameEdit(PLUS_ONE, `  ${PLUS_ONE}  `)).toBeNull();
    expect(guestNameEdit('Marcus Reed', 'Marcus  Reed')).toBeNull();
  });

  test('normalizes whitespace inside a name it does write', () => {
    expect(guestNameEdit(PLUS_ONE, '  Marcus   Reed ')).toEqual({
      first: 'Marcus',
      last: 'Reed',
      title: 'Marcus Reed',
    });
  });
});

test.describe('guestNameEdit — leaving a name alone', () => {
  test('no edit when the name is unchanged', () => {
    expect(guestNameEdit('Casey Morgan', 'Casey Morgan')).toBeNull();
  });

  test('no edit when the form threaded no name for this member', () => {
    expect(guestNameEdit('Casey Morgan', undefined)).toBeNull();
  });

  test('never blanks a name', () => {
    // A cleared input must not wipe the Guest List row
    expect(guestNameEdit('Casey Morgan', '')).toBeNull();
    expect(guestNameEdit('Casey Morgan', '   ')).toBeNull();
  });

  test('a correction that differs only by accent or case is a real edit', () => {
    // The guest can then log in as the name they just fixed
    expect(guestNameEdit('Jerome Vasseur', 'Jérôme Vasseur')).toEqual({
      first: 'Jérôme',
      last: 'Vasseur',
      title: 'Jérôme Vasseur',
    });
    expect(guestNameEdit('mary anne whitlock', 'Mary Anne Whitlock')).toEqual({
      first: 'Mary Anne',
      last: 'Whitlock',
      title: 'Mary Anne Whitlock',
    });
  });
});
