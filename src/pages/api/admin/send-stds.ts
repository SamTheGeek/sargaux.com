/**
 * POST /api/admin/send-stds
 *
 * Bulk-send save-the-date emails to all guests for an event who have an email on file.
 * Requires Authorization: Bearer {ADMIN_SECRET} header.
 *
 * Body: { event: 'nyc' | 'france' }
 * Response: { sent, failed, noEmail }
 */

import type { APIRoute } from 'astro';
import { fetchAllGuests } from '../../../lib/notion';
import { sendToGuests } from '../../../lib/email';
import { saveTheDateNYC, saveTheDateFrance } from '../../../lib/email-templates';
import { isEnabled } from '../../../config/features';

export const POST: APIRoute = async ({ request }) => {
  // Auth check
  const authHeader = request.headers.get('Authorization');
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse body
  let body: { event?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const event = body.event;
  if (event !== 'nyc' && event !== 'france') {
    return new Response(
      JSON.stringify({ error: 'Invalid event (must be "nyc" or "france")' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Fetch guests
  const allGuests = await fetchAllGuests();
  const invited = allGuests.filter((g) => g.eventInvitations.includes(event));
  const withEmail = invited.filter((g) => g.email);
  const noEmail = invited.length - withEmail.length;

  if (noEmail > 0) {
    console.warn(
      `send-stds: ${noEmail} guest(s) invited to ${event} have no email on file and will be skipped`
    );
  }

  const guestList = withEmail.map((g) => ({ email: g.email!, name: g.name }));

  // Send (skipped if emailEnabled is off)
  if (!isEnabled('global.emailEnabled')) {
    return new Response(
      JSON.stringify({
        sent: 0,
        failed: 0,
        noEmail,
        skipped: true,
        reason: 'emailEnabled feature flag is off',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const buildPayload = event === 'nyc'
    ? (g: { email: string; name: string }) => saveTheDateNYC({ guestName: g.name })
    : (g: { email: string; name: string }) => saveTheDateFrance({ guestName: g.name });

  const { sent, failed } = await sendToGuests(guestList, buildPayload);

  return new Response(
    JSON.stringify({ sent, failed, noEmail }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
