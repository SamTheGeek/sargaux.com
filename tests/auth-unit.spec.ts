import { test, expect } from '@playwright/test';
import {
  createSessionToken,
  parseSessionToken,
  validateGuest,
  validateGuestFromRecords,
  matchGuestsFromRecords,
  SESSION_MAX_AGE_SECONDS,
  SessionSecretMissingError,
} from '../src/lib/auth';
import { normalize } from '../src/lib/normalize';
import { hmacSha256Hex } from '../src/lib/hmac';
import type { GuestRecord } from '../src/types';

/**
 * Unit-style tests for auth functions. These run in the Playwright Node context
 * (not the browser) to directly test the auth module's logic.
 */

/**
 * Sign an arbitrary payload with the real session HMAC routine so tests can
 * mint validly-signed tokens with backdated or malformed `created` fields.
 */
function signSessionPayload(payload: Record<string, unknown>): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = hmacSha256Hex(process.env.SESSION_HMAC_SECRET!, payloadB64, 32);
  return `${payloadB64}.${hmac}`;
}

test.describe('Auth Module — Session Tokens', () => {
  test('session token round-trips guest name', async () => {
    const token = createSessionToken('Alex Rivera');
    const parsed = parseSessionToken(token);

    expect(parsed).not.toBeNull();
    expect(parsed!.guest).toBe('Alex Rivera');
    expect(parsed!.notionId).toBeUndefined();
  });

  test('session token includes notionId when provided', async () => {
    const notionId = 'abc123-def456';
    const token = createSessionToken('Jordan Chen', notionId);
    const parsed = parseSessionToken(token);

    expect(parsed).not.toBeNull();
    expect(parsed!.guest).toBe('Jordan Chen');
    expect(parsed!.notionId).toBe(notionId);
  });

  test('omitted eventInvitations defaults to both (legacy cookies)', async () => {
    const token = createSessionToken('Alex Rivera');
    const parsed = parseSessionToken(token);
    expect(parsed!.eventInvitations).toEqual(['nyc', 'france']);
  });

  test('explicit empty eventInvitations stays empty (descoped guest)', async () => {
    const token = createSessionToken('Alex Rivera', 'notion-descoped', []);
    const parsed = parseSessionToken(token);
    expect(parsed!.eventInvitations).toEqual([]);
  });

  test('unsigned legacy tokens are rejected', async () => {
    const payload = { guest: 'Alex Rivera', created: 1700000000000 };
    const unsigned = Buffer.from(JSON.stringify(payload)).toString('base64url');
    expect(parseSessionToken(unsigned)).toBeNull();
  });

  test('tampered HMAC is rejected', async () => {
    const token = createSessionToken('Alex Rivera');
    const [payloadB64] = token.split('.');
    expect(parseSessionToken(`${payloadB64}.00000000000000000000000000000000`)).toBeNull();
  });

  test('invalid base64 token returns null on parse', async () => {
    expect(parseSessionToken('not-valid-base64!!!')).toBeNull();
  });
});

test.describe('Auth Module — Missing signing secret', () => {
  test('createSessionToken throws SessionSecretMissingError when secret is unset', async () => {
    const saved = process.env.SESSION_HMAC_SECRET;
    delete process.env.SESSION_HMAC_SECRET;
    try {
      expect(() => createSessionToken('Alex Rivera')).toThrow(SessionSecretMissingError);
      expect(() => createSessionToken('Alex Rivera')).toThrow(/SESSION_HMAC_SECRET/);
    } finally {
      process.env.SESSION_HMAC_SECRET = saved;
    }
  });

  test('parseSessionToken fails closed when secret is unset', async () => {
    const token = createSessionToken('Alex Rivera');
    const saved = process.env.SESSION_HMAC_SECRET;
    delete process.env.SESSION_HMAC_SECRET;
    try {
      expect(parseSessionToken(token)).toBeNull();
    } finally {
      process.env.SESSION_HMAC_SECRET = saved;
    }
  });
});

test.describe('Auth Module — Session expiry', () => {
  const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  test('freshly minted token carries a valid created timestamp', async () => {
    // Guards the fail-closed rule below: parseSessionToken may reject tokens
    // without `created` only because createSessionToken always sets it.
    const token = createSessionToken('Alex Rivera');
    const [payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    expect(typeof payload.created).toBe('number');
    expect(payload.created).toBeGreaterThan(Date.now() - 5_000);
  });

  test('signed token older than 90 days is rejected', async () => {
    const token = signSessionPayload({
      guest: 'Alex Rivera',
      created: Date.now() - SESSION_MAX_AGE_MS - DAY_MS,
    });
    expect(parseSessionToken(token)).toBeNull();
  });

  test('signed token younger than 90 days is accepted', async () => {
    const token = signSessionPayload({
      guest: 'Alex Rivera',
      created: Date.now() - SESSION_MAX_AGE_MS + DAY_MS,
    });
    const parsed = parseSessionToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed!.guest).toBe('Alex Rivera');
  });

  test('signed token with missing created is rejected', async () => {
    const token = signSessionPayload({ guest: 'Alex Rivera' });
    expect(parseSessionToken(token)).toBeNull();
  });

  test('signed token with garbage created is rejected', async () => {
    expect(
      parseSessionToken(signSessionPayload({ guest: 'Alex Rivera', created: 'yesterday' }))
    ).toBeNull();
    // JSON.stringify turns NaN into null — still a non-number, still rejected
    expect(
      parseSessionToken(signSessionPayload({ guest: 'Alex Rivera', created: NaN }))
    ).toBeNull();
  });
});

test.describe('Auth Module — Name Normalization', () => {
  test('normalizes case', async () => {
    expect(normalize('ALEX RIVERA')).toBe('alex rivera');
    expect(normalize('alex rivera')).toBe('alex rivera');
  });

  test('removes accents', async () => {
    expect(normalize('Amélie Boucher')).toBe('amelie boucher');
    expect(normalize('François Müller')).toBe('francois muller');
  });

  test('collapses whitespace', async () => {
    expect(normalize('  Alex   Rivera  ')).toBe('alex rivera');
  });

  test('treats hyphens as word separators', async () => {
    expect(normalize('Jean-Pierre Delacroix')).toBe('jean pierre delacroix');
    expect(normalize('Jean Pierre Delacroix')).toBe('jean pierre delacroix');
    expect(normalize('jean-pierre   delacroix')).toBe('jean pierre delacroix');
  });

  test('handles combined normalization', async () => {
    expect(normalize('  AMÉLIE   BOUCHER  ')).toBe('amelie boucher');
  });

  test('folds ligature and stroke letters to their ASCII spellings', async () => {
    // These have no NFD decomposition, so the accent strip alone leaves them
    // unmatched against the ASCII form a guest actually types (and vice versa).
    expect(normalize('Cœur')).toBe('coeur');
    expect(normalize('COEUR')).toBe(normalize('CŒUR'));
    expect(normalize('Groß')).toBe('gross');
    expect(normalize('Søren Kjær')).toBe('soren kjaer');
    expect(normalize('Łukasz Đorđević')).toBe('lukasz dordevic');
  });

  test('removes apostrophes regardless of form', async () => {
    // iOS smart punctuation types U+2019 (’) when the guest presses ' — all
    // apostrophe-like characters must collapse to the same normalized name.
    expect(normalize("Rebecca O'Reilly")).toBe('rebecca oreilly'); // straight U+0027
    expect(normalize('Rebecca O’Reilly')).toBe('rebecca oreilly'); // curly U+2019
    expect(normalize('Rebecca O‘Reilly')).toBe('rebecca oreilly'); // curly U+2018
    expect(normalize('Rebecca OʼReilly')).toBe('rebecca oreilly'); // modifier U+02BC
    expect(normalize('Rebecca O`Reilly')).toBe('rebecca oreilly'); // backtick U+0060
    expect(normalize('Rebecca O´Reilly')).toBe('rebecca oreilly'); // acute U+00B4
  });

  test('treats Unicode dashes as word separators', async () => {
    // iOS smart punctuation can also produce en/em dashes.
    expect(normalize('Jean–Pierre Delacroix')).toBe('jean pierre delacroix'); // en dash
    expect(normalize('Jean—Pierre Delacroix')).toBe('jean pierre delacroix'); // em dash
    expect(normalize('Jean‑Pierre Delacroix')).toBe('jean pierre delacroix'); // non-breaking hyphen
  });
});

test.describe('Auth Module — Guest Validation', () => {
  // Invented names chosen for their *shape* — accents, hyphens, apostrophes —
  // never real guests'. This repo is public.
  const mockGuests: GuestRecord[] = [
    { id: 'notion-1', name: 'Alex Rivera', normalizedName: 'alex rivera', eventInvitations: ['nyc'], isPlusOne: false, relatedGuestIds: [] },
    { id: 'notion-2', name: 'Jordan Chen', normalizedName: 'jordan chen', eventInvitations: ['nyc'], isPlusOne: false, relatedGuestIds: [] },
    { id: 'notion-3', name: 'Amélie Boucher', normalizedName: 'amelie boucher', eventInvitations: ['france'], isPlusOne: false, relatedGuestIds: [] },
    {
      id: 'notion-4',
      name: 'Jean-Pierre Delacroix',
      normalizedName: 'jean pierre delacroix',
      eventInvitations: ['france'],
      isPlusOne: false,
      relatedGuestIds: [],
    },
    {
      id: 'notion-5',
      name: "Rebecca O'Reilly",
      normalizedName: 'rebecca oreilly',
      eventInvitations: ['nyc'],
      isPlusOne: false,
      relatedGuestIds: [],
    },
  ];

  test('finds guest by exact name', async () => {
    const found = validateGuestFromRecords('Alex Rivera', mockGuests);
    expect(found).toBeDefined();
    expect(found!.id).toBe('notion-1');
  });

  test('finds guest by case-insensitive name', async () => {
    const found = validateGuestFromRecords('alex rivera', mockGuests);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Alex Rivera');
  });

  test('finds guest with accent normalization', async () => {
    const found = validateGuestFromRecords('Amelie Boucher', mockGuests);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Amélie Boucher');
  });

  test('finds hyphenated-name guest when input omits the hyphen', async () => {
    const found = validateGuestFromRecords('Jean Pierre Delacroix', mockGuests);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Jean-Pierre Delacroix');
  });

  test('finds hyphenated-name guest when input includes the hyphen', async () => {
    const found = validateGuestFromRecords('jean-pierre delacroix', mockGuests);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Jean-Pierre Delacroix');
  });

  test('finds apostrophe-name guest for any apostrophe form the keyboard produces', async () => {
    // Straight apostrophe, iOS smart-punctuation curly apostrophe, and no
    // apostrophe at all must all resolve to the stored record.
    for (const typed of ["Rebecca O'Reilly", 'Rebecca O’Reilly', 'Rebecca OReilly']) {
      const found = validateGuestFromRecords(typed, mockGuests);
      expect(found, `input: ${typed}`).not.toBeNull();
      expect(found!.id).toBe('notion-5');
    }
  });

  test('returns null for unknown guest', async () => {
    const found = validateGuestFromRecords('Unknown Person', mockGuests);
    expect(found).toBeNull();
  });

  test('hardcoded fallback accepts synthetic names', async () => {
    expect(validateGuest('Alex Rivera')).toBe('Alex Rivera');
    expect(validateGuest('Unknown Person')).toBeNull();
  });
});

// The name printed on the invitation (`Name of Guest`) is not always the same
// as the `Full Name` formula login has always matched. Matching only Full Name
// meant one wrong or missing name part in Notion locked a guest out entirely —
// including from the envelope-name rules, which check a typed surname against
// the household's own.
test.describe('Invitation-title login fallback', () => {
  const nicknamed: GuestRecord = {
    id: 'notion-10',
    name: 'Frederica Okonkwo',
    normalizedName: 'frederica okonkwo',
    invitationTitle: 'Freddie Okonkwo',
    eventInvitations: ['nyc'],
    isPlusOne: false,
    relatedGuestIds: [],
  };
  // Surname mistyped in `Last Name`, so `Full Name` is wrong but the printed
  // title is right — the shape that produced the original bug report.
  const badSurname: GuestRecord = {
    id: 'notion-11',
    name: 'Margot Delacroi',
    normalizedName: 'margot delacroi',
    invitationTitle: 'Margot Delacroix',
    eventInvitations: ['france'],
    isPlusOne: false,
    relatedGuestIds: [],
  };
  const records = [nicknamed, badSurname];

  test('accepts the name printed on the invitation', async () => {
    expect(validateGuestFromRecords('Freddie Okonkwo', records)?.id).toBe('notion-10');
    expect(validateGuestFromRecords('Margot Delacroix', records)?.id).toBe('notion-11');
  });

  test('still accepts the Full Name', async () => {
    expect(validateGuestFromRecords('Frederica Okonkwo', records)?.id).toBe('notion-10');
    expect(validateGuestFromRecords('Margot Delacroi', records)?.id).toBe('notion-11');
  });

  test('normalizes titles the same way as Full Names', async () => {
    expect(validateGuestFromRecords('  freddie   okonkwo ', records)?.id).toBe('notion-10');
  });

  test('Full Name wins over another record title, across the whole list', async () => {
    // Someone's Full Name is someone else's printed title: the Full Name owner
    // must win, no matter which record comes first in the list.
    const collision: GuestRecord[] = [
      { ...nicknamed, invitationTitle: 'Robin Vasquez' },
      {
        id: 'notion-12',
        name: 'Robin Vasquez',
        normalizedName: 'robin vasquez',
        invitationTitle: 'Robin Vasquez',
        eventInvitations: ['nyc'],
        isPlusOne: false,
        relatedGuestIds: [],
      },
    ];
    expect(validateGuestFromRecords('Robin Vasquez', collision)?.id).toBe('notion-12');
  });

  test('a title shared by two records fails closed', async () => {
    const ambiguous: GuestRecord[] = [
      { ...nicknamed, id: 'notion-13' },
      { ...nicknamed, id: 'notion-14', name: 'Frederica Ozawa', normalizedName: 'frederica ozawa' },
    ];
    expect(validateGuestFromRecords('Freddie Okonkwo', ambiguous)).toBeNull();
  });

  test('matchGuestsFromRecords returns every holder of a duplicated Full Name', async () => {
    // Two people (different households) sharing a Full Name: the login route
    // must see both so it can disambiguate, instead of the first silently
    // receiving the session either of them asked for.
    const duplicates: GuestRecord[] = [
      { ...nicknamed, id: 'dup-1', name: 'Louis Garnier', normalizedName: 'louis garnier', invitationTitle: undefined },
      { ...nicknamed, id: 'dup-2', name: 'Louis Garnier', normalizedName: 'louis garnier', invitationTitle: undefined },
    ];
    const matches = matchGuestsFromRecords('Louis Garnier', duplicates);
    expect(matches.map((g) => g.id).sort()).toEqual(['dup-1', 'dup-2']);
  });

  test('matchGuestsFromRecords returns every holder of a shared title', async () => {
    // Where the single-result matcher fails closed, the plural matcher hands
    // both candidates to the identity picker — their distinct Full Names make
    // them distinguishable to the guest.
    const ambiguous: GuestRecord[] = [
      { ...nicknamed, id: 'notion-13' },
      { ...nicknamed, id: 'notion-14', name: 'Frederica Ozawa', normalizedName: 'frederica ozawa' },
    ];
    const matches = matchGuestsFromRecords('Freddie Okonkwo', ambiguous);
    expect(matches.map((g) => g.id).sort()).toEqual(['notion-13', 'notion-14']);
  });

  test('matchGuestsFromRecords never mixes Full Name and title matches', async () => {
    // A Full Name match settles the question — another record whose *title*
    // happens to equal the typed name must not widen it into a picker.
    const collision: GuestRecord[] = [
      { ...nicknamed, id: 'own-name', name: 'Robin Vasquez', normalizedName: 'robin vasquez', invitationTitle: undefined },
      { ...badSurname, id: 'title-only', invitationTitle: 'Robin Vasquez' },
    ];
    const matches = matchGuestsFromRecords('Robin Vasquez', collision);
    expect(matches.map((g) => g.id)).toEqual(['own-name']);
  });

  test('records without a title are unaffected', async () => {
    expect(validateGuestFromRecords('Alex Rivera', mockGuestsNoTitles)?.id).toBe('no-title-1');
    expect(validateGuestFromRecords('Someone Else', mockGuestsNoTitles)).toBeNull();
  });

  const mockGuestsNoTitles: GuestRecord[] = [
    {
      id: 'no-title-1',
      name: 'Alex Rivera',
      normalizedName: 'alex rivera',
      eventInvitations: ['nyc'],
      isPlusOne: false,
      relatedGuestIds: [],
    },
  ];
});

/**
 * The synthetic 🤖 guests are real Notion Guest List rows whose names are
 * published in this repo, so they must never be able to log in anywhere the
 * public can reach. `global.testGuestLogin` gates that, and the one way to
 * silently undo it is to add the flag to netlify.toml alongside the other
 * preview flags — deploy previews are shareable URLs. Guard that directly.
 */
test.describe('Test-guest login gate', () => {
  test('the test-guest flag is not enabled for deploy previews', async () => {
    const { readFile } = await import('node:fs/promises');
    const netlifyToml = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
    expect(netlifyToml).not.toContain('FEATURE_GLOBAL_TEST_GUEST_LOGIN');
  });

  test('every synthetic guest name is covered by isTestGuest', async () => {
    const { TEST_GUEST_DISPLAY_NAMES, isTestGuest } = await import('../src/lib/test-guests');
    const { TEST_GUEST_NAME, TEST_GUEST_FRANCE_NAME } = await import('./fixtures');

    for (const name of [TEST_GUEST_NAME, TEST_GUEST_FRANCE_NAME]) {
      expect(TEST_GUEST_DISPLAY_NAMES).toContain(name);
      expect(isTestGuest({ name })).toBe(true);
    }
    // Accent- and case-insensitive, matching the login normalizer.
    expect(isTestGuest({ name: '  RILEY   DUBOIS ' })).toBe(true);
    expect(isTestGuest({ name: 'Someone Else' })).toBe(false);
  });

  test('the scripts-side exclusion list matches the app-side one', async () => {
    const { TEST_GUEST_NORMALIZED_NAMES: appNames } = await import('../src/lib/test-guests');
    const { TEST_GUEST_NORMALIZED_NAMES: scriptNames } = await import('../scripts/lib/test-guests.mjs');
    expect([...scriptNames].sort()).toEqual([...appNames].sort());
  });
});
