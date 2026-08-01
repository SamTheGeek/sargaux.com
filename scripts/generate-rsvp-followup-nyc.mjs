#!/usr/bin/env node
/**
 * Generate the NYC RSVP follow-up workbooks.
 *
 * A companion to generate-invitation-csv.mjs, aimed at chasing responses rather
 * than printing envelopes: one row per invited guest, grouped by household, with
 * each guest's RSVP for this event resolved from the latest party-level response
 * in RSVP Responses. Guests who have not yet replied are highlighted and sorted
 * to the top, so the sheet reads as a call list.
 *
 * Output splits by the Guest List `Group` multi-select — households stay whole
 * and are filed by majority vote (ties and untagged households fall to Sargaux):
 *
 *   Sam Family / Gross Guests      → …-Gross-YYYYMMDD.xlsx
 *   Margaux Family / Ancel Guests  → …-Ancels-YYYYMMDD.xlsx
 *   everyone else                  → …-Sargaux-YYYYMMDD.xlsx
 *
 * Usage:
 *   node scripts/generate-rsvp-followup-nyc.mjs
 *
 * Output:
 *   scripts/output/rsvp-followup-nyc-{Gross,Ancels,Sargaux}-YYYYMMDD.xlsx
 *
 * Requires: NOTION_API_KEY, NOTION_GUEST_LIST_DB, NOTION_RSVP_RESPONSES_DB in .env.local
 */

import { generateFollowUpExport, openOutputFolder } from './lib/rsvp-followup.mjs';

generateFollowUpExport('nyc')
  .then(() => {
    console.log('\nDone.');
    openOutputFolder();
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
