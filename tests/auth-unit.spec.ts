import { test, expect } from '@playwright/test';
import {
  createSessionToken,
  parseSessionToken,
  validateGuest,
  validateGuestFromRecords,
  SESSION_MAX_AGE_SECONDS,
  SessionSecretMissingError,
} from '../src/lib/auth';
import { normalize } from '../src/lib/normalize';
import { hmacSha256Hex } from '../src/lib/hmac';

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
    expect(normalize('Dorothée Ancel')).toBe('dorothee ancel');
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
    expect(normalize('  DOROTHÉE   ANCEL  ')).toBe('dorothee ancel');
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
  const mockGuests = [
    { id: 'notion-1', name: 'Alex Rivera', normalizedName: 'alex rivera', eventInvitations: ['nyc'] as const, isPlusOne: false, relatedGuestIds: [] },
    { id: 'notion-2', name: 'Jordan Chen', normalizedName: 'jordan chen', eventInvitations: ['nyc'] as const, isPlusOne: false, relatedGuestIds: [] },
    { id: 'notion-3', name: 'Dorothée Ancel', normalizedName: 'dorothee ancel', eventInvitations: ['france'] as const, isPlusOne: false, relatedGuestIds: [] },
    {
      id: 'notion-4',
      name: 'Jean-Pierre Delacroix',
      normalizedName: 'jean pierre delacroix',
      eventInvitations: ['france'] as const,
      isPlusOne: false,
      relatedGuestIds: [],
    },
    {
      id: 'notion-5',
      name: "Rebecca O'Reilly",
      normalizedName: 'rebecca oreilly',
      eventInvitations: ['nyc'] as const,
      isPlusOne: false,
      relatedGuestIds: [],
    },
  ];

  test('finds guest by exact name', async () => {
    const found = validateGuestFromRecords('Alex Rivera', [...mockGuests]);
    expect(found).toBeDefined();
    expect(found!.id).toBe('notion-1');
  });

  test('finds guest by case-insensitive name', async () => {
    const found = validateGuestFromRecords('alex rivera', [...mockGuests]);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Alex Rivera');
  });

  test('finds guest with accent normalization', async () => {
    const found = validateGuestFromRecords('Dorothee Ancel', [...mockGuests]);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Dorothée Ancel');
  });

  test('finds hyphenated-name guest when input omits the hyphen', async () => {
    const found = validateGuestFromRecords('Jean Pierre Delacroix', [...mockGuests]);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Jean-Pierre Delacroix');
  });

  test('finds hyphenated-name guest when input includes the hyphen', async () => {
    const found = validateGuestFromRecords('jean-pierre delacroix', [...mockGuests]);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Jean-Pierre Delacroix');
  });

  test('finds apostrophe-name guest for any apostrophe form the keyboard produces', async () => {
    // Straight apostrophe, iOS smart-punctuation curly apostrophe, and no
    // apostrophe at all must all resolve to the stored record.
    for (const typed of ["Rebecca O'Reilly", 'Rebecca O’Reilly', 'Rebecca OReilly']) {
      const found = validateGuestFromRecords(typed, [...mockGuests]);
      expect(found, `input: ${typed}`).not.toBeNull();
      expect(found!.id).toBe('notion-5');
    }
  });

  test('returns null for unknown guest', async () => {
    const found = validateGuestFromRecords('Unknown Person', [...mockGuests]);
    expect(found).toBeNull();
  });

  test('hardcoded fallback accepts synthetic names', async () => {
    expect(validateGuest('Alex Rivera')).toBe('Alex Rivera');
    expect(validateGuest('Unknown Person')).toBeNull();
  });
});
