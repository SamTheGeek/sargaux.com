import type { APIRoute } from 'astro';
import {
  validateGuest,
  validateGuestFromRecords,
  createSessionToken,
  AUTH_COOKIE_NAME,
} from '../../lib/auth';
import { features } from '../../config/features';
import { fetchAllGuests } from '../../lib/notion';
import type { EventInvitation } from '../../lib/auth';

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
      const guests = await fetchAllGuests();
      const record = validateGuestFromRecords(name, guests);
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
        error: 'Please enter your name as it appears on your invitation.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Create session token and set cookie
  const token = createSessionToken(guestName, notionId, eventInvitations);
  const redirectPath = eventInvitations.includes('nyc') ? '/nyc' : '/france';

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
