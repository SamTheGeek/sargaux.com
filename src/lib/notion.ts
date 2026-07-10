/**
 * Notion client wrapper for fetching guest data.
 *
 * IMPORTANT: The NOTION_API_KEY must NEVER be committed to the repository.
 * Store it in GitHub Secrets / Netlify environment variables only.
 */

import { Client } from '@notionhq/client';
import { getStore } from '@netlify/blobs';
import type { GuestRecord, EventRecord, RSVPSubmission, RSVPResponse, RSVPDetails } from '../types';
import { normalize } from './normalize';
import { parseTime } from './calendar';

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

/**
 * Parse a Notion Guest List page into a GuestRecord.
 * Shared by the full DB scan, the targeted login query, and direct
 * page retrieves. Returns null for non-page objects or pages without a name.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGuestPage(page: any): GuestRecord | null {
  if (!page || page.object !== 'page') return null;

  const props = page.properties ?? {};

  // Full Name is a formula property
  const fullName =
    props['Full Name']?.formula?.string ||
    props['Name of Guest']?.title?.[0]?.plain_text ||
    '';

  if (!fullName) return null;

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

  const email: string | undefined = props['Guest Email']?.email ?? undefined;

  return {
    id: page.id,
    name: fullName,
    normalizedName: normalize(fullName),
    eventInvitations,
    country,
    isPlusOne,
    relatedGuestIds,
    email,
  };
}

// Module-level cache — populated once per cold start
let guestCache: GuestRecord[] | null = null;
// In-flight deduplication — prevents thundering herd on first request
let guestCachePromise: Promise<GuestRecord[]> | null = null;

// ── Netlify Blobs persistence for the guest cache ───────────────────────────
// The in-memory cache dies with each function instance, so cold starts used to
// pay for a full paginated Notion scan. The blob layer persists the last scan
// across instances/deploys: cold starts hydrate from one fast blob read and
// only fall back to Notion when the blob is missing or older than the TTL.
// All blob access is best-effort — local dev and Playwright runs without a
// Netlify Blobs environment silently skip this layer.

const GUEST_CACHE_STORE = 'guest-cache';
const GUEST_CACHE_KEY = 'all-guests-v1';
const GUEST_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface GuestCacheBlob {
  fetchedAt: number;
  guests: GuestRecord[];
}

async function readGuestCacheBlob(): Promise<GuestRecord[] | null> {
  try {
    const raw = await getStore(GUEST_CACHE_STORE).get(GUEST_CACHE_KEY, { type: 'json' });
    const blob = raw as GuestCacheBlob | null;
    if (!blob || !Array.isArray(blob.guests)) return null;
    if (Date.now() - blob.fetchedAt > GUEST_CACHE_TTL_MS) return null;
    return blob.guests;
  } catch {
    return null; // Blobs unavailable (local dev/tests) or read failure
  }
}

async function writeGuestCacheBlob(guests: GuestRecord[]): Promise<void> {
  try {
    const blob: GuestCacheBlob = { fetchedAt: Date.now(), guests };
    await getStore(GUEST_CACHE_STORE).setJSON(GUEST_CACHE_KEY, blob);
  } catch {
    // Best-effort — never fail the request over cache persistence
  }
}

async function deleteGuestCacheBlob(): Promise<void> {
  try {
    await getStore(GUEST_CACHE_STORE).delete(GUEST_CACHE_KEY);
  } catch {
    // Best-effort
  }
}

/**
 * Hydrate the in-memory guest cache from the blob layer if possible.
 * Returns the cache (or null without touching Notion).
 */
async function hydrateGuestCacheFromBlob(): Promise<GuestRecord[] | null> {
  if (guestCache) return guestCache;
  const guests = await readGuestCacheBlob();
  if (guests) {
    guestCache = guests;
  }
  return guestCache;
}

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
  // Fast path: a fresh blob from a previous instance avoids the full scan
  const fromBlob = await hydrateGuestCacheFromBlob();
  if (fromBlob) return fromBlob;

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
      const guest = parseGuestPage(page);
      if (guest) guests.push(guest);
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  guestCache = guests;
  await writeGuestCacheBlob(guests);
  return guests;
}

/**
 * Clear the guest cache (useful for testing or manual refresh).
 * Also drops the blob-persisted copy so the next fetch is fresh.
 */
export function clearGuestCache(): void {
  guestCache = null;
  guestCachePromise = null;
  guestPagePromises.clear();
  void deleteGuestCacheBlob();
}

// Short-TTL cache for direct guest page retrieves. Deduplicates concurrent
// calls (the RSVP page requests party + events at once, both needing the same
// guest page on a cold start) and skips repeat round-trips on warm instances.
// TTL matches the blob cache so guest edits in Notion surface within minutes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const guestPagePromises: Map<string, { at: number; promise: Promise<any> }> = new Map();
const GUEST_PAGE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Retrieve a guest's Notion page directly, deduplicating concurrent calls. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function retrieveGuestPage(guestId: string): Promise<any> {
  const existing = guestPagePromises.get(guestId);
  if (existing && Date.now() - existing.at < GUEST_PAGE_TTL_MS) {
    return existing.promise;
  }

  const notion = getClient();
  const promise = notion.pages.retrieve({ page_id: guestId }).catch((err) => {
    guestPagePromises.delete(guestId); // allow retry after failure
    throw err;
  });
  guestPagePromises.set(guestId, { at: Date.now(), promise });
  return promise;
}

/**
 * Fetch a single guest by Notion page ID without ever triggering a full
 * guest-list scan: in-memory cache → blob cache → direct page retrieve.
 */
export async function getGuestById(guestId: string): Promise<GuestRecord | null> {
  const cached = guestCache ?? (await hydrateGuestCacheFromBlob());
  if (cached) {
    const hit = cached.find(g => g.id === guestId);
    if (hit) return hit;
  }

  const page = await retrieveGuestPage(guestId);
  return parseGuestPage(page);
}

/**
 * Find a single guest by name for login validation.
 *
 * Uses the in-memory cache when warm (fast path), then the blob-persisted
 * cache (one fast read). On a fully cold start, does a targeted Notion
 * title-filter query — one API call instead of a full paginated DB scan —
 * so login is fast even after idle.
 *
 * Falls back to fetchAllGuests() if the targeted query fails.
 */
export async function findGuestByName(name: string): Promise<GuestRecord | null> {
  const normalized = normalize(name);

  // Fast path: in-memory cache, then blob-persisted cache. A miss falls
  // through to the live targeted query — the cache can be up to TTL stale,
  // and a freshly added guest must still be able to log in.
  const cached = guestCache ?? (await hydrateGuestCacheFromBlob());
  if (cached) {
    const hit = cached.find(g => g.normalizedName === normalized);
    if (hit) return hit;
  }

  // Cold path: targeted title-filter query (avoids full DB scan)
  const apiKey = process.env.NOTION_API_KEY;
  const dataSourceId = process.env.NOTION_GUEST_LIST_DB;

  if (!apiKey || !dataSourceId) {
    throw new Error('Missing Notion credentials');
  }

  try {
    // Filter by the first word of the name (Name of Guest is a filterable title property)
    const firstWord = name.trim().split(/\s+/)[0];
    const response = await fetch(`https://api.notion.com/v1/databases/${dataSourceId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        page_size: 10,
        filter: {
          property: 'Name of Guest',
          title: { contains: firstWord },
        },
      }),
    });

    if (!response.ok) throw new Error(`Notion query failed: ${response.status}`);

    const data: { results: any[] } = await response.json();

    for (const page of data.results) {
      const guest = parseGuestPage(page);
      if (guest && guest.normalizedName === normalized) return guest;
    }

    // Not found in targeted query — could be a schema mismatch; fall back to full scan
    const allGuests = await fetchAllGuests();
    return allGuests.find(g => g.normalizedName === normalized) ?? null;
  } catch (err) {
    console.error('findGuestByName targeted query failed, falling back to fetchAllGuests:', err);
    const allGuests = await fetchAllGuests();
    return allGuests.find(g => g.normalizedName === normalized) ?? null;
  }
}

/**
 * Write an email address back to a guest's Notion page.
 * Invalidates the in-memory guest cache so subsequent requests see the update.
 */
export async function updateGuestEmail(guestId: string, email: string | null): Promise<void> {
  const notion = getClient();
  await notion.pages.update({
    page_id: guestId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: { 'Guest Email': { email } } as any,
  });
  // Invalidate cache so the next fetchAllGuests() reflects the new email
  clearGuestCache();
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

      // Time (text) — display only
      const time = props['Time']?.rich_text?.[0]?.plain_text || undefined;

      // Start Time (text) — authoritative for ICS calendar
      const startTime = props['Start Time']?.rich_text?.[0]?.plain_text || undefined;

      // Duration (text) — e.g. "3h", "2h30m", "90m"
      const duration = props['Duration']?.rich_text?.[0]?.plain_text || undefined;

      // Location (text)
      const location = props['Location']?.rich_text?.[0]?.plain_text || undefined;

      // Description (rich text)
      const description = props['Description']?.rich_text?.[0]?.plain_text || undefined;

      // French display variants ("* FR" rich_text properties) — optional;
      // display falls back to the English field when unset. Timing fields
      // (Start Time/Duration/Event Date) intentionally have no FR variant.
      const nameFr = props['Event Name FR']?.rich_text?.[0]?.plain_text || undefined;
      const timeFr = props['Time FR']?.rich_text?.[0]?.plain_text || undefined;
      const locationFr = props['Location FR']?.rich_text?.[0]?.plain_text || undefined;
      const descriptionFr = props['Description FR']?.rich_text?.[0]?.plain_text || undefined;

      // Date (date property — YYYY-MM-DD)
      const date: string | undefined = props['Event Date']?.date?.start ?? undefined;

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
        startTime,
        duration,
        date,
        location,
        description,
        nameFr,
        timeFr,
        locationFr,
        descriptionFr,
        dayId,
        showOnWebsite,
      });
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  // Chronological order: Event Date first, then parsed Start Time.
  // Events without a date sort last; same-date events without a parseable
  // start time sort after timed ones.
  events.sort((a, b) => {
    const dateA = a.date ?? '9999-12-31';
    const dateB = b.date ?? '9999-12-31';
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;
    const timeA = a.startTime ? parseTime(a.startTime) : undefined;
    const timeB = b.startTime ? parseTime(b.startTime) : undefined;
    const minutesA = timeA ? timeA.hour * 60 + timeA.minute : Number.MAX_SAFE_INTEGER;
    const minutesB = timeB ? timeB.hour * 60 + timeB.minute : Number.MAX_SAFE_INTEGER;
    return minutesA - minutesB;
  });

  eventCatalogCache.set(wedding, events);
  return events;
}

/**
 * Fetch the events a guest can RSVP to: the full Event Catalog for each
 * wedding they are invited to (per the live Notion record). The deprecated
 * 'Events Invited' relation is intentionally not consulted — every guest
 * invited to a wedding gets that wedding's whole catalog.
 */
export async function getGuestEvents(guestId: string): Promise<EventRecord[]> {
  // Targeted lookup: memory/blob cache, or a single direct page retrieve —
  // never a full guest-list scan (this runs on every RSVP page load).
  const guest = await getGuestById(guestId);
  const weddings = guest?.eventInvitations ?? [];

  if (weddings.length === 0) {
    return [];
  }

  const catalogs = await Promise.all(weddings.map((wedding) => getEventCatalog(wedding)));
  return catalogs.flat();
}

/**
 * Fetch the events a guest has RSVP'd to attend: the union of
 * `eventsAttending` across their latest non-declined response per wedding.
 * Guests who have not RSVP'd (or declined everything) get an empty list.
 * This is the source of truth for the personalized calendar ICS.
 */
export async function getAttendingEvents(guestId: string): Promise<EventRecord[]> {
  const guest = await getGuestById(guestId);
  const weddings = guest?.eventInvitations ?? [];

  if (weddings.length === 0) {
    return [];
  }

  const [catalogs, rsvps] = await Promise.all([
    Promise.all(weddings.map((wedding) => getEventCatalog(wedding))),
    Promise.all(weddings.map((wedding) => getLatestRSVP(guestId, wedding))),
  ]);

  const attendingIds = new Set<string>();
  for (const rsvp of rsvps) {
    if (!rsvp || rsvp.status === 'Declined') continue;
    // Responses are party-level — only count this response for THIS guest if
    // they are among its attendees (a declining member of an attending party
    // keeps an empty calendar).
    if (guest && !rsvpIncludesGuest(rsvp, guest.normalizedName)) continue;
    for (const eventId of rsvp.eventsAttending ?? []) {
      attendingIds.add(eventId);
    }
  }

  return catalogs.flat().filter((event) => attendingIds.has(event.id));
}

/** True if the guest's normalized name appears in a response's attendee list. */
export function rsvpIncludesGuest(rsvp: RSVPResponse, normalizedName: string): boolean {
  return rsvp.guestsAttending
    .split(',')
    .map((name) => normalize(name))
    .filter(Boolean)
    .includes(normalizedName);
}

/**
 * Fetch a guest and their related party members (Related Guests).
 * Returns [primary guest, ...related guests], with +1s sorted last.
 */
export async function getGuestParty(guestId: string): Promise<GuestRecord[]> {
  // Targeted lookups (memory/blob cache or direct page retrieves in parallel)
  // — never a full guest-list scan.
  const primaryGuest = await getGuestById(guestId);

  if (!primaryGuest) {
    throw new Error(`Guest not found: ${guestId}`);
  }

  // Fetch related guests in parallel; skip any that fail to resolve
  const related = await Promise.all(
    primaryGuest.relatedGuestIds.map(async (relatedId) => {
      try {
        return await getGuestById(relatedId);
      } catch (error) {
        console.error(`Failed to fetch related guest ${relatedId}:`, error);
        return null;
      }
    })
  );

  const party: GuestRecord[] = [
    primaryGuest,
    ...related.filter((g): g is GuestRecord => g !== null),
  ];

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

  // Fetch the whole party (targeted lookups, no full scan) — RSVP responses
  // are party-level: one row per party + event, related to every member so
  // any member's pre-fill lookup and calendar generation can find it.
  const party = await getGuestParty(guestId);
  const guest = party.find((member) => member.id === guestId) ?? null;
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

  // Check if an existing RSVP exists for this party + event — matched against
  // any party member, so a partner updating the RSVP lands on the same row
  // instead of forking a second response.
  const existingRSVP = await getLatestRSVPForParty(
    party.map((member) => member.id),
    submission.event
  );

  const properties = {
    Response: {
      title: [{ text: { content: `${guestName} — ${eventLabel}` } }],
    },
    Guest: {
      relation: party.map((member) => ({ id: member.id })),
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

  let responseId: string;
  if (existingRSVP) {
    // Update existing page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notion.pages.update({
      page_id: existingRSVP.id,
      properties,
    });
    responseId = existingRSVP.id;
  } else {
    // Create new page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await notion.pages.create({
      parent: { type: 'database_id', database_id: dataSourceId },
      properties,
    });
    responseId = response.id;
  }

  // Sync RSVP status back to every party member's Guest List record.
  // Per member: gather their personal attendance from this submission plus the
  // party's latest response for any other event they're invited to, then
  // resolve: all attending → Attending, none → Declined, mixed → Partial.
  const partyIds = party.map((member) => member.id);
  const otherEvents = Array.from(
    new Set(party.flatMap((member) => member.eventInvitations))
  ).filter((e) => e !== submission.event);
  const otherRSVPs = new Map(
    await Promise.all(
      otherEvents.map(async (e) => [e, await getLatestRSVPForParty(partyIds, e)] as const)
    )
  );

  const attendingNamesFor = (event: 'nyc' | 'france'): Set<string> | null => {
    if (event === submission.event) {
      return new Set(
        submission.guestsAttending.filter((g) => g.attending).map((g) => normalize(g.name))
      );
    }
    const rsvp = otherRSVPs.get(event);
    if (!rsvp) return null; // no response yet for this event — don't count it
    return new Set(
      rsvp.guestsAttending
        .split(',')
        .map((name) => normalize(name))
        .filter(Boolean)
    );
  };

  await Promise.all(
    party.map((member) => {
      const attendance: boolean[] = [];
      for (const event of member.eventInvitations) {
        const names = attendingNamesFor(event);
        if (names === null) continue;
        attendance.push(names.has(member.normalizedName));
      }
      if (attendance.length === 0) return Promise.resolve(null);

      const anyYes = attendance.some(Boolean);
      const anyNo = attendance.some((a) => !a);
      const memberStatus = anyYes && anyNo ? 'Partial' : anyYes ? 'Attending' : 'Declined';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return notion.pages.update({
        page_id: member.id,
        properties: { RSVP: { status: { name: memberStatus } } } as any,
      });
    })
  );

  return responseId;
}

/**
 * Fetch the latest RSVP for a party and event — matches a response related to
 * ANY of the given party members, so responses submitted by one member are
 * found when another member of the same party looks them up.
 */
export async function getLatestRSVPForParty(
  partyIds: string[],
  event: 'nyc' | 'france'
): Promise<RSVPResponse | null> {
  const dataSourceId = process.env.NOTION_RSVP_RESPONSES_DB;

  if (!dataSourceId || partyIds.length === 0) {
    return null;
  }

  const eventLabel = event === 'nyc' ? 'NYC' : 'France';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: any = await queryDatabase(dataSourceId, {
    page_size: 1,
    filter: {
      and: [
        {
          or: partyIds.map((id) => ({
            property: 'Guest',
            relation: { contains: id },
          })),
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
  return parseRSVPPage(page, partyIds[0], event);
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
 * Fetch the latest RSVP response per guest + event across the whole
 * RSVP Responses database in one paginated scan (sorted newest-first, so the
 * first row seen for a guest + event pair is the latest). Used by the bulk
 * ICS refresh to avoid two Notion queries per guest.
 */
export async function fetchAllLatestRSVPs(): Promise<Map<string, RSVPResponse[]>> {
  const dataSourceId = process.env.NOTION_RSVP_RESPONSES_DB;

  if (!dataSourceId) {
    throw new Error(
      'NOTION_RSVP_RESPONSES_DB is not set. Add it to Netlify environment variables.'
    );
  }

  // guestId → event → latest response
  const latestByGuest = new Map<string, Map<'nyc' | 'france', RSVPResponse>>();
  let cursor: string | undefined = undefined;

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await queryDatabase(dataSourceId, {
      start_cursor: cursor,
      page_size: 100,
      sorts: [
        {
          property: 'Submitted At',
          direction: 'descending',
        },
      ],
    });

    for (const page of response.results ?? []) {
      if (page.object !== 'page') continue;
      const props = page.properties ?? {};

      // Responses are party-level: index under every related guest so each
      // party member's calendar refresh finds the shared response.
      const relatedGuestIds: string[] = (props['Guest']?.relation ?? []).map(
        (r: { id: string }) => r.id
      );
      const eventLabel = props['Event']?.select?.name;
      const event = eventLabel === 'NYC' ? 'nyc' : eventLabel === 'France' ? 'france' : null;
      if (relatedGuestIds.length === 0 || !event) continue;

      for (const guestId of relatedGuestIds) {
        const perGuest = latestByGuest.get(guestId) ?? new Map<'nyc' | 'france', RSVPResponse>();
        if (!perGuest.has(event)) {
          const parsed = parseRSVPPage(page, guestId, event);
          if (parsed) perGuest.set(event, parsed);
        }
        latestByGuest.set(guestId, perGuest);
      }
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return new Map(
    Array.from(latestByGuest, ([guestId, byEvent]) => [guestId, Array.from(byEvent.values())])
  );
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

// Day date cache — maps Wedding Timeline page ID to "YYYY-MM-DD" (or undefined)
const dayDateCache: Map<string, string | undefined> = new Map();

/**
 * Fetch the date from a Wedding Timeline page (the "Day" relation target).
 * Returns "YYYY-MM-DD" or undefined if the page has no date property.
 * Results are cached in memory for the lifetime of the server process.
 */
export async function fetchDayDate(dayId: string): Promise<string | undefined> {
  if (dayDateCache.has(dayId)) {
    return dayDateCache.get(dayId);
  }

  const notion = getClient();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = await notion.pages.retrieve({ page_id: dayId });
    const dateProp = page.properties?.['Date'];
    const dateStr: string | undefined = dateProp?.date?.start ?? undefined;
    dayDateCache.set(dayId, dateStr);
    return dateStr;
  } catch (error) {
    console.error(`Failed to fetch Day page ${dayId}:`, error);
    dayDateCache.set(dayId, undefined);
    return undefined;
  }
}

/**
 * Clear the day date cache (useful for testing or manual refresh).
 */
export function clearDayDateCache(): void {
  dayDateCache.clear();
}
