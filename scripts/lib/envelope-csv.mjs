/**
 * Shared household grouping and envelope-name formatting.
 *
 * Used by generate-invitation-csv.mjs (which prints the envelopes) and
 * import-envelope-names.mjs (which reads the hand-edited result back into the
 * Notion `Envelope Names` property). Keeping one implementation means the
 * import can reproduce the generator's output exactly, which is how it joins
 * unedited CSV rows back to the household that produced them.
 */

// ─── Spreadsheet reading ──────────────────────────────────────────────────────

import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';

/**
 * Read an invitation spreadsheet into row objects keyed by header.
 * Accepts the generator's .csv output and the .xlsx an editing pass produces.
 */
export function readTable(path) {
  return /\.xlsx$/i.test(path)
    ? parseXLSX(path)
    : parseCSV(readFileSync(path, 'utf8'));
}

/**
 * Minimal .xlsx reader for the first worksheet — no dependencies.
 *
 * An .xlsx is a zip of XML parts. We only need shared strings and the first
 * sheet's cell values, all of which these files store as text, so unzipping
 * two entries and pulling <v>/<is> out of each <c> is enough. Anything more
 * exotic (formulas, dates, multiple sheets) is out of scope: export to CSV.
 */
function parseXLSX(path) {
  const readEntry = (entry) => {
    try {
      return execFileSync('unzip', ['-p', path, entry], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch {
      return null;
    }
  };

  const stripTags = (xml) => xml.replace(/<[^>]*>/g, '');
  const decode = (text) =>
    text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&amp;/g, '&');

  // Shared strings: every <si> is one string, possibly split across <t> runs
  const sharedXml = readEntry('xl/sharedStrings.xml') ?? '';
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m =>
    decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(''))
  );

  const sheetXml = readEntry('xl/worksheets/sheet1.xml');
  if (sheetXml === null) {
    throw new Error(`Could not read ${path} — is it a valid .xlsx? (needs \`unzip\`)`);
  }

  const columnIndex = (ref) => {
    const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? 'A';
    return [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
  };

  const rows = [];
  for (const rowMatch of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = new Map();
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cell[1];
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      if (!ref) continue;

      const inline = /<is>([\s\S]*?)<\/is>/.exec(cell[2]);
      const value = /<v>([\s\S]*?)<\/v>/.exec(cell[2]);

      let text = '';
      if (/t="s"/.test(attrs) && value) text = shared[Number(value[1])] ?? '';
      else if (inline) text = decode(stripTags(inline[1]));
      else if (value) text = decode(value[1]);

      cells.set(columnIndex(ref), text);
    }
    if (cells.size === 0) continue;
    const width = Math.max(...cells.keys()) + 1;
    rows.push(Array.from({ length: width }, (_, i) => cells.get(i) ?? ''));
  }

  const nonEmpty = rows.filter(r => r.some(cell => cell.trim()));
  if (nonEmpty.length === 0) return [];

  const [headers, ...body] = nonEmpty;
  return body.map(cells =>
    Object.fromEntries(headers.map((h, i) => [h.trim(), (cells[i] ?? '').trim()]))
  );
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

/**
 * Parse RFC 4180-ish CSV into row objects keyed by header.
 * Handles quoted fields, doubled quotes, embedded newlines, CRLF, and the
 * UTF-8 BOM the generator writes so Excel opens its output correctly.
 */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const input = text.replace(/^﻿/, '');

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += char;
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }

  if (field || row.length > 0) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter(r => r.some(cell => cell.trim()));
  if (nonEmpty.length === 0) return [];

  const [headers, ...body] = nonEmpty;
  return body.map(cells =>
    Object.fromEntries(headers.map((h, i) => [h.trim(), (cells[i] ?? '').trim()]))
  );
}

// ─── Property extractors ──────────────────────────────────────────────────────

/** Collapse all rich_text blocks (handles multi-block values) and trim. */
export function getText(props, key) {
  return (props[key]?.rich_text || []).map(b => b.plain_text).join('').trim();
}

export function getSelect(props, key) {
  return props[key]?.select?.name?.trim() || '';
}

export function getCheckbox(props, key) {
  return props[key]?.checkbox === true;
}

export function getEventInvitations(props) {
  return (props['Event Invitations']?.multi_select || []).map(s => s.name);
}

// ─── Union-Find ───────────────────────────────────────────────────────────────

export function makeUF(ids) {
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

/**
 * Group Notion guest pages into households (connected components over the
 * `Related Guests` self-relation). Returns an array of page arrays.
 */
export function groupHouseholds(pages) {
  const byId = Object.fromEntries(pages.map(p => [p.id, p]));
  const uf = makeUF(pages.map(p => p.id));
  for (const page of pages) {
    for (const rel of page.properties['Related Guests']?.relation || []) {
      if (byId[rel.id]) uf.union(page.id, rel.id);
    }
  }

  const components = {};
  for (const page of pages) {
    const root = uf.find(page.id);
    (components[root] ??= []).push(page);
  }
  return Object.values(components);
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
export function formatEnvelopeName(members) {
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

/** Returns true if this +1 record is still an unnamed placeholder. */
export function isPlaceholderPlusOne(m) {
  if (!m.isPlusOne) return false;
  const hasPlaceholderName = /\+\s*1/.test(m.firstName) || /\+\s*1/.test(m.lastName);
  return !m.firstName || !m.lastName || m.lastName === 'TBD' || hasPlaceholderName;
}

/** Extract the name fields the envelope formatter needs from a Notion page. */
export function toMemberInfo(page) {
  return {
    id: page.id,
    firstName: getText(page.properties, 'First Name'),
    lastName: getText(page.properties, 'Last Name'),
    title: getSelect(page.properties, 'Title'),
    isPlusOne: getCheckbox(page.properties, '+1'),
  };
}

/**
 * Build the envelope addressee line for a set of Notion pages, exactly as the
 * invitation CSV does: drop unnamed +1 placeholders, format the remaining
 * names, and re-append " +1" when the household includes a placeholder.
 *
 * Returns null when every member is an unnamed placeholder.
 */
export function envelopeNameForPages(pages) {
  const allMemberInfos = pages.map(toMemberInfo);
  const members = allMemberInfos.filter(m => m.firstName && !isPlaceholderPlusOne(m));
  if (members.length === 0) return null;

  const hasUnnamedPlusOne = allMemberInfos.some(isPlaceholderPlusOne);
  const envelopeName = formatEnvelopeName(members);
  return hasUnnamedPlusOne ? `${envelopeName} +1` : envelopeName;
}
