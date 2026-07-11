import type { APIRoute } from 'astro';
import { fetchAllGuests } from '../../lib/notion';
import { features } from '../../config/features';
import { requireAdminAuth } from '../../lib/admin-auth';

/**
 * Cache warmup endpoint — called by CI after each deploy to pre-populate
 * the in-memory guest cache so the first real user request is fast.
 *
 * Requires Authorization: Bearer {RESEND_ADMIN_SECRET}.
 * Does not return guestCount publicly.
 */
export const GET: APIRoute = async ({ request }) => {
  const unauthorized = requireAdminAuth(request, '/api/warm');
  if (unauthorized) return unauthorized;

  if (!features.global.notionBackend) {
    return new Response(JSON.stringify({ warmed: false, reason: 'notion backend disabled' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await fetchAllGuests();
    return new Response(JSON.stringify({ warmed: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Cache warmup failed:', err);
    return new Response(JSON.stringify({ warmed: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
