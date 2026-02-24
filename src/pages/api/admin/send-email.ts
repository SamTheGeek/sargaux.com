/**
 * POST /api/admin/send-email
 *
 * Send any registered email template to a specified list of guests (by Notion ID).
 * Useful for reminders, visa notices, logistics updates, etc.
 * Requires Authorization: Bearer {ADMIN_SECRET} header.
 *
 * Body: {
 *   templateId: TemplateName,
 *   guestIds: string[],
 *   templateData?: Record<string, string>   // extra data passed to the template fn
 * }
 * Response: { sent, failed, noEmail }
 */

import type { APIRoute } from 'astro';
import { fetchAllGuests } from '../../../lib/notion';
import { sendToGuests } from '../../../lib/email';
import { TEMPLATES } from '../../../lib/email-templates';
import type { TemplateName } from '../../../lib/email-templates';
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
  let body: { templateId?: string; guestIds?: unknown; templateData?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate templateId
  const templateId = body.templateId as TemplateName;
  if (!templateId || !(templateId in TEMPLATES)) {
    return new Response(
      JSON.stringify({
        error: `Invalid templateId. Must be one of: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate guestIds
  if (!Array.isArray(body.guestIds) || body.guestIds.length === 0) {
    return new Response(
      JSON.stringify({ error: 'guestIds must be a non-empty array' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const guestIds = body.guestIds as string[];

  // Fetch guest records
  const allGuests = await fetchAllGuests();
  const requested = guestIds.map((id) => allGuests.find((g) => g.id === id)).filter(Boolean) as typeof allGuests;
  const withEmail = requested.filter((g) => g.email);
  const noEmail = requested.length - withEmail.length;

  if (noEmail > 0) {
    console.warn(`send-email: ${noEmail} guest(s) have no email on file and will be skipped`);
  }

  const guestList = withEmail.map((g) => ({ email: g.email!, name: g.name }));

  // Skipped if emailEnabled is off
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

  const templateFn = TEMPLATES[templateId] as (params: any) => ReturnType<typeof TEMPLATES[typeof templateId]>;
  const templateData = body.templateData ?? {};

  const { sent, failed } = await sendToGuests(guestList, (guest) =>
    templateFn({ guestName: guest.name, ...templateData })
  );

  return new Response(
    JSON.stringify({ sent, failed, noEmail }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
