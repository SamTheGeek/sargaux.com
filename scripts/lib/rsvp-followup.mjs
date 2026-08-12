/**
 * Shared logic for the per-event RSVP follow-up exports.
 *
 * Used by generate-rsvp-followup-nyc.mjs and generate-rsvp-followup-france.mjs.
 * The two event scripts differ only in which event they pass in, so everything
 * substantive lives here: Notion reads, household grouping, per-guest RSVP
 * resolution, the Group → file bucketing, and the .xlsx writer.
 *
 * Unlike generate-invitation-csv.mjs (one row per envelope), this export is one
 * row per *guest*, grouped by household, so a follow-up call can work down a
 * household and tick off each person.
 */

import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import ExcelJS from 'exceljs';
import { excludeTestGuestPages, getGuestFullName, normalizeName } from './test-guests.mjs';
import {
  getText,
  getSelect,
  getEventInvitations,
  groupHouseholds,
  envelopeNameForPages,
  isPlaceholderPlusOne,
  toMemberInfo,
} from './envelope-csv.mjs';

// ─── Event configuration ──────────────────────────────────────────────────────

/**
 * Per-event Notion vocabulary. `invitations`/`responses` differ deliberately:
 * Event Invitations uses 'NYC'/'France', RSVP Responses' Event select uses the
 * same labels, but the invite-status property name is event-specific.
 */
export const EVENTS = {
  nyc: {
    label: 'NYC',
    title: 'NYC — October 11, 2026',
    inviteStatusProp: 'NYC Invite Sent',
    inviteStatusHeader: 'Invite Sent',
  },
  france: {
    label: 'France',
    title: 'France — May 28–30, 2027',
    inviteStatusProp: 'France Save the Date Sent',
    inviteStatusHeader: 'Save the Date Sent',
  },
};

/**
 * The three output files, in write order. `groups` lists the Notion `Group`
 * multi-select values that claim a household; the final bucket is the
 * catch-all and matches nothing explicitly.
 */
export const BUCKETS = [
  { key: 'gross', suffix: 'Gross', label: 'Sam side', groups: ['Sam Family', 'Gross Guests'] },
  { key: 'ancels', suffix: 'Ancels', label: 'Margaux side', groups: ['Margaux Family', 'Ancel Guests'] },
  { key: 'sargaux', suffix: 'Sargaux', label: 'Everyone else', groups: [] },
];

// ─── Env ──────────────────────────────────────────────────────────────────────

/** Read .env.local into a plain object (same shape the other scripts use). */
export function loadEnv() {
  const envPath = new URL('../../.env.local', import.meta.url).pathname;
  const env = Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );

  const missing = ['NOTION_API_KEY', 'NOTION_GUEST_LIST_DB', 'NOTION_RSVP_RESPONSES_DB']
    .filter(k => !env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(', ')} in .env.local`);
  }
  return env;
}

// ─── Dates ────────────────────────────────────────────────────────────────────

/**
 * Today's date as YYYY-MM-DD in the machine's own time zone.
 *
 * Deliberately not `toISOString()`, which is UTC: a run after ~7pm Eastern
 * would stamp tomorrow's date, so an evening run and the next morning's run
 * land on the same filename and silently overwrite each other. 'en-CA' is the
 * locale that formats as YYYY-MM-DD.
 */
export function localDateStamp() {
  return new Date().toLocaleDateString('en-CA');
}

// ─── Notion ───────────────────────────────────────────────────────────────────

/**
 * Query every page of a Notion database.
 *
 * Uses the legacy REST endpoint with Notion-Version 2022-06-28 deliberately:
 * the env vars hold database *page* IDs, which `dataSources.query()` in SDK v5
 * cannot take (see CLAUDE.md → Notion SDK v5).
 */
export async function queryAll(apiKey, dbId, filter) {
  const pages = [];
  let cursor;
  do {
    const body = {
      page_size: 100,
      ...(filter ? { filter } : {}),
      ...(cursor ? { start_cursor: cursor } : {}),
    };
    const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await r.json();
    if (json.object === 'error') throw new Error(json.message);
    pages.push(...json.results);
    cursor = json.has_more ? json.next_cursor : null;
  } while (cursor);
  return pages;
}

// ─── RSVP resolution ──────────────────────────────────────────────────────────

/**
 * Shape one RSVP Responses page into the fields this export needs.
 * `attendingNames` is the normalized set of everyone the response says is
 * coming — responses only ever list attendees, never decliners.
 */
function parseResponse(page) {
  const props = page.properties;
  const guestsAttending = getText(props, 'Guests Attending');

  // Per-member { guestId, attending } recorded by submitRSVP in the Details
  // JSON — the same first-priority source memberAttendedResponse uses on the
  // site. Exact by page ID, so it survives renames and covers unnamed +1s.
  // Older or hand-edited rows may hold no JSON; that's fine, the map stays
  // empty and resolution falls through to Status.
  const attendanceById = new Map();
  try {
    const parsed = JSON.parse(getText(props, 'Details') || '{}');
    const entries = Array.isArray(parsed?.attendance) ? parsed.attendance : [];
    for (const entry of entries) {
      if (typeof entry?.guestId === 'string' && typeof entry?.attending === 'boolean') {
        attendanceById.set(entry.guestId, entry.attending);
      }
    }
  } catch {
    // Not JSON — legacy free-text details
  }

  return {
    id: page.id,
    guestIds: (props['Guest']?.relation || []).map(r => r.id),
    submittedAt: props['Submitted At']?.date?.start || '',
    status: getSelect(props, 'Status'),
    attendanceById,
    attendingNames: new Set(
      guestsAttending.split(',').map(n => normalizeName(n)).filter(Boolean)
    ),
    dietary: getText(props, 'Dietary Needs'),
    message: getText(props, 'Message'),
  };
}

/**
 * Pick the response that governs a household: the most recently submitted row
 * related to *any* member. Responses are party-level (one row per party +
 * event, with the Guest relation set to every member), so a partner's
 * submission is the household's submission.
 */
function latestResponseForHousehold(responses, memberIds) {
  const ids = new Set(memberIds);
  let best = null;
  for (const response of responses) {
    if (!response.guestIds.some(id => ids.has(id))) continue;
    if (!best || response.submittedAt > best.submittedAt) best = response;
  }
  return best;
}

/**
 * Resolve one guest's RSVP for the event — the same source order
 * memberAttendedResponse uses on the site:
 *
 * 1. The Details JSON's per-member `attendance` entry, when the response
 *    recorded one for this page ID. Exact: survives renames, and covers
 *    placeholder +1s (the form submits every row, named or not).
 * 2. The response's `Status` against the Guest relation: submitRSVP derives
 *    it from the whole party, so 'Attending'/'Declined' settle any member on
 *    the relation — including placeholders, which is what keeps a household
 *    that declined outright from sorting as "outstanding" forever just
 *    because its +1 has no name.
 * 3. The attendee-name list, only for 'Partial' rows old enough to lack the
 *    attendance JSON. Names drift (a guest can submit under a surname that
 *    differs from their record), so this is last resort — and a placeholder
 *    can never be matched by name, so it stays 'Not yet' here.
 *
 * A guest outside the response's Guest relation isn't covered by it at all
 * (union-find households can be wider than the party that submitted), so they
 * stay 'Not yet' rather than inheriting someone else's decline.
 */
function resolveGuestRSVP(page, response, isPlaceholder) {
  if (!response) return 'Not yet';

  const recorded = response.attendanceById.get(page.id);
  if (recorded !== undefined) return recorded ? 'Attending' : 'Declined';

  const inParty = response.guestIds.includes(page.id);
  if (inParty && response.status === 'Attending') return 'Attending';
  if (inParty && response.status === 'Declined') return 'Declined';

  if (isPlaceholder) return 'Not yet';
  if (guestNameCandidates(page).some(name => response.attendingNames.has(name))) return 'Attending';
  return inParty ? 'Declined' : 'Not yet';
}

/** Every normalized name a guest's record could be matched by. */
function guestNameCandidates(page) {
  return [
    getGuestFullName(page),
    `${getText(page.properties, 'First Name')} ${getText(page.properties, 'Last Name')}`,
  ]
    .map(normalizeName)
    .filter(Boolean);
}

// ─── Bucketing ────────────────────────────────────────────────────────────────

function getGroups(props) {
  return (props['Group']?.multi_select || []).map(s => s.name);
}

/**
 * Choose which of the three files a household belongs in.
 *
 * Households are kept whole and filed by majority: every event member's Group
 * tags vote, and the bucket with the most votes wins. A tie — or no tagged
 * member at all — falls to the catch-all Sargaux file, which is also where
 * friends-only households land.
 */
export function bucketForHousehold(eventMembers) {
  const votes = new Map(BUCKETS.map(b => [b.key, 0]));
  for (const page of eventMembers) {
    for (const group of getGroups(page.properties)) {
      const bucket = BUCKETS.find(b => b.groups.includes(group));
      if (bucket) votes.set(bucket.key, votes.get(bucket.key) + 1);
    }
  }

  const ranked = [...votes.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return 'sargaux';
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return 'sargaux'; // tie
  return ranked[0][0];
}

// ─── Row building ─────────────────────────────────────────────────────────────

/**
 * Build every guest row for the event, grouped into households and bucketed
 * into the three output files.
 *
 * @returns {{ rowsByBucket: Record<string, object[]>, householdCount: number, warnings: string[] }}
 */
export function buildRows(guestPages, responsePages, eventKey) {
  const { label, inviteStatusProp } = EVENTS[eventKey];
  const isEvent = p => getEventInvitations(p.properties).includes(label);
  const warnings = [];

  const responses = responsePages
    .filter(p => getSelect(p.properties, 'Event') === label)
    .map(parseResponse);

  // Households are connected components over the whole guest list, then
  // filtered to those with at least one member invited to this event — the
  // same rule the invitation export uses, so envelopes and follow-up agree.
  const households = groupHouseholds(guestPages).filter(members => members.some(isEvent));

  const rowsByBucket = Object.fromEntries(BUCKETS.map(b => [b.key, []]));

  // Every name each guest could be matched by, keyed by page ID, so the drift
  // check below can resolve a response's whole Guest relation — which may reach
  // outside the household currently being written.
  const namesById = new Map(guestPages.map(p => [p.id, guestNameCandidates(p)]));
  const warnedResponses = new Set();

  for (const members of households) {
    const eventMembers = members.filter(isEvent);
    const named = eventMembers.filter(p => !isPlaceholderPlusOne(toMemberInfo(p)));
    const placeholders = eventMembers.filter(p => isPlaceholderPlusOne(toMemberInfo(p)));

    // Envelope name is built from the event members only, so a France-only
    // partner never shows up on the NYC household line.
    const householdName = envelopeNameForPages(eventMembers) ?? '(unnamed household)';
    if (named.length === 0) continue; // all-placeholder household — nobody to call

    const response = latestResponseForHousehold(responses, members.map(p => p.id));

    // Flag attendee names that match nobody the response actually covers.
    // Status-first resolution means these no longer corrupt the RSVP column,
    // but they do mean the Guest List and the submitted name have diverged —
    // worth a look before ringing anyone.
    //
    // The check spans the response's whole Guest relation, not just this
    // household: one envelope may deliberately span several households (people
    // invited together but split so they RSVP separately — see CLAUDE.md), and
    // scoping it to the household being written reports every *sibling*
    // household's members as drift, once per household, on every run.
    //
    // A response is warned about at most once for the same reason.
    if (response && !warnedResponses.has(response.id)) {
      const covered = new Set([
        ...members.flatMap(guestNameCandidates),
        ...response.guestIds.flatMap(id => namesById.get(id) ?? []),
      ]);
      const drifted = [...response.attendingNames].filter(name => !covered.has(name));
      if (drifted.length > 0) {
        warnedResponses.add(response.id);
        warnings.push(
          `  ⚠️  Name drift in ${householdName}: response lists ${drifted.length} ` +
          `attendee name(s) matching no Guest List record (response ${response.id})`
        );
      }
    }

    const memberRows = named.map(page => {
      const props = page.properties;
      return {
        guest: getGuestFullName(page) || '(no name)',
        rsvp: resolveGuestRSVP(page, response, false),
        inviteStatus: props[inviteStatusProp]?.status?.name || '',
        lastRSVP: props['Last RSVP']?.date?.start?.slice(0, 10) || '',
      };
    });

    // One row per unnamed +1 so the household's outstanding headcount is
    // visible — the envelope name already carries a "+1" suffix, but a caller
    // needs a line to write the name on. The RSVP is resolved like anyone
    // else's (attendance JSON, then party Status), so a fully-declined
    // household's +1 shows 'Declined' instead of pinning the household to the
    // top of the call list as outstanding.
    for (const placeholder of placeholders) {
      memberRows.push({
        guest: '+1 (name not yet known)',
        rsvp: resolveGuestRSVP(placeholder, response, true),
        inviteStatus: '',
        lastRSVP: '',
      });
    }

    const outstanding = memberRows.filter(r => r.rsvp === 'Not yet').length;
    const householdStatus = !response
      ? 'No response'
      : outstanding > 0
        ? `Partial — ${outstanding} outstanding`
        : memberRows.every(r => r.rsvp === 'Declined')
          ? 'All declined'
          : memberRows.some(r => r.rsvp === 'Declined')
            ? 'Mixed'
            : 'All attending';

    const household = {
      name: householdName,
      status: householdStatus,
      outstanding,
      dietary: response?.dietary || '',
      message: response?.message || '',
      submittedAt: response?.submittedAt?.slice(0, 10) || '',
      members: memberRows,
    };

    rowsByBucket[bucketForHousehold(eventMembers)].push(household);
  }

  // Households needing a call first, then most-outstanding, then alphabetical.
  for (const list of Object.values(rowsByBucket)) {
    const needsCall = h => (h.outstanding > 0 ? 1 : 0);
    list.sort((a, b) =>
      needsCall(b) - needsCall(a) ||
      b.outstanding - a.outstanding ||
      a.name.localeCompare(b.name)
    );
  }

  return { rowsByBucket, householdCount: households.length, warnings };
}

// ─── Workbook ─────────────────────────────────────────────────────────────────

/**
 * The sheet is a call list, so it carries only what helps decide whether to
 * ring someone and what to say. Four columns were deliberately dropped:
 * `Email` and `Meal` (sparse — 40% and 1% filled), `Notion RSVP` (a stored
 * status that restates the derived `RSVP` column and can drift from it, so
 * two status columns invited trusting the wrong one), and `Group` (the
 * workbooks are already split by it, so it mostly restated the filename).
 */
const COLUMNS = [
  { header: 'Household', key: 'household', width: 34 },
  { header: 'Household Status', key: 'householdStatus', width: 22 },
  { header: 'Guest', key: 'guest', width: 26 },
  { header: 'RSVP', key: 'rsvp', width: 11 },
  { header: 'INVITE_STATUS', key: 'inviteStatus', width: 18 },
  { header: 'Last RSVP', key: 'lastRSVP', width: 12 },
  { header: 'Dietary Needs', key: 'dietary', width: 26 },
  { header: 'Message', key: 'message', width: 40 },
];

// Fills are keyed off the per-guest RSVP value. 'Not yet' is the loud one —
// this export exists to make those rows findable at a glance.
const RSVP_FILL = {
  'Not yet': 'FFFCE8B2',   // amber
  Attending: 'FFDDF0DC',   // green tint
  Declined: 'FFEDEDED',    // grey
};

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F3F36' } };
  row.alignment = { vertical: 'middle' };
  row.height = 22;
}

/**
 * Write one bucket's workbook: a Follow-Up sheet (one row per guest, grouped
 * by household) plus a Summary sheet of counts.
 */
export async function writeWorkbook({ eventKey, bucket, households, outPath }) {
  const event = EVENTS[eventKey];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'sargaux.com';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Follow-Up', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = COLUMNS.map(c => ({
    header: c.header === 'INVITE_STATUS' ? event.inviteStatusHeader : c.header,
    key: c.key,
    width: c.width,
  }));
  styleHeader(sheet.getRow(1));

  let firstDataRow = 2;
  for (const household of households) {
    const startRow = sheet.rowCount + 1;

    household.members.forEach((member, i) => {
      const row = sheet.addRow({
        // Household identity repeats on every member row so the sheet stays
        // sortable and filterable; the visual grouping comes from the border
        // drawn at each household boundary below.
        household: household.name,
        householdStatus: household.status,
        guest: member.guest,
        rsvp: member.rsvp,
        inviteStatus: member.inviteStatus,
        lastRSVP: member.lastRSVP,
        // Dietary and message are party-level — show them once per household.
        dietary: i === 0 ? household.dietary : '',
        message: i === 0 ? household.message : '',
      });

      const fill = RSVP_FILL[member.rsvp];
      if (fill) {
        row.getCell('rsvp').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      }
      if (member.rsvp === 'Not yet') {
        row.getCell('guest').font = { bold: true };
      }
      row.getCell('message').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('dietary').alignment = { wrapText: true, vertical: 'top' };
    });

    // Household boundary: a hairline above the first member row.
    if (startRow > firstDataRow) {
      const row = sheet.getRow(startRow);
      for (let col = 1; col <= COLUMNS.length; col++) {
        row.getCell(col).border = { top: { style: 'thin', color: { argb: 'FFBBBBBB' } } };
      }
    }
  }

  if (sheet.rowCount > 1) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const guests = households.flatMap(h => h.members);
  const count = value => guests.filter(g => g.rsvp === value).length;

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 34 },
    { header: 'Count', key: 'count', width: 10 },
  ];
  styleHeader(summary.getRow(1));
  for (const [metric, value] of [
    ['Event', event.title],
    ['File', `${bucket.suffix} — ${bucket.label}`],
    ['Households', households.length],
    ['Guests', guests.length],
    ['Not yet RSVP’d', count('Not yet')],
    ['Attending', count('Attending')],
    ['Declined', count('Declined')],
    ['Households with no response', households.filter(h => h.status === 'No response').length],
    ['Households fully responded', households.filter(h => h.outstanding === 0).length],
    ['Generated', localDateStamp()],
  ]) {
    const row = summary.addRow({ metric, count: value });
    row.getCell('metric').font = { bold: true };
  }

  await workbook.xlsx.writeFile(outPath);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Reveal scripts/output in Finder. One window for the folder, not one per file
 * — three `open -R` calls would stack three reveals for a single run.
 */
export function openOutputFolder() {
  execFileSync('open', [new URL('../output', import.meta.url).pathname]);
}

/**
 * Generate all three follow-up workbooks for one event.
 * Called by the two per-event scripts, which pass 'nyc' or 'france'.
 */
export async function generateFollowUpExport(eventKey) {
  const event = EVENTS[eventKey];
  if (!event) throw new Error(`Unknown event: ${eventKey}`);

  const env = loadEnv();
  console.log(`\n── RSVP follow-up export: ${event.title} ──`);

  const [guestPages, responsePages] = await Promise.all([
    queryAll(env.NOTION_API_KEY, env.NOTION_GUEST_LIST_DB, undefined),
    queryAll(env.NOTION_API_KEY, env.NOTION_RSVP_RESPONSES_DB, undefined),
  ]);

  const guests = excludeTestGuestPages(guestPages);
  console.log(`  Guests in database: ${guests.length}`);
  console.log(`  RSVP responses:     ${responsePages.length}`);

  const { rowsByBucket, householdCount, warnings } = buildRows(guests, responsePages, eventKey);
  console.log(`  Households invited: ${householdCount}`);

  if (warnings.length > 0) {
    console.log(`\n  Warnings (${warnings.length}):`);
    warnings.forEach(w => console.log(w));
    console.log('');
  }

  const runDate = localDateStamp().replace(/-/g, '');
  const outPaths = [];

  for (const bucket of BUCKETS) {
    const households = rowsByBucket[bucket.key];
    const outPath = new URL(
      `../output/rsvp-followup-${eventKey}-${bucket.suffix}-${runDate}.xlsx`,
      import.meta.url
    ).pathname;

    await writeWorkbook({ eventKey, bucket, households, outPath });

    const guestCount = households.reduce((n, h) => n + h.members.length, 0);
    const outstanding = households.reduce((n, h) => n + h.outstanding, 0);
    console.log(
      `  ✓ ${bucket.suffix.padEnd(8)} ${String(households.length).padStart(3)} households, ` +
      `${String(guestCount).padStart(3)} guests, ${outstanding} awaiting RSVP`
    );
    outPaths.push(outPath);
  }

  return outPaths;
}
