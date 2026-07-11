/**
 * POST /api/admin/refresh-calendars
 *
 * Regenerate the stored ICS calendar for every guest (same job as the
 * scheduled ics-refresh functions, triggered on demand), then invalidate the
 * CDN-cached calendar URLs so subscriptions pick up the new content promptly.
 * Requires Authorization: Bearer {ADMIN_SECRET} header.
 *
 * Response: { total, succeeded, failed }
 */

import type { APIRoute } from 'astro';
import { refreshAllICS } from '../../../lib/ics-generator';
import { fetchAllGuests } from '../../../lib/notion';
import { generateToken } from '../../../lib/calendar';
import { requireAdminAuth } from '../../../lib/admin-auth';
import { checkRateLimit, clientIp, rateLimitResponse } from '../../../lib/rate-limit';

export const POST: APIRoute = async ({ request, cache }) => {
  const ip = clientIp(request);
  const limit = checkRateLimit(`admin:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSec);

  const unauthorized = requireAdminAuth(request, '/api/admin/refresh-calendars');
  if (unauthorized) return unauthorized;

  try {
    const result = await refreshAllICS();

    // Purge the CDN-cached calendar files (same pattern as POST /api/rsvp) —
    // otherwise the CDN keeps serving the old ICS for up to an hour.
    // Guest list is served from the in-memory cache populated by the refresh.
    if (cache.enabled) {
      const guests = await fetchAllGuests();
      await Promise.all(
        guests.map((guest) =>
          cache.invalidate({ path: `/api/calendar/${generateToken(guest.id)}.ics` })
        )
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[refresh-calendars] Refresh failed:', err);
    return new Response(JSON.stringify({ error: 'Refresh failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
