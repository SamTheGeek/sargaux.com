import { test, expect } from '@playwright/test';
import {
  createSessionToken,
  parseSessionToken,
  validateGuest,
  validateGuestFromRecords,
} from '../src/lib/auth';
import { normalize } from '../src/lib/normalize';

/**
 * Unit-style tests for auth functions. These run in the Playwright Node context
 * (not the browser) to directly test the auth module's logic.
 */

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

  test('returns null for unknown guest', async () => {
    const found = validateGuestFromRecords('Unknown Person', [...mockGuests]);
    expect(found).toBeNull();
  });

  test('hardcoded fallback accepts synthetic names', async () => {
    expect(validateGuest('Alex Rivera')).toBe('Alex Rivera');
    expect(validateGuest('Unknown Person')).toBeNull();
  });
});
