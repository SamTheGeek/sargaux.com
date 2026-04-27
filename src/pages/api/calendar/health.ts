import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const ok = !!process.env.CALENDAR_HMAC_SECRET && !!process.env.NOTION_API_KEY;
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
};
