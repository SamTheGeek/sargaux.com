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
import { fetchAllGuests, markInviteSent, clearGuestCache } from '../../../lib/notion';
import { excludeTestGuests } from '../../../lib/test-guests';
import { sendToGuests, withRecipient } from '../../../lib/email';
import { saveTheDateNYC, saveTheDateFrance } from '../../../lib/email-templates';
import { isEnabled } from '../../../config/features';
import { requireAdminAuth } from '../../../lib/admin-auth';
import { checkRateLimit, clientIp, rateLimitResponse } from '../../../lib/rate-limit';

export const POST: APIRoute = async ({ request }) => {
  const ip = clientIp(request);
  const limit = checkRateLimit(`admin:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSec);

  const unauthorized = requireAdminAuth(request, '/api/admin/send-stds');
  if (unauthorized) return unauthorized;

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
  const allGuests = excludeTestGuests(await fetchAllGuests());
  const invited = allGuests.filter((g) => g.eventInvitations.includes(event));
  const withEmail = invited.filter((g) => g.email);
  const noEmail = invited.length - withEmail.length;

  if (noEmail > 0) {
    console.warn(
      `send-stds: ${noEmail} guest(s) invited to ${event} have no email on file and will be skipped`
    );
  }

  // Skip guests whose invite status already advanced — this is what makes a
  // re-run after a timeout resume where it left off instead of double-mailing.
  const inviteStatus = (g: (typeof withEmail)[number]) =>
    event === 'nyc' ? g.nycInviteStatus : g.franceSaveTheDateStatus;
  const pending = withEmail.filter((g) => {
    const status = inviteStatus(g);
    return status !== 'Sent' && status !== 'Received';
  });
  const alreadySent = withEmail.length - pending.length;

  const guestList = pending.map((g) => ({ id: g.id, email: g.email!, name: g.name }));

  // Send (skipped if emailEnabled is off)
  if (!isEnabled('global.emailEnabled')) {
    return new Response(
      JSON.stringify({
        sent: 0,
        failed: 0,
        noEmail,
        alreadySent,
        skipped: true,
        reason: 'emailEnabled feature flag is off',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const template = event === 'nyc' ? saveTheDateNYC : saveTheDateFrance;
  const buildPayload = (g: { email: string; name: string }) =>
    withRecipient(g, template({ guestName: g.name }));

  const { sent, failed, onSentFailed } = await sendToGuests(guestList, buildPayload, {
    // Resend allows 2 req/s; each send is also followed by a Notion write
    delayMs: 600,
    // Record progress per guest so an interrupted run is resumable
    onSent: (g) => markInviteSent(g.id, event),
  });

  if (onSentFailed > 0) {
    console.warn(
      `send-stds: ${onSentFailed} status write(s) failed — those guests were emailed but ` +
        `still look pending, so a re-run would mail them again. Fix their ` +
        `"${event === 'nyc' ? 'NYC Invite Sent' : 'France Save the Date Sent'}" status in Notion first.`
    );
  }

  // One cache clear for the whole run so reads reflect the new statuses
  if (sent > 0) await clearGuestCache();

  return new Response(
    JSON.stringify({ sent, failed, noEmail, alreadySent, statusWriteFailed: onSentFailed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
