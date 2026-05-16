#!/usr/bin/env node
/**
 * Generate invitation mailing CSV(s) for NYC and/or France.
 *
 * For each event, builds a list of households (connected components via
 * Related Guests), then formats the envelope addressee per etiquette rules:
 *
 *   1. Individual:      [Title] First Last
 *   2. Same last name:  [Title] First1 & [Title] First2 LastName  (alpha by first)
 *   3. Mixed last names: [Title] First1 Last1 & [Title] First2 Last2  (alpha by last)
 *
 * Unnamed +1 placeholders are stripped from the envelope name but leave a " +1"
 * suffix on the primary guest's name to signal the invitation covers a plus-one.
 *
 * Title (Mr./Ms./Mrs./Dr.) is prepended to first names when set in Notion.
 * Guests without an address are flagged with a warning but still included.
 *
 * Special case — Dennis-style fallback: when Mailing Address does not geocode,
 * the full address is stored as newline-separated text in "Apartment Nº".
 *
 * Usage:
 *   node scripts/generate-invitation-csv.mjs [nyc|france|both]
 *   Defaults to 'both' if no argument given.
 *
 * Output:
 *   invitation-addresses-nyc.csv
 *   invitation-addresses-france.csv
 *
 * Requires: NOTION_API_KEY and NOTION_GUEST_LIST_DB in .env.local
 */

import { readFileSync, writeFileSync } from 'fs';

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

async function notionPost(path, body) {
  const r = await fetch('https://api.notion.com/v1/' + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + NOTION_API_KEY,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (json.object === 'error') throw new Error(json.message);
  return json;
}

async function queryAll(dbId, filter) {
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) };
    const res = await notionPost('databases/' + dbId + '/query', body);
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return pages;
}

// ─── Property extractors ──────────────────────────────────────────────────────

function getText(props, key) {
  // Collapse all rich_text blocks (handles multi-block values) and trim
  return (props[key]?.rich_text || []).map(b => b.plain_text).join('').trim();
}

function getSelect(props, key) {
  return props[key]?.select?.name?.trim() || '';
}

function getCheckbox(props, key) {
  return props[key]?.checkbox === true;
}

function getEventInvitations(props) {
  return (props['Event Invitations']?.multi_select || []).map(s => s.name);
}

// ─── Address parsing ──────────────────────────────────────────────────────────

/**
 * Structured address: all fields are strings (empty string = not present).
 * @typedef {{ address1: string, address2: string, address3: string, city: string, state: string, postcode: string, country: string }} ParsedAddress
 */

/**
 * Parse a Google Maps formatted address string into structured fields.
 *
 * Handles four formats observed in the data:
 *  3-part European:    "Street, ZIP City, Country"
 *  4-part US/Canada:   "Street, City, State/Province ZIP, Country"
 *  4-part UK:          "Street, City, Postcode, Country"
 *  4-part other:       "Street, Locality, Region, Country"  (no postcode)
 */
function parsePlaceAddress(full) {
  const parts = full.split(', ');
  const address1 = parts[0] || '';
  const country = parts[parts.length - 1] || '';

  if (parts.length === 3) {
    // European: "Street, ZIP City, Country" — ZIP starts with digits
    const middle = parts[1];
    const euroMatch = middle.match(/^(\d[\w-]*)\s+(.+)$/);
    if (euroMatch) {
      return { address1, city: euroMatch[2], state: '', postcode: euroMatch[1], country };
    }
    return { address1, city: middle, state: '', postcode: '', country };
  }

  if (parts.length === 4) {
    const locality = parts[1]; // city / town / village
    const region = parts[2];   // "State ZIP", "Province ZIP", "Postcode", or plain region name

    // US / Canada: "XX 12345" or "XX A1B 2C3"
    const usCanadaMatch = region.match(/^([A-Z]{2})\s+(.+)$/);
    if (usCanadaMatch) {
      return { address1, city: locality, state: usCanadaMatch[1], postcode: usCanadaMatch[2], country };
    }

    // UK postcode: starts with 1-2 uppercase letters then a digit  (e.g. "SW4 7SS", "EC1A 1BB")
    if (/^[A-Z]{1,2}\d/.test(region)) {
      return { address1, city: locality, state: '', postcode: region, country };
    }

    // Fallback (e.g. French rural "Place, Village, Loire Region, France"): no postcode
    return { address1, city: locality, state: region, postcode: '', country };
  }

  // Unexpected format — surface everything except country as address1
  return { address1: parts.slice(0, -1).join(', '), city: '', state: '', postcode: '', country };
}

/**
 * Return a ParsedAddress from a Notion page's properties, or null if no address.
 *
 * Normal path:    Mailing Address (place) provides the geocoded string;
 *                 Apartment Nº holds an optional unit number (becomes address2).
 *
 * Fallback path:  Mailing Address is null (failed geocode) and Apartment Nº
 *                 contains the full address as newline-separated lines
 *                 (e.g. "P.O. Box 28722\nAustin TX 78755\nUS").
 */
function getAddress(props) {
  const placeAddr = props['Mailing Address']?.place?.address;
  const aptRaw = getText(props, 'Apartment Nº');

  if (placeAddr) {
    const parsed = parsePlaceAddress(placeAddr);
    // Insert apt as address2 if present
    parsed.address2 = aptRaw;
    parsed.address3 = '';
    return parsed;
  }

  // Dennis-style fallback: full address stored as newlines in Apartment Nº
  if (aptRaw && aptRaw.includes('\n')) {
    const lines = aptRaw.split('\n').map(l => l.trim()).filter(Boolean);
    // Try to parse the city/state/zip from the second line if it looks like one
    let address1 = lines[0] || '';
    let address2 = '';
    let address3 = '';
    let city = '';
    let state = '';
    let postcode = '';
    let country = lines.length > 1 ? lines[lines.length - 1] : '';

    if (lines.length >= 3) {
      // Middle line(s) contain city/state/zip
      const cityLine = lines[1];
      // US-style: "City ST ZIP"
      const usMatch = cityLine.match(/^(.+?)\s+([A-Z]{2})\s+(\S+)$/);
      if (usMatch) {
        city = usMatch[1];
        state = usMatch[2];
        postcode = usMatch[3];
      } else {
        address2 = cityLine;
        if (lines.length > 3) address3 = lines.slice(2, -1).join(', ');
      }
    } else if (lines.length === 2) {
      // Only two lines: treat second as country, first as address1
      country = lines[1];
    }

    return { address1, address2, address3, city, state, postcode, country };
  }

  return null;
}

// ─── Union-Find ───────────────────────────────────────────────────────────────

function makeUF(ids) {
  const parent = Object.fromEntries(ids.map(id => [id, id]));
  const rank = Object.fromEntries(ids.map(id => [id, 0]));
  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  function union(x, y) {
    const px = find(x), py = find(y);
    if (px === py) return;
    if (rank[px] < rank[py]) parent[px] = py;
    else if (rank[px] > rank[py]) parent[py] = px;
    else { parent[py] = px; rank[px]++; }
  }
  return { find, union };
}

// ─── Envelope formatting ──────────────────────────────────────────────────────

/** Returns "[Title ]First" — never emits a leading space when title is empty. */
function formatFirstName(firstName, title) {
  return title ? `${title} ${firstName}` : firstName;
}

/**
 * Format the envelope addressee line for a group of named guests.
 *
 *  1. Solo:            [Title] First Last
 *  2. Same last name:  [Title] First1 & [Title] First2 Last  (alpha by first)
 *  3. Mixed last names: [Title] First1 Last1 & [Title] First2 Last2  (alpha by last)
 */
function formatEnvelopeName(members) {
  if (members.length === 1) {
    const { firstName, lastName, title } = members[0];
    return `${formatFirstName(firstName, title)} ${lastName}`.trim();
  }

  const lastNames = [...new Set(members.map(m => m.lastName))];

  if (lastNames.length === 1) {
    const sorted = [...members].sort((a, b) => a.firstName.localeCompare(b.firstName));
    const firstParts = sorted.map(m => formatFirstName(m.firstName, m.title));
    return `${firstParts.join(' & ')} ${lastNames[0]}`.trim();
  } else {
    const sorted = [...members].sort((a, b) => a.lastName.localeCompare(b.lastName));
    const nameParts = sorted.map(m => `${formatFirstName(m.firstName, m.title)} ${m.lastName}`.trim());
    return nameParts.join(' & ');
  }
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function csvCell(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(values) {
  return values.map(csvCell).join(',');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const VALID_EVENTS = ['nyc', 'france'];
const arg = (process.argv[2] || 'both').toLowerCase();
const events = arg === 'both' ? VALID_EVENTS : [arg];

if (!events.every(e => VALID_EVENTS.includes(e))) {
  console.error('Usage: node scripts/generate-invitation-csv.mjs [nyc|france|both]');
  process.exit(1);
}

/** Returns true if this +1 record is still an unnamed placeholder. */
function isPlaceholderPlusOne(m) {
  if (!m.isPlusOne) return false;
  const hasPlaceholderName = /\+\s*1/.test(m.firstName) || /\+\s*1/.test(m.lastName);
  return !m.firstName || !m.lastName || m.lastName === 'TBD' || hasPlaceholderName;
}

async function generateCSV(eventName) {
  const notionEventName = eventName === 'nyc' ? 'NYC' : 'France';
  console.log(`\n── Generating ${notionEventName} CSV ──`);

  const allPages = await queryAll(NOTION_GUEST_LIST_DB, undefined);
  console.log(`  Total guests in database: ${allPages.length}`);

  const isEvent = p => getEventInvitations(p.properties).includes(notionEventName);
  const eventPages = allPages.filter(isEvent);
  console.log(`  ${notionEventName}-invited guests: ${eventPages.length}`);

  // Build households via union-find over all guests
  const byId = Object.fromEntries(allPages.map(p => [p.id, p]));
  const uf = makeUF(allPages.map(p => p.id));
  for (const page of allPages) {
    for (const rel of page.properties['Related Guests']?.relation || []) {
      if (byId[rel.id]) uf.union(page.id, rel.id);
    }
  }

  // Group all guests into connected components; keep only those with event members
  const components = {};
  for (const page of allPages) {
    const root = uf.find(page.id);
    (components[root] ??= []).push(page);
  }

  const households = Object.values(components)
    .filter(members => members.some(isEvent))
    .map(members => ({ eventMembers: members.filter(isEvent), allMembers: members }));

  console.log(`  Households (= envelopes): ${households.length}`);

  // ── Build CSV rows ──────────────────────────────────────────────────────────
  const headers = ['EnvelopeName', 'Address1', 'Address2', 'Address3', 'City', 'State', 'Postcode', 'Country', 'HandDeliver'];
  const rows = [csvRow(headers)];
  const warnings = [];

  for (const { eventMembers, allMembers } of households) {
    // Split event members into named guests and unnamed +1 placeholders
    const allMemberInfos = eventMembers.map(p => ({
      firstName: getText(p.properties, 'First Name'),
      lastName: getText(p.properties, 'Last Name'),
      title: getSelect(p.properties, 'Title'),
      isPlusOne: getCheckbox(p.properties, '+1'),
    }));

    const members = allMemberInfos.filter(m => m.firstName && !isPlaceholderPlusOne(m));
    const hasUnnamedPlusOne = allMemberInfos.some(isPlaceholderPlusOne);

    if (members.length === 0) continue; // all-placeholder household — skip

    let envelopeName = formatEnvelopeName(members);
    if (hasUnnamedPlusOne) envelopeName += ' +1';

    // Find address — prefer an event member's address, then fall back to any household member
    let addrSource = eventMembers.find(p => getAddress(p.properties));
    if (!addrSource) addrSource = allMembers.find(p => getAddress(p.properties));

    const addr = addrSource ? getAddress(addrSource.properties) : null;
    const handDeliver = eventMembers.some(p => getCheckbox(p.properties, 'Hand-Deliver'));

    if (!addr) {
      warnings.push(`  ⚠️  No address: ${envelopeName}`);
    }

    rows.push(csvRow([
      envelopeName,
      addr?.address1 ?? '',
      addr?.address2 ?? '',
      addr?.address3 ?? '',
      addr?.city ?? '',
      addr?.state ?? '',
      addr?.postcode ?? '',
      addr?.country ?? '',
      handDeliver ? 'Yes' : '',
    ]));
  }

  const outPath = new URL(`../invitation-addresses-${eventName}.csv`, import.meta.url).pathname;
  // Prepend UTF-8 BOM so Excel opens the file with correct encoding
  writeFileSync(outPath, '﻿' + rows.join('\n') + '\n', 'utf8');
  console.log(`  ✓ Wrote ${rows.length - 1} rows → ${outPath}`);

  if (warnings.length > 0) {
    console.log(`\n  Households missing addresses (${warnings.length}):`);
    warnings.forEach(w => console.log(w));
  }
}

async function main() {
  for (const event of events) {
    await generateCSV(event);
  }
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
