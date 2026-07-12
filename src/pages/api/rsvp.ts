/**
 * RSVP API endpoint
 *
 * POST /api/rsvp - Submit or update an RSVP
 * GET /api/rsvp?event=nyc|france - Fetch existing RSVP for pre-fill
 * DELETE /api/rsvp?event=nyc|france - Delete RSVP (gated: feature flag or admin Bearer)
 */

import { promises as dnsPromises } from 'node:dns';
import type { APIRoute } from 'astro';
import {
  getAuthenticatedGuest,
  createSessionToken,
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '../../lib/auth';
import {
  submitRSVP,
  getLatestRSVPForParty,
  deleteRSVP,
  updateGuestEmail,
  getGuestEvents,
  getGuestParty,
  getGuestById,
} from '../../lib/notion';
import { isEnabled, features } from '../../config/features';
import { sendToGuests } from '../../lib/email';
import { rsvpConfirmation, type EventInfo } from '../../lib/email-templates';
import { generateToken } from '../../lib/calendar';
import { generateAndStoreICSForGuest } from '../../lib/ics-generator';
import { normalize } from '../../lib/normalize';
import { verifyAdminBearer } from '../../lib/admin-auth';
import { checkRateLimit, clientIp, rateLimitResponse } from '../../lib/rate-limit';
import type { RSVPSubmission } from '../../types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
/** Hard cap on JSON-serialized `details` blob to prevent oversized Notion writes. */
const DETAILS_MAX_BYTES = 8_192;
/**
 * Cap on free-text fields (`dietary`, `message`). Notion rejects a single
 * rich_text content block over 2,000 chars, and notion.ts writes each of
 * these as one block — anything larger would turn into a 500.
 */
const TEXT_FIELD_MAX_CHARS = 2_000;
/** Cap on a submitted guest display name persisted back to the Notion Guest List. */
const NAME_MAX_CHARS = 100;

function normalizeOptionalEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

async function hasMxRecord(email: string): Promise<boolean> {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    const records = await dnsPromises.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Bind session cookie identity to the live Notion record.
 * Rejects forged notionId + mismatched display name.
 */
async function bindSessionToNotion(
  auth: NonNullable<ReturnType<typeof getAuthenticatedGuest>>,
  guestId: string
): Promise<Response | null> {
  try {
    const record = await getGuestById(guestId);
    if (!record) {
      return jsonError(401, 'Invalid session');
    }
    if (normalize(auth.guest) !== record.normalizedName) {
      return jsonError(401, 'Invalid session');
    }
  } catch (error) {
    console.error('Session Notion bind failed:', error);
    return jsonError(500, 'Failed to verify session');
  }
  return null;
}

/**
 * POST - Submit or update an RSVP
 */
export const POST: APIRoute = async ({ request, cookies, cache }) => {
  const ip = clientIp(request);
  const limit = checkRateLimit(`rsvp:${ip}`, 30, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSec);

  const authCookie = cookies.get('sargaux_auth');
  if (!authCookie) {
    return jsonError(401, 'Unauthorized');
  }

  const auth = getAuthenticatedGuest(cookies);
  if (!auth) {
    return jsonError(401, 'Invalid session');
  }

  const guestId = auth.notionId;
  if (!guestId) {
    return jsonError(400, 'Notion backend required for RSVPs');
  }

  const bindError = await bindSessionToNotion(auth, guestId);
  if (bindError) return bindError;

  let body: RSVPSubmission;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  if (!body.event || !['nyc', 'france'].includes(body.event)) {
    return jsonError(400, 'Invalid event (must be "nyc" or "france")');
  }

  if (!Array.isArray(body.guestsAttending)) {
    return jsonError(400, 'guestsAttending must be an array');
  }

  if (!Array.isArray(body.eventsAttending)) {
    return jsonError(400, 'eventsAttending must be an array');
  }

  if (body.details !== undefined && body.details !== null) {
    if (typeof body.details !== 'object' || Array.isArray(body.details)) {
      return jsonError(400, 'details must be an object');
    }
    try {
      const size = Buffer.byteLength(JSON.stringify(body.details), 'utf8');
      if (size > DETAILS_MAX_BYTES) {
        return jsonError(400, 'details payload too large');
      }
    } catch {
      return jsonError(400, 'details payload too large');
    }
  }

  // Free-text fields flow into Notion rich_text blocks and the confirmation
  // email — reject non-strings and oversized values instead of 500ing later.
  for (const field of ['dietary', 'message'] as const) {
    const value: unknown = body[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') {
      return jsonError(400, `${field} must be a string`);
    }
    if (value.length > TEXT_FIELD_MAX_CHARS) {
      return jsonError(400, `${field} payload too large`);
    }
  }

  const sendConfirmation = body.sendConfirmation === true;

  let party;
  try {
    party = await getGuestParty(guestId);
  } catch (error) {
    console.error('Failed to load guest party for RSVP:', error);
    return jsonError(500, 'Failed to load guest party details');
  }

  // Event access is validated against the live Notion record, never the
  // session cookie — a 90-day cookie can go stale if invitations change.
  const primaryGuest = party.find((member) => member.id === guestId);
  const liveInvitations = primaryGuest?.eventInvitations ?? [];
  if (!liveInvitations.includes(body.event)) {
    return jsonError(403, 'Forbidden for this event');
  }

  // Validate guestsAttending. When an entry carries a guestId it must belong to
  // this party (that member's name may be edited on the form and persisted);
  // otherwise the name must match the party roster (legacy clients without ids).
  const partyIdSet = new Set(party.map((m) => m.id));
  const partyNames = new Set(party.map((m) => m.normalizedName));
  for (const entry of body.guestsAttending) {
    if (!entry || typeof entry.name !== 'string') {
      return jsonError(400, 'guestsAttending entries must include a name');
    }
    const trimmedName = entry.name.trim();
    if (trimmedName.length === 0 || trimmedName.length > NAME_MAX_CHARS) {
      return jsonError(400, 'guestsAttending includes an invalid name');
    }
    if (entry.guestId !== undefined) {
      if (typeof entry.guestId !== 'string' || !partyIdSet.has(entry.guestId)) {
        return jsonError(400, 'guestsAttending includes a guest outside this party');
      }
    } else if (!partyNames.has(normalize(trimmedName))) {
      return jsonError(400, 'guestsAttending includes a name outside this party');
    }
  }

  // eventsAttending must be ⊆ events the guest is invited to
  let invitedEventIds: Set<string>;
  try {
    const invitedEvents = await getGuestEvents(guestId);
    invitedEventIds = new Set(
      invitedEvents.filter((e) => e.wedding === body.event).map((e) => e.id)
    );
  } catch (error) {
    console.error('Failed to load guest events for RSVP validation:', error);
    return jsonError(500, 'Failed to validate events');
  }

  for (const eventId of body.eventsAttending) {
    if (typeof eventId !== 'string' || !invitedEventIds.has(eventId)) {
      return jsonError(400, 'eventsAttending includes an invalid event');
    }
  }

  const partyById = new Map(party.map((guest) => [guest.id, guest]));
  const submittedGuestEmails = new Map<string, string | undefined>();

  if (Array.isArray(body.guestEmails)) {
    for (const entry of body.guestEmails) {
      if (!entry || typeof entry.guestId !== 'string') {
        return jsonError(400, 'guestEmails entries must include a guestId');
      }

      if (!partyById.has(entry.guestId)) {
        return jsonError(400, 'guestEmails includes a guest outside this party');
      }

      const normalizedEmail = normalizeOptionalEmail(entry.email);
      if (normalizedEmail && !EMAIL_PATTERN.test(normalizedEmail)) {
        const guestName = partyById.get(entry.guestId)?.name ?? entry.name ?? 'this guest';
        return jsonError(400, `Enter a valid email address for ${guestName}.`, {
          fieldGuestId: entry.guestId,
        });
      }

      submittedGuestEmails.set(entry.guestId, normalizedEmail);
    }
  } else {
    const fallbackEmail = normalizeOptionalEmail(body.email);
    if (fallbackEmail) {
      if (!EMAIL_PATTERN.test(fallbackEmail)) {
        return jsonError(400, 'Enter a valid email address.');
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

  if (partyContacts.every((guest) => !guest.email)) {
    return jsonError(
      400,
      'At least one email address is required. We recommend adding an email address for everyone in your party.'
    );
  }

  if (isEnabled('global.rsvpRequireAllEmails')) {
    const missing = partyContacts.find((guest) => !guest.email);
    if (missing) {
      return jsonError(400, `An email address is required for ${missing.name}.`);
    }
  }

  const emailsToValidate = partyContacts.filter((guest) => guest.email);
  const mxResults = await Promise.all(
    emailsToValidate.map(async (guest) => ({
      id: guest.id,
      name: guest.name,
      valid: await hasMxRecord(guest.email!),
    }))
  );
  const invalidMx = mxResults.find((r) => !r.valid);
  if (invalidMx) {
    return jsonError(400, `Enter a valid email address for ${invalidMx.name}.`, {
      fieldGuestId: invalidMx.id,
    });
  }

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
    return jsonError(500, 'Failed to submit RSVP');
  }

  // If the authenticated guest renamed themselves, the session cookie's display
  // name no longer matches the live Notion record — re-sign it so subsequent
  // requests (bindSessionToNotion) don't fail closed with a 401. submitRSVP
  // cleared the guest cache, so this read reflects the new name.
  try {
    const refreshed = await getGuestById(guestId);
    if (refreshed && normalize(refreshed.name) !== normalize(auth.guest)) {
      cookies.set(
        AUTH_COOKIE_NAME,
        createSessionToken(refreshed.name, guestId, auth.eventInvitations, auth.country),
        {
          path: '/',
          httpOnly: true,
          secure: import.meta.env.PROD,
          sameSite: 'lax',
          maxAge: SESSION_MAX_AGE_SECONDS,
        }
      );
    }
  } catch (err) {
    console.error('Post-RSVP session re-sign failed (non-fatal):', err);
  }

  try {
    await Promise.all(party.map((member) => generateAndStoreICSForGuest(member.id)));

    if (cache.enabled) {
      await Promise.all(
        party.map((member) =>
          cache.invalidate({ path: `/api/calendar/${generateToken(member.id)}.ics` })
        )
      );
    }
  } catch (err) {
    console.error('ICS regeneration after RSVP failed (non-fatal):', err);
  }

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
        const attending = (body.guestsAttending ?? []).some((g: { attending?: boolean }) => g.attending);
        const guestsAttendingStr = (body.guestsAttending ?? [])
          .filter((g: { attending?: boolean }) => g.attending)
          .map((g: { name: string }) => g.name)
          .join(', ');

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
  const authCookie = cookies.get('sargaux_auth');
  if (!authCookie) {
    return jsonError(401, 'Unauthorized');
  }

  const auth = getAuthenticatedGuest(cookies);
  if (!auth) {
    return jsonError(401, 'Invalid session');
  }

  const guestId = auth.notionId;
  if (!guestId) {
    return jsonError(400, 'Notion backend required for RSVPs');
  }

  const bindError = await bindSessionToNotion(auth, guestId);
  if (bindError) return bindError;

  const url = new URL(request.url);
  const event = url.searchParams.get('event');

  if (!event || !['nyc', 'france'].includes(event)) {
    return jsonError(400, 'Invalid event (must be "nyc" or "france")');
  }

  try {
    const party = await getGuestParty(guestId);
    const primaryGuest = party.find((member) => member.id === guestId);
    if (!primaryGuest?.eventInvitations.includes(event as 'nyc' | 'france')) {
      return jsonError(403, 'Forbidden for this event');
    }

    const rsvp = await getLatestRSVPForParty(
      party.map((member) => member.id),
      event as 'nyc' | 'france'
    );

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
    return jsonError(500, 'Failed to fetch RSVP');
  }
};

/**
 * DELETE - Delete an RSVP (testing / admin only).
 * Gated behind FEATURE_GLOBAL_RSVP_DELETE_ENABLED or admin Bearer.
 * Not open in production for casual guest use.
 */
export const DELETE: APIRoute = async ({ request, cookies }) => {
  const deleteAllowed = features.global.rsvpDeleteEnabled || verifyAdminBearer(request);
  if (!deleteAllowed) {
    return jsonError(403, 'RSVP delete is disabled');
  }

  const authCookie = cookies.get('sargaux_auth');
  if (!authCookie) {
    return jsonError(401, 'Unauthorized');
  }

  const auth = getAuthenticatedGuest(cookies);
  if (!auth) {
    return jsonError(401, 'Invalid session');
  }

  const guestId = auth.notionId;
  if (!guestId) {
    return jsonError(400, 'Notion backend required for RSVPs');
  }

  const bindError = await bindSessionToNotion(auth, guestId);
  if (bindError) return bindError;

  const url = new URL(request.url);
  const event = url.searchParams.get('event');

  if (!event || !['nyc', 'france'].includes(event)) {
    return jsonError(400, 'Invalid event (must be "nyc" or "france")');
  }

  // Live invitations — never trust stale cookie eventInvitations
  try {
    const party = await getGuestParty(guestId);
    const primaryGuest = party.find((member) => member.id === guestId);
    if (!primaryGuest?.eventInvitations.includes(event as 'nyc' | 'france')) {
      return jsonError(403, 'Forbidden for this event');
    }
  } catch (error) {
    console.error('Failed to verify invitations for RSVP delete:', error);
    return jsonError(500, 'Failed to verify event access');
  }

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
    return jsonError(500, 'Failed to delete RSVP');
  }
};
