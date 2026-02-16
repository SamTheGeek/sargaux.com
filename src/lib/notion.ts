/**
 * Notion client wrapper for fetching guest data.
 *
 * IMPORTANT: The NOTION_API_KEY must NEVER be committed to the repository.
 * Store it in GitHub Secrets / Netlify environment variables only.
 */

import { Client } from '@notionhq/client';
import type { GuestRecord } from '../types/guest';
import type { EventRecord } from '../types/event';
import type { RSVPSubmission, RSVPResponse, RSVPDetails } from '../types/rsvp';

let notionClient: Client | null = null;

function getClient(): Client {
  if (notionClient) return notionClient;

  // Notion secrets are runtime env vars (set in Netlify Dashboard, not netlify.toml).
  // Vite's import.meta.env only includes vars present at build time, so we use process.env.
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error(
      'NOTION_API_KEY is not set. Add it to Netlify environment variables (never commit it to the repo).'
    );
  }

  notionClient = new Client({ auth: apiKey });
  return notionClient;
}

/**
 * Query a Notion database using the stable REST API (v2022-06-28).
 *
 * NOTE: The SDK v5 `dataSources.query` (v2025-09-03) only works for databases
 * explicitly registered as Notion AI data sources. Using the legacy
 * `databases/{id}/query` endpoint is more reliable and works for all databases
 * as long as the integration has page-level access.
 *
 * The databaseId here is the Notion database PAGE ID (not the collection/data source ID).
 */
async function queryDatabase(
  databaseId: string,
  body: Record<string, unknown> = {}
): Promise<{ results: any[]; has_more: boolean; next_cursor?: string }> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error('NOTION_API_KEY is not set.');

  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err: any = await response.json();
    throw new Error(err.message || `Notion API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Normalize a name for auth matching:
 * lowercase, remove accents, collapse whitespace.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Derive which wedding(s) a guest is invited to based on Country.
 * This is a temporary heuristic until the Event Invitations multi-select
 * is added to the Guest List database (Phase 2).
 */
function deriveEventInvitations(country: string | null): ('nyc' | 'france')[] {
  switch (country) {
    case 'USA':
    case 'CANADA':
      return ['nyc'];
    case 'FRANCE':
      return ['france'];
    case 'UNITED KINGDOM':
      return ['france'];
    default:
      // If no country, default to both
      return ['nyc', 'france'];
  }
}

// Module-level cache — populated once per cold start
let guestCache: GuestRecord[] | null = null;
// In-flight deduplication — prevents thundering herd on first request
let guestCachePromise: Promise<GuestRecord[]> | null = null;

/**
 * Fetch all guests from the Notion Guest List database.
 * Results are cached in memory for the lifetime of the server process.
 * Uses promise deduplication to prevent concurrent Notion fetches.
 */
export async function fetchAllGuests(): Promise<GuestRecord[]> {
  if (guestCache) return guestCache;
  if (guestCachePromise) return guestCachePromise;
  guestCachePromise = _fetchAllGuests().catch((err) => {
    // Clear promise on error so next call retries
    guestCachePromise = null;
    throw err;
  });
  return guestCachePromise;
}

async function _fetchAllGuests(): Promise<GuestRecord[]> {

  const notion = getClient();
  const dataSourceId = process.env.NOTION_GUEST_LIST_DB;

  if (!dataSourceId) {
    throw new Error(
      'NOTION_GUEST_LIST_DB is not set. Add it to Netlify environment variables.'
    );
  }

  const guests: GuestRecord[] = [];
  let cursor: string | undefined = undefined;

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await queryDatabase(dataSourceId, {
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (page.object !== 'page') continue;

      const props = page.properties;

      // Full Name is a formula property
      const fullName =
        props['Full Name']?.formula?.string ||
        props['Name of Guest']?.title?.[0]?.plain_text ||
        '';

      if (!fullName) continue;

      const country = props['Country']?.select?.name || null;
      const isPlusOne = props['+1']?.checkbox === true;

      // Related Guests is a self-relation
      const relatedGuestIds: string[] = (
        props['Related Guests']?.relation || []
      ).map((r: { id: string }) => r.id);

      // Event Invitations multi-select (Phase 2 addition)
      // Falls back to deriving from Country if property doesn't exist yet
      let eventInvitations: ('nyc' | 'france')[];
      const eventInvProp = props['Event Invitations'];
      if (eventInvProp?.multi_select?.length > 0) {
        eventInvitations = eventInvProp.multi_select
          .map((opt: { name: string }) => opt.name.toLowerCase() as 'nyc' | 'france')
          .filter((e: string) => e === 'nyc' || e === 'france');
      } else {
        eventInvitations = deriveEventInvitations(country);
      }

      guests.push({
        id: page.id,
        name: fullName,
        normalizedName: normalizeName(fullName),
        eventInvitations,
        isPlusOne,
        relatedGuestIds,
      });
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  guestCache = guests;
  return guests;
}

/**
 * Clear the guest cache (useful for testing or manual refresh).
 */
export function clearGuestCache(): void {
  guestCache = null;
  guestCachePromise = null;
}

// Event catalog cache — populated once per cold start
let eventCatalogCache: Map<'nyc' | 'france', EventRecord[]> = new Map();

/**
 * Fetch all events from the Event Catalog for a specific wedding.
 * Results are cached in memory for the lifetime of the server process.
 */
export async function getEventCatalog(wedding: 'nyc' | 'france'): Promise<EventRecord[]> {
  if (eventCatalogCache.has(wedding)) {
    return eventCatalogCache.get(wedding)!;
  }

  const notion = getClient();
  const dataSourceId = process.env.NOTION_EVENT_CATALOG_DB;

  if (!dataSourceId) {
    throw new Error(
      'NOTION_EVENT_CATALOG_DB is not set. Add it to Netlify environment variables.'
    );
  }

  const events: EventRecord[] = [];
  let cursor: string | undefined = undefined;

  // Map our internal wedding key to the Notion select option name
  const weddingLabel = wedding === 'nyc' ? 'New York' : 'France';

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await queryDatabase(dataSourceId, {
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (page.object !== 'page') continue;

      const props = page.properties;

      // Event Name (title)
      const name = props['Event Name']?.title?.[0]?.plain_text || '';
      if (!name) continue;

      // Wedding (select) — stored as "New York" or "France", not "nyc"/"france"
      const weddingProp = props['Wedding']?.select?.name;
      if (weddingProp !== weddingLabel) continue; // Filter by wedding

      // Event Type (select)
      const typeProp = props['Event Type']?.select?.name;
      const type = typeProp === 'Optional' ? 'Optional' : 'Core';

      // Time (text)
      const time = props['Time']?.rich_text?.[0]?.plain_text || undefined;

      // Location (text)
      const location = props['Location']?.rich_text?.[0]?.plain_text || undefined;

      // Description (rich text)
      const description = props['Description']?.rich_text?.[0]?.plain_text || undefined;

      // Day (relation to Wedding Timeline)
      const dayId = props['Day']?.relation?.[0]?.id || undefined;

      // Show on Website (checkbox)
      const showOnWebsite = props['Show on Website']?.checkbox === true;

      events.push({
        id: page.id,
        name,
        type,
        wedding,
        time,
        location,
        description,
        dayId,
        showOnWebsite,
      });
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  eventCatalogCache.set(wedding, events);
  return events;
}

/**
 * Fetch events that a specific guest is invited to.
 */
export async function getGuestEvents(guestId: string): Promise<EventRecord[]> {
  const notion = getClient();

  // Fetch the guest page to get Events Invited relation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guestPage: any = await notion.pages.retrieve({ page_id: guestId });
  const props = guestPage.properties;

  // Events Invited (relation to Event Catalog)
  const eventIds: string[] = (props['Events Invited']?.relation || []).map(
    (r: { id: string }) => r.id
  );

  if (eventIds.length === 0) {
    return [];
  }

  // Fetch each event page
  const events: EventRecord[] = [];
  for (const eventId of eventIds) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventPage: any = await notion.pages.retrieve({ page_id: eventId });
      const eventProps = eventPage.properties;

      const name = eventProps['Event Name']?.title?.[0]?.plain_text || '';
      if (!name) continue;

      const weddingProp = eventProps['Wedding']?.select?.name?.toLowerCase();
      const wedding = weddingProp === 'france' ? 'france' : 'nyc';

      const typeProp = eventProps['Event Type']?.select?.name;
      const type = typeProp === 'Optional' ? 'Optional' : 'Core';

      const time = eventProps['Time']?.rich_text?.[0]?.plain_text || undefined;
      const location = eventProps['Location']?.rich_text?.[0]?.plain_text || undefined;
      const description = eventProps['Description']?.rich_text?.[0]?.plain_text || undefined;
      const dayId = eventProps['Day']?.relation?.[0]?.id || undefined;
      const showOnWebsite = eventProps['Show on Website']?.checkbox === true;

      events.push({
        id: eventId,
        name,
        type,
        wedding,
        time,
        location,
        description,
        dayId,
        showOnWebsite,
      });
    } catch (error) {
      console.error(`Failed to fetch event ${eventId}:`, error);
    }
  }

  return events;
}

/**
 * Fetch a guest and their related party members (Related Guests).
 * Returns [primary guest, ...related guests], with +1s sorted last.
 */
export async function getGuestParty(guestId: string): Promise<GuestRecord[]> {
  const allGuests = await fetchAllGuests();
  const primaryGuest = allGuests.find(g => g.id === guestId);

  if (!primaryGuest) {
    throw new Error(`Guest not found: ${guestId}`);
  }

  const party: GuestRecord[] = [primaryGuest];

  // Fetch related guests
  for (const relatedId of primaryGuest.relatedGuestIds) {
    const relatedGuest = allGuests.find(g => g.id === relatedId);
    if (relatedGuest) {
      party.push(relatedGuest);
    }
  }

  // Sort: primary first, then non-+1s, then +1s
  return party.sort((a, b) => {
    if (a.id === guestId) return -1;
    if (b.id === guestId) return 1;
    if (a.isPlusOne && !b.isPlusOne) return 1;
    if (!a.isPlusOne && b.isPlusOne) return -1;
    return 0;
  });
}

/**
 * Submit or update an RSVP in the RSVP Responses database.
 * If an existing response exists for this guest + event, it will be updated.
 * Returns the Notion page ID of the created/updated response.
 */
export async function submitRSVP(
  guestId: string,
  submission: RSVPSubmission
): Promise<string> {
  const notion = getClient();
  const dataSourceId = process.env.NOTION_RSVP_RESPONSES_DB;

  if (!dataSourceId) {
    throw new Error(
      'NOTION_RSVP_RESPONSES_DB is not set. Add it to Netlify environment variables.'
    );
  }

  // Fetch the guest name for the title
  const allGuests = await fetchAllGuests();
  const guest = allGuests.find(g => g.id === guestId);
  const guestName = guest?.name || 'Unknown Guest';

  // Determine status
  const attendingCount = submission.guestsAttending.filter(g => g.attending).length;
  const totalCount = submission.guestsAttending.length;
  let status: 'Attending' | 'Declined' | 'Partial';
  if (attendingCount === 0) {
    status = 'Declined';
  } else if (attendingCount === totalCount) {
    status = 'Attending';
  } else {
    status = 'Partial';
  }

  // Guests Attending: comma-separated names
  const guestsAttending = submission.guestsAttending
    .filter(g => g.attending)
    .map(g => g.name)
    .join(', ');

  // Details JSON blob
  const details: RSVPDetails & { eventsAttending?: string[] } = {
    ...submission.details,
    eventsAttending: submission.eventsAttending,
  };

  // Event label must match the Notion select options: 'NYC' or 'France'
  const eventLabel = submission.event === 'nyc' ? 'NYC' : 'France';

  // Check if an existing RSVP exists for this guest + event
  const existingRSVP = await getLatestRSVP(guestId, submission.event);

  const properties = {
    Response: {
      title: [{ text: { content: `${guestName} — ${eventLabel}` } }],
    },
    Guest: {
      relation: [{ id: guestId }],
    },
    Event: {
      select: { name: eventLabel },
    },
    'Submitted At': {
      date: { start: new Date().toISOString() },
    },
    Status: {
      select: { name: status },
    },
    'Guests Attending': {
      rich_text: [{ text: { content: guestsAttending } }],
    },
    'Dietary Needs': {
      rich_text: submission.dietary
        ? [{ text: { content: submission.dietary } }]
        : [],
    },
    Message: {
      rich_text: submission.message
        ? [{ text: { content: submission.message } }]
        : [],
    },
    Details: {
      rich_text: [{ text: { content: JSON.stringify(details) } }],
    },
  };

  if (existingRSVP) {
    // Update existing page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notion.pages.update({
      page_id: existingRSVP.id,
      properties,
    });
    return existingRSVP.id;
  } else {
    // Create new page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await notion.pages.create({
      parent: { type: 'database_id', database_id: dataSourceId },
      properties,
    });
    return response.id;
  }
}

/**
 * Fetch the latest RSVP for a guest and event (for pre-filling forms).
 * Returns null if no RSVP exists.
 */
export async function getLatestRSVP(
  guestId: string,
  event: 'nyc' | 'france'
): Promise<RSVPResponse | null> {
  const notion = getClient();
  const dataSourceId = process.env.NOTION_RSVP_RESPONSES_DB;

  if (!dataSourceId) {
    throw new Error(
      'NOTION_RSVP_RESPONSES_DB is not set. Add it to Netlify environment variables.'
    );
  }

  // Event stored as 'NYC' or 'France' in the database (not 'nyc'/'france')
  const eventLabel = event === 'nyc' ? 'NYC' : 'France';

  // Query for latest response matching guest + event (server-side filter + sort)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: any = await queryDatabase(dataSourceId, {
    page_size: 1,
    filter: {
      and: [
        {
          property: 'Guest',
          relation: { contains: guestId },
        },
        {
          property: 'Event',
          select: { equals: eventLabel },
        },
      ],
    },
    sorts: [
      {
        property: 'Submitted At',
        direction: 'descending',
      },
    ],
  });

  const page = response.results?.[0];
  return parseRSVPPage(page, guestId, event);
}

function getRichTextPlainText(prop: any): string | undefined {
  if (!prop || !Array.isArray(prop.rich_text)) return undefined;
  return prop.rich_text[0]?.plain_text;
}

export function parseRSVPPage(
  page: any,
  guestId: string,
  event: 'nyc' | 'france'
): RSVPResponse | null {
  if (!page || page.object !== 'page') return null;

  const props = page.properties ?? {};

  const submittedAt =
    props['Submitted At']?.date?.start || new Date().toISOString();
  const status = props['Status']?.select?.name || 'Attending';
  const guestsAttending = getRichTextPlainText(props['Guests Attending']) || '';
  const dietary = getRichTextPlainText(props['Dietary Needs']);
  const message = getRichTextPlainText(props['Message']);

  const detailsText = getRichTextPlainText(props['Details']);
  const hasDetailsText =
    typeof detailsText === 'string' && detailsText.trim().length > 0;
  const detailsJson = hasDetailsText ? detailsText : '{}';

  let details: RSVPDetails | undefined;
  let eventsAttending: string[] | undefined;

  try {
    const parsed = JSON.parse(detailsJson);
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.eventsAttending)) {
        eventsAttending = parsed.eventsAttending.filter(
          (item: unknown) => typeof item === 'string'
        );
      }
      delete parsed.eventsAttending;
      const remainingKeys = Object.keys(parsed);
      if (hasDetailsText && remainingKeys.length > 0) {
        details = parsed as RSVPDetails;
      }
    }
  } catch {
    details = undefined;
  }

  return {
    id: page.id,
    guestId,
    event,
    submittedAt,
    status: status as 'Attending' | 'Declined' | 'Partial',
    guestsAttending,
    dietary,
    message,
    details,
    eventsAttending,
  };
}

/**
 * Delete an RSVP response (for testing "new RSVP" flows).
 * Returns true if deleted, false if not found.
 */
export async function deleteRSVP(
  guestId: string,
  event: 'nyc' | 'france'
): Promise<boolean> {
  const existingRSVP = await getLatestRSVP(guestId, event);

  if (!existingRSVP) {
    return false;
  }

  const notion = getClient();

  // Archive the page (Notion doesn't have a true delete via API)
  await notion.pages.update({
    page_id: existingRSVP.id,
    archived: true,
  });

  return true;
}

/**
 * Clear the event catalog cache (useful for testing or manual refresh).
 */
export function clearEventCache(): void {
  eventCatalogCache.clear();
}
