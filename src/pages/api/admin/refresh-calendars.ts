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

export const POST: APIRoute = async ({ request, cache }) => {
  // Auth check
  const authHeader = request.headers.get('Authorization');
  const adminSecret = process.env.RESEND_ADMIN_SECRET;
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Refresh failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
