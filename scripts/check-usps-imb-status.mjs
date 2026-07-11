#!/usr/bin/env node
/**
 * Check USPS tracking status for every assigned IMb barcode (invitations and
 * save-the-dates), via the Informed Visibility Mail Tracking & Reporting
 * (IV-MTR) API — the only USPS service that returns scan-event data for
 * standard First-Class letters (the public Tracking API only covers package
 * tracking numbers).
 *
 * scripts/data/usps-imb-serials.json stores only opaque mailpiece-key hashes
 * → serial numbers (no names, by design — see usps-serial-registry.mjs), so
 * this script re-derives the same household list generate-invitation-csv.mjs
 * builds, live from Notion on every run, purely to label each serial with a
 * readable household + mailpiece name for the report. It never assigns new
 * serials — households with no serial (not yet mailed, or no US address) are
 * skipped.
 *
 * Requires IV-MTR API access — a Business Customer Gateway (BCG) account
 * with the IV-MTR service enabled at BSA or BSA Delegate access level:
 *   1. Log into https://gateway.usps.com with your BCG account.
 *   2. Under "All Services", find "Informed Visibility" and click Get Access.
 *      Approval for a BCG account already active in Production is immediate.
 *   3. Add to .env.local:
 *        USPS_BCG_USERNAME=<your BCG username>
 *        USPS_BCG_PASSWORD=<your BCG password>
 *   (Optional: USPS_IV_MTR_ENV=cat to hit USPS's test environment instead of
 *   production — CAT requires a separate account requested by emailing
 *   InformedVisibility@usps.gov with subject "Request for IV-MTR API CAT
 *   Account" and your name/email/phone/company/business address.)
 *
 * Reference: USPS Informed Visibility IV-MTR API Developer Toolkit v2.5
 * (https://postalpro.usps.com/informedvisibility/APItoolkit).
 *
 * Usage:
 *   node scripts/check-usps-imb-status.mjs [nyc|france|both]
 *   Defaults to 'both' if no argument given.
 *
 * Requires: NOTION_API_KEY, NOTION_GUEST_LIST_DB, USPS_BCG_USERNAME,
 * USPS_BCG_PASSWORD in .env.local
 */

import { readFileSync } from 'fs';
import { mailpieceKey, lookupSerial, formatSerial } from './lib/usps-serial-registry.mjs';
import { USPS_MAILER_ID, USPS_SERVICE_TYPE, USPS_SERIAL_DIGITS, MAIL_PIECES } from './lib/usps-mailer-config.mjs';
import { authenticate, getBarcodesByMidSerial, getPieceByImb } from './lib/usps-iv-mtr.mjs';
import { excludeTestGuestPages } from './lib/test-guests.mjs';

// ─── Env ──────────────────────────────────────────────────────────────────────

const envPath = new URL('../.env.local', import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const { NOTION_API_KEY, NOTION_GUEST_LIST_DB, USPS_BCG_USERNAME, USPS_BCG_PASSWORD } = env;
const USPS_IV_MTR_ENV = env.USPS_IV_MTR_ENV === 'cat' ? 'cat' : 'production';

if (!NOTION_API_KEY || !NOTION_GUEST_LIST_DB) {
  console.error('Missing NOTION_API_KEY or NOTION_GUEST_LIST_DB in .env.local');
  process.exit(1);
}
if (!USPS_BCG_USERNAME || !USPS_BCG_PASSWORD) {
  console.error('Missing USPS_BCG_USERNAME or USPS_BCG_PASSWORD in .env.local — see this script\'s header comment for setup steps.');
  process.exit(1);
}

// ─── Notion helpers (mirrors generate-invitation-csv.mjs) ─────────────────────

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

async function queryAll(dbId) {
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) };
    const res = await notionPost('databases/' + dbId + '/query', body);
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return pages;
}

function getText(props, key) {
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

// ─── Union-Find (identical to generate-invitation-csv.mjs) ────────────────────

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

/** Returns true if this +1 record is still an unnamed placeholder. */
function isPlaceholderPlusOne(m) {
  if (!m.isPlusOne) return false;
  const hasPlaceholderName = /\+\s*1/.test(m.firstName) || /\+\s*1/.test(m.lastName);
  return !m.firstName || !m.lastName || m.lastName === 'TBD' || hasPlaceholderName;
}

/** Returns "[Title ]First" — never emits a leading space when title is empty. */
function formatFirstName(firstName, title) {
  return title ? `${title} ${firstName}` : firstName;
}

/** Same envelope-name formatting as generate-invitation-csv.mjs, for display only. */
function formatEnvelopeName(members) {
  if (members.length === 1) {
    const { firstName, lastName, title } = members[0];
    return `${formatFirstName(firstName, title)} ${lastName}`.trim();
  }
  const lastNames = [...new Set(members.map(m => m.lastName))];
  if (lastNames.length === 1) {
    const sorted = [...members].sort((a, b) => a.firstName.localeCompare(b.firstName));
    return `${sorted.map(m => formatFirstName(m.firstName, m.title)).join(' & ')} ${lastNames[0]}`.trim();
  }
  const sorted = [...members].sort((a, b) => a.lastName.localeCompare(b.lastName));
  return sorted.map(m => `${formatFirstName(m.firstName, m.title)} ${m.lastName}`.trim()).join(' & ');
}

// ─── Build mail jobs (household + piece + assigned serial) ────────────────────

function buildJobsForEvent(eventName, allPages, uf) {
  const notionEventName = eventName === 'nyc' ? 'NYC' : 'France';
  const isEvent = p => getEventInvitations(p.properties).includes(notionEventName);

  const components = {};
  for (const page of allPages) {
    (components[uf.find(page.id)] ??= []).push(page);
  }
  const households = Object.values(components).filter(members => members.some(isEvent));

  const jobs = [];
  for (const members of households) {
    const eventMembers = members.filter(isEvent);
    const memberInfos = eventMembers.map(p => ({
      id: p.id,
      firstName: getText(p.properties, 'First Name'),
      lastName: getText(p.properties, 'Last Name'),
      title: getSelect(p.properties, 'Title'),
      isPlusOne: getCheckbox(p.properties, '+1'),
    }));
    const named = memberInfos.filter(m => m.firstName && !isPlaceholderPlusOne(m));
    if (named.length === 0) continue;

    const memberIds = named.map(m => m.id);
    const envelopeName = formatEnvelopeName(named);

    for (const piece of MAIL_PIECES[eventName]) {
      const serial = lookupSerial(mailpieceKey(memberIds, `${eventName}:${piece}`));
      if (serial === null) continue; // never mailed (no US address, or not yet sent)
      jobs.push({ eventName: notionEventName, piece, envelopeName, serial });
    }
  }
  return jobs;
}

// ─── Report formatting ─────────────────────────────────────────────────────────

function formatScan(scan) {
  const where = [scan.scan_facility_name, scan.scan_facility_city, scan.scan_facility_state]
    .filter(Boolean).join(', ');
  return `${scan.scan_date_time}  ${scan.mail_phase || scan.scan_event_code || '(no phase)'}${where ? '  @ ' + where : ''}`;
}

async function reportOnJob(accessToken, job) {
  const serialStr = formatSerial(job.serial, USPS_SERIAL_DIGITS);
  const label = `[${job.eventName}] ${job.envelopeName} — ${job.piece} (serial ${serialStr})`;

  try {
    const barcodes = await getBarcodesByMidSerial(USPS_IV_MTR_ENV, accessToken, USPS_MAILER_ID, serialStr, USPS_SERVICE_TYPE);
    if (barcodes.length === 0) {
      console.log(`⏳ ${label}\n     No scans yet — not seen by IV-MTR (may not have entered the mailstream, or delivery scan hasn't posted).`);
      return { hasScans: false };
    }

    let anyScans = false;
    for (const imb of barcodes) {
      const piece = await getPieceByImb(USPS_IV_MTR_ENV, accessToken, imb);
      const scans = piece?.scans || [];
      if (scans.length === 0) {
        console.log(`⏳ ${label}\n     Barcode found (${imb}) but no scans recorded yet.`);
        continue;
      }
      anyScans = true;
      const latest = [...scans].sort((a, b) => b.scan_date_time.localeCompare(a.scan_date_time))[0];
      console.log(`📬 ${label}`);
      console.log(`     Latest: ${formatScan(latest)}`);
      if (piece.expected_delivery_date) console.log(`     Expected delivery: ${piece.expected_delivery_date}`);
      console.log(`     Total scans: ${scans.length}`);
    }
    return { hasScans: anyScans };
  } catch (err) {
    console.log(`❌ ${label}\n     Error: ${err.message}`);
    return { hasScans: false, error: true };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const VALID_EVENTS = ['nyc', 'france'];
const arg = (process.argv[2] || 'both').toLowerCase();
const events = arg === 'both' ? VALID_EVENTS : [arg];

if (!events.every(e => VALID_EVENTS.includes(e))) {
  console.error('Usage: node scripts/check-usps-imb-status.mjs [nyc|france|both]');
  process.exit(1);
}

async function main() {
  console.log(`Authenticating to IV-MTR (${USPS_IV_MTR_ENV})...`);
  const { accessToken } = await authenticate(USPS_IV_MTR_ENV, {
    username: USPS_BCG_USERNAME,
    password: USPS_BCG_PASSWORD,
  });

  const allPages = excludeTestGuestPages(await queryAll(NOTION_GUEST_LIST_DB));
  const byId = Object.fromEntries(allPages.map(p => [p.id, p]));
  const uf = makeUF(allPages.map(p => p.id));
  for (const page of allPages) {
    for (const rel of page.properties['Related Guests']?.relation || []) {
      if (byId[rel.id]) uf.union(page.id, rel.id);
    }
  }

  const jobs = [];
  for (const eventName of events) {
    jobs.push(...buildJobsForEvent(eventName, allPages, uf));
  }
  jobs.sort((a, b) => a.envelopeName.localeCompare(b.envelopeName));

  console.log(`\nChecking ${jobs.length} mailed piece(s)...\n`);

  let withScans = 0;
  let errors = 0;
  for (const job of jobs) {
    const result = await reportOnJob(accessToken, job);
    if (result.hasScans) withScans++;
    if (result.error) errors++;
  }

  console.log(`\nDone. ${withScans}/${jobs.length} have recorded scans.${errors ? ` ${errors} lookup error(s).` : ''}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
