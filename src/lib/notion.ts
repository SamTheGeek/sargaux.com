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
import { isTestGuest, isTestGuestFromNotionProps } from './test-guests';
import { envelopeTokens, findMatchingHousehold } from './envelope-name';
import { validateGuestFromRecords } from './auth';
import { guestNameEdit } from './guest-name';
import { strandedGuestIds, planDetachedResponse } from './rsvp-split';

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

  // The invitation title, joined across blocks — Notion splits a title into
  // several rich-text blocks whenever part of it is styled or was pasted, so
  // reading only `[0]` can silently truncate a name.
  const invitationTitle = titleText(props['Name of Guest']);

  // Full Name is a formula property
  const fullName = props['Full Name']?.formula?.string || invitationTitle || '';

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
  const normalizedName = normalize(fullName);
  const testGuest =
    isTestGuestFromNotionProps(props) || isTestGuest({ normalizedName });

  // Per-event physical-mail status (Notion `status` props). Read so RSVP
  // write-back can advance them to 'Received' (advance-forward only) without a
  // second fetch. Absent props parse to null.
  const nycInviteStatus: string | null = props['NYC Invite Sent']?.status?.name ?? null;
  const franceSaveTheDateStatus: string | null =
    props['France Save the Date Sent']?.status?.name ?? null;

  // Name parts and household envelope strings for envelope-name login.
  // `Envelope Names` holds one addressee line per row — a household can have
  // two (NYC and France include different members). Rich text may arrive split
  // across blocks, so join before splitting on newlines.
  const firstName: string | undefined = richText(props['First Name']) || undefined;
  const lastName: string | undefined = richText(props['Last Name']) || undefined;
  const envelopeNames = richText(props['Envelope Names'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  // `Also Known As` — alternate names the guest answers to, one per line.
  // Parsed identically; absent on records that need no alias, and on the whole
  // database until the property exists, in which case this is simply empty.
  const aka = richText(props['Also Known As'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    id: page.id,
    name: fullName,
    normalizedName,
    eventInvitations,
    country,
    isPlusOne,
    relatedGuestIds,
    email,
    isTestGuest: testGuest,
    nycInviteStatus,
    franceSaveTheDateStatus,
    firstName,
    lastName,
    envelopeNames: envelopeNames.length > 0 ? envelopeNames : undefined,
    aka: aka.length > 0 ? aka : undefined,
    invitationTitle: invitationTitle || undefined,
  };
}

/** Collapse a Notion title property into a plain string ('' when absent). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function titleText(prop: any): string {
  return (prop?.title ?? [])
    .map((block: { plain_text?: string }) => block.plain_text ?? '')
    .join('')
    .trim();
}

/** Collapse a Notion rich_text property into a plain string ('' when absent). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function richText(prop: any): string {
  return (prop?.rich_text ?? [])
    .map((block: { plain_text?: string }) => block.plain_text ?? '')
    .join('')
    .trim();
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
// v2 adds firstName/lastName/envelopeNames (envelope-name login); v3 adds
// invitationTitle (the invitation-title login fallback); v4 adds aka (the
// `Also Known As` alternate-name property). Bumping the key retires blobs
// written by older deploys — reusing it would leave the new matching silently
// dead until the 15-minute TTL expired.
const GUEST_CACHE_KEY = 'all-guests-v4';
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
 * Tiers that hold the *complete* guest list (both caches, and the full scan)
 * match via `validateGuestFromRecords`, which falls back to the invitation
 * title. The targeted query deliberately does not: it returns at most 10 rows,
 * and `validateGuestFromRecords` only accepts a title match when it is unique
 * across the records it is given — a claim a 10-row window cannot support. So a
 * title-only login on a cold cache falls through to the full scan, which can
 * make that judgement globally. That costs one extra scan for the handful of
 * guests whose printed name differs from their `Full Name`, and never fires for
 * a guest whose two names agree.
 *
 * Falls back to fetchAllGuests() if the targeted query fails.
 */
export async function findGuestByName(name: string): Promise<GuestRecord | null> {
  // Fast path: in-memory cache, then blob-persisted cache. A miss falls
  // through to the live targeted query — the cache can be up to TTL stale,
  // and a freshly added guest must still be able to log in.
  const cached = guestCache ?? (await hydrateGuestCacheFromBlob());
  if (cached) {
    const hit = validateGuestFromRecords(name, cached);
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

    // Full Name only — see the note above on why titles wait for the full list.
    const normalized = normalize(name);
    for (const page of data.results) {
      const guest = parseGuestPage(page);
      if (guest && guest.normalizedName === normalized) return guest;
    }

    // Not found in targeted query — could be a schema mismatch; fall back to full scan
    return validateGuestFromRecords(name, await fetchAllGuests());
  } catch (err) {
    console.error('findGuestByName targeted query failed, falling back to fetchAllGuests:', err);
    return validateGuestFromRecords(name, await fetchAllGuests());
  }
}

/**
 * Resolve an envelope name (or any combination of a household's first names)
 * to the guests it identifies. See src/lib/envelope-name.ts for the rules.
 *
 * Mirrors the tiering of `findGuestByName`: warm caches first, then targeted
 * queries, and only a full scan as a last resort. Matching needs household
 * context, so every path assembles complete households before matching —
 * a partial household would silently reject valid names.
 *
 * Returns the matched guests, or null when nothing (or more than one household)
 * matches. Ambiguity fails closed rather than guessing which household to admit.
 */
export async function findHouseholdByEnvelopeName(name: string): Promise<GuestRecord[] | null> {
  const tokens = envelopeTokens(name);
  if (tokens.length === 0) return null;

  const warnAmbiguous = (matches: string[][]) => {
    console.warn(
      `Envelope-name login is ambiguous for ${JSON.stringify(name)} — matched ${matches.length} households:`,
      matches
    );
  };

  const resolve = (guests: GuestRecord[]): GuestRecord[] | null => {
    const memberIds = findMatchingHousehold(name, guests, warnAmbiguous);
    if (!memberIds) return null;
    const byId = new Map(guests.map((guest) => [guest.id, guest]));
    return memberIds
      .map((id) => byId.get(id))
      .filter((guest): guest is GuestRecord => guest !== undefined);
  };

  // Fast path: the cached list already holds every household in full.
  const cached = guestCache ?? (await hydrateGuestCacheFromBlob());
  if (cached) {
    const hit = resolve(cached);
    if (hit) return hit;
  }

  // Cold path: find candidate guests with two targeted queries, then expand each
  // hit to its full household via cached page retrieves. Keyed off the first
  // stripped token — the leading word of a name, once titles and "The" are gone.
  const apiKey = process.env.NOTION_API_KEY;
  const dataSourceId = process.env.NOTION_GUEST_LIST_DB;
  if (!apiKey || !dataSourceId) {
    throw new Error('Missing Notion credentials');
  }

  try {
    const firstToken = tokens[0];
    const candidates = await queryGuestCandidates(apiKey, dataSourceId, firstToken);

    if (candidates.length > 0) {
      // Pull in every related guest so each candidate's household is complete
      const householdIds = new Set<string>();
      for (const guest of candidates) {
        householdIds.add(guest.id);
        for (const relatedId of guest.relatedGuestIds) householdIds.add(relatedId);
      }

      const members = await Promise.all(
        [...householdIds].map(async (id) => {
          try {
            return await getGuestById(id);
          } catch (error) {
            console.error(`Failed to fetch household member ${id}:`, error);
            return null;
          }
        })
      );

      const hit = resolve(members.filter((g): g is GuestRecord => g !== null));
      if (hit) return hit;
    }

    // Nothing found via the targeted queries — the name may not lead with a
    // token either index contains (e.g. a hand-edited envelope). Full scan.
    return resolve(await fetchAllGuests());
  } catch (err) {
    console.error('findHouseholdByEnvelopeName targeted query failed, falling back:', err);
    return resolve(await fetchAllGuests());
  }
}

/**
 * Three targeted Notion queries for guests whose name, envelope line, or
 * `Also Known As` entry contains `token`, run in parallel. Failures on any one
 * side are tolerated — a single index hitting is enough to assemble the
 * household, and the `Also Known As` filter also 400s on a database where that
 * property has not been created yet.
 */
async function queryGuestCandidates(
  apiKey: string,
  dataSourceId: string,
  token: string
): Promise<GuestRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runQuery = async (filter: any): Promise<GuestRecord[]> => {
    const response = await fetch(`https://api.notion.com/v1/databases/${dataSourceId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ page_size: 25, filter }),
    });

    if (!response.ok) throw new Error(`Notion query failed: ${response.status}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: { results: any[] } = await response.json();
    return data.results
      .map(parseGuestPage)
      .filter((guest): guest is GuestRecord => guest !== null);
  };

  const results = await Promise.allSettled([
    runQuery({ property: 'Name of Guest', title: { contains: token } }),
    runQuery({ property: 'Envelope Names', rich_text: { contains: token } }),
    runQuery({ property: 'Also Known As', rich_text: { contains: token } }),
  ]);

  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<GuestRecord[]> => result.status === 'fulfilled'
  );

  if (fulfilled.length === 0) {
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    throw rejected?.reason ?? new Error('All guest candidate queries failed');
  }

  const merged = new Map<string, GuestRecord>();
  for (const result of fulfilled) {
    for (const guest of result.value) merged.set(guest.id, guest);
  }
  return [...merged.values()];
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

  // A member must appear once. `Related Guests` is hand-edited, and a row that
  // lists itself — or lists the same person twice — otherwise renders a
  // duplicate row on the RSVP form, which the guest fills in twice and which
  // lands in `Guests Attending` as a repeated name and a double headcount.
  // Notion silently dedupes the relation on write, so the response's Guest
  // relation looks right while the attendee list does not.
  const relatedIds = Array.from(new Set(primaryGuest.relatedGuestIds)).filter(
    (relatedId) => relatedId !== guestId
  );

  // Fetch related guests in parallel; skip any that fail to resolve
  const related = await Promise.all(
    relatedIds.map(async (relatedId) => {
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
 * Hand a shared response back to the members who are still on it, after the
 * submitting party has split off from them.
 *
 * The relation is narrowed to the stranded members and the attendee list is
 * rebuilt from those members alone, so the row keeps saying exactly what they
 * answered and nothing about the party that just left. The title follows the
 * relation so the row is still recognisable in Notion.
 *
 * Attendee names and status are only rewritten when every stranded member
 * resolved: a partial read would silently drop someone from a response that is
 * no longer ours to edit. Narrowing the relation is safe either way, and is what
 * stops the next lookup from finding this row again.
 */
async function detachFromSharedResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notion: any,
  existing: RSVPResponse,
  strandedIds: string[],
  eventLabel: 'NYC' | 'France'
): Promise<void> {
  const members = (
    await Promise.all(
      strandedIds.map(async (id) => {
        try {
          return await getGuestById(id);
        } catch (error) {
          console.error(`Failed to fetch stranded guest ${id}:`, error);
          return null;
        }
      })
    )
  ).filter((member): member is GuestRecord => member !== null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Guest: { relation: strandedIds.map((id) => ({ id })) },
  };

  const plan =
    members.length === strandedIds.length
      ? planDetachedResponse(members, existing.guestsAttending)
      : null;

  if (plan) {
    properties['Guests Attending'] = {
      rich_text: [{ text: { content: plan.guestsAttending } }],
    };
    properties.Status = { select: { name: plan.status } };
    properties.Response = {
      title: [{ text: { content: `${members[0].name} — ${eventLabel}` } }],
    };
  }

  await notion.pages.update({ page_id: existing.id, properties });
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
  const partyIds = party.map((member) => member.id);
  const guest = party.find((member) => member.id === guestId) ?? null;
  const guestName = guest?.name || 'Unknown Guest';

  // Index submitted attendance by member page ID when the form threads it, so
  // name edits and attendance resolve to the right member even if the displayed
  // name was changed on the form. Entries without a guestId (legacy clients)
  // fall back to normalized-name matching.
  const submittedById = new Map<string, { name: string; attending: boolean }>();
  for (const entry of submission.guestsAttending) {
    if (entry.guestId) {
      submittedById.set(entry.guestId, { name: entry.name, attending: entry.attending });
    }
  }
  const submittedAttendingNamesLegacy = new Set(
    submission.guestsAttending
      .filter((g) => g.attending && !g.guestId)
      .map((g) => normalize(g.name))
  );
  const memberAttendsSubmitted = (member: GuestRecord): boolean => {
    const byId = submittedById.get(member.id);
    if (byId) return byId.attending;
    return submittedAttendingNamesLegacy.has(member.normalizedName);
  };

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
  const existingRSVP = await getLatestRSVPForParty(partyIds, submission.event);

  // If that row also covers people who are no longer in this party, the
  // household was split after it responded. Leave the row to them and take a
  // fresh one, rather than overwriting their answer with this one.
  const stranded = existingRSVP
    ? strandedGuestIds(existingRSVP.guestIds, partyIds)
    : [];
  if (existingRSVP && stranded.length > 0) {
    await detachFromSharedResponse(notion, existingRSVP, stranded, eventLabel);
  }
  const rowToUpdate = stranded.length === 0 ? existingRSVP : null;

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
  if (rowToUpdate) {
    // Update existing page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notion.pages.update({
      page_id: rowToUpdate.id,
      properties,
    });
    responseId = rowToUpdate.id;
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
  const otherEvents = Array.from(
    new Set(party.flatMap((member) => member.eventInvitations))
  ).filter((e) => e !== submission.event);
  const otherRSVPs = new Map(
    await Promise.all(
      otherEvents.map(async (e) => [e, await getLatestRSVPForParty(partyIds, e)] as const)
    )
  );

  // Attendee name set from a stored response, for events OTHER than the one just
  // submitted — those resolve by name against the stored row, whose names match
  // the in-memory party's pre-write names.
  const otherAttendingNames = (event: 'nyc' | 'france'): Set<string> | null => {
    const rsvp = otherRSVPs.get(event);
    if (!rsvp) return null; // no response yet for this event — don't count it
    return new Set(
      rsvp.guestsAttending.split(',').map((name) => normalize(name)).filter(Boolean)
    );
  };

  // Resolve a member's RSVP status across every event they're invited to.
  const memberRsvpStatus = (
    member: GuestRecord
  ): 'Attending' | 'Declined' | 'Partial' | null => {
    const attendance: boolean[] = [];
    for (const event of member.eventInvitations) {
      if (event === submission.event) {
        attendance.push(memberAttendsSubmitted(member));
      } else {
        const names = otherAttendingNames(event);
        if (names === null) continue;
        attendance.push(names.has(member.normalizedName));
      }
    }
    if (attendance.length === 0) return null;
    const anyYes = attendance.some(Boolean);
    const anyNo = attendance.some((a) => !a);
    return anyYes && anyNo ? 'Partial' : anyYes ? 'Attending' : 'Declined';
  };

  // Resolve the specific Event Catalog pages a member has RSVP'd to attend: the
  // submitted event from this submission (so name edits don't break it), other
  // events from their latest non-declined stored response. Mirrors
  // getAttendingEvents but reads the current submission directly.
  const eventsAttendingForMember = (member: GuestRecord): string[] => {
    const ids = new Set<string>();
    for (const event of member.eventInvitations) {
      if (event === submission.event) {
        if (memberAttendsSubmitted(member)) {
          for (const id of submission.eventsAttending) ids.add(id);
        }
      } else {
        const rsvp = otherRSVPs.get(event);
        if (!rsvp || rsvp.status === 'Declined') continue;
        if (!rsvpIncludesGuest(rsvp, member.normalizedName)) continue;
        for (const id of rsvp.eventsAttending ?? []) ids.add(id);
      }
    }
    return Array.from(ids);
  };

  const nowIso = new Date().toISOString();

  // One merged Guest List write per party member: RSVP status, per-event invite
  // status → Received (advance-forward only), Last RSVP, Events Attending
  // relation, party dietary text, and — when the form threaded a guestId — a
  // persisted name edit.
  await Promise.all(
    party.map((member) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props: Record<string, any> = {};

      const rsvpStatus = memberRsvpStatus(member);
      if (rsvpStatus) props.RSVP = { status: { name: rsvpStatus } };

      if (member.eventInvitations.includes(submission.event)) {
        if (submission.event === 'nyc' && member.nycInviteStatus !== 'Received') {
          props['NYC Invite Sent'] = { status: { name: 'Received' } };
        } else if (
          submission.event === 'france' &&
          member.franceSaveTheDateStatus !== 'Received'
        ) {
          props['France Save the Date Sent'] = { status: { name: 'Received' } };
        }
      }

      props['Last RSVP'] = { date: { start: nowIso } };
      props['Events Attending'] = {
        relation: eventsAttendingForMember(member).map((id) => ({ id })),
      };
      props['Dietary Needs'] = {
        rich_text: submission.dietary ? [{ text: { content: submission.dietary } }] : [],
      };

      // Persist a name edit only when the form threaded this member's guestId
      // and the typed name differs. Writes First/Last (drives Full Name) and the
      // Name of Guest title so login and display stay consistent. This is how an
      // unnamed plus-one gets a real name — see src/lib/guest-name.ts.
      const nameEdit = guestNameEdit(member.name, submittedById.get(member.id)?.name);
      if (nameEdit) {
        props['First Name'] = { rich_text: [{ text: { content: nameEdit.first } }] };
        props['Last Name'] = { rich_text: [{ text: { content: nameEdit.last } }] };
        props['Name of Guest'] = { title: [{ text: { content: nameEdit.title } }] };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return notion.pages.update({ page_id: member.id, properties: props as any });
    })
  );

  // Guest List rows changed (status, name, attending events) — drop the cache so
  // reads (middleware, RSVP pre-fill, the API's post-submit name re-sign) see the
  // new values instead of a stale 15-min entry.
  clearGuestCache();

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
    // The whole relation, not just the id this was looked up by: submitRSVP
    // needs it to tell a response covering exactly this party from one left
    // over by a household that has since been split (see rsvp-split.ts).
    guestIds: (props['Guest']?.relation ?? []).map(
      (relation: { id: string }) => relation.id
    ),
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

export interface BackfillReport {
  totalGuests: number;
  guestsWithResponses: number;
  updated: number;
  skipped: number;
  failed: number;
  changes: Array<{
    id: string;
    name: string;
    eventsAttending: number;
    lastRSVP: string | null;
    dietary: string | null;
  }>;
}

/**
 * One-off backfill: populate the newer Guest List columns (`Events Attending`,
 * `Last RSVP`, `Dietary Needs`) for guests who RSVP'd before the RSVP write-back
 * shipped. Sourced entirely from stored RSVP Responses — it does NOT touch
 * `RSVP` status (already maintained) or the invite-status fields (mail
 * pipeline). Idempotent; safe to re-run. Pass `{ dryRun: true }` to compute the
 * report without writing.
 */
export async function backfillGuestListFromRSVPs(
  opts: { dryRun?: boolean } = {}
): Promise<BackfillReport> {
  const notion = getClient();
  const dryRun = opts.dryRun === true;

  const [guests, rsvpMap, nycCatalog, franceCatalog] = await Promise.all([
    fetchAllGuests(),
    fetchAllLatestRSVPs(),
    getEventCatalog('nyc'),
    getEventCatalog('france'),
  ]);
  const validEventIds = new Set([...nycCatalog, ...franceCatalog].map((e) => e.id));

  const report: BackfillReport = {
    totalGuests: guests.length,
    guestsWithResponses: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    changes: [],
  };

  for (const guest of guests) {
    const responses = rsvpMap.get(guest.id) ?? [];
    if (responses.length === 0) continue;
    report.guestsWithResponses++;

    // Events this guest is attending: union of eventsAttending across their
    // non-declined responses where they're named, filtered to live catalog IDs.
    const attendingIds = new Set<string>();
    for (const rsvp of responses) {
      if (rsvp.status === 'Declined') continue;
      if (!rsvpIncludesGuest(rsvp, guest.normalizedName)) continue;
      for (const id of rsvp.eventsAttending ?? []) {
        if (validEventIds.has(id)) attendingIds.add(id);
      }
    }

    // Latest submission time across their party's responses.
    const lastRSVP = responses
      .map((r) => r.submittedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    // Party-level dietary text from their most recent response that carries one.
    const dietary =
      [...responses]
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
        .map((r) => r.dietary)
        .find((d) => d && d.trim().length > 0) ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props: Record<string, any> = {
      'Events Attending': { relation: Array.from(attendingIds).map((id) => ({ id })) },
    };
    if (lastRSVP) props['Last RSVP'] = { date: { start: lastRSVP } };
    if (dietary) props['Dietary Needs'] = { rich_text: [{ text: { content: dietary } }] };

    report.changes.push({
      id: guest.id,
      name: guest.name,
      eventsAttending: attendingIds.size,
      lastRSVP,
      dietary,
    });

    if (dryRun) {
      report.skipped++;
      continue;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await notion.pages.update({ page_id: guest.id, properties: props as any });
      report.updated++;
    } catch (err) {
      console.error('Backfill update failed for', guest.id, guest.name, err);
      report.failed++;
    }
  }

  if (!dryRun) clearGuestCache();
  return report;
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
