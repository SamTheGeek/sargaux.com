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
 * US addresses also get a pair of UspsSerial<Piece>/UspsImbBarcode<Piece>
 * columns per physical mailpiece this household receives for the event:
 *   - NYC sends one mailpiece (Invitation) per household.
 *   - France sends two (SaveTheDate, then Invitation) per household.
 * A USPS Intelligent Mail Barcode serial identifies one physical mailpiece,
 * not a household, so each piece gets its own unique serial (see
 * scripts/lib/usps-imb.mjs for the encoder). Serials are calculated and
 * permanently assigned once per (household, piece), persisted in
 * scripts/data/usps-imb-serials.json (see scripts/lib/usps-serial-registry.mjs),
 * so re-running this script never changes an already-assigned serial.
 *
 * Usage:
 *   node scripts/generate-invitation-csv.mjs [nyc|france|both]
 *   Defaults to 'both' if no argument given.
 *
 * Output:
 *   scripts/output/invitation-addresses-nyc-YYYYMMDD.csv
 *   scripts/output/invitation-addresses-france-YYYYMMDD.csv
 *
 * Requires: NOTION_API_KEY and NOTION_GUEST_LIST_DB in .env.local
 */

import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { encodeImb } from './lib/usps-imb.mjs';
import { mailpieceKey, createSerialAssigner, formatSerial } from './lib/usps-serial-registry.mjs';

// ─── USPS Intelligent Mail Barcode config ──────────────────────────────────────
//
// Mailer ID is 9 digits, so the serial number field is 6 digits (9 + 6 = 15,
// per USPS Pub 109). Service Type 300 = First-Class Mail, no special IMb
// services. Barcode Identifier 00 = standard, no special services.

const USPS_MAILER_ID = '904209274';
const USPS_SERVICE_TYPE = '300';
const USPS_BARCODE_ID = '00';
const USPS_SERIAL_DIGITS = 6;

// Physical mailpieces sent to each household, per event, in mailing order.
// A serial number — and therefore a barcode — must be unique per mailpiece,
// not per household, so each event lists every piece its households receive.
const MAIL_PIECES = {
  nyc: ['Invitation'],
  france: ['SaveTheDate', 'Invitation'],
};

/** Split a US postcode ("11238-4002" or "11238") into 5-digit zip + optional plus4. */
function parseUsZip(postcode) {
  const digits = (postcode || '').replace(/\D/g, '');
  if (digits.length === 9) return { zip: digits.slice(0, 5), plus4: digits.slice(5) };
  if (digits.length === 5) return { zip: digits, plus4: '' };
  return null;
}

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
 * Parse a manually-entered address string (from the Apartment Nº fallback field).
 * Normalises newlines to commas first, then handles US formats with or without
 * an explicit country token.
 *
 * Observed shapes:
 *   "P.O. Box 28722\nAustin TX 78755\nUS"           → newline-separated
 *   "P.O. Box 20155 Fountain Hills, Arizona 85269"  → single line, full state name
 *   "3 Daybreak Commons, Westport, CT 06880"        → single line, state abbrev
 *   "PO Box 6572, Mckinney, TX 75071"               → single line, state abbrev
 */
function parseManualAddress(raw) {
  // Normalise newlines → comma-separated parts
  const normalised = raw.replace(/\n/g, ', ').replace(/,\s*,/g, ', ').trim();
  const parts = normalised.split(', ').map(p => p.trim()).filter(Boolean);

  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return { address1: parts[0], address2: '', address3: '', city: '', state: '', postcode: '', country: '' };
  }

  // Detect a country token as the last part
  const KNOWN_COUNTRIES = /^(US|USA|United States|France|United Kingdom|UK|Canada|Belgium|Germany|Italy|Spain|Australia)$/i;
  const COUNTRY_NORMALISE = { US: 'United States', USA: 'United States', UK: 'United Kingdom' };
  const lastPart = parts[parts.length - 1];
  const hasCountry = KNOWN_COUNTRIES.test(lastPart);
  const country = hasCountry
    ? (COUNTRY_NORMALISE[lastPart.toUpperCase()] ?? lastPart)
    : '';
  const addrParts = hasCountry ? parts.slice(0, -1) : parts;

  const address1 = addrParts[0];
  const tail = addrParts[addrParts.length - 1]; // last non-country token

  // "City ST ZIP" on a single token — e.g. "Austin TX 78755"
  const cityStateZip = tail.match(/^(.+?)\s+([A-Z]{2})\s+(\S+)$/);
  if (cityStateZip && addrParts.length === 2) {
    return { address1, address2: '', address3: '', city: cityStateZip[1], state: cityStateZip[2], postcode: cityStateZip[3], country: country || 'United States' };
  }

  // "ST ZIP" on last token — e.g. "CT 06880", "TX 75071"
  const stateZip = tail.match(/^([A-Z]{2})\s+(\d[\w-]*)$/);
  if (stateZip) {
    const city = addrParts.length > 2 ? addrParts.slice(1, -1).join(', ') : '';
    return { address1, address2: '', address3: '', city, state: stateZip[1], postcode: stateZip[2], country: country || 'United States' };
  }

  // "Full State Name ZIP" on last token — e.g. "Arizona 85269"
  const stateFullZip = tail.match(/^([A-Za-z][A-Za-z\s]+)\s+(\d[\w-]*)$/);
  if (stateFullZip) {
    const city = addrParts.length > 2 ? addrParts.slice(1, -1).join(', ') : '';
    return { address1, address2: '', address3: '', city, state: stateFullZip[1].trim(), postcode: stateFullZip[2], country: country || 'United States' };
  }

  // Fallback: put everything after address1 as city
  return { address1, address2: '', address3: '', city: addrParts.slice(1).join(', '), state: '', postcode: '', country };
}

/**
 * Return a ParsedAddress from a Notion page's properties, or null if no address.
 *
 * Normal path:    Mailing Address (place) provides the geocoded string;
 *                 Apartment Nº holds an optional unit number (becomes address2).
 *
 * Fallback path:  Mailing Address did not geocode (null) and Apartment Nº
 *                 holds the full address — either newline-separated or a
 *                 single comma-separated line (e.g. P.O. Box addresses).
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

  // Fallback: full address typed into the Apartment Nº field
  if (aptRaw) {
    return parseManualAddress(aptRaw);
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
  const pieces = MAIL_PIECES[eventName];
  const headers = [
    'EnvelopeName', 'Address1', 'Address2', 'Address3', 'City', 'State', 'Postcode', 'Country', 'HandDeliver',
    ...pieces.flatMap(piece => [`UspsSerial${piece}`, `UspsImbBarcode${piece}`]),
  ];
  const warnings = [];

  // Resolve each mailpiece's serial in a fixed order (by mailpiece-key hash,
  // never by name) so collision resolution is reproducible across runs.
  const serialAssigner = createSerialAssigner(USPS_SERIAL_DIGITS);
  const householdRows = [];

  for (const { eventMembers, allMembers } of households) {
    // Split event members into named guests and unnamed +1 placeholders
    const allMemberInfos = eventMembers.map(p => ({
      id: p.id,
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

    const memberIds = members.map(m => m.id);
    householdRows.push({
      envelopeName,
      addr,
      handDeliver,
      sortKey: [...memberIds].sort().join('|'),
      memberIds,
    });
  }

  householdRows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const rows = [csvRow(headers)];
  for (const { envelopeName, addr, handDeliver, memberIds } of householdRows) {
    const pieceCells = [];
    for (const piece of pieces) {
      let serialStr = '';
      let barcode = '';
      if (addr?.country === 'United States') {
        const zipParts = parseUsZip(addr.postcode);
        if (zipParts) {
          // Scope the piece label by event: an "Invitation" mailed for NYC and
          // an "Invitation" mailed for France are two distinct physical
          // envelopes (even to the same household), so each needs its own serial.
          const serial = serialAssigner.getOrAssignSerial(mailpieceKey(memberIds, `${eventName}:${piece}`));
          serialStr = formatSerial(serial, USPS_SERIAL_DIGITS);
          barcode = encodeImb({
            barcodeId: USPS_BARCODE_ID,
            serviceType: USPS_SERVICE_TYPE,
            mailerId: USPS_MAILER_ID,
            serialNum: serialStr,
            zip: zipParts.zip,
            plus4: zipParts.plus4,
          });
        } else {
          warnings.push(`  ⚠️  US address missing usable zip for ${piece} barcode: ${envelopeName}`);
        }
      }
      pieceCells.push(serialStr, barcode);
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
      ...pieceCells,
    ]));
  }

  serialAssigner.flush();

  if (warnings.length > 0) {
    console.log(`\n  Warnings (${warnings.length}):`);
    warnings.forEach(w => console.log(w));
  }

  const runDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outPath = new URL(`output/invitation-addresses-${eventName}-${runDate}.csv`, import.meta.url).pathname;
  // Prepend UTF-8 BOM so Excel opens the file with correct encoding
  writeFileSync(outPath, '﻿' + rows.join('\n') + '\n', 'utf8');
  console.log(`  ✓ Wrote ${rows.length - 1} rows → ${outPath}`);
  return outPath;
}

async function main() {
  const outPaths = [];
  for (const event of events) {
    outPaths.push(await generateCSV(event));
  }
  console.log('\nDone.');
  for (const p of outPaths) {
    execFileSync('open', ['-R', p]);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
