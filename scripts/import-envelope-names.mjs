#!/usr/bin/env node
/**
 * Import hand-edited envelope names into the Notion Guest List.
 *
 * The invitation CSVs produced by generate-invitation-csv.mjs were corrected by
 * hand before printing, so the strings that actually reached guests live only
 * in those spreadsheets. Guests type what is printed on their envelope, so
 * login needs them: this script writes each household's envelope line(s) into
 * the `Envelope Names` property on every member of that household, where
 * src/lib/envelope-name.ts can match against them.
 *
 * Households are the same connected components the generator used (union-find
 * over `Related Guests`), so each CSV row corresponds to exactly one household.
 * Joining a row back to its household is attempted in descending confidence:
 *
 *   1. The row's EnvelopeName equals the name this household generates.
 *      Unedited rows — the majority — land here.
 *   2. Address1 + Postcode match the household's address.
 *   3. Every name token in the row is a first or last name in the household,
 *      and vice versa for the household's named members.
 *
 * Rows that still don't join are reported, never guessed at. A household can
 * receive two different envelope lines (NYC and France include different
 * members), so values accumulate across input files and are stored one per
 * line.
 *
 * Usage:
 *   node scripts/import-envelope-names.mjs <csv> [<csv> ...]          # dry run
 *   node scripts/import-envelope-names.mjs <csv> [<csv> ...] --apply  # writes
 *
 * Requires: NOTION_API_KEY and NOTION_GUEST_LIST_DB in .env.local
 */

import { readFileSync } from 'fs';
import { excludeTestGuestPages } from './lib/test-guests.mjs';
import {
  getText,
  parseCSV,
  groupHouseholds,
  envelopeNameForPages,
  toMemberInfo,
  isPlaceholderPlusOne,
} from './lib/envelope-csv.mjs';

// ─── Env ──────────────────────────────────────────────────────────────────────

const envPath = new URL('../.env.local', import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const { NOTION_API_KEY, NOTION_GUEST_LIST_DB } = env;
if (!NOTION_API_KEY || !NOTION_GUEST_LIST_DB) {
  console.error('Missing NOTION_API_KEY or NOTION_GUEST_LIST_DB in .env.local');
  process.exit(1);
}

// ─── Notion helpers ───────────────────────────────────────────────────────────

async function notionRequest(method, path, body) {
  const r = await fetch('https://api.notion.com/v1/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + NOTION_API_KEY,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await r.json();
  if (json.object === 'error') throw new Error(json.message);
  return json;
}

async function queryAll(dbId) {
  const pages = [];
  let cursor;
  do {
    const res = await notionRequest('POST', 'databases/' + dbId + '/query', {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return pages;
}

// ─── Name comparison ──────────────────────────────────────────────────────────

/**
 * Token set for loose name comparison. Mirrors envelopeTokens() in
 * src/lib/envelope-name.ts closely enough for joining, but this is only ever
 * used to *match rows to households* — never to decide a login.
 */
const TITLES = new Set(['mr', 'mrs', 'ms', 'mx', 'dr', 'm', 'mme', 'mlle']);
const CONNECTORS = new Set(['and', 'et', '&', '+', 'plus']);

function nameTokens(input) {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['‘’ʼ`´]/g, '')
    .replace(/[-‐-—]/g, ' ')
    .replace(/\+\s*1\b/g, ' ')
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => !TITLES.has(t) && !CONNECTORS.has(t));
}

function sameTokens(a, b) {
  const ta = [...nameTokens(a)].sort().join(' ');
  const tb = [...nameTokens(b)].sort().join(' ');
  return ta.length > 0 && ta === tb;
}

// ─── Household model ──────────────────────────────────────────────────────────

/** The address fields the CSV carries, read back off a household's pages. */
function householdAddressKeys(pages) {
  const keys = new Set();
  for (const page of pages) {
    const place = page.properties['Mailing Address']?.place?.address;
    if (!place) continue;
    const parts = place.split(', ');
    keys.add(normalizeAddressKey(parts[0]));
  }
  return keys;
}

function normalizeAddressKey(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** All name tokens a household owns (first and last names of named members). */
function householdNameTokens(pages) {
  const tokens = new Set();
  for (const page of pages) {
    const info = toMemberInfo(page);
    if (isPlaceholderPlusOne(info)) continue;
    for (const token of nameTokens(info.firstName)) tokens.add(token);
    for (const token of nameTokens(info.lastName)) tokens.add(token);
  }
  return tokens;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const csvPaths = args.filter(a => !a.startsWith('--'));

if (csvPaths.length === 0) {
  console.error('Usage: node scripts/import-envelope-names.mjs <csv> [<csv> ...] [--apply]');
  process.exit(1);
}

async function main() {
  console.log(`\n── Importing envelope names ${apply ? '(APPLY)' : '(dry run)'} ──`);

  const allPages = excludeTestGuestPages(await queryAll(NOTION_GUEST_LIST_DB));
  console.log(`  Guests in database: ${allPages.length}`);

  const households = groupHouseholds(allPages).map(pages => ({
    pages,
    generated: envelopeNameForPages(pages),
    addressKeys: householdAddressKeys(pages),
    nameTokens: householdNameTokens(pages),
    /** Envelope strings gathered from the CSVs, in first-seen order. */
    envelopeNames: [],
  }));
  console.log(`  Households: ${households.length}`);

  const unjoined = [];
  let rowCount = 0;

  for (const csvPath of csvPaths) {
    const rows = parseCSV(readFileSync(csvPath, 'utf8'));
    console.log(`\n  ${csvPath}: ${rows.length} rows`);
    rowCount += rows.length;

    for (const row of rows) {
      const envelopeName = (row.EnvelopeName || '').trim();
      if (!envelopeName) continue;

      const household = joinRow(row, envelopeName, households);
      if (!household) {
        unjoined.push({ csvPath, envelopeName, address: row.Address1 || '' });
        continue;
      }

      if (!household.envelopeNames.includes(envelopeName)) {
        household.envelopeNames.push(envelopeName);
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const changes = [];
  for (const household of households) {
    if (household.envelopeNames.length === 0) continue;
    const desired = household.envelopeNames.join('\n');

    for (const page of household.pages) {
      const current = getText(page.properties, 'Envelope Names');
      if (current === desired) continue;
      changes.push({ page, current, desired, household });
    }
  }

  const changedHouseholds = new Set(changes.map(c => c.household));
  console.log(`\n  Rows read: ${rowCount}`);
  console.log(`  Households matched: ${households.filter(h => h.envelopeNames.length > 0).length}`);
  console.log(`  Guest rows to update: ${changes.length} across ${changedHouseholds.size} households`);

  for (const household of changedHouseholds) {
    const members = household.pages.map(p => toMemberInfo(p).firstName || '?').join(', ');
    console.log(`    • ${household.envelopeNames.join(' | ')}  →  [${members}]`);
  }

  if (unjoined.length > 0) {
    console.log(`\n  ⚠️  Unjoined rows (${unjoined.length}) — resolve these by hand:`);
    for (const row of unjoined) {
      console.log(`    • "${row.envelopeName}"${row.address ? `  (${row.address})` : ''}`);
    }
  }

  const skipped = households.filter(h => h.envelopeNames.length === 0);
  if (skipped.length > 0) {
    console.log(`\n  Households with no CSV row (${skipped.length}) — left untouched:`);
    for (const household of skipped.slice(0, 20)) {
      console.log(`    • ${household.generated ?? '(unnamed household)'}`);
    }
    if (skipped.length > 20) console.log(`    … and ${skipped.length - 20} more`);
  }

  if (!apply) {
    console.log('\n  Dry run — nothing written. Re-run with --apply to write.\n');
    return;
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  let written = 0;
  for (const { page, desired } of changes) {
    await notionRequest('PATCH', `pages/${page.id}`, {
      properties: {
        'Envelope Names': { rich_text: [{ type: 'text', text: { content: desired } }] },
      },
    });
    written++;
    if (written % 25 === 0) console.log(`    … ${written}/${changes.length}`);
  }

  console.log(`\n  ✓ Updated ${written} guest rows.\n`);
}

/** Join one CSV row to a household. Returns the household or null. */
function joinRow(row, envelopeName, households) {
  // 1. Exact match on the name this household generates (unedited rows)
  const generated = households.filter(h => h.generated && h.generated === envelopeName);
  if (generated.length === 1) return generated[0];

  // 2. Address1 (+ Postcode when the CSV carries one)
  const addressKey = normalizeAddressKey(row.Address1);
  if (addressKey) {
    const byAddress = households.filter(h => h.addressKeys.has(addressKey));
    if (byAddress.length === 1) return byAddress[0];
  }

  // 3. Name tokens: every token in the row belongs to the household, and the
  //    household contributes no named member the row omits.
  const rowTokens = nameTokens(envelopeName);
  if (rowTokens.length > 0) {
    const byTokens = households.filter(h => {
      if (h.nameTokens.size === 0) return false;
      if (!rowTokens.every(t => h.nameTokens.has(t))) return false;
      return h.generated ? sameTokens(h.generated, envelopeName) : false;
    });
    if (byTokens.length === 1) return byTokens[0];
  }

  return null;
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
