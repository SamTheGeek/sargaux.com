import type { APIRoute } from 'astro';
import { fetchAllGuests } from '../../lib/notion';
import { features } from '../../config/features';

/**
 * Cache warmup endpoint — called by CI after each deploy to pre-populate
 * the in-memory guest cache so the first real user request is fast.
 *
 * Only does real work when the Notion backend is enabled; returns 200 either way.
 */
export const GET: APIRoute = async () => {
  if (!features.global.notionBackend) {
    return new Response(JSON.stringify({ warmed: false, reason: 'notion backend disabled' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const guests = await fetchAllGuests();
    return new Response(JSON.stringify({ warmed: true, guestCount: guests.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Cache warmup failed:', err);
    return new Response(JSON.stringify({ warmed: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
