import { test, expect } from '@playwright/test';
import {
  envelopeTokens,
  buildHouseholds,
  matchHousehold,
  findMatchingHousehold,
} from '../src/lib/envelope-name';
import { createClaimToken, parseClaimToken, createSessionToken } from '../src/lib/auth';
import { hmacSha256Hex } from '../src/lib/hmac';
import type { GuestRecord } from '../src/types';

/**
 * Unit-style tests for envelope-name login. These run in the Playwright Node
 * context (not the browser) against the matching module directly.
 *
 * Names here are synthetic. Real guest names live in Notion.
 */

function guest(overrides: Partial<GuestRecord> & { id: string; name: string }): GuestRecord {
  return {
    normalizedName: overrides.name.toLowerCase(),
    eventInvitations: ['nyc'],
    isPlusOne: false,
    relatedGuestIds: [],
    ...overrides,
  };
}

// Household sharing one surname — the common case.
const alex = guest({
  id: 'a',
  name: 'Alex Rivera',
  firstName: 'Alex',
  lastName: 'Rivera',
  relatedGuestIds: ['b'],
  envelopeNames: ['Alex & Jordan Rivera'],
});
const jordan = guest({
  id: 'b',
  name: 'Jordan Rivera',
  firstName: 'Jordan',
  lastName: 'Rivera',
  relatedGuestIds: ['a'],
  envelopeNames: ['Alex & Jordan Rivera'],
});
const riveras = [alex, jordan];

// Household with two surnames.
const casey = guest({
  id: 'c',
  name: 'Casey Morgan',
  firstName: 'Casey',
  lastName: 'Morgan',
  relatedGuestIds: ['d'],
});
const riley = guest({
  id: 'd',
  name: 'Riley Dubois',
  firstName: 'Riley',
  lastName: 'Dubois',
  relatedGuestIds: ['c'],
});
const morganDubois = [casey, riley];

test.describe('envelopeTokens', () => {
  test('strips titles', () => {
    expect(envelopeTokens('Mr. Alex Rivera')).toEqual(['alex', 'rivera']);
    expect(envelopeTokens('Dr. Casey Morgan')).toEqual(['casey', 'morgan']);
    expect(envelopeTokens('Mme Riley Dubois')).toEqual(['riley', 'dubois']);
    expect(envelopeTokens('M. Riley Dubois')).toEqual(['riley', 'dubois']);
  });

  test('strips connectors', () => {
    expect(envelopeTokens('Alex & Jordan Rivera')).toEqual(['alex', 'jordan', 'rivera']);
    expect(envelopeTokens('Alex and Jordan Rivera')).toEqual(['alex', 'jordan', 'rivera']);
    expect(envelopeTokens('Casey Morgan et Riley Dubois')).toEqual([
      'casey',
      'morgan',
      'riley',
      'dubois',
    ]);
  });

  test('keeps collective words, so a bare surname cannot stand in for them', () => {
    // Stripping "The"/"Family" would reduce this to ['rivera'] and let anyone
    // typing the surname alone into the household.
    expect(envelopeTokens('The Rivera Family')).toEqual(['the', 'rivera', 'family']);
    expect(envelopeTokens('La Famille Dubois')).toEqual(['la', 'famille', 'dubois']);
  });

  test('strips the +1 suffix the CSV generator appends', () => {
    expect(envelopeTokens('Alex Rivera +1')).toEqual(['alex', 'rivera']);
    expect(envelopeTokens('Alex Rivera + 1')).toEqual(['alex', 'rivera']);
  });

  test('inherits normalize() accent, apostrophe, and hyphen handling', () => {
    expect(envelopeTokens('Riley Duböis')).toEqual(['riley', 'dubois']);
    expect(envelopeTokens("Jean-Pierre O'Brien")).toEqual(['jean', 'pierre', 'obrien']);
    // iOS smart punctuation produces a curly apostrophe
    expect(envelopeTokens('Jean O’Brien')).toEqual(['jean', 'obrien']);
  });

  test('returns nothing for a string of only stripped words', () => {
    expect(envelopeTokens('  Mr. and Mrs.  ')).toEqual([]);
    expect(envelopeTokens('')).toEqual([]);
  });
});

test.describe('buildHouseholds', () => {
  test('groups guests linked by Related Guests', () => {
    const households = buildHouseholds([...riveras, ...morganDubois]);
    expect(households).toHaveLength(2);
    expect(households.map((h) => h.length).sort()).toEqual([2, 2]);
  });

  test('groups a chain A-B, B-C that a single relation hop would miss', () => {
    const a = guest({ id: 'x', name: 'A One', relatedGuestIds: ['y'] });
    const b = guest({ id: 'y', name: 'B Two', relatedGuestIds: ['x', 'z'] });
    const c = guest({ id: 'z', name: 'C Three', relatedGuestIds: ['y'] });

    const households = buildHouseholds([a, b, c]);
    expect(households).toHaveLength(1);
    expect(households[0]).toHaveLength(3);
  });

  test('ignores relations pointing outside the supplied set', () => {
    const orphan = guest({ id: 'lone', name: 'Solo Guest', relatedGuestIds: ['not-fetched'] });
    const households = buildHouseholds([orphan]);
    expect(households).toHaveLength(1);
    expect(households[0]).toHaveLength(1);
  });

  test('puts an unrelated guest in their own household', () => {
    const households = buildHouseholds([alex, jordan, casey]);
    expect(households).toHaveLength(2);
  });
});

test.describe('matchHousehold — first-name combinations', () => {
  test('matches one member by first and last name', () => {
    expect(matchHousehold('Alex Rivera', riveras)).toEqual({ memberIds: ['a'] });
  });

  test('matches both members on a shared surname', () => {
    expect(matchHousehold('Alex & Jordan Rivera', riveras)).toEqual({ memberIds: ['a', 'b'] });
  });

  test('is order-independent, and reports household order either way', () => {
    // Household order keeps the picker stable no matter how the name was typed
    expect(matchHousehold('Jordan and Alex Rivera', riveras)).toEqual({ memberIds: ['a', 'b'] });
    expect(matchHousehold('Alex and Jordan Rivera', riveras)).toEqual({ memberIds: ['a', 'b'] });
  });

  test('matches a first name against another household member\'s surname', () => {
    // Casey's surname is Morgan, but Dubois belongs to the same household
    expect(matchHousehold('Casey Dubois', morganDubois)).toEqual({ memberIds: ['c'] });
  });

  test('matches both members across two surnames', () => {
    expect(matchHousehold('Casey Morgan & Riley Dubois', morganDubois)).toEqual({
      memberIds: ['c', 'd'],
    });
  });

  test('matches first names alone', () => {
    expect(matchHousehold('Alex Jordan', riveras)).toEqual({ memberIds: ['a', 'b'] });
  });

  test('tolerates a title on the envelope', () => {
    expect(matchHousehold('Mr. Alex Rivera', riveras)).toEqual({ memberIds: ['a'] });
  });

  test('tolerates a title on the second member of a mixed-surname household', () => {
    // The Guest List `Title` select is carried by one member only, so on a
    // two-surname household the title lands mid-string ("<first> <surname> &
    // Dr. <first> <surname>") rather than at the front, as the case above.
    expect(matchHousehold('Casey Morgan & Dr. Riley Dubois', morganDubois)).toEqual({
      memberIds: ['c', 'd'],
    });
    expect(matchHousehold('Dr. Riley Dubois & Casey Morgan', morganDubois)).toEqual({
      memberIds: ['c', 'd'],
    });
    expect(matchHousehold('Casey & Dr. Riley', morganDubois)).toEqual({ memberIds: ['c', 'd'] });
  });

  test('rejects a bare surname — it names nobody', () => {
    expect(matchHousehold('Rivera', riveras)).toBeNull();
  });

  test('rejects a token the household does not own', () => {
    expect(matchHousehold('Alex Morgan', riveras)).toBeNull();
    expect(matchHousehold('Alex Rivera Smith', riveras)).toBeNull();
  });

  test('rejects the same first name claimed twice', () => {
    expect(matchHousehold('Alex Alex Rivera', riveras)).toBeNull();
  });

  test('rejects an empty or all-stripped input', () => {
    expect(matchHousehold('', riveras)).toBeNull();
    expect(matchHousehold('Mr. and Mrs.', riveras)).toBeNull();
  });

  test('rejects a guest from a different household', () => {
    expect(matchHousehold('Casey Morgan', riveras)).toBeNull();
  });
});

/**
 * Name *shapes* drawn from the real invitation CSVs, rendered with invented
 * names — this repo is public, so no guest's real name belongs in a fixture.
 * These are the cases single-token first-name matching silently failed.
 */
test.describe('matchHousehold — multi-token given names', () => {
  const hyphenated = [
    guest({
      id: 'h1',
      name: 'Marie-Claire Vasseur',
      firstName: 'Marie-Claire',
      lastName: 'Vasseur',
      relatedGuestIds: ['h2'],
    }),
    guest({
      id: 'h2',
      name: 'Thibault Vasseur',
      firstName: 'Thibault',
      lastName: 'Vasseur',
      relatedGuestIds: ['h1'],
    }),
  ];

  test('matches a hyphenated first name as printed', () => {
    expect(matchHousehold('Marie-Claire & Thibault Vasseur', hyphenated)).toEqual({
      memberIds: ['h1', 'h2'],
    });
  });

  test('matches a hyphenated first name typed without the hyphen', () => {
    // normalize() turns hyphens into spaces, so both forms tokenize the same
    expect(matchHousehold('Marie Claire Vasseur', hyphenated)).toEqual({ memberIds: ['h1'] });
  });

  test('rejects half of a hyphenated first name', () => {
    expect(matchHousehold('Claire Vasseur', hyphenated)).toBeNull();
  });

  const twoWord = [
    guest({
      id: 't1',
      name: 'Sarah Jane Whitlock',
      firstName: 'Sarah Jane',
      lastName: 'Whitlock',
      relatedGuestIds: ['t2'],
    }),
    guest({
      id: 't2',
      name: 'Preston Ackley',
      firstName: 'Preston',
      lastName: 'Ackley',
      relatedGuestIds: ['t1'],
    }),
  ];

  test('matches a two-word given name across a mixed-surname household', () => {
    expect(matchHousehold('Sarah Jane Whitlock & Preston Ackley', twoWord)).toEqual({
      memberIds: ['t1', 't2'],
    });
  });

  test('a longer given name is not shadowed by a shorter one', () => {
    // "Sarah Jane" must be consumed whole rather than leaving "jane" stranded
    const withSarah = [
      ...twoWord,
      guest({ id: 't3', name: 'Sarah Ackley', firstName: 'Sarah', lastName: 'Ackley', relatedGuestIds: ['t1'] }),
    ];
    expect(matchHousehold('Sarah Jane Whitlock', withSarah)).toEqual({ memberIds: ['t1'] });
  });

  test('a multi-word surname matches token by token', () => {
    const compound = [
      guest({
        id: 'c1',
        name: 'Elena Duarte Pryce',
        firstName: 'Elena',
        lastName: 'Duarte Pryce',
        relatedGuestIds: [],
      }),
    ];
    expect(matchHousehold('Elena Duarte Pryce', compound)).toEqual({ memberIds: ['c1'] });
    expect(matchHousehold('Elena Pryce', compound)).toEqual({ memberIds: ['c1'] });
  });

  test('two members sharing a first name need the stored envelope string', () => {
    // A named guest plus an unnamed +1 sharing a first name appears in the real
    // data; the first-name rule correctly refuses to guess between them.
    const sharedFirst = [
      guest({
        id: 'd1',
        name: 'Frances Holloway',
        firstName: 'Frances',
        lastName: 'Holloway',
        relatedGuestIds: ['d2'],
        envelopeNames: ['Frances +1 & Frances Holloway'],
      }),
      guest({
        id: 'd2',
        name: 'Frances Guest',
        firstName: 'Frances',
        lastName: 'Holloway',
        isPlusOne: true,
        relatedGuestIds: ['d1'],
        envelopeNames: ['Frances +1 & Frances Holloway'],
      }),
    ];

    // Both members are named "Frances", so both are legitimately claimed
    expect(matchHousehold('Frances Frances Holloway', sharedFirst)).toEqual({
      memberIds: ['d1', 'd2'],
    });
    // The +1's record carries the suffix in `First Name` itself, which must be
    // stripped on the stored side too — otherwise that member is unclaimable
    // and the household needs its envelope line verbatim.
    const suffixInRecord = [
      sharedFirst[0],
      { ...sharedFirst[1], firstName: 'Frances +1' },
    ];
    expect(matchHousehold('Frances Frances Holloway', suffixInRecord)).toEqual({
      memberIds: ['d1', 'd2'],
    });
    // And the printed envelope (whose "+1" is stripped) still resolves
    expect(matchHousehold('Frances +1 & Frances Holloway', sharedFirst)).toEqual({
      memberIds: ['d1', 'd2'],
    });
  });
});

test.describe('matchHousehold — stored envelope strings', () => {
  const smiths = [
    guest({
      id: 's1',
      name: 'Robin Smith',
      firstName: 'Robin',
      lastName: 'Smith',
      relatedGuestIds: ['s2'],
      envelopeNames: ['The Smith Household'],
    }),
    guest({
      id: 's2',
      name: 'Sky Smith',
      firstName: 'Sky',
      lastName: 'Smith',
      relatedGuestIds: ['s1'],
      envelopeNames: ['The Smith Household'],
    }),
  ];

  test('matches a hand-edited envelope no name rule would derive', () => {
    expect(matchHousehold('The Smith Household', smiths)).toEqual({ memberIds: ['s1', 's2'] });
  });

  test('the surname alone does not stand in for the full envelope', () => {
    expect(matchHousehold('Smith', smiths)).toBeNull();
    expect(matchHousehold('The Smith', smiths)).toBeNull();
  });

  test('returns the whole household — the string names no one in particular', () => {
    const match = matchHousehold('The Smith Household', smiths);
    expect(match!.memberIds).toHaveLength(2);
  });

  test('is order-independent, but every word must be present', () => {
    expect(matchHousehold('The Household Smith', smiths)).toEqual({ memberIds: ['s1', 's2'] });
    expect(matchHousehold('Smith Household', smiths)).toBeNull();
  });

  test('rejects a partial envelope string', () => {
    expect(matchHousehold('Smith Household Extra', smiths)).toBeNull();
  });

  test('first-name rules still win where both could apply', () => {
    expect(matchHousehold('Robin Smith', smiths)).toEqual({ memberIds: ['s1'] });
  });
});

/**
 * Alternate names: the ways a guest's everyday name differs from the Notion
 * record. Shapes are drawn from the real guest list; the names are invented.
 */
test.describe('matchHousehold — multi-word surnames typed closed up', () => {
  const spaced = [
    guest({
      id: 'g1',
      name: 'Noor Le Marchand',
      firstName: 'Noor',
      lastName: 'Le Marchand',
      relatedGuestIds: ['g2'],
      envelopeNames: ['The Le Marchand Family'],
    }),
    guest({
      id: 'g2',
      name: 'Tomas Le Marchand',
      firstName: 'Tomas',
      lastName: 'Le Marchand',
      relatedGuestIds: ['g1'],
      envelopeNames: ['The Le Marchand Family'],
    }),
  ];

  test('accepts the surname closed up', () => {
    expect(matchHousehold('Noor LeMarchand', spaced)).toEqual({ memberIds: ['g1'] });
    expect(matchHousehold('Noor & Tomas LeMarchand', spaced)).toEqual({ memberIds: ['g1', 'g2'] });
  });

  test('still accepts the surname as stored', () => {
    expect(matchHousehold('Noor Le Marchand', spaced)).toEqual({ memberIds: ['g1'] });
    expect(matchHousehold('Noor Marchand', spaced)).toEqual({ memberIds: ['g1'] });
  });

  test('accepts a stored envelope typed closed up', () => {
    expect(matchHousehold('The LeMarchand Family', spaced)).toEqual({ memberIds: ['g1', 'g2'] });
  });

  test('works the other way round when Notion holds the closed-up spelling', () => {
    const closed = [
      guest({ id: 'k1', name: 'Noor LeMarchand', firstName: 'Noor', lastName: 'LeMarchand' }),
    ];
    expect(matchHousehold('Noor Le Marchand', closed)).toEqual({ memberIds: ['k1'] });
    expect(matchHousehold('Noor LeMarchand', closed)).toEqual({ memberIds: ['k1'] });
  });

  test('the closed-up surname alone still names nobody', () => {
    expect(matchHousehold('LeMarchand', spaced)).toBeNull();
  });
});

test.describe('matchHousehold — Also Known As', () => {
  // A maiden name kept alongside a married one: one line covers every phrasing
  const maidenName = [
    guest({
      id: 'm1',
      name: 'Odette Vaillant',
      firstName: 'Odette',
      lastName: 'Vaillant',
      relatedGuestIds: ['m2'],
      aka: ['Odette Brossard'],
    }),
    guest({
      id: 'm2',
      name: 'Hugo Vaillant',
      firstName: 'Hugo',
      lastName: 'Vaillant',
      relatedGuestIds: ['m1'],
    }),
  ];

  test('accepts either surname, and both together', () => {
    expect(matchHousehold('Odette Vaillant', maidenName)).toEqual({ memberIds: ['m1'] });
    expect(matchHousehold('Odette Brossard', maidenName)).toEqual({ memberIds: ['m1'] });
    expect(matchHousehold('Odette Brossard Vaillant', maidenName)).toEqual({ memberIds: ['m1'] });
  });

  test('the alternate surname joins the household pool', () => {
    // Same rule that lets a partner's surname stand in for one's own
    expect(matchHousehold('Hugo Brossard', maidenName)).toEqual({ memberIds: ['m2'] });
  });

  test('the alternate surname alone names nobody', () => {
    expect(matchHousehold('Brossard', maidenName)).toBeNull();
  });

  // A nickname no rule could derive
  const nickname = [
    guest({
      id: 'n1',
      name: 'Perpetua Nwachukwu',
      firstName: 'Perpetua',
      lastName: 'Nwachukwu',
      relatedGuestIds: ['n2'],
      aka: ['Pet'],
    }),
    guest({
      id: 'n2',
      name: 'Bode Nwachukwu',
      firstName: 'Bode',
      lastName: 'Nwachukwu',
      relatedGuestIds: ['n1'],
    }),
  ];

  test('accepts a single-token nickname on its own and with a surname', () => {
    expect(matchHousehold('Pet', nickname)).toEqual({ memberIds: ['n1'] });
    expect(matchHousehold('Pet Nwachukwu', nickname)).toEqual({ memberIds: ['n1'] });
  });

  test('composes with the rest of the household', () => {
    expect(matchHousehold('Pet & Bode Nwachukwu', nickname)).toEqual({ memberIds: ['n1', 'n2'] });
  });

  test('the record name keeps working', () => {
    expect(matchHousehold('Perpetua Nwachukwu', nickname)).toEqual({ memberIds: ['n1'] });
  });

  test('does not admit a name nobody answers to', () => {
    expect(matchHousehold('Pat Nwachukwu', nickname)).toBeNull();
  });
});

test.describe('matchHousehold — derived initials', () => {
  const hyphenated = [
    guest({
      id: 'i1',
      name: 'Anne-Sixtine Delcourt',
      firstName: 'Anne-Sixtine',
      lastName: 'Delcourt',
      relatedGuestIds: ['i2'],
    }),
    guest({
      id: 'i2',
      name: 'Bastien Delcourt',
      firstName: 'Bastien',
      lastName: 'Delcourt',
      relatedGuestIds: ['i1'],
    }),
  ];

  test('accepts the initials of a hyphenated given name', () => {
    expect(matchHousehold('AS Delcourt', hyphenated)).toEqual({ memberIds: ['i1'] });
    expect(matchHousehold('A.S. Delcourt', hyphenated)).toEqual({ memberIds: ['i1'] });
  });

  test('composes with the rest of the household', () => {
    expect(matchHousehold('AS & Bastien Delcourt', hyphenated)).toEqual({
      memberIds: ['i1', 'i2'],
    });
  });

  test('does not derive initials from a single-token given name', () => {
    // "B Delcourt" must not resolve to Bastien
    expect(matchHousehold('B Delcourt', hyphenated)).toBeNull();
  });

  test('the full hyphenated name keeps working', () => {
    expect(matchHousehold('Anne-Sixtine Delcourt', hyphenated)).toEqual({ memberIds: ['i1'] });
    expect(matchHousehold('Anne Sixtine Delcourt', hyphenated)).toEqual({ memberIds: ['i1'] });
  });
});

test.describe('matchHousehold — common diminutives', () => {
  const michaels = [
    guest({
      id: 'v1',
      name: 'Michael Ashworth',
      firstName: 'Michael',
      lastName: 'Ashworth',
      relatedGuestIds: ['v2'],
    }),
    guest({
      id: 'v2',
      name: 'Katherine Ashworth',
      firstName: 'Katherine',
      lastName: 'Ashworth',
      relatedGuestIds: ['v1'],
    }),
  ];

  test('accepts a diminutive of the stored name', () => {
    expect(matchHousehold('Mike Ashworth', michaels)).toEqual({ memberIds: ['v1'] });
    expect(matchHousehold('Kate Ashworth', michaels)).toEqual({ memberIds: ['v2'] });
    expect(matchHousehold('Mike & Kate Ashworth', michaels)).toEqual({ memberIds: ['v1', 'v2'] });
  });

  test('works when Notion holds the short form and the guest types the long one', () => {
    const stored = [guest({ id: 'w1', name: 'Mike Ashworth', firstName: 'Mike', lastName: 'Ashworth' })];
    expect(matchHousehold('Michael Ashworth', stored)).toEqual({ memberIds: ['w1'] });
  });

  test('a shared diminutive does not leak between roots', () => {
    // Ted is short for both Edward and Theodore, but Edward must never accept
    // "Theo" — the variants are read from the stored name, not unioned.
    const edward = [guest({ id: 'e1', name: 'Edward Ashworth', firstName: 'Edward', lastName: 'Ashworth' })];
    expect(matchHousehold('Ted Ashworth', edward)).toEqual({ memberIds: ['e1'] });
    expect(matchHousehold('Theo Ashworth', edward)).toBeNull();

    const theodore = [
      guest({ id: 'e2', name: 'Theodore Ashworth', firstName: 'Theodore', lastName: 'Ashworth' }),
    ];
    expect(matchHousehold('Ted Ashworth', theodore)).toEqual({ memberIds: ['e2'] });
    expect(matchHousehold('Eddie Ashworth', theodore)).toBeNull();
  });

  test('an unrelated name is still rejected', () => {
    expect(matchHousehold('Marcus Ashworth', michaels)).toBeNull();
  });
});

test.describe('matchHousehold — ambiguity narrows the rules back off', () => {
  // An Alex and an Alexander under one roof: "Alex" must not silently pick one
  const both = [
    guest({
      id: 'p1',
      name: 'Alex Ashworth',
      firstName: 'Alex',
      lastName: 'Ashworth',
      relatedGuestIds: ['p2'],
    }),
    guest({
      id: 'p2',
      name: 'Alexander Ashworth',
      firstName: 'Alexander',
      lastName: 'Ashworth',
      relatedGuestIds: ['p1'],
    }),
  ];

  test('each member is reachable only by their stored name', () => {
    expect(matchHousehold('Alex Ashworth', both)).toEqual({ memberIds: ['p1'] });
    expect(matchHousehold('Alexander Ashworth', both)).toEqual({ memberIds: ['p2'] });
  });

  test('both are named when both are typed', () => {
    expect(matchHousehold('Alex & Alexander Ashworth', both)).toEqual({ memberIds: ['p1', 'p2'] });
  });

  test('losing diminutives does not cost the household its stored aliases', () => {
    const withAlias = [
      { ...both[0], aka: ['Lexie'] },
      both[1],
    ];
    expect(matchHousehold('Lexie Ashworth', withAlias)).toEqual({ memberIds: ['p1'] });
    // ...while the diminutive that caused the collision stays literal
    expect(matchHousehold('Alex Ashworth', withAlias)).toEqual({ memberIds: ['p1'] });
  });

  test('a colliding alias narrows all the way back to stored first names', () => {
    // Someone typed the wrong person's name into Also Known As
    const collides = [
      { ...both[0], aka: ['Alexander'] },
      both[1],
    ];
    expect(matchHousehold('Alexander Ashworth', collides)).toEqual({ memberIds: ['p2'] });
    expect(matchHousehold('Alex Ashworth', collides)).toEqual({ memberIds: ['p1'] });
  });
});

test.describe('findMatchingHousehold', () => {
  const all = [...riveras, ...morganDubois];

  test('finds the one household a name belongs to', () => {
    expect(findMatchingHousehold('Alex & Jordan Rivera', all)).toEqual(['a', 'b']);
    expect(findMatchingHousehold('Riley Dubois', all)).toEqual(['d']);
  });

  test('returns null when nothing matches', () => {
    expect(findMatchingHousehold('Nobody Here', all)).toBeNull();
  });

  /**
   * Households are deliberately split when the people on one envelope should
   * RSVP separately. The printed line then names everyone but belongs to no
   * single household, so it must reach the picker rather than fail closed.
   */
  test('unions across households when one envelope spans a deliberate split', () => {
    const shared = 'Jerome & Juliette & Marie-Sophie Vasseur';
    // Jérôme and Marie-Sophie RSVP together; Juliette RSVPs on her own
    const pair = [
      guest({
        id: 'sp1',
        name: 'Jerome Vasseur',
        firstName: 'Jerome',
        lastName: 'Vasseur',
        relatedGuestIds: ['sp2'],
        envelopeNames: [shared],
      }),
      guest({
        id: 'sp2',
        name: 'Marie-Sophie Vasseur',
        firstName: 'Marie-Sophie',
        lastName: 'Vasseur',
        relatedGuestIds: ['sp1'],
        envelopeNames: [shared],
      }),
    ];
    const alone = guest({
      id: 'sp3',
      name: 'Juliette Vasseur',
      firstName: 'Juliette',
      lastName: 'Vasseur',
      envelopeNames: [shared],
    });
    const split = [...pair, alone];

    const seen: string[][][] = [];
    expect(findMatchingHousehold(shared, split, (m) => seen.push(m))).toEqual([
      'sp1',
      'sp2',
      'sp3',
    ]);
    // A legitimate span is not an anomaly — nothing to investigate
    expect(seen).toHaveLength(0);
  });

  test('an individual name still resolves to just their own group', () => {
    // ...so the picked identity decides which side of the split they RSVP on
    const pair = [
      guest({ id: 'sp1', name: 'Jerome Vasseur', firstName: 'Jerome', lastName: 'Vasseur', relatedGuestIds: ['sp2'] }),
      guest({ id: 'sp2', name: 'Marie-Sophie Vasseur', firstName: 'Marie-Sophie', lastName: 'Vasseur', relatedGuestIds: ['sp1'] }),
    ];
    const alone = guest({ id: 'sp3', name: 'Juliette Vasseur', firstName: 'Juliette', lastName: 'Vasseur' });
    const split = [...pair, alone];

    expect(findMatchingHousehold('Juliette Vasseur', split)).toEqual(['sp3']);
    expect(findMatchingHousehold('Jerome Vasseur', split)).toEqual(['sp1']);
  });

  test('fails closed and reports when two households match', () => {
    // A second, unrelated Rivera household with the same first name
    const otherAlex = guest({
      id: 'z1',
      name: 'Alex Rivera',
      firstName: 'Alex',
      lastName: 'Rivera',
    });

    const seen: string[][][] = [];
    const result = findMatchingHousehold('Alex Rivera', [...all, otherAlex], (matches) =>
      seen.push(matches)
    );

    expect(result).toBeNull();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(2);
  });
});

test.describe('Identity claim tokens', () => {
  test('round-trips the member IDs it was created with', () => {
    const parsed = parseClaimToken(createClaimToken(['a', 'b']));
    expect(parsed).not.toBeNull();
    expect(parsed!.memberIds).toEqual(['a', 'b']);
  });

  test('rejects a tampered HMAC', () => {
    const [payloadB64] = createClaimToken(['a', 'b']).split('.');
    expect(parseClaimToken(`${payloadB64}.00000000000000000000000000000000`)).toBeNull();
  });

  test('rejects an unsigned token', () => {
    const payload = { typ: 'claim', memberIds: ['a'], created: Date.now() };
    const unsigned = Buffer.from(JSON.stringify(payload)).toString('base64url');
    expect(parseClaimToken(unsigned)).toBeNull();
  });

  test('rejects an expired claim', () => {
    const payload = {
      typ: 'claim',
      memberIds: ['a'],
      created: Date.now() - 11 * 60 * 1000, // claims live 10 minutes
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const hmac = hmacSha256Hex(process.env.SESSION_HMAC_SECRET!, payloadB64, 32);
    expect(parseClaimToken(`${payloadB64}.${hmac}`)).toBeNull();
  });

  test('rejects a validly-signed session token presented as a claim', () => {
    // Domain separation: both are signed with SESSION_HMAC_SECRET, so only the
    // `typ` field stops a session cookie being redeemed at the picker step.
    const session = createSessionToken('Alex Rivera', 'notion-1');
    expect(parseClaimToken(session)).toBeNull();
  });

  test('rejects a claim with no members', () => {
    const payload = { typ: 'claim', memberIds: [], created: Date.now() };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const hmac = hmacSha256Hex(process.env.SESSION_HMAC_SECRET!, payloadB64, 32);
    expect(parseClaimToken(`${payloadB64}.${hmac}`)).toBeNull();
  });
});
