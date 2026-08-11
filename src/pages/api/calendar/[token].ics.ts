/**
 * GET /api/calendar/[token].ics
 *
 * Serves pre-generated personalized calendar subscriptions from Netlify Blobs.
 *
 * Returns 200 with ICS content if the blob exists.
 * On a blob miss, generates and stores the calendar on demand — the token has
 * already been HMAC-verified, so the guest is identified, and 503-ing left a
 * guest whose blob write failed (or predated the feature) with a permanently
 * erroring subscription until the next scheduled refresh.
 * Returns 503 only when generation itself fails (calendar apps retry; the
 * scheduled job is the backstop).
 * Returns 404 for invalid tokens (not 401, to avoid leaking information).
 */

import type { APIRoute } from 'astro';
import { verifyToken } from '../../../lib/calendar';
import { getICS } from '../../../lib/ics-store';
import { generateAndStoreICSForGuest } from '../../../lib/ics-generator';

const ICS_HEADERS = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'inline; filename="sargaux-wedding.ics"',
  // Allow CDN caching for 1 hour; serve stale for up to 7 days on origin errors
  // to prevent subscriptions from dropping during transient outages.
  'Cache-Control': 'max-age=3600, stale-while-revalidate=7200, stale-if-error=604800',
};

export const GET: APIRoute = async ({ params, cache }) => {
  const token = params.token;

  if (!token) {
    return new Response('Not found', { status: 404 });
  }

  // Missing secret → 503 (transient) not 404 (permanent unsubscribe).
  if (!process.env.CALENDAR_HMAC_SECRET) {
    console.error('Calendar: CALENDAR_HMAC_SECRET not configured');
    return new Response('Service Unavailable', { status: 503 });
  }

  const guestId = verifyToken(token);
  if (!guestId) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const stored = await getICS(guestId);
    if (stored !== null) {
      // Durable CDN cache (Netlify) — each token is a unique per-guest URL, so
      // path-keyed caching is safe. POST /api/rsvp invalidates this path after
      // regenerating the guest's ICS. Only successful responses are cached;
      // 503s below fall through without cache directives.
      if (cache.enabled) {
        cache.set({ maxAge: 3600, swr: 86400, tags: ['calendar'] });
      }
      return new Response(stored, { status: 200, headers: ICS_HEADERS });
    }

    // Blob missing — mint it now from Notion. Skipped in mock-store test mode,
    // where a miss must stay deterministic (and Notion isn't part of the test).
    if (process.env.CALENDAR_TEST_MODE !== 'true') {
      const generated = await generateAndStoreICSForGuest(guestId);
      if (cache.enabled) {
        cache.set({ maxAge: 3600, swr: 86400, tags: ['calendar'] });
      }
      return new Response(generated, { status: 200, headers: ICS_HEADERS });
    }

    return new Response('Service Unavailable', { status: 503 });
  } catch (err: unknown) {
    console.error('Calendar: blob store or generation error for guest', guestId, err);
    return new Response('Service Unavailable', { status: 503 });
  }
};
