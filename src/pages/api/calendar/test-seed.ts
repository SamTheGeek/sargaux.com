/**
 * POST /api/calendar/test-seed
 *
 * Seeds the in-memory blob store for calendar endpoint tests.
 * Only functional when CALENDAR_TEST_MODE=true.
 * Returns 404 in all other environments.
 */

import type { APIRoute } from 'astro';
import { verifyToken } from '../../../lib/calendar';
import { setICS } from '../../../lib/ics-store';

export const POST: APIRoute = async ({ request }) => {
  if (process.env.CALENDAR_TEST_MODE !== 'true') {
    return new Response('Not Found', { status: 404 });
  }

  const { token, ics } = await request.json();
  const guestId = verifyToken(token);
  if (!guestId) {
    return new Response('Bad token', { status: 400 });
  }

  await setICS(guestId, ics);
  return new Response('OK', { status: 200 });
};
