/**
 * Unit tests for calendar ICS generation and token logic.
 * No server required — imports src/lib/calendar.ts directly.
 */

import { test, expect } from '@playwright/test';
import { generateToken, verifyToken, buildICS, parseTime, parseDuration } from '../src/lib/calendar';
import type { EventWithDate } from '../src/lib/calendar';

const TEST_SECRET = 'test-hmac-secret-for-unit-tests';
const TEST_GUEST_ID = 'abc123-test-notion-page-id';

// Set the secret for token tests
process.env.CALENDAR_HMAC_SECRET = TEST_SECRET;

const NYC_EVENT: EventWithDate = {
  id: 'event-nyc-1',
  name: 'Wedding Dinner',
  type: 'Core',
  wedding: 'nyc',
  date: '2026-10-11',
  startTime: '6:00 PM',
  duration: '3h',
  location: 'The Venue, New York',
  showOnWebsite: true,
};

const FRANCE_EVENT: EventWithDate = {
  id: 'event-france-1',
  name: 'Cérémonie',
  type: 'Core',
  wedding: 'france',
  date: '2027-05-28',
  showOnWebsite: true,
};

test.describe('buildICS', () => {
  test('produces valid RFC 5545 envelope', () => {
    const ics = buildICS([NYC_EVENT]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('X-WR-CALNAME:Sargaux Wedding');
  });

  test('includes VEVENT for an event with a date', () => {
    const ics = buildICS([NYC_EVENT]);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('SUMMARY:Wedding Dinner');
    expect(ics).toContain('LOCATION:The Venue\\, New York');
  });

  test('DTSTART uses TZID America/New_York for NYC events with time', () => {
    const ics = buildICS([NYC_EVENT]);
    expect(ics).toContain('DTSTART;TZID=America/New_York:20261011T180000');
  });

  test('DTEND is 3 hours after DTSTART for duration=3h', () => {
    const ics = buildICS([NYC_EVENT]);
    expect(ics).toContain('DTEND;TZID=America/New_York:20261011T210000');
  });

  test('DTSTART uses TZID Europe/Paris for France events with time', () => {
    const event: EventWithDate = { ...FRANCE_EVENT, startTime: '14:00', duration: '2h' };
    const ics = buildICS([event]);
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20270528T140000');
  });

  test('DATE-only DTSTART for events without startTime', () => {
    const ics = buildICS([FRANCE_EVENT]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270528');
  });

  test('skips events without a date', () => {
    const eventNoDate: EventWithDate = { ...NYC_EVENT, date: undefined };
    const ics = buildICS([eventNoDate]);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  test('empty event list produces valid calendar with no events', () => {
    const ics = buildICS([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  test('multiple events produce multiple VEVENTs', () => {
    const ics = buildICS([NYC_EVENT, FRANCE_EVENT]);
    const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(count).toBe(2);
  });

  test('UID is stable and unique per event', () => {
    const ics = buildICS([NYC_EVENT]);
    expect(ics).toContain('UID:event-nyc-1@sargaux.com');
  });

  test('an event ending inside the 23:00 hour keeps its real end time', () => {
    // The old clamp rounded ANY end in hour 23 up to 23:59 — a 21:30 + 2h
    // dinner showed as ending at 23:59 instead of 23:30.
    const lateDinner: EventWithDate = { ...NYC_EVENT, startTime: '9:30 PM', duration: '2h' };
    const ics = buildICS([lateDinner]);
    expect(ics).toContain('DTEND;TZID=America/New_York:20261011T233000');
  });

  test('a midnight-crossing event is clamped to 23:59', () => {
    const allNighter: EventWithDate = { ...NYC_EVENT, startTime: '11:00 PM', duration: '3h' };
    const ics = buildICS([allNighter]);
    expect(ics).toContain('DTEND;TZID=America/New_York:20261011T235900');
  });

  test('emits a VTIMEZONE for each TZID actually referenced', () => {
    const nycOnly = buildICS([NYC_EVENT]);
    expect(nycOnly).toContain('TZID:America/New_York');
    expect(nycOnly).toContain('BEGIN:VTIMEZONE');
    expect(nycOnly).not.toContain('TZID:Europe/Paris');

    const both = buildICS([NYC_EVENT, { ...FRANCE_EVENT, startTime: '14:00' }]);
    expect((both.match(/BEGIN:VTIMEZONE/g) ?? []).length).toBe(2);

    // All-day events carry no TZID, so no VTIMEZONE either
    const allDay = buildICS([FRANCE_EVENT]);
    expect(allDay).not.toContain('BEGIN:VTIMEZONE');
  });

  test('an unparseable Start Time falls back to all-day instead of vanishing', () => {
    const badTime: EventWithDate = { ...NYC_EVENT, startTime: 'around sunset' };
    const ics = buildICS([badTime]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261011');
    expect(ics).toContain('BEGIN:VEVENT');
  });

  test('folds long lines by UTF-8 octets without splitting characters', () => {
    const accented: EventWithDate = {
      ...FRANCE_EVENT,
      startTime: '14:00',
      // é is 2 octets in UTF-8 — long enough to force several folds, and
      // positioned so a code-unit-based fold would split one in half.
      location: 'Château de Sully — Salle des Fêtes, Allée des Érables numéro '.repeat(4),
    };
    const ics = buildICS([accented]);
    const utf8 = new TextEncoder();
    for (const line of ics.split('\r\n')) {
      expect(utf8.encode(line).length, `line too long: ${line}`).toBeLessThanOrEqual(75);
    }
    // Unfolding restores the original text — nothing was dropped or split
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('Salle des Fêtes');
  });

  test('carriage returns in text fields never reach the output raw', () => {
    const windowsPaste: EventWithDate = {
      ...NYC_EVENT,
      description: 'Line one\r\nLine two\rLine three',
    };
    const ics = buildICS([windowsPaste]);
    // \r may only appear as part of the \r\n line terminator
    expect(ics.replace(/\r\n/g, '')).not.toContain('\r');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two\\nLine three');
  });
});

test.describe('buildICS — French localization', () => {
  const FR_LOCALIZED_EVENT: EventWithDate = {
    id: 'event-france-2',
    name: 'Friday Welcome Dinner',
    type: 'Core',
    wedding: 'france',
    date: '2027-05-28',
    startTime: '7:00 PM',
    duration: '3h',
    location: 'Village Square',
    description: 'Welcome dinner on Friday evening',
    nameFr: 'Dîner au Marché du Village',
    locationFr: 'La Place du Village',
    showOnWebsite: true,
  };

  test("lang='fr' uses the French name and location", () => {
    const ics = buildICS([FR_LOCALIZED_EVENT], 'fr');
    expect(ics).toContain('SUMMARY:Dîner au Marché du Village');
    expect(ics).toContain('LOCATION:La Place du Village');
  });

  test("lang='fr' falls back to English fields when French is unset", () => {
    const ics = buildICS([FR_LOCALIZED_EVENT], 'fr');
    // No Description FR on the event — English description is kept
    expect(ics).toContain('DESCRIPTION:Welcome dinner on Friday evening');
  });

  test("lang='fr' keeps canonical timing — DTSTART/DTEND are language-neutral", () => {
    const ics = buildICS([FR_LOCALIZED_EVENT], 'fr');
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20270528T190000');
    expect(ics).toContain('DTEND;TZID=Europe/Paris:20270528T220000');
  });

  test('default lang stays English', () => {
    const ics = buildICS([FR_LOCALIZED_EVENT]);
    expect(ics).toContain('SUMMARY:Friday Welcome Dinner');
    expect(ics).toContain('LOCATION:Village Square');
  });
});

test.describe('generateToken / verifyToken', () => {
  test('verifyToken recovers the guestId from a valid token', () => {
    const token = generateToken(TEST_GUEST_ID);
    expect(verifyToken(token)).toBe(TEST_GUEST_ID);
  });

  test('verifyToken returns null for a tampered HMAC', () => {
    const token = generateToken(TEST_GUEST_ID);
    const dot = token.indexOf('.');
    const tampered = token.slice(0, dot + 1) + 'a'.repeat(32);
    expect(verifyToken(tampered)).toBeNull();
  });

  test('verifyToken returns null for a token with no dot', () => {
    expect(verifyToken('notavalidtoken')).toBeNull();
  });

  test('verifyToken returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });
});

test.describe('parseTime', () => {
  test('parses 12-hour format', () => {
    expect(parseTime('6:00 PM')).toEqual({ hour: 18, minute: 0 });
    expect(parseTime('12:00 AM')).toEqual({ hour: 0, minute: 0 });
    expect(parseTime('12:30 PM')).toEqual({ hour: 12, minute: 30 });
  });

  test('parses 24-hour format', () => {
    expect(parseTime('14:00')).toEqual({ hour: 14, minute: 0 });
  });

  test('parses minute-less 12-hour times', () => {
    expect(parseTime('6 PM')).toEqual({ hour: 18, minute: 0 });
    expect(parseTime('12 AM')).toEqual({ hour: 0, minute: 0 });
  });

  test('tolerates surrounding whitespace', () => {
    expect(parseTime(' 6:00 PM ')).toEqual({ hour: 18, minute: 0 });
  });

  test('rejects out-of-range values instead of emitting nonsense times', () => {
    expect(parseTime('25:00')).toBeUndefined();
    expect(parseTime('14:75')).toBeUndefined();
    expect(parseTime('0:30 PM')).toBeUndefined();
    expect(parseTime('13:00 PM')).toBeUndefined();
  });

  test('returns undefined for unparseable input', () => {
    expect(parseTime('not a time')).toBeUndefined();
  });
});

test.describe('parseDuration', () => {
  test('parses hours and minutes', () => {
    expect(parseDuration('3h')).toBe(180);
    expect(parseDuration('90m')).toBe(90);
    expect(parseDuration('2h30m')).toBe(150);
  });

  test('returns undefined for empty or invalid input', () => {
    expect(parseDuration('')).toBeUndefined();
    expect(parseDuration('invalid')).toBeUndefined();
  });
});
