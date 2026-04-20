import type { APIRoute } from 'astro';
import {
  validateGuest,
  createSessionToken,
  AUTH_COOKIE_NAME,
} from '../../lib/auth';
import { features } from '../../config/features';
import { findGuestByName } from '../../lib/notion';
import type { EventInvitation } from '../../lib/auth';
import { getPrimaryEventRoute } from '../../lib/event-routing';

export const POST: APIRoute = async ({ request, cookies }) => {
  const formData = await request.formData();
  const name = formData.get('name');

  if (typeof name !== 'string' || !name.trim()) {
    return new Response(JSON.stringify({ error: 'Please enter your name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let guestName: string | null = null;
  let notionId: string | undefined;
  let eventInvitations: EventInvitation[] = ['nyc', 'france'];

  if (features.global.notionBackend) {
    try {
      const record = await findGuestByName(name);
      if (record) {
        guestName = record.name;
        notionId = record.id;
        eventInvitations = record.eventInvitations;
      }
    } catch (err) {
      console.error('Notion fetch failed, falling back to hardcoded list:', err);
      guestName = validateGuest(name);
    }
  } else {
    guestName = validateGuest(name);
  }

  if (!guestName) {
    return new Response(
      JSON.stringify({
        error: 'Name not found, it must match exactly.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Create session token and set cookie
  const token = createSessionToken(guestName, notionId, eventInvitations);
  const redirectPath = getPrimaryEventRoute(eventInvitations);

  cookies.set(AUTH_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });

  // Return success with the canonical guest name
  return new Response(JSON.stringify({ success: true, guest: guestName, redirectPath }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
