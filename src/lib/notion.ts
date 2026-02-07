/**
 * Notion client wrapper for fetching guest data.
 *
 * IMPORTANT: The NOTION_API_KEY must NEVER be committed to the repository.
 * Store it in GitHub Secrets / Netlify environment variables only.
 */

import { Client } from '@notionhq/client';
import type { GuestRecord } from '../types/guest';

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

/**
 * Fetch all guests from the Notion Guest List database.
 * Results are cached in memory for the lifetime of the server process.
 */
export async function fetchAllGuests(): Promise<GuestRecord[]> {
  if (guestCache) return guestCache;

  const notion = getClient();
  const databaseId = process.env.NOTION_GUEST_LIST_DB;

  if (!databaseId) {
    throw new Error(
      'NOTION_GUEST_LIST_DB is not set. Add it to Netlify environment variables.'
    );
  }

  const guests: GuestRecord[] = [];
  let cursor: string | undefined = undefined;

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await notion.databases.query({
      database_id: databaseId,
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
}
