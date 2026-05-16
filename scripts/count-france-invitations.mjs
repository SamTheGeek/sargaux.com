#!/usr/bin/env node
/**
 * Count France wedding invitation households.
 *
 * Logic:
 * 1. Fetch all guests with 'France' in their Event Invitations
 * 2. Build a graph from Related Guests relations
 * 3. Find connected components (= households) via union-find
 * 4. Report household count, size distribution, and outliers
 *
 * Usage: node scripts/count-france-invitations.mjs
 * Requires: NOTION_API_KEY and NOTION_GUEST_LIST_DB in .env.local
 */

import { readFileSync } from 'fs';

// Load .env.local
const envPath = new URL('../.env.local', import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const NOTION_API_KEY = env.NOTION_API_KEY;
const NOTION_GUEST_LIST_DB = env.NOTION_GUEST_LIST_DB;

if (!NOTION_API_KEY || !NOTION_GUEST_LIST_DB) {
  console.error('Missing NOTION_API_KEY or NOTION_GUEST_LIST_DB in .env.local');
  process.exit(1);
}

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
    const body = { page_size: 100, filter };
    if (cursor) body.start_cursor = cursor;
    const res = await notionPost('databases/' + dbId + '/query', body);
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return pages;
}

// Union-Find
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

function getName(page) {
  return (
    page.properties['Full Name']?.formula?.string ||
    page.properties['Name of Guest']?.title?.[0]?.plain_text ||
    page.id
  );
}

async function main() {
  console.log('Fetching all guests from Notion...\n');

  // Fetch ALL guests to build the full relation graph (Option B: transitive grouping)
  const allPages = await queryAll(NOTION_GUEST_LIST_DB, undefined);
  console.log(`Total guests in database: ${allPages.length}`);

  const isFrance = p => (p.properties['Event Invitations']?.multi_select || []).some(s => s.name === 'France');
  const nycPages = allPages.filter(isFrance);
  console.log(`France-invited guests: ${nycPages.length}`);

  // Build full union-find across ALL guests
  const byId = Object.fromEntries(allPages.map(p => [p.id, p]));
  const uf = makeUF(allPages.map(p => p.id));

  for (const page of allPages) {
    for (const rel of page.properties['Related Guests']?.relation || []) {
      if (byId[rel.id]) uf.union(page.id, rel.id);
    }
  }

  // Group ALL guests by connected component
  const components = {};
  for (const page of allPages) {
    const root = uf.find(page.id);
    if (!components[root]) components[root] = [];
    components[root].push(page);
  }

  // Keep only components that contain at least one France guest
  // For display, show only the France members per household
  const households = Object.values(components)
    .filter(members => members.some(isFrance))
    .map(members => ({
      nycMembers: members.filter(isFrance),
      allMembers: members,
    }));

  // Sort by France member count descending
  households.sort((a, b) => b.nycMembers.length - a.nycMembers.length);

  // --- Report ---
  console.log(`\n${'='.repeat(60)}`);
  console.log(`France INVITATION COUNT REPORT`);
  console.log('='.repeat(60));
  console.log(`\nFrance guests:         ${nycPages.length}`);
  console.log(`Total households:   ${households.length}  ← invitations to print`);

  // Size distribution (by France member count)
  const sizeMap = {};
  for (const h of households) {
    const n = h.nycMembers.length;
    sizeMap[n] = (sizeMap[n] || 0) + 1;
  }
  console.log('\nHousehold size breakdown (France members per invitation):');
  for (const [size, count] of Object.entries(sizeMap).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const label = size === '1' ? 'solo' : `${size} France guests`;
    console.log(`  Size ${size} (${label}): ${count} household${count > 1 ? 's' : ''}`);
  }

  // Solo guests
  const solos = households.filter(h => h.nycMembers.length === 1);
  console.log(`\nSolo invitations (${solos.length}):`);
  for (const h of solos) {
    console.log(`  - ${getName(h.nycMembers[0])}`);
  }

  // Households of 2+
  const multi = households.filter(h => h.nycMembers.length >= 2);
  console.log(`\nMulti-person households (${multi.length}):`);
  for (const h of multi) {
    const names = h.nycMembers.map(getName).join(', ');
    // Note if household also has France-only members
    const franceOnly = h.allMembers.filter(m => !isFrance(m));
    const extra = franceOnly.length > 0 ? ` (+${franceOnly.length} France-only: ${franceOnly.map(getName).join(', ')})` : '';
    console.log(`  [${h.nycMembers.length}] ${names}${extra}`);
  }

  // Outliers: households of 4+ France members
  const large = households.filter(h => h.nycMembers.length >= 4);
  if (large.length > 0) {
    console.log(`\n⚠️  Large households (4+ France guests) — double-check these:`);
    for (const h of large) {
      console.log(`  [${h.nycMembers.length}] ${h.nycMembers.map(getName).join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`PRINT ${households.length} INVITATIONS`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
