#!/usr/bin/env node
/**
 * Find envelopes (households) with no mailing address on file.
 *
 * Reuses the same household-grouping and envelope-naming rules as
 * generate-invitation-csv.mjs (connected components via Related Guests,
 * named-guest filtering, +1 placeholder handling) but produces a single
 * combined sheet — one row per envelope across both events — listing only
 * envelopes that are missing an address, with empty Address fields ready
 * to be filled in.
 *
 * Usage:
 *   node scripts/find-missing-addresses.mjs [group[,group...]]
 *
 *   [group] — optional, comma-separated, case-insensitive exact match against
 *             the guest's "Group" property (e.g. "Sam Family,Gross Guests").
 *             When given, only envelopes with at least one member in any of
 *             the listed groups are included.
 *
 * Output:
 *   scripts/output/missing-addresses.csv
 *
 * Requires: NOTION_API_KEY and NOTION_GUEST_LIST_DB in .env.local
 */

import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { excludeTestGuestPages } from './lib/test-guests.mjs';

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
  return (props[key]?.rich_text || []).map(b => b.plain_text).join('').trim();
}

function getSelect(props, key) {
  return props[key]?.select?.name?.trim() || '';
}

function getCheckbox(props, key) {
  return props[key]?.checkbox === true;
}

function getMultiSelect(props, key) {
  return (props[key]?.multi_select || []).map(s => s.name);
}

function getEventInvitations(props) {
  return getMultiSelect(props, 'Event Invitations');
}

function hasAddress(props) {
  return Boolean(props['Mailing Address']?.place?.address) || Boolean(getText(props, 'Apartment Nº'));
}

function notionPageUrl(pageId) {
  return 'https://www.notion.so/' + pageId.replace(/-/g, '');
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

// ─── Envelope formatting (same rules as generate-invitation-csv.mjs) ─────────

function formatFirstName(firstName, title) {
  return title ? `${title} ${firstName}` : firstName;
}

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

function isPlaceholderPlusOne(m) {
  if (!m.isPlusOne) return false;
  const hasPlaceholderName = /\+\s*1/.test(m.firstName) || /\+\s*1/.test(m.lastName);
  return !m.firstName || !m.lastName || m.lastName === 'TBD' || hasPlaceholderName;
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

const EVENT_NAMES = ['NYC', 'France'];

const groupFilters = (process.argv[2] || '')
  .split(',')
  .map(g => g.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  console.log('── Finding envelopes with no mailing address ──');
  if (groupFilters.length) console.log(`  Filtering to group(s): ${groupFilters.join(', ')}`);

  const allPages = excludeTestGuestPages(await queryAll(NOTION_GUEST_LIST_DB, undefined));
  console.log(`  Total guests in database: ${allPages.length}`);

  const isInvited = p => getEventInvitations(p.properties).length > 0;

  // Build households via union-find over all guests (mirrors generate-invitation-csv.mjs)
  const byId = Object.fromEntries(allPages.map(p => [p.id, p]));
  const uf = makeUF(allPages.map(p => p.id));
  for (const page of allPages) {
    for (const rel of page.properties['Related Guests']?.relation || []) {
      if (byId[rel.id]) uf.union(page.id, rel.id);
    }
  }

  const components = {};
  for (const page of allPages) {
    const root = uf.find(page.id);
    (components[root] ??= []).push(page);
  }

  const households = Object.values(components)
    .filter(members => members.some(isInvited))
    .map(members => ({ eventMembers: members.filter(isInvited), allMembers: members }));

  console.log(`  Households (= envelopes): ${households.length}`);

  const headers = ['EnvelopeName', 'NotionLink', 'Group', 'Events'];
  const rows = [csvRow(headers)];
  let missingCount = 0;

  for (const { eventMembers, allMembers } of households) {
    const allMemberInfos = eventMembers.map(p => ({
      page: p,
      firstName: getText(p.properties, 'First Name'),
      lastName: getText(p.properties, 'Last Name'),
      title: getSelect(p.properties, 'Title'),
      isPlusOne: getCheckbox(p.properties, '+1'),
    }));

    const members = allMemberInfos.filter(m => m.firstName && !isPlaceholderPlusOne(m));
    const hasUnnamedPlusOne = allMemberInfos.some(isPlaceholderPlusOne);

    if (members.length === 0) continue; // all-placeholder household — skip

    const group = [...new Set(eventMembers.flatMap(p => getMultiSelect(p.properties, 'Group')))].sort();
    if (groupFilters.length && !group.some(g => groupFilters.includes(g.toLowerCase()))) continue;

    let envelopeName = formatEnvelopeName(members);
    if (hasUnnamedPlusOne) envelopeName += ' +1';

    // Same address lookup as generate-invitation-csv.mjs: prefer an event
    // member's address, then fall back to any household member's
    const hasAnyAddress = eventMembers.some(p => hasAddress(p.properties))
      || allMembers.some(p => hasAddress(p.properties));

    if (hasAnyAddress) continue;

    // Link to the Notion record of the first person alphabetically (by last, then first name)
    const firstAlphabetically = [...members].sort((a, b) =>
      a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    )[0];
    const notionLink = notionPageUrl(firstAlphabetically.page.id);

    const events = [...new Set(eventMembers.flatMap(p => getEventInvitations(p.properties)))]
      .filter(e => EVENT_NAMES.includes(e))
      .join(' & ');

    rows.push(csvRow([envelopeName, notionLink, group.join(', '), events]));
    missingCount++;
  }

  const outPath = new URL('output/missing-addresses.csv', import.meta.url).pathname;
  // Prepend UTF-8 BOM so Excel opens the file with correct encoding
  writeFileSync(outPath, '﻿' + rows.join('\n') + '\n', 'utf8');
  console.log(`\n  ✓ ${missingCount} envelope(s) missing an address → ${outPath}`);

  execFileSync('open', ['-R', outPath]);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
