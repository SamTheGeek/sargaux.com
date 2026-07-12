#!/usr/bin/env tsx
/**
 * One-off backfill of the newer Guest List columns — `Events Attending`,
 * `Last RSVP`, `Dietary Needs` — from existing RSVP Responses, for guests who
 * RSVP'd before the RSVP write-back shipped.
 *
 * Dry run (default, no writes):  npx tsx scripts/backfill-rsvp-guest-list.ts
 * Execute writes:                npx tsx scripts/backfill-rsvp-guest-list.ts --write
 *
 * Requires in the environment (e.g. exported from .env.local):
 *   NOTION_API_KEY, NOTION_GUEST_LIST_DB, NOTION_EVENT_CATALOG_DB,
 *   NOTION_RSVP_RESPONSES_DB
 *
 * Idempotent — safe to re-run. Does NOT touch `RSVP` status or the invite-status
 * (mail-pipeline) fields.
 */

import { backfillGuestListFromRSVPs } from '../src/lib/notion';

const write = process.argv.includes('--write');

async function main(): Promise<void> {
  const report = await backfillGuestListFromRSVPs({ dryRun: !write });

  console.log(`\nMode:                  ${write ? 'WRITE' : 'DRY RUN (no writes)'}`);
  console.log(`Total guests:          ${report.totalGuests}`);
  console.log(`Guests with responses: ${report.guestsWithResponses}`);
  console.log(`${write ? 'Updated:              ' : 'Would update:         '} ${report.changes.length}`);
  if (write) {
    console.log(`Failed:                ${report.failed}`);
  }

  console.log('\nPer-guest changes:');
  for (const c of report.changes) {
    console.log(
      `  ${c.name.padEnd(28)} events=${String(c.eventsAttending).padStart(2)}  ` +
        `lastRSVP=${c.lastRSVP ?? '-'}  dietary=${c.dietary ? JSON.stringify(c.dietary) : '-'}`
    );
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
