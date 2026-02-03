import type { APIRoute } from 'astro';
import { validateGuest, createSessionToken, AUTH_COOKIE_NAME } from '../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const name = formData.get('name');

  if (typeof name !== 'string' || !name.trim()) {
    return new Response(JSON.stringify({ error: 'Please enter your name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const guestName = validateGuest(name);

  if (!guestName) {
    return new Response(JSON.stringify({ error: "We couldn't find that name. Please enter your name as it appears on your invitation." }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create session token and set cookie
  const token = createSessionToken(guestName);

  cookies.set(AUTH_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });

  // Return success with the canonical guest name
  return new Response(JSON.stringify({ success: true, guest: guestName }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
