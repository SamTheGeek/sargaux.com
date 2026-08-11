/**
 * Calendar subscription utilities.
 *
 * Generates HMAC-signed tokens for personalized .ics calendar feeds.
 * Tokens are URL-safe and do not require session cookies — designed
 * for webcal:// subscription URLs that calendar apps poll directly.
 *
 * CALENDAR_HMAC_SECRET is a runtime secret (process.env, never committed).
 */

import type { EventRecord } from '../types';
import type { Lang } from '../content/strings';
import { localizeEvent } from './event-i18n';
import { toBase64Url, fromBase64Url, hmacSha256Hex, timingSafeEqualString } from './hmac';

/**
 * Compute HMAC-SHA256 of guestId using CALENDAR_HMAC_SECRET.
 * Returns first 32 hex characters.
 */
function computeHmac(guestId: string): string {
  const secret = process.env.CALENDAR_HMAC_SECRET;
  if (!secret) throw new Error('CALENDAR_HMAC_SECRET is not set.');
  return hmacSha256Hex(secret, guestId, 32);
}

/**
 * Generate a calendar subscription token for a guest.
 * Format: base64url(guestId).hmac[0:32]
 */
export function generateToken(guestId: string): string {
  const encoded = toBase64Url(guestId);
  const hmac = computeHmac(guestId);
  return `${encoded}.${hmac}`;
}

/**
 * Generate a calendar token when runtime config allows it.
 * Returns null instead of throwing when the signing secret is unavailable.
 */
export function generateTokenIfPossible(guestId?: string | null): string | null {
  if (!guestId) return null;
  try {
    return generateToken(guestId);
  } catch {
    return null;
  }
}

/**
 * Verify a calendar token and return the guestId, or null if invalid.
 */
export function verifyToken(token: string): string | null {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return null;

  const encoded = token.slice(0, dotIndex);
  const providedHmac = token.slice(dotIndex + 1);

  const guestId = fromBase64Url(encoded);
  if (!guestId) return null;

  let expectedHmac: string;
  try {
    expectedHmac = computeHmac(guestId);
  } catch {
    return null;
  }

  if (!timingSafeEqualString(providedHmac, expectedHmac)) return null;
  return guestId;
}

/**
 * Parse a duration string like "3h", "90m", or "2h30m" into total minutes.
 * Returns undefined if the string is empty or cannot be parsed.
 */
export function parseDuration(duration: string): number | undefined {
  const match = duration.trim().match(/^(?:(\d+)h)?(?:(\d+)m)?$/);
  if (!match) return undefined;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

/**
 * Parse a time string like "6:00 PM", "6 PM", or "14:00" into
 * { hour, minute }. Returns undefined if the string cannot be parsed or is
 * out of range — a hand-typed Notion `Start Time` like "25:00" must not
 * become a nonsense DTSTART.
 */
export function parseTime(time: string): { hour: number; minute: number } | undefined {
  const trimmed = time.trim();

  // 12-hour format: "6:00 PM", "11:30 AM", and minute-less "6 PM"
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\.?$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2] ?? '0', 10);
    if (hour < 1 || hour > 12 || minute > 59) return undefined;
    const period = match12[3].toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    return { hour, minute };
  }

  // 24-hour format: "14:00", "09:30"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    if (hour > 23 || minute > 59) return undefined;
    return { hour, minute };
  }

  return undefined;
}

/**
 * Format a date-only string "YYYY-MM-DD" as ICS date: "20261011"
 */
function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Current UTC timestamp in ICS format: "20260220T120000Z"
 */
function dtstamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

/**
 * Escape special characters in ICS text fields (RFC 5545 §3.3.11).
 * Carriage returns are normalized away first — a raw CR inside a property
 * value (Notion text pasted from Windows) breaks the line-based format.
 */
function escapeICS(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Fold a single ICS content line to ≤75 octets per RFC 5545 §3.1.
 * Continuation lines begin with a single space.
 *
 * The 75-octet limit is measured in UTF-8 bytes, not string length, and a
 * split must never land inside a multi-byte sequence — folding "Château" or
 * an emoji by UTF-16 code units can cut a character in half, which some
 * parsers reject wholesale. Iterating by code point keeps every character
 * (surrogate pairs included) intact.
 */
const utf8 = new TextEncoder();

function foldLine(line: string): string {
  if (utf8.encode(line).length <= 75) return line;

  const folded: string[] = [];
  let chunk = '';
  let octets = 0;
  for (const char of line) {
    const size = utf8.encode(char).length;
    if (octets + size > 75) {
      folded.push(chunk);
      chunk = ' '; // continuation marker counts against the next line's limit
      octets = 1;
    }
    chunk += char;
    octets += size;
  }
  folded.push(chunk);
  return folded.join('\r\n');
}

/**
 * Add one calendar day to a "YYYY-MM-DD" string.
 */
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

export interface EventWithDate extends EventRecord {
  date?: string; // "YYYY-MM-DD" resolved from the Day relation page
}

/**
 * VTIMEZONE definitions for the two zones this wedding uses. RFC 5545
 * requires a VTIMEZONE component for every TZID referenced by an event —
 * Apple and Google tolerate the omission, but stricter parsers (Outlook
 * among them) drop or mis-shift events without one. Standard recurring
 * DST rules, the same fixed blocks every major exporter emits.
 */
const VTIMEZONES: Record<string, string[]> = {
  'America/New_York': [
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ],
  'Europe/Paris': [
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Paris',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ],
};

/**
 * Build an RFC 5545 ICS calendar string from a list of events.
 * Events without a date are skipped.
 * Events with a date but no parseable time get a DATE-only DTSTART.
 *
 * `lang: 'fr'` renders each event's French display fields (name,
 * description, location), falling back per field to English. Timing is
 * language-neutral: DTSTART/DTEND always come from the canonical
 * startTime/duration.
 */
export function buildICS(events: EventWithDate[], lang: Lang = 'en'): string {
  const stamp = dtstamp();
  const usedTimezones = new Set<string>();

  const vevents = events
    .map((event) => {
      if (!event.date) return null;

      const timezone = event.wedding === 'nyc' ? 'America/New_York' : 'Europe/Paris';
      const uid = `${event.id}@sargaux.com`;
      const loc = localizeEvent(event, lang);

      let dtstart: string;
      let dtend: string;

      const parsed = event.startTime ? parseTime(event.startTime) : undefined;
      if (event.startTime && !parsed) {
        // A Start Time that fails to parse silently downgrades the event to
        // all-day — visible only to guests, not in any log. Say so.
        console.warn(
          `[ics] Event ${event.id} ("${event.name}") has an unparseable Start Time ${JSON.stringify(event.startTime)} — emitting as all-day`
        );
      }
      if (parsed) {
        usedTimezones.add(timezone);
        const [year, month, day] = event.date.split('-').map(Number);
        const pad = (n: number) => String(n).padStart(2, '0');
        const localStr = `${year}${pad(month)}${pad(day)}T${pad(parsed.hour)}${pad(parsed.minute)}00`;
        // Use explicit duration if provided, otherwise fall back to 2h default
        const durationMinutes =
          (event.duration ? parseDuration(event.duration) : undefined) ?? 120;
        // Clamp to 23:59 only when the event would cross midnight — the old
        // formula rounded ANY event ending in the 23:00 hour up to 23:59
        // (a 21:30 dinner + 2h showed as ending at 23:59, not 23:30).
        const endMinutes = Math.min(
          parsed.hour * 60 + parsed.minute + durationMinutes,
          23 * 60 + 59
        );
        const endH = Math.floor(endMinutes / 60);
        const endM = endMinutes % 60;
        const endStr = `${year}${pad(month)}${pad(day)}T${pad(endH)}${pad(endM)}00`;
        dtstart = `DTSTART;TZID=${timezone}:${localStr}`;
        dtend = `DTEND;TZID=${timezone}:${endStr}`;
      } else {
        const d = formatDate(event.date);
        dtstart = `DTSTART;VALUE=DATE:${d}`;
        dtend = `DTEND;VALUE=DATE:${nextDay(event.date)}`;
      }

      const lines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        dtstart,
        dtend,
        `SUMMARY:${escapeICS(loc.name)}`,
      ];

      if (loc.description) lines.push(`DESCRIPTION:${escapeICS(loc.description)}`);
      if (loc.location) lines.push(`LOCATION:${escapeICS(loc.location)}`);

      lines.push('END:VEVENT');
      return lines.map(foldLine).join('\r\n');
    })
    .filter(Boolean)
    .join('\r\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sargaux Wedding//sargaux.com//EN',
    'X-WR-CALNAME:Sargaux Wedding',
    "X-WR-CALDESC:Your personal schedule for Sam & Margaux's wedding",
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ].map(foldLine);

  // One VTIMEZONE per TZID actually referenced, before the events (RFC 5545).
  for (const timezone of usedTimezones) {
    const block = VTIMEZONES[timezone];
    if (block) lines.push(block.join('\r\n'));
  }

  if (vevents) lines.push(vevents);
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}
