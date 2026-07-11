import type { APIRoute } from 'astro';
import { checkBlobStoreHealth } from '../../../lib/ics-store';

/**
 * Calendar subsystem health check.
 * Returns only `{ ok: boolean }` — no secret/config flags (recon hardening).
 */
export const GET: APIRoute = async () => {
  const hasSecret = !!process.env.CALENDAR_HMAC_SECRET;
  const hasNotionKey = !!process.env.NOTION_API_KEY;
  const blobsOk = await checkBlobStoreHealth();

  const ok = hasSecret && hasNotionKey && blobsOk;
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
};
