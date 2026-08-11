import { test, expect } from '@playwright/test';
import { splitGuestName, guestNameEdit, preserveFormerName } from '../src/lib/guest-name';

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

  test('an all-lowercase retype does not overwrite a properly-cased name', () => {
    // A phone keyboard, not an edit — the row feeds envelopes and place cards.
    expect(guestNameEdit('Mary Anne Whitlock', 'mary anne whitlock')).toBeNull();
    // Still an edit when more than case differs.
    expect(guestNameEdit('Mary Anne Whitlock', 'mary anne vasseur')).toEqual({
      first: 'mary anne',
      last: 'vasseur',
      title: 'mary anne vasseur',
    });
  });
});

test.describe('preserveFormerName', () => {
  test('keeps the previous name so the guest can still log in as it', () => {
    expect(preserveFormerName('Matthew Gavin', undefined)).toBe('Matthew Gavin');
  });

  test('appends to existing alternates rather than replacing them', () => {
    expect(preserveFormerName('Camille Muller', ['Soso'])).toBe('Soso\nCamille Muller');
  });

  test('does not preserve an unnamed plus-one placeholder', () => {
    // "<host> +1" is a slot, not a name.
    expect(preserveFormerName('Philippa +1', undefined)).toBeNull();
    expect(preserveFormerName('Philippa + 1', undefined)).toBeNull();
  });

  test('does not duplicate a name already listed', () => {
    expect(preserveFormerName('Camille Muller', ['Camille Muller'])).toBeNull();
    expect(preserveFormerName('Camille Muller', ['camille muller'])).toBeNull();
  });

  test('ignores a blank stored name', () => {
    expect(preserveFormerName('   ', ['Soso'])).toBeNull();
  });
});
