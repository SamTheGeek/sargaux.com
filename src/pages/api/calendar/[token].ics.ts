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
  } catch (error) {
    console.error('Calendar: failed to fetch events for guest', guestId, error);
    // 503 (not 500) — calendar apps treat 503 as transient and retry,
    // whereas 500 may trigger permanent unsubscribe in some clients.
    return new Response('Service Unavailable', { status: 503 });
  }

  const ics = buildICS(events);

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
