/**
 * RSVP API endpoint
 *
 * POST /api/rsvp - Submit or update an RSVP
 * GET /api/rsvp?event=nyc|france - Fetch existing RSVP for pre-fill
 * DELETE /api/rsvp?event=nyc|france - Delete RSVP (for testing)
 */

import type { APIRoute } from 'astro';
import { getAuthenticatedGuest } from '../../lib/auth';
import { submitRSVP, getLatestRSVP, deleteRSVP, fetchAllGuests, updateGuestEmail } from '../../lib/notion';
import { isEnabled } from '../../config/features';
import { sendEmail } from '../../lib/email';
import { rsvpConfirmation } from '../../lib/email-templates';
import type { RSVPSubmission } from '../../types/rsvp';

/**
 * POST - Submit or update an RSVP
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  // Check authentication
  const authCookie = cookies.get('sargaux_auth');
  if (!authCookie) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = getAuthenticatedGuest(cookies);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const guestId = auth.notionId;
  if (!guestId) {
    return new Response(
      JSON.stringify({ error: 'Notion backend required for RSVPs' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Parse request body
  let body: RSVPSubmission;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate required fields
  if (!body.event || !['nyc', 'france'].includes(body.event)) {
    return new Response(
      JSON.stringify({ error: 'Invalid event (must be "nyc" or "france")' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (!auth.eventInvitations.includes(body.event)) {
    return new Response(JSON.stringify({ error: 'Forbidden for this event' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!Array.isArray(body.guestsAttending)) {
    return new Response(
      JSON.stringify({ error: 'guestsAttending must be an array' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (!Array.isArray(body.eventsAttending)) {
    return new Response(
      JSON.stringify({ error: 'eventsAttending must be an array' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Submit to Notion
  let responseId: string;
  try {
    responseId = await submitRSVP(guestId, body);
  } catch (error) {
    console.error('RSVP submission error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to submit RSVP',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Email logic — non-blocking, never fails the RSVP response
  if (isEnabled('global.emailEnabled')) {
    const submittedEmail: string | undefined = (body as any).email?.trim() || undefined;
    const sendConfirmation: boolean = (body as any).sendConfirmation === true;

    // Resolve the best email to use: submitted > on-file
    let emailToUse: string | undefined = submittedEmail;
    if (!emailToUse) {
      try {
        const guests = await fetchAllGuests();
        emailToUse = guests.find((g) => g.id === guestId)?.email;
      } catch (err) {
        console.error('Failed to fetch guest email for confirmation:', err);
      }
    }

    // Save new email back to Notion if guest didn't have one
    if (submittedEmail) {
      try {
        const guests = await fetchAllGuests();
        const existing = guests.find((g) => g.id === guestId);
        if (!existing?.email) {
          await updateGuestEmail(guestId, submittedEmail);
        }
      } catch (err) {
        console.error('Failed to save guest email to Notion:', err);
      }
    }

    // Send confirmation if opted in and email is available
    if (sendConfirmation && emailToUse) {
      try {
        const attending = (body.guestsAttending ?? []).some((g: any) => g.attending);
        const guestsAttendingStr = (body.guestsAttending ?? [])
          .filter((g: any) => g.attending)
          .map((g: any) => g.name)
          .join(', ');
        const updateUrl = `https://sargaux.com/${body.event}/rsvp`;
        const template = rsvpConfirmation({
          guestName: auth.guest,
          event: body.event,
          attending,
          guestsAttending: guestsAttendingStr,
          dietary: body.dietary,
          updateUrl,
        });
        await sendEmail({ to: emailToUse, ...template });
      } catch (err) {
        console.error('Failed to send RSVP confirmation email:', err);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      responseId,
      message: 'RSVP submitted successfully',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

/**
 * GET - Fetch existing RSVP for pre-fill
 */
export const GET: APIRoute = async ({ request, cookies }) => {
  // Check authentication
  const authCookie = cookies.get('sargaux_auth');
  if (!authCookie) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = getAuthenticatedGuest(cookies);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const guestId = auth.notionId;
  if (!guestId) {
    return new Response(
      JSON.stringify({ error: 'Notion backend required for RSVPs' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Parse query params
  const url = new URL(request.url);
  const event = url.searchParams.get('event');

  if (!event || !['nyc', 'france'].includes(event)) {
    return new Response(
      JSON.stringify({ error: 'Invalid event (must be "nyc" or "france")' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (!auth.eventInvitations.includes(event as 'nyc' | 'france')) {
    return new Response(JSON.stringify({ error: 'Forbidden for this event' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch from Notion
  try {
    const rsvp = await getLatestRSVP(guestId, event as 'nyc' | 'france');

    if (!rsvp) {
      return new Response(JSON.stringify({ rsvp: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ rsvp }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('RSVP fetch error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch RSVP',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

/**
 * DELETE - Delete an RSVP (for testing)
 */
export const DELETE: APIRoute = async ({ request, cookies }) => {
  // Check authentication
  const authCookie = cookies.get('sargaux_auth');
  if (!authCookie) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = getAuthenticatedGuest(cookies);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const guestId = auth.notionId;
  if (!guestId) {
    return new Response(
      JSON.stringify({ error: 'Notion backend required for RSVPs' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Parse query params
  const url = new URL(request.url);
  const event = url.searchParams.get('event');

  if (!event || !['nyc', 'france'].includes(event)) {
    return new Response(
      JSON.stringify({ error: 'Invalid event (must be "nyc" or "france")' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (!auth.eventInvitations.includes(event as 'nyc' | 'france')) {
    return new Response(JSON.stringify({ error: 'Forbidden for this event' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Delete from Notion
  try {
    const deleted = await deleteRSVP(guestId, event as 'nyc' | 'france');

    if (!deleted) {
      return new Response(
        JSON.stringify({ success: false, message: 'No RSVP found to delete' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'RSVP deleted successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('RSVP deletion error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to delete RSVP',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
