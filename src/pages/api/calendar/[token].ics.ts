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
import { getGuestEvents, fetchDayDate } from '../../../lib/notion';
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

  // Fetch events this guest is invited to
  let events: EventWithDate[];
  try {
    const rawEvents = await getGuestEvents(guestId);

    // Resolve dates from Day pages in parallel
    events = await Promise.all(
      rawEvents.map(async (event) => {
        const date = event.dayId ? await fetchDayDate(event.dayId) : undefined;
        return { ...event, date };
      })
    );
  } catch (error) {
    console.error('Calendar: failed to fetch events for guest', guestId, error);
    return new Response('Internal server error', { status: 500 });
  }

  const ics = buildICS(events);

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sargaux-wedding.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
