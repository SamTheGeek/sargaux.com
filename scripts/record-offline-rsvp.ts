#!/usr/bin/env tsx
/**
 * Record RSVPs that arrived off-site — by text, email, or in person — as if the
 * guest had filled in the form.
 *
 * Everything goes through `submitRSVP`, the same function the RSVP endpoint
 * calls, so a hand-entered response is indistinguishable from a submitted one:
 * the party-level RSVP Responses row (with per-member `attendance` in Details),
 * the Guest List write-back (RSVP status, invite status → Received, Last RSVP,
 * Events Attending, dietary), and the household-split handling all run. Writing
 * the Notion rows by hand skips every one of those.
 *
 * Dry run (default, no writes):  npx tsx scripts/record-offline-rsvp.ts
 * Execute writes:                npx tsx scripts/record-offline-rsvp.ts --write
 * Alternate input file:          npx tsx scripts/record-offline-rsvp.ts path/to/file.json
 *
 * Input defaults to `scripts/input/offline-rsvps.json` — gitignored, because it
 * holds real guest names. A JSON array of entries:
 *
 *   [
 *     {
 *       "lookup": "Jane Doe",          // any name that logs them in — full name,
 *                                      // envelope line, or an `Also Known As`
 *       "event": "nyc",                // "nyc" | "france"
 *       "attending": "all",            // "all" | "none" | ["Jane Doe", "John Doe"]
 *       "optionalEvents": ["Brunch"],  // optional-event names; omit for none
 *       "dietary": "no shellfish",     // optional, party-level
 *       "message": "Can't wait!"       // optional
 *     }
 *   ]
 *
 * `attending` names are matched against the guest's whole party (the household's
 * transitive closure, exactly what the form renders). Anyone in the party who
 * isn't listed is recorded as declining, which is what makes the response's
 * Status trustworthy — so an unrecognised name is a hard error rather than a
 * silent decline for the person who was meant to be there.
 *
 * Requires in the environment, or in .env.local: NOTION_API_KEY,
 * NOTION_GUEST_LIST_DB, NOTION_EVENT_CATALOG_DB, NOTION_RSVP_RESPONSES_DB.
 *
 * Idempotent — re-running an entry updates that party's existing row for the
 * event rather than adding a second one.
 *
 * After a --write run, refresh calendar subscriptions so the new attendance
 * reaches anyone already subscribed:
 *
 *   curl -X POST https://sargaux.com/api/admin/refresh-calendars \
 *     -H "Content-Type: application/json" \
 *     -H "Authorization: Bearer $(grep '^RESEND_ADMIN_SECRET' .env.local | cut -d= -f2-)"
 */

import { readFileSync } from 'fs';
import {
  findGuestsByName,
  findHouseholdByEnvelopeName,
  getGuestParty,
  getGuestEvents,
  submitRSVP,
} from '../src/lib/notion';
import { normalize } from '../src/lib/normalize';
import type { GuestRecord, EventRecord } from '../src/types';

interface OfflineRSVPEntry {
  lookup: string;
  event: 'nyc' | 'france';
  attending: 'all' | 'none' | string[];
  optionalEvents?: string[];
  dietary?: string;
  message?: string;
}

const DEFAULT_INPUT = 'scripts/input/offline-rsvps.json';

const write = process.argv.includes('--write');
const inputPath = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? DEFAULT_INPUT;

/**
 * Fill process.env from .env.local, matching the other Notion scripts. Runs
 * before any Notion call — the client and every database ID are read lazily
 * inside the helpers, not when the module is imported.
 */
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const idx = line.indexOf('=');
      const key = line.slice(0, idx).trim();
      if (!process.env[key]) process.env[key] = line.slice(idx + 1).trim();
    }
  } catch {
    // No .env.local — fall through to whatever is already exported.
  }
}

function readEntries(path: string): OfflineRSVPEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${path}: ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${path} must contain a JSON array of entries.`);
  }
  return parsed.map((entry, i) => validateEntry(entry, i));
}

function validateEntry(entry: unknown, index: number): OfflineRSVPEntry {
  const where = `entry ${index + 1}`;
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`${where}: must be an object.`);
  }
  const e = entry as Record<string, unknown>;
  if (typeof e.lookup !== 'string' || !e.lookup.trim()) {
    throw new Error(`${where}: "lookup" must be a non-empty name.`);
  }
  if (e.event !== 'nyc' && e.event !== 'france') {
    throw new Error(`${where}: "event" must be "nyc" or "france".`);
  }
  const attending = e.attending;
  const attendingOk =
    attending === 'all' ||
    attending === 'none' ||
    (Array.isArray(attending) && attending.every((n) => typeof n === 'string'));
  if (!attendingOk) {
    throw new Error(`${where}: "attending" must be "all", "none", or an array of names.`);
  }
  return {
    lookup: e.lookup.trim(),
    event: e.event,
    attending: attending as OfflineRSVPEntry['attending'],
    optionalEvents: Array.isArray(e.optionalEvents) ? (e.optionalEvents as string[]) : undefined,
    dietary: typeof e.dietary === 'string' && e.dietary.trim() ? e.dietary.trim() : undefined,
    message: typeof e.message === 'string' && e.message.trim() ? e.message.trim() : undefined,
  };
}

/**
 * Resolve the typed name to a single guest, using the same ladder as login:
 * exact `Full Name` first, then the envelope/alias rules. An ambiguous name is
 * an error — the site would show an identity picker here, and guessing would
 * file the RSVP against the wrong household.
 */
async function resolveGuest(lookup: string): Promise<GuestRecord> {
  const exact = await findGuestsByName(lookup);
  const matches = exact.length > 0 ? exact : ((await findHouseholdByEnvelopeName(lookup)) ?? []);

  if (matches.length === 0) {
    throw new Error(`no guest matches "${lookup}" — check the spelling against the Guest List.`);
  }
  if (matches.length > 1) {
    const names = matches.map((g) => g.name).join(', ');
    throw new Error(
      `"${lookup}" matches ${matches.length} guests (${names}) — use one of their full names instead.`
    );
  }
  return matches[0];
}

/**
 * Map the listed names onto party members. Matches a full name first, then a
 * unique first name, so "Matt" resolves in a party with one Matt but errors in
 * a party with two.
 */
function resolveAttendance(
  party: GuestRecord[],
  attending: OfflineRSVPEntry['attending']
): Map<string, boolean> {
  if (attending === 'all') return new Map(party.map((m) => [m.id, true]));
  if (attending === 'none') return new Map(party.map((m) => [m.id, false]));

  const byId = new Map(party.map((m) => [m.id, false]));
  for (const name of attending) {
    const wanted = normalize(name);
    const full = party.filter((m) => m.normalizedName === wanted);
    const first = party.filter((m) => normalize(m.name).split(' ')[0] === wanted);
    const candidates = full.length > 0 ? full : first;

    if (candidates.length === 0) {
      throw new Error(
        `"${name}" is not in this party (${party.map((m) => m.name).join(', ')}).`
      );
    }
    if (candidates.length > 1) {
      throw new Error(`"${name}" matches more than one party member — use their full name.`);
    }
    byId.set(candidates[0].id, true);
  }
  return byId;
}

/**
 * The Event Catalog pages this response covers: every Core event for the
 * wedding, plus any Optional events named in the entry. Mirrors the form, where
 * core events are the default yes and optional ones are opted into. Empty when
 * nobody attends, matching the form's `anyAttending` guard.
 */
function resolveEvents(
  events: EventRecord[],
  entry: OfflineRSVPEntry,
  anyAttending: boolean
): EventRecord[] {
  if (!anyAttending) return [];

  const forWedding = events.filter((e) => e.wedding === entry.event);
  const core = forWedding.filter((e) => e.type === 'Core');
  const optional = forWedding.filter((e) => e.type === 'Optional');

  const picked: EventRecord[] = [...core];
  for (const name of entry.optionalEvents ?? []) {
    const wanted = normalize(name);
    const hit = optional.filter((e) => normalize(e.name) === wanted);
    if (hit.length === 0) {
      const available = optional.map((e) => e.name).join(', ') || '(none)';
      throw new Error(
        `optional event "${name}" not found for ${entry.event} — available: ${available}`
      );
    }
    picked.push(...hit);
  }
  return picked;
}

async function processEntry(entry: OfflineRSVPEntry): Promise<void> {
  const guest = await resolveGuest(entry.lookup);
  const party = await getGuestParty(guest.id);

  if (!guest.eventInvitations.includes(entry.event)) {
    throw new Error(`${guest.name} is not invited to ${entry.event.toUpperCase()}.`);
  }

  const attendance = resolveAttendance(party, entry.attending);
  const anyAttending = Array.from(attendance.values()).some(Boolean);
  const events = resolveEvents(await getGuestEvents(guest.id), entry, anyAttending);

  // Every party member, always: submitRSVP derives the response Status from
  // this list while relating the row to the whole party, so a gap would make
  // Status describe a different set of people than the relation.
  const guestsAttending = party.map((member) => ({
    guestId: member.id,
    name: member.name,
    attending: attendance.get(member.id) === true,
  }));

  const attendingCount = guestsAttending.filter((g) => g.attending).length;
  const status =
    attendingCount === 0 ? 'Declined' : attendingCount === party.length ? 'Attending' : 'Partial';

  console.log(`\n  ${entry.lookup} → ${entry.event.toUpperCase()} · ${status}`);
  for (const g of guestsAttending) {
    console.log(`    ${g.attending ? '✓' : '✗'} ${g.name}`);
  }
  console.log(`    events:  ${events.map((e) => e.name).join(', ') || '(none)'}`);
  if (entry.dietary) console.log(`    dietary: ${entry.dietary}`);
  if (entry.message) console.log(`    message: ${entry.message}`);

  if (!write) return;

  const response = await submitRSVP(guest.id, {
    event: entry.event,
    guestsAttending,
    eventsAttending: events.map((e) => e.id),
    dietary: entry.dietary,
    message: entry.message,
  });
  console.log(`    written: ${response.id}`);
}

async function main(): Promise<void> {
  loadEnvLocal();

  const missing = [
    'NOTION_API_KEY',
    'NOTION_GUEST_LIST_DB',
    'NOTION_EVENT_CATALOG_DB',
    'NOTION_RSVP_RESPONSES_DB',
  ].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(', ')} in .env.local (or the environment).`);
  }

  const entries = readEntries(inputPath);

  console.log(`\nMode:   ${write ? 'WRITE' : 'DRY RUN (no writes)'}`);
  console.log(`Input:  ${inputPath}`);
  console.log(`Entries: ${entries.length}`);

  let failed = 0;
  for (const entry of entries) {
    try {
      await processEntry(entry);
    } catch (err) {
      failed += 1;
      // Keep going: one bad lookup shouldn't strand the rest of the batch, and
      // a dry run is most useful when it reports every problem at once.
      console.error(`\n  ${entry.lookup} → SKIPPED: ${(err as Error).message}`);
    }
  }

  console.log(
    `\n${write ? 'Recorded' : 'Would record'}: ${entries.length - failed}   Skipped: ${failed}\n`
  );
  if (write && entries.length - failed > 0) {
    console.log('Refresh calendar subscriptions with POST /api/admin/refresh-calendars.\n');
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  // Everything that reaches here is a bad input file or a missing credential —
  // the message is the useful part, not the stack.
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
