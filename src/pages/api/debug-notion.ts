import type { APIRoute } from 'astro';
import { features } from '../../config/features';
import { fetchAllGuests, clearGuestCache } from '../../lib/notion';

export const GET: APIRoute = async () => {
  // Only available in non-production deploys
  if (import.meta.env.PROD && !import.meta.env.FEATURE_GLOBAL_NOTION_BACKEND) {
    return new Response('Not found', { status: 404 });
  }

  const info: Record<string, unknown> = {
    notionBackendFlag: features.global.notionBackend,
    hasApiKey: !!process.env.NOTION_API_KEY,
    apiKeyPrefix: process.env.NOTION_API_KEY?.slice(0, 8) + '...',
    hasDbId: !!process.env.NOTION_GUEST_LIST_DB,
    dbId: process.env.NOTION_GUEST_LIST_DB,
  };

  if (features.global.notionBackend) {
    try {
      clearGuestCache();
      const guests = await fetchAllGuests();
      info.guestCount = guests.length;
      info.sampleGuests = guests.slice(0, 3).map((g) => ({
        name: g.name,
        normalizedName: g.normalizedName,
        eventInvitations: g.eventInvitations,
      }));
    } catch (err) {
      info.error = err instanceof Error ? err.message : String(err);
      info.errorStack = err instanceof Error ? err.stack : undefined;
    }
  }

  return new Response(JSON.stringify(info, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
