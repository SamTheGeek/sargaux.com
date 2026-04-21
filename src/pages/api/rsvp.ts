/**
 * RSVP API endpoint
 *
 * POST /api/rsvp - Submit or update an RSVP
 * GET /api/rsvp?event=nyc|france - Fetch existing RSVP for pre-fill
 * DELETE /api/rsvp?event=nyc|france - Delete RSVP (for testing)
 */

import type { APIRoute } from 'astro';
import { getAuthenticatedGuest } from '../../lib/auth';
import { submitRSVP, getLatestRSVP, deleteRSVP, updateGuestEmail, getGuestEvents, getGuestParty } from '../../lib/notion';
import { isEnabled } from '../../config/features';
import { sendToGuests } from '../../lib/email';
import { rsvpConfirmation, type EventInfo } from '../../lib/email-templates';
import { generateToken } from '../../lib/calendar';
import type { RSVPSubmission } from '../../types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeOptionalEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

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

  const sendConfirmation = body.sendConfirmation === true;

  let party;
  try {
    party = await getGuestParty(guestId);
  } catch (error) {
    console.error('Failed to load guest party for RSVP:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load guest party details' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const partyById = new Map(party.map((guest) => [guest.id, guest]));
  const submittedGuestEmails = new Map<string, string | undefined>();

  if (Array.isArray(body.guestEmails)) {
    for (const entry of body.guestEmails) {
      if (!entry || typeof entry.guestId !== 'string') {
        return new Response(JSON.stringify({ error: 'guestEmails entries must include a guestId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!partyById.has(entry.guestId)) {
        return new Response(JSON.stringify({ error: 'guestEmails includes a guest outside this party' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const normalizedEmail = normalizeOptionalEmail(entry.email);
      if (normalizedEmail && !EMAIL_PATTERN.test(normalizedEmail)) {
        const guestName = partyById.get(entry.guestId)?.name ?? entry.name ?? 'this guest';
        return new Response(JSON.stringify({ error: `Enter a valid email address for ${guestName}.` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      submittedGuestEmails.set(entry.guestId, normalizedEmail);
    }
  } else {
    const fallbackEmail = normalizeOptionalEmail(body.email);
    if (fallbackEmail) {
      if (!EMAIL_PATTERN.test(fallbackEmail)) {
        return new Response(JSON.stringify({ error: 'Enter a valid email address.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      submittedGuestEmails.set(guestId, fallbackEmail);
    }
  }

  const partyContacts = party.map((partyGuest) => ({
    id: partyGuest.id,
    name: partyGuest.name,
    currentEmail: normalizeOptionalEmail(partyGuest.email),
    email: submittedGuestEmails.has(partyGuest.id)
      ? submittedGuestEmails.get(partyGuest.id)
      : normalizeOptionalEmail(partyGuest.email),
  }));

  if (sendConfirmation && partyContacts.every((guest) => !guest.email)) {
    return new Response(
      JSON.stringify({ error: 'Add at least one email address to receive a confirmation.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Submit to Notion
  let responseId: string;
  try {
    await Promise.all(
      partyContacts
        .filter((guest) => submittedGuestEmails.has(guest.id) && guest.email !== guest.currentEmail)
        .map((guest) => updateGuestEmail(guest.id, guest.email ?? null))
    );

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
  if (isEnabled('global.emailEnabled') && sendConfirmation) {
    const recipients = Array.from(
      partyContacts
        .filter((guest) => guest.email)
        .reduce((map, guest) => {
          const key = guest.email!.toLowerCase();
          if (!map.has(key)) {
            map.set(key, { email: guest.email!, name: guest.name });
          }
          return map;
        }, new Map<string, { email: string; name: string }>())
        .values()
    );

    if (recipients.length > 0) {
      try {
        const attending = (body.guestsAttending ?? []).some((g: any) => g.attending);
        const guestsAttendingStr = (body.guestsAttending ?? [])
          .filter((g: any) => g.attending)
          .map((g: any) => g.name)
          .join(', ');

        // Fetch events the guest is attending, split into core and optional
        let coreEvents: EventInfo[] | undefined;
        let optionalEvents: EventInfo[] | undefined;
        const attendingEventIds = new Set(body.eventsAttending ?? []);
        if (attendingEventIds.size > 0) {
          try {
            const allEvents = await getGuestEvents(guestId);
            const attended = allEvents.filter((e) => attendingEventIds.has(e.id));
            coreEvents = attended
              .filter((e) => e.type === 'Core')
              .map((e): EventInfo => ({ name: e.name, time: e.time, location: e.location }));
            optionalEvents = attended
              .filter((e) => e.type === 'Optional')
              .map((e): EventInfo => ({ name: e.name, time: e.time, location: e.location }));
          } catch (err) {
            console.error('Failed to fetch event names for confirmation email:', err);
          }
        }

        // Generate personalised calendar URL (requires CALENDAR_HMAC_SECRET)
        let calendarUrl: string | undefined;
        try {
          const token = generateToken(guestId);
          calendarUrl = `https://sargaux.com/api/calendar/${token}.ics`;
        } catch {
          // CALENDAR_HMAC_SECRET not set — omit calendar link gracefully
        }

        const updateUrl = `https://sargaux.com/${body.event}/rsvp`;
        await sendToGuests(recipients, (recipient) => {
          const template = rsvpConfirmation({
            guestName: recipient.name,
            event: body.event,
            attending,
            guestsAttending: guestsAttendingStr,
            coreEvents,
            optionalEvents,
            dietary: body.dietary,
            updateUrl,
            calendarUrl,
          });

          return { to: recipient.email, ...template };
        });
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
