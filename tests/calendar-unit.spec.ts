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

  test("lang='fr' keeps canonical timing when no French start time is set", () => {
    const ics = buildICS([FR_LOCALIZED_EVENT], 'fr');
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20270528T190000');
    expect(ics).toContain('DTEND;TZID=Europe/Paris:20270528T220000');
  });

  test("lang='fr' with an unparseable French start time falls back to the English time", () => {
    const event: EventWithDate = { ...FR_LOCALIZED_EVENT, startTimeFr: '19 h' };
    const ics = buildICS([event], 'fr');
    // "19 h" is not parseable — timing must not regress to a DATE-only event
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20270528T190000');
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
