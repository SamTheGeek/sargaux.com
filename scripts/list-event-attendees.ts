#!/usr/bin/env tsx
/**
 * Who RSVP'd yes to a given event?
 *
 * Built for the case where an event is cancelled and the guests who signed up
 * for it need to be told. It resolves the recipient list and prints the exact
 * `POST /api/admin/send-email` call that mails them — it never sends anything
 * itself, and it never writes to Notion.
 *
 * Two things make this more than a Notion filter:
 *
 * 1. **A cancelled event is invisible to getEventCatalog.** Unchecking `Show on
 *    Website` is how an event is cancelled (see parseEventPage in
 *    src/lib/notion.ts), and the catalog drops those rows for the whole site.
 *    So this script queries the Event Catalog directly and deliberately
 *    includes hidden rows — otherwise you could never mail the people affected
 *    by the very cancellation you just made.
 *
 * 2. **Attendance is not a name match.** It goes through
 *    `memberAttendedResponse`, the single decision used by the calendar feeds
 *    and the Guest List write-back: recorded per-member attendance first, then
 *    the response Status against the `Guest` relation, and only then the
 *    attendee names. A party-level response says "this party is attending";
 *    it does not by itself say that every member on it attended. Matching on
 *    names alone silently drops guests whose stored name has drifted from the
 *    one they submitted under (a married surname, a nickname, an unnamed +1).
 *
 * The Guest List `Events Attending` relation would be an easier read, but it is
 * a derived write-back that only refreshes when a party resubmits. The stored
 * responses are the source of truth, so that is what this reads.
 *
 * Usage:
 *   # by name (substring, case-insensitive) — the usual way
 *   npx tsx scripts/list-event-attendees.ts --event "Leaf Peeping Bike Ride"
 *
 *   # several at once, or by Notion page ID
 *   npx tsx scripts/list-event-attendees.ts --event "Bike Ride" --event "Brooklyn Museum"
 *   npx tsx scripts/list-event-attendees.ts --event-id 30004b63ea278107b543eaaad5dc724d
 *
 *   # list every event, cancelled ones included, to find the right name
 *   npx tsx scripts/list-event-attendees.ts --list
 *
 * Flags:
 *   --event <name>       event to report on, by name substring (repeatable)
 *   --event-id <id>      event to report on, by Notion page ID (repeatable)
 *   --list               print the whole Event Catalog and exit
 *   --json <path>        also write the full report (names + emails) to a file
 *                        (default: scripts/output/event-attendees-<date>.json)
 *   --no-json            skip the file, print to stdout only
 *   --include-test-guests  don't drop the synthetic 🤖 party (default: dropped)
 *
 * Reads NOTION_API_KEY, NOTION_GUEST_LIST_DB, NOTION_EVENT_CATALOG_DB and
 * NOTION_RSVP_RESPONSES_DB from .env.local.
 *
 * PRIVACY: guest names and addresses are PII and this repo is public. The JSON
 * report lands in scripts/output/, which is gitignored and must stay that way.
 * Never paste a real guest's name into a commit message, a PR, or this file.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Client } from '@notionhq/client';
import { fetchAllGuests, fetchAllLatestRSVPs } from '../src/lib/notion';
import { memberAttendedResponse } from '../src/lib/rsvp-attendance';
import { excludeTestGuests } from '../src/lib/test-guests';
import type { GuestRecord, RSVPResponse } from '../src/types';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * An Event Catalog row as this script reads it — deliberately including rows
 * the site no longer shows, which is the whole point.
 */
interface CatalogRow {
  id: string;
  name: string;
  wedding: 'nyc' | 'france';
  type: string;
  date?: string;
  live: boolean; // `Show on Website`
}

interface Recipient {
  guestId: string;
  name: string;
  email?: string;
}

interface EventReport {
  event: CatalogRow;
  recipients: Recipient[];
}

// ─── Args ────────────────────────────────────────────────────────────────────

interface Args {
  names: string[];
  ids: string[];
  list: boolean;
  jsonPath: string | null;
  includeTestGuests: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    names: [],
    ids: [],
    list: false,
    jsonPath: defaultJsonPath(),
    includeTestGuests: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) fail(`${arg} needs a value`);
      return value;
    };

    switch (arg) {
      case '--event':
        args.names.push(next());
        break;
      case '--event-id':
        args.ids.push(next().replace(/-/g, ''));
        break;
      case '--list':
        args.list = true;
        break;
      case '--json':
        args.jsonPath = next();
        break;
      case '--no-json':
        args.jsonPath = null;
        break;
      case '--include-test-guests':
        args.includeTestGuests = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      // eslint-disable-next-line no-fallthrough -- process.exit never returns
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  if (!args.list && args.names.length === 0 && args.ids.length === 0) {
    printUsage();
    process.exit(1);
  }

  return args;
}

function defaultJsonPath(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `scripts/output/event-attendees-${stamp}.json`;
}

function printUsage(): void {
  console.log(
    [
      'Usage:',
      '  npx tsx scripts/list-event-attendees.ts --event "Leaf Peeping Bike Ride"',
      '  npx tsx scripts/list-event-attendees.ts --event "Bike Ride" --event "Brooklyn Museum"',
      '  npx tsx scripts/list-event-attendees.ts --event-id <notion-page-id>',
      '  npx tsx scripts/list-event-attendees.ts --list',
      '',
      'Flags: --json <path>  --no-json  --include-test-guests',
    ].join('\n')
  );
}

function fail(message: string): never {
  console.error(`❌  ${message}`);
  process.exit(1);
}

// ─── Event Catalog (hidden rows included) ────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`${name} is not set. Add it to .env.local.`);
  return value;
}

/**
 * Read the whole Event Catalog, cancelled events included.
 *
 * Not getEventCatalog(): that filters on `Show on Website`, so the events this
 * script exists to report on are exactly the ones it would hide.
 */
async function fetchCatalog(): Promise<CatalogRow[]> {
  const notion = new Client({ auth: requireEnv('NOTION_API_KEY') });
  const dataSourceId = requireEnv('NOTION_EVENT_CATALOG_DB');

  const rows: CatalogRow[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = (page as any).properties ?? {};
      const name = props['Event Name']?.title?.[0]?.plain_text;
      if (!name) continue;

      const weddingLabel = props['Wedding']?.select?.name;
      if (weddingLabel !== 'New York' && weddingLabel !== 'France') continue;

      rows.push({
        id: (page as { id: string }).id,
        name,
        wedding: weddingLabel === 'New York' ? 'nyc' : 'france',
        type: props['Event Type']?.select?.name ?? 'Core',
        date: props['Event Date']?.date?.start ?? undefined,
        live: props['Show on Website']?.checkbox === true,
      });
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return rows;
}

/** Resolve the requested events, failing closed on an ambiguous name. */
function resolveEvents(catalog: CatalogRow[], args: Args): CatalogRow[] {
  const byNormalizedId = new Map(catalog.map((row) => [row.id.replace(/-/g, ''), row]));
  const resolved: CatalogRow[] = [];

  for (const id of args.ids) {
    const row = byNormalizedId.get(id);
    if (!row) fail(`No Event Catalog row with page ID ${id}`);
    resolved.push(row);
  }

  for (const needle of args.names) {
    const matches = catalog.filter((row) =>
      row.name.toLowerCase().includes(needle.toLowerCase())
    );
    if (matches.length === 0) {
      fail(`No event matches "${needle}". Run with --list to see them all.`);
    }
    if (matches.length > 1) {
      // Ambiguity is cheap to surface here and expensive to discover in a
      // recipient list, so it's an error rather than a guess.
      fail(
        `"${needle}" matches ${matches.length} events: ${matches
          .map((row) => row.name)
          .join(', ')}. Be more specific, or use --event-id.`
      );
    }
    resolved.push(matches[0]);
  }

  // Dedupe in case the same event was named twice.
  return [...new Map(resolved.map((row) => [row.id, row])).values()];
}

// ─── Recipients ──────────────────────────────────────────────────────────────

/**
 * Guests whose latest stored response for the event's wedding both names the
 * event and records them personally as attending.
 */
function recipientsFor(
  event: CatalogRow,
  guests: GuestRecord[],
  latestRSVPs: Map<string, RSVPResponse[]>
): Recipient[] {
  const recipients: Recipient[] = [];

  for (const guest of guests) {
    const responses = latestRSVPs.get(guest.id) ?? [];
    const attended = responses.some(
      (rsvp) =>
        rsvp.event === event.wedding &&
        (rsvp.eventsAttending ?? []).includes(event.id) &&
        // Party-level Status alone doesn't settle a member — see the module
        // docblock in src/lib/rsvp-attendance.ts.
        memberAttendedResponse(rsvp, guest)
    );
    if (!attended) continue;

    recipients.push({ guestId: guest.id, name: guest.name, email: guest.email });
  }

  return recipients.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Reporting ───────────────────────────────────────────────────────────────

function reportEvent(report: EventReport): void {
  const { event, recipients } = report;
  const status = event.live ? 'live' : 'CANCELLED (Show on Website unchecked)';

  console.log('');
  console.log(`── ${event.name} ──`);
  console.log(
    `   ${event.wedding.toUpperCase()} · ${event.type} · ${event.date ?? 'no date'} · ${status}`
  );
  console.log(`   ${recipients.length} guest(s) RSVP'd yes`);

  const withEmail = recipients.filter((r) => r.email);
  const withoutEmail = recipients.filter((r) => !r.email);
  const uniqueAddresses = new Set(withEmail.map((r) => r.email!.toLowerCase()));

  console.log(
    `   ${withEmail.length} with an email on file · ${uniqueAddresses.size} unique address(es)`
  );

  if (withoutEmail.length > 0) {
    // sendToGuests skips these silently, so say so here instead.
    console.log(
      `   ⚠️  ${withoutEmail.length} have no email on file and will NOT be mailed:`
    );
    for (const r of withoutEmail) console.log(`        · ${r.name}`);
  }

  if (uniqueAddresses.size < withEmail.length) {
    // One email per guest is what sendToGuests does, so a shared household
    // address receives one message per person at it.
    const shared = new Map<string, string[]>();
    for (const r of withEmail) {
      const key = r.email!.toLowerCase();
      shared.set(key, [...(shared.get(key) ?? []), r.name]);
    }
    console.log('   ⚠️  shared address(es) — one email will be sent per guest:');
    for (const [email, names] of shared) {
      if (names.length > 1) console.log(`        · ${email} → ${names.join(', ')}`);
    }
  }

  console.log('');
  console.log('   guestIds for POST /api/admin/send-email:');
  console.log(`   ${JSON.stringify(recipients.map((r) => r.guestId))}`);
}

function printSendInstructions(reports: EventReport[]): void {
  console.log('');
  console.log('────────────────────────────────────────────────────────────');
  console.log('To send, per event (reminder-general takes subject + body;');
  console.log('guestName is filled in per recipient by the endpoint):');
  console.log('');
  for (const { event, recipients } of reports) {
    const ids = JSON.stringify(recipients.map((r) => r.guestId));
    console.log(`# ${event.name}`);
    console.log('curl -X POST https://sargaux.com/api/admin/send-email \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log(
      '  -H "Authorization: Bearer $(grep \'^RESEND_ADMIN_SECRET\' .env.local | cut -d= -f2-)" \\'
    );
    console.log(
      `  -d '${JSON.stringify({
        templateId: 'reminder-general',
        guestIds: JSON.parse(ids),
        templateData: { subject: 'TODO', body: 'TODO' },
      })}'`
    );
    console.log('');
  }
  console.log('The endpoint drops test guests and guests with no email, and');
  console.log('returns { sent, failed, noEmail, unknownIds }.');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const catalog = await fetchCatalog();

  if (args.list) {
    console.log('Event Catalog (cancelled events included):');
    for (const row of catalog) {
      const status = row.live ? '  live   ' : 'CANCELLED';
      console.log(
        `  [${status}] ${row.wedding.toUpperCase().padEnd(6)} ${row.type.padEnd(8)} ${
          row.date ?? '          '
        }  ${row.name}`
      );
    }
    return;
  }

  const events = resolveEvents(catalog, args);

  const [allGuests, latestRSVPs] = await Promise.all([
    fetchAllGuests(),
    fetchAllLatestRSVPs(),
  ]);
  const guests = args.includeTestGuests ? allGuests : excludeTestGuests(allGuests);

  const reports: EventReport[] = events.map((event) => ({
    event,
    recipients: recipientsFor(event, guests, latestRSVPs),
  }));

  for (const report of reports) reportEvent(report);

  if (reports.length > 1) {
    const union = new Set(
      reports.flatMap((r) => r.recipients.map((recipient) => recipient.guestId))
    );
    const counts = new Map<string, number>();
    for (const report of reports) {
      for (const r of report.recipients) {
        counts.set(r.guestId, (counts.get(r.guestId) ?? 0) + 1);
      }
    }
    const overlap = [...counts.values()].filter((n) => n === reports.length).length;
    console.log('');
    console.log(
      `Across all ${reports.length} events: ${union.size} distinct guest(s), ${overlap} on every list.`
    );
  }

  printSendInstructions(reports);

  if (args.jsonPath) {
    mkdirSync(dirname(args.jsonPath), { recursive: true });
    writeFileSync(
      args.jsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          events: reports.map(({ event, recipients }) => ({ event, recipients })),
        },
        null,
        2
      )
    );
    console.log('');
    console.log(`📄  Full report (names + emails) written to ${args.jsonPath}`);
    console.log('    That file is guest PII — scripts/output/ is gitignored, keep it so.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
