/**
 * Calendar subscription utilities.
 *
 * Generates HMAC-signed tokens for personalized .ics calendar feeds.
 * Tokens are URL-safe and do not require session cookies — designed
 * for webcal:// subscription URLs that calendar apps poll directly.
 *
 * CALENDAR_HMAC_SECRET is a runtime secret (process.env, never committed).
 */

import { createHmac } from 'crypto';
import type { EventRecord } from '../types/event';

/**
 * Encode a string as URL-safe base64 (no padding).
 */
function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode a base64url string back to a UTF-8 string.
 * Returns null if decoding fails.
 */
function fromBase64Url(input: string): string | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4;
    const b64 = pad === 0 ? padded : padded + '='.repeat(4 - pad);
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Compute HMAC-SHA256 of guestId using CALENDAR_HMAC_SECRET.
 * Returns first 32 hex characters.
 */
function computeHmac(guestId: string): string {
  const secret = process.env.CALENDAR_HMAC_SECRET;
  if (!secret) throw new Error('CALENDAR_HMAC_SECRET is not set.');
  return createHmac('sha256', secret).update(guestId).digest('hex').slice(0, 32);
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

  // Constant-time comparison to prevent timing attacks
  if (providedHmac.length !== expectedHmac.length) return null;
  const a = Buffer.from(providedHmac);
  const b = Buffer.from(expectedHmac);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0 ? guestId : null;
}

/**
 * Parse a time string like "6:00 PM" or "14:00" into { hour, minute }.
 * Returns undefined if the string cannot be parsed.
 */
export function parseTime(time: string): { hour: number; minute: number } | undefined {
  // Try 12-hour format: "6:00 PM", "11:30 AM"
  const match12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    return { hour, minute };
  }

  // Try 24-hour format: "14:00", "09:30"
  const match24 = time.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return {
      hour: parseInt(match24[1], 10),
      minute: parseInt(match24[2], 10),
    };
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
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export interface EventWithDate extends EventRecord {
  date?: string; // "YYYY-MM-DD" resolved from the Day relation page
}

/**
 * Build an RFC 5545 ICS calendar string from a list of events.
 * Events without a date are skipped.
 * Events with a date but no parseable time get a DATE-only DTSTART.
 */
export function buildICS(events: EventWithDate[]): string {
  const stamp = dtstamp();

  const vevents = events
    .map((event) => {
      if (!event.date) return null;

      const timezone = event.wedding === 'nyc' ? 'America/New_York' : 'Europe/Paris';
      const uid = `${event.id}@sargaux.com`;

      let dtstart: string;
      let dtend: string;

      const parsed = event.time ? parseTime(event.time) : undefined;
      if (parsed) {
        const [year, month, day] = event.date.split('-').map(Number);
        const pad = (n: number) => String(n).padStart(2, '0');
        const localStr = `${year}${pad(month)}${pad(day)}T${pad(parsed.hour)}${pad(parsed.minute)}00`;
        const endHour = parsed.hour + 2;
        const endStr = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(parsed.minute)}00`;
        dtstart = `DTSTART;TZID=${timezone}:${localStr}`;
        dtend = `DTEND;TZID=${timezone}:${endStr}`;
      } else {
        const d = formatDate(event.date);
        dtstart = `DTSTART;VALUE=DATE:${d}`;
        dtend = `DTEND;VALUE=DATE:${d}`;
      }

      const lines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        dtstart,
        dtend,
        `SUMMARY:${escapeICS(event.name)}`,
      ];

      if (event.description) lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
      if (event.location) lines.push(`LOCATION:${escapeICS(event.location)}`);

      lines.push('END:VEVENT');
      return lines.join('\r\n');
    })
    .filter(Boolean)
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sargaux Wedding//sargaux.com//EN',
    'X-WR-CALNAME:Sargaux Wedding',
    "X-WR-CALDESC:Your personal schedule for Sam & Margaux's wedding",
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n');
}
