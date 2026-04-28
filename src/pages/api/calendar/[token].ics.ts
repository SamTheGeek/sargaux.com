/**
 * GET /api/calendar/[token].ics
 *
 * Personalized calendar subscription endpoint.
 * Token encodes the guest's Notion page ID, signed with CALENDAR_HMAC_SECRET.
 * Calendar apps subscribe to this URL directly — no auth cookies needed.
 *
 * Returns 404 (not 401) for invalid tokens to avoid leaking information.
 */

import type { APIRoute } from 'astro';
import { verifyToken, buildICS } from '../../../lib/calendar';
import { getGuestEventsById } from '../../../lib/notion';
import type { EventWithDate } from '../../../lib/calendar';

export const GET: APIRoute = async ({ params }) => {
  const token = params.token;

  if (!token) {
    return new Response('Not found', { status: 404 });
  }

  // Check secret before verifyToken so a missing secret returns 503 (transient,
  // calendar apps retry) rather than 404 (permanent, calendar apps unsubscribe).
  if (!process.env.CALENDAR_HMAC_SECRET) {
    console.error('Calendar: CALENDAR_HMAC_SECRET not configured');
    return new Response('Service Unavailable', { status: 503 });
  }

  // Verify token and extract guestId
  const guestId = verifyToken(token);
  if (!guestId) {
    return new Response('Not found', { status: 404 });
  }

  // Fetch events this guest is invited to via direct page lookup (bypasses full
  // guest-list scan so the cold-start path stays well under the 10s timeout).
  let events: EventWithDate[];
  try {
    events = await getGuestEventsById(guestId);
  } catch (error: unknown) {
    // Return 410 Gone if the Notion page no longer exists — this is a permanent
    // failure (e.g. guest record was deleted) and 410 is more accurate than 503.
    const code = (error as Record<string, unknown>)?.code;
    const status = (error as Record<string, unknown>)?.status;
    if (code === 'object_not_found' || status === 404) {
      console.warn('Calendar: guest page not found, subscription may be stale', guestId);
      return new Response('Gone', { status: 410 });
    }
    console.error('Calendar: failed to fetch events for guest', guestId, error);
    // 503 (not 500) — calendar apps treat 503 as transient and retry.
    return new Response('Service Unavailable', { status: 503 });
  }

  const ics = buildICS(events);

  // Derive Last-Modified from the latest event date so calendar apps can use
  // conditional If-Modified-Since requests and skip re-parsing unchanged data.
  const latestDate = events
    .map((e) => e.date)
    .filter(Boolean)
    .sort()
    .at(-1);
  const lastModified = latestDate
    ? new Date(latestDate + 'T00:00:00Z').toUTCString()
    : new Date().toUTCString();

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Last-Modified': lastModified,
      // Allow CDN and calendar apps to cache the ICS for 1 hour.
      // stale-if-error lets the CDN serve a cached copy when the origin errors
      // (e.g. Notion is slow, or a deploy cold-start returns 503), preventing
      // established subscriptions from being dropped during transient outages.
      // 7-day stale-if-error: wedding event dates rarely change, so serving
      // week-old data is fine and prevents subscriptions from dropping during
      // extended Notion outages or cold-start error windows.
      'Cache-Control': 'max-age=3600, stale-while-revalidate=7200, stale-if-error=604800',
    },
  });
};
