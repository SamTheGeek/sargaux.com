#!/usr/bin/env tsx
/**
 * Record RSVPs that arrived off-website — by text, phone, or in person — so
 * they land in Notion exactly as a website submission would.
 *
 * The whole point is that a guest whose RSVP was entered here can later open
 * /nyc/rsvp or /france/rsvp and see their own answer pre-filled, get the right
 * personalized calendar, and show the right status on the Guest List. That only
 * works if every derived field the site reads is written too — the response row
 * is the smallest part of it.
 *
 * So this script does NOT hand-roll Notion writes. It calls `submitRSVP()`, the
 * same function POST /api/rsvp calls, which owns all of it: the party-level
 * response row (related to every member), the per-member `attendance` blob that
 * makes attendance resolvable by page ID rather than by name, the split-household
 * detach, and the Guest List write-back (RSVP status, invite status → Received,
 * Last RSVP, Events Attending, Dietary Needs). Everything this script adds around
 * that call is resolution, validation, and read-back verification.
 *
 * Two steps, because guest names are fuzzy and Notion writes are not:
 *
 *   1. scaffold — resolve a list of names to real Guest List rows and write a
 *      JSON file with each party's members and their event catalog spelled out.
 *      Ambiguity is surfaced here, where it is cheap, not at write time.
 *   2. apply — read that file back, dry-run by default, and write with --write.
 *
 * Usage:
 *   # 1. put one name per line (envelope line or full name) in a file
 *   npx tsx scripts/record-manual-rsvp.ts scaffold scripts/input/names.txt \
 *     --event nyc -o scripts/input/manual-rsvps.json
 *
 *   # 2. edit the JSON: set each person's `attending`, trim `events`, add dietary
 *   npx tsx scripts/record-manual-rsvp.ts apply scripts/input/manual-rsvps.json
 *   npx tsx scripts/record-manual-rsvp.ts apply scripts/input/manual-rsvps.json --write
 *
 * Flags (apply):
 *   --write             actually write (default is a dry run that writes nothing)
 *   --no-sync           skip the post-run production cache warm + calendar refresh
 *   --site <url>        target for that sync (default https://sargaux.com)
 *   --skip-mx           don't DNS-check the domain of any email given
 *   --allow-test-guests don't skip the synthetic 🤖 party
 *
 * Reads NOTION_API_KEY, NOTION_GUEST_LIST_DB, NOTION_EVENT_CATALOG_DB,
 * NOTION_RSVP_RESPONSES_DB and (for --sync) RESEND_ADMIN_SECRET from .env.local.
 *
 * Idempotent: re-running an entry updates that party's existing response row
 * rather than forking a second one, exactly as a guest re-submitting the form does.
 *
 * PRIVACY: guest names are PII and this repo is public. Both the names list and
 * the generated JSON belong in scripts/input/ or scripts/output/, both gitignored.
 * Never paste a real guest's name into a commit message or into this file.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { promises as dnsPromises } from 'node:dns';
import { Client } from '@notionhq/client';
import {
  submitRSVP,
  getGuestParty,
  getGuestById,
  getGuestEvents,
  findGuestsByName,
  findHouseholdByEnvelopeName,
  updateGuestEmail,
  getLatestRSVPForParty,
} from '../src/lib/notion';
import { generateAndStoreICSForGuest } from '../src/lib/ics-generator';
import { normalize } from '../src/lib/normalize';
import { isTestGuest } from '../src/lib/test-guests';
import type { GuestRecord, EventRecord, RSVPSubmission, RSVPDetails } from '../src/types';

// ── Limits mirrored from src/pages/api/rsvp.ts ──────────────────────────────
// This script bypasses the endpoint, so it has to enforce the endpoint's caps
// itself. Notion rejects a rich_text item over 2,000 chars outright, and the
// Details blob is chunked but still bounded.
const NAME_MAX_CHARS = 100;
const TEXT_FIELD_MAX_CHARS = 2_000;
const DETAILS_MAX_BYTES = 8_192;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const DEFAULT_SITE = 'https://sargaux.com';

// ── Entry shape ────────────────────────────────────────────────────────────

interface ManualGuestEntry {
  /** Guest List page ID. Written by `scaffold`; the authoritative identifier. */
  guestId: string;
  /** Display name, for reading the file. Persisted only if it differs (a rename). */
  name: string;
  /** Did this person attend? */
  attending: boolean;
  /** Optional email to record for this member. */
  email?: string;
}

interface ManualRSVPEntry {
  /** What was typed to find this party — kept for the log only. */
  lookup?: string;
  event: 'nyc' | 'france';
  /** Every member of the party, each with an explicit answer. */
  guests: ManualGuestEntry[];
  /**
   * Sub-events the attending members are coming to, by Event Catalog page ID
   * (or exact event name). `"all"` means every event of this wedding they are
   * invited to. Ignored when nobody is attending.
   *
   * Party-level, not per-person: the RSVP Responses row stores ONE event list
   * shared by everyone marked attending, which is what the website's own form
   * collects. See the note in the run summary.
   */
  events?: string[] | 'all';
  dietary?: string;
  message?: string;
  details?: RSVPDetails;
  /** Free-text reminder for the operator. Never written to Notion. */
  note?: string;
}

// ── .env.local ─────────────────────────────────────────────────────────────

/**
 * Load .env.local into process.env without clobbering anything already set.
 * Safe to call after the imports above: none of those modules read env at
 * module scope — the Notion client and every DB id are read at call time.
 */
function loadEnvLocal(): void {
  const envPath = new URL('../.env.local', import.meta.url).pathname;
  let raw: string;
  try {
    raw = readFileSync(envPath, 'utf8');
  } catch {
    return; // Already exported into the environment, presumably.
  }
  for (const line of raw.split('\n')) {
    if (line.trimStart().startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    if (process.env[key] === undefined) process.env[key] = line.slice(idx + 1).trim();
  }
}

// ── Small helpers ──────────────────────────────────────────────────────────

const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => console.log(`  ✗ ${msg}`);
const warn = (msg: string) => console.log(`  ! ${msg}`);

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function flagValue(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

class EntryError extends Error {}

function requireEnv(...keys: string[]): void {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing ${missing.join(', ')} — add them to .env.local.`);
    process.exit(1);
  }
}

function notionClient(): Client {
  return new Client({ auth: process.env.NOTION_API_KEY });
}

// ── Resolution ─────────────────────────────────────────────────────────────

/**
 * Resolve a typed name to one Guest List row, using the same two tiers login
 * uses: exact `Full Name` first, then the envelope/household rules.
 *
 * Fails closed on ambiguity rather than picking. Both failure modes are fixed
 * the same way — put the page ID in the JSON by hand — so the message says so.
 */
async function resolvePrimary(lookup: string): Promise<GuestRecord> {
  const exact = await findGuestsByName(lookup);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const ids = exact.map((g) => shortId(g.id)).join(', ');
    throw new EntryError(
      `"${lookup}" matches ${exact.length} guests (ids ${ids}) — set guestId explicitly.`
    );
  }

  const household = await findHouseholdByEnvelopeName(lookup);
  if (!household || household.length === 0) {
    throw new EntryError(`"${lookup}" matched no guest.`);
  }

  // An envelope line can span several `Related Guests` groups on purpose (see
  // CLAUDE.md → "One envelope may span several households"). The RSVP boundary
  // is the party, not the envelope, so a match that crosses parties has to be
  // disambiguated by hand — writing one response for it would put one group's
  // answer on the other group's row.
  const primary = household.find((member) => !member.isPlusOne) ?? household[0];
  const party = await getGuestParty(primary.id);
  const partyIds = new Set(party.map((member) => member.id));
  const outside = household.filter((member) => !partyIds.has(member.id));
  if (outside.length > 0) {
    throw new EntryError(
      `"${lookup}" matches an envelope spanning ${outside.length + 1} separate parties — ` +
        `set guestId to the person whose party you mean (candidates: ` +
        `${household.map((m) => shortId(m.id)).join(', ')}).`
    );
  }
  return primary;
}

/** Event Catalog entries for this wedding that the party is invited to. */
async function invitedEvents(
  primaryId: string,
  event: 'nyc' | 'france'
): Promise<EventRecord[]> {
  const all = await getGuestEvents(primaryId);
  return all.filter((candidate) => candidate.wedding === event);
}

/** Match `events` entries against the catalog by page ID or by exact name. */
function resolveEventIds(
  requested: string[] | 'all' | undefined,
  catalog: EventRecord[]
): string[] {
  if (requested === undefined || requested === 'all') return catalog.map((e) => e.id);

  const byId = new Map(catalog.map((e) => [e.id, e.id]));
  const byName = new Map(catalog.map((e) => [normalize(e.name), e.id]));
  const resolved: string[] = [];
  for (const entry of requested) {
    const id = byId.get(entry) ?? byName.get(normalize(entry));
    if (!id) {
      throw new EntryError(
        `event "${entry}" is not in this guest's catalog for this wedding ` +
          `(have: ${catalog.map((e) => e.name).join(', ')}).`
      );
    }
    resolved.push(id);
  }
  return Array.from(new Set(resolved));
}

async function hasMxRecord(email: string): Promise<boolean> {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    return (await dnsPromises.resolveMx(domain)).length > 0;
  } catch {
    return false;
  }
}

// ── Plan ───────────────────────────────────────────────────────────────────

interface EntryPlan {
  entry: ManualRSVPEntry;
  primary: GuestRecord;
  party: GuestRecord[];
  catalog: EventRecord[];
  submission: RSVPSubmission;
  /** Members whose recorded email differs from what the entry supplies. */
  emailWrites: { guestId: string; name: string; email: string }[];
  status: 'Attending' | 'Declined' | 'Partial';
  /** Non-fatal observations worth printing before a write. */
  warnings: string[];
}

/**
 * Turn one file entry into the exact submission that will be sent, applying the
 * endpoint's validation and its two normalizations (no events attended ⇒ the
 * whole party declines; nobody attending ⇒ no events attended). Doing the
 * normalization here rather than leaving it to submitRSVP keeps the dry-run
 * printout honest about what will actually be stored.
 */
async function planEntry(
  entry: ManualRSVPEntry,
  opts: { skipMx: boolean; allowTestGuests: boolean }
): Promise<EntryPlan> {
  if (entry.event !== 'nyc' && entry.event !== 'france') {
    throw new EntryError(`event must be "nyc" or "france" (got ${JSON.stringify(entry.event)}).`);
  }
  if (!Array.isArray(entry.guests) || entry.guests.length === 0) {
    throw new EntryError('guests must be a non-empty array — run `scaffold` to generate it.');
  }

  const seedId = entry.guests.find((g) => g.guestId)?.guestId;
  if (!seedId && !entry.lookup) {
    throw new EntryError('needs either a guestId on one of its guests or a "lookup" name.');
  }
  const primary = seedId ? await getGuestById(seedId) : await resolvePrimary(entry.lookup!);
  if (!primary) throw new EntryError(`guestId ${seedId} is not a Guest List row.`);

  if (!opts.allowTestGuests && isTestGuest(primary)) {
    throw new EntryError(`${primary.name} is a synthetic test guest — pass --allow-test-guests to include them.`);
  }

  const party = await getGuestParty(primary.id);
  const partyById = new Map(party.map((member) => [member.id, member]));

  if (!primary.eventInvitations.includes(entry.event)) {
    throw new EntryError(
      `${primary.name} is not invited to ${entry.event} (invited to: ${primary.eventInvitations.join(', ') || 'nothing'}).`
    );
  }

  // A response's Status is derived from the submission while its Guest relation
  // is the whole party — the endpoint rejects a submission that covers fewer
  // people than the party for exactly that reason, and so does this.
  for (const guest of entry.guests) {
    if (!guest.guestId || !partyById.has(guest.guestId)) {
      throw new EntryError(
        `guest ${JSON.stringify(guest.name ?? guest.guestId)} is not in ${primary.name}'s party — re-run scaffold.`
      );
    }
    if (typeof guest.attending !== 'boolean') {
      throw new EntryError(`guest ${JSON.stringify(guest.name)} needs an explicit true/false "attending".`);
    }
  }
  const covered = new Set(entry.guests.map((g) => g.guestId));
  const uncovered = party.filter((member) => !covered.has(member.id));
  if (uncovered.length > 0) {
    throw new EntryError(
      `the party has ${party.length} members but the entry lists ${entry.guests.length} — ` +
        `missing ${uncovered.map((m) => m.name).join(', ')}. Re-run scaffold.`
    );
  }

  const warnings: string[] = [];

  const guestsAttending = entry.guests.map((guest) => {
    const member = partyById.get(guest.guestId)!;
    const name = (guest.name ?? member.name).trim();
    if (name.length === 0 || name.length > NAME_MAX_CHARS) {
      throw new EntryError(`invalid name for ${shortId(guest.guestId)} (1–${NAME_MAX_CHARS} chars).`);
    }
    // submitRSVP persists a differing name as a real rename of the Guest List
    // row (and files the old one under `Also Known As`). That is right when a
    // plus-one is finally named and wrong when the JSON was hand-edited
    // casually, so say so before it happens.
    if (normalize(name) !== member.normalizedName) {
      warnings.push(`will RENAME ${member.name} → ${name} (old name kept in Also Known As)`);
    }
    return { guestId: guest.guestId, name, attending: guest.attending };
  });

  const catalog = await invitedEvents(primary.id, entry.event);
  let eventsAttending = resolveEventIds(entry.events, catalog);

  // The endpoint's two normalizations, in its order.
  let normalized = guestsAttending;
  if (catalog.length > 0 && eventsAttending.length === 0) {
    normalized = guestsAttending.map((guest) => ({ ...guest, attending: false }));
  }
  if (!normalized.some((guest) => guest.attending)) eventsAttending = [];

  for (const field of ['dietary', 'message'] as const) {
    const value = entry[field];
    if (value !== undefined && (typeof value !== 'string' || value.length > TEXT_FIELD_MAX_CHARS)) {
      throw new EntryError(`${field} must be a string of at most ${TEXT_FIELD_MAX_CHARS} chars.`);
    }
  }
  if (entry.details !== undefined) {
    if (typeof entry.details !== 'object' || Array.isArray(entry.details)) {
      throw new EntryError('details must be an object.');
    }
    if (Buffer.byteLength(JSON.stringify(entry.details), 'utf8') > DETAILS_MAX_BYTES) {
      throw new EntryError('details payload too large.');
    }
  }

  // Emails: format- and MX-checked like the endpoint, but not *required*. The
  // form demands one address per party because it is the guest's own only
  // chance to give it; a phone RSVP legitimately arrives without one.
  const emailWrites: { guestId: string; name: string; email: string }[] = [];
  for (const guest of entry.guests) {
    const email = guest.email?.trim();
    if (!email) continue;
    if (!EMAIL_PATTERN.test(email)) {
      throw new EntryError(`"${email}" is not a valid email address.`);
    }
    if (!opts.skipMx && !(await hasMxRecord(email))) {
      throw new EntryError(`"${email}" has no MX record — check the domain, or pass --skip-mx.`);
    }
    const member = partyById.get(guest.guestId)!;
    if (normalize(member.email ?? '') !== normalize(email)) {
      emailWrites.push({ guestId: guest.guestId, name: member.name, email });
    }
  }
  if (party.every((member) => !member.email) && emailWrites.length === 0) {
    warnings.push('no email on file for anyone in this party (fine, but they get no confirmations)');
  }

  const attendingCount = normalized.filter((guest) => guest.attending).length;
  const status =
    attendingCount === 0 ? 'Declined' : attendingCount === normalized.length ? 'Attending' : 'Partial';

  const submission: RSVPSubmission = {
    event: entry.event,
    guestsAttending: normalized,
    eventsAttending,
    dietary: entry.dietary,
    message: entry.message,
    details: entry.details,
    // Never true from this script: a manual RSVP is a record of a conversation
    // that already happened, and the guest did not ask for mail.
    sendConfirmation: false,
  };

  return { entry, primary, party, catalog, submission, emailWrites, status, warnings };
}

function printPlan(plan: EntryPlan): void {
  const { primary, submission, catalog, status } = plan;
  console.log(`\n▸ ${primary.name} — ${submission.event.toUpperCase()}  [${status}]`);
  for (const guest of submission.guestsAttending) {
    const member = plan.party.find((m) => m.id === guest.guestId);
    const renamed = member && normalize(guest.name) !== member.normalizedName ? `  (was ${member.name})` : '';
    console.log(`    ${guest.attending ? '✓' : '·'} ${guest.name}${renamed}`);
  }
  const names = submission.eventsAttending.map(
    (id) => catalog.find((event) => event.id === id)?.name ?? id
  );
  console.log(
    `    events: ${names.length > 0 ? names.join(', ') : '(none)'}` +
      ` — ${submission.eventsAttending.length} of ${catalog.length} invited`
  );
  if (submission.dietary) console.log(`    dietary: ${submission.dietary}`);
  if (submission.message) console.log(`    message: ${submission.message}`);
  if (submission.details && Object.keys(submission.details).length > 0) {
    console.log(`    details: ${JSON.stringify(submission.details)}`);
  }
  for (const write of plan.emailWrites) console.log(`    email:   ${write.name} → ${write.email}`);
  for (const message of plan.warnings) warn(message);
}

// ── Verification ───────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function richText(props: any, key: string): string {
  return (props?.[key]?.rich_text ?? []).map((item: any) => item.plain_text ?? '').join('');
}

/**
 * Read back what actually landed in Notion — the response row and every party
 * member's Guest List row — through a fresh client rather than trusting what
 * submitRSVP returned. The whole reason this script exists is that a
 * half-written RSVP looks fine until the guest opens the site weeks later.
 *
 * Checked against the plan: the response's Status, attendee names, event list,
 * Guest relation and per-member attendance blob; and per member, that their
 * Guest List RSVP status is consistent with their own answer, that Last RSVP
 * was stamped, that Events Attending gained (or was kept clear of) the
 * submitted events, and that the invite status advanced to Received.
 *
 * A member's Guest List RSVP is only pinned to an exact value when this is the
 * one wedding they are invited to. For a dual-invite guest it legitimately
 * depends on the other event's stored response, so it is checked for
 * consistency instead of equality — asserting an exact value here would mean
 * duplicating submitRSVP's resolution and would fail on correct data.
 */
async function verify(plan: EntryPlan, responseId: string): Promise<boolean> {
  const notion = notionClient();
  const { submission } = plan;
  let clean = true;
  const fail = (message: string) => {
    bad(message);
    clean = false;
  };

  const page: any = await notion.pages.retrieve({ page_id: responseId });
  const props = page.properties ?? {};

  if (props.Status?.select?.name !== plan.status) {
    fail(`response Status is ${props.Status?.select?.name ?? '(empty)'}, expected ${plan.status}`);
  }
  const expectedLabel = submission.event === 'nyc' ? 'NYC' : 'France';
  if (props.Event?.select?.name !== expectedLabel) {
    fail(`response Event is ${props.Event?.select?.name ?? '(empty)'}, expected ${expectedLabel}`);
  }

  const expectedNames = submission.guestsAttending.filter((g) => g.attending).map((g) => g.name);
  const storedNames = richText(props, 'Guests Attending');
  if (normalize(storedNames) !== normalize(expectedNames.join(', '))) {
    fail(`response attendee list is "${storedNames}", expected "${expectedNames.join(', ')}"`);
  }

  const relatedIds = new Set<string>((props.Guest?.relation ?? []).map((rel: any) => rel.id));
  const missingFromRelation = plan.party.filter((member) => !relatedIds.has(member.id));
  if (missingFromRelation.length > 0) {
    fail(`response Guest relation is missing ${missingFromRelation.map((m) => m.name).join(', ')}`);
  }

  let details: { eventsAttending?: string[]; attendance?: { guestId: string; attending: boolean }[] } = {};
  try {
    details = JSON.parse(richText(props, 'Details') || '{}');
  } catch {
    fail('response Details is not valid JSON');
  }
  const storedEvents = new Set(details.eventsAttending ?? []);
  const eventsMatch =
    storedEvents.size === submission.eventsAttending.length &&
    submission.eventsAttending.every((id) => storedEvents.has(id));
  if (!eventsMatch) {
    fail(`response eventsAttending has ${storedEvents.size} ids, expected ${submission.eventsAttending.length}`);
  }
  const attendanceById = new Map((details.attendance ?? []).map((a) => [a.guestId, a.attending]));
  for (const guest of submission.guestsAttending) {
    if (attendanceById.get(guest.guestId!) !== guest.attending) {
      fail(`response attendance blob has ${guest.name} as ${attendanceById.get(guest.guestId!)}, expected ${guest.attending}`);
    }
  }
  if (clean) ok(`response row ${shortId(responseId)} stored correctly`);

  // Pre-fill path: exactly what /nyc/rsvp and /france/rsvp read on page load.
  const prefill = await getLatestRSVPForParty(
    plan.party.map((member) => member.id),
    submission.event
  );
  if (!prefill) {
    fail('the RSVP page pre-fill lookup finds no response for this party');
  } else if (prefill.id !== responseId) {
    fail(`pre-fill lookup returns a different row (${shortId(prefill.id)}) — an older response may be shadowing this one`);
  } else {
    ok('RSVP page pre-fill resolves to this response');
  }

  const submittedEventIds = new Set(submission.eventsAttending);
  for (const guest of submission.guestsAttending) {
    const memberPage: any = await notion.pages.retrieve({ page_id: guest.guestId! });
    const memberProps = memberPage.properties ?? {};
    const rsvp = memberProps.RSVP?.status?.name ?? null;
    const soleEvent = plan.party.find((m) => m.id === guest.guestId)?.eventInvitations.length === 1;

    if (soleEvent) {
      const expected = guest.attending ? 'Attending' : 'Declined';
      if (rsvp !== expected) fail(`${guest.name}: Guest List RSVP is ${rsvp ?? '(empty)'}, expected ${expected}`);
    } else if (guest.attending ? rsvp === 'Declined' : rsvp === 'Attending') {
      fail(`${guest.name}: Guest List RSVP is ${rsvp}, which contradicts this submission`);
    } else if (!rsvp) {
      fail(`${guest.name}: Guest List RSVP is empty`);
    }

    if (!memberProps['Last RSVP']?.date?.start) fail(`${guest.name}: Last RSVP was not stamped`);

    const attendingIds = new Set<string>(
      (memberProps['Events Attending']?.relation ?? []).map((rel: any) => rel.id)
    );
    if (guest.attending) {
      const missing = submission.eventsAttending.filter((id) => !attendingIds.has(id));
      if (missing.length > 0) fail(`${guest.name}: Events Attending is missing ${missing.length} submitted event(s)`);
    } else {
      const stale = [...attendingIds].filter((id) => submittedEventIds.has(id));
      if (stale.length > 0) fail(`${guest.name}: not attending, but Events Attending still lists ${stale.length} of them`);
    }

    const inviteProp = submission.event === 'nyc' ? 'NYC Invite Sent' : 'France Save the Date Sent';
    const inviteStatus = memberProps[inviteProp]?.status?.name;
    if (inviteStatus !== 'Received') {
      warn(`${guest.name}: ${inviteProp} is ${inviteStatus ?? '(empty)'}, not Received`);
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (clean) ok('Guest List write-back verified for every party member');
  return clean;
}

// ── scaffold ───────────────────────────────────────────────────────────────

/**
 * Resolve a list of names into a ready-to-edit entry file. Everyone defaults to
 * attending everything, so declines and partials are an edit away rather than
 * the file being written from nothing.
 */
async function scaffold(): Promise<void> {
  const namesPath = process.argv[3];
  const event = flagValue('--event');
  const outPath = flagValue('-o') ?? flagValue('--out');

  if (!namesPath || (event !== 'nyc' && event !== 'france')) {
    console.error(
      'Usage: npx tsx scripts/record-manual-rsvp.ts scaffold <names.txt> --event nyc|france [-o out.json]'
    );
    process.exit(1);
  }

  const names = readFileSync(namesPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  console.log(`Resolving ${names.length} name(s) against the Guest List…\n`);

  const entries: ManualRSVPEntry[] = [];
  const failures: string[] = [];

  for (const name of names) {
    try {
      const primary = await resolvePrimary(name);
      const party = await getGuestParty(primary.id);
      if (!primary.eventInvitations.includes(event)) {
        throw new EntryError(`invited to ${primary.eventInvitations.join(', ') || 'nothing'}, not ${event}`);
      }
      const catalog = await invitedEvents(primary.id, event);
      entries.push({
        lookup: name,
        event,
        guests: party.map((member) => ({
          guestId: member.id,
          name: member.name,
          attending: true,
        })),
        events: catalog.map((entry) => entry.name),
        ...(event === 'france' ? { details: {} } : {}),
      });
      console.log(
        `  ✓ ${name} → ${party.map((m) => m.name).join(' + ')} (${catalog.length} events)` +
          (isTestGuest(primary) ? '  [synthetic test guest — apply needs --allow-test-guests]' : '')
      );
    } catch (error) {
      const message = error instanceof EntryError ? error.message : String(error);
      failures.push(`${name}: ${message}`);
      console.log(`  ✗ ${name} — ${message}`);
    }
  }

  const json = `${JSON.stringify(entries, null, 2)}\n`;
  if (outPath) {
    writeFileSync(outPath, json);
    console.log(`\nWrote ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} to ${outPath}`);
  } else {
    console.log(`\n${json}`);
  }

  if (failures.length > 0) {
    console.log(`\n${failures.length} name(s) did not resolve and are NOT in the file:`);
    for (const failure of failures) console.log(`  - ${failure}`);
    console.log('Fix the spelling, or add the entry by hand with the guest\'s Notion page ID.');
  }

  console.log(
    '\nNext: set each person\'s "attending", trim "events" to what they are coming to,\n' +
      'add "dietary"/"email" where you have it, then run `apply` (dry run first).'
  );
}

// ── apply ──────────────────────────────────────────────────────────────────

async function syncProduction(site: string): Promise<void> {
  const secret = process.env.RESEND_ADMIN_SECRET;
  const warmUrl = `${site}/api/warm`;
  const refreshUrl = `${site}/api/admin/refresh-calendars`;

  if (!secret) {
    console.log(
      `\nRESEND_ADMIN_SECRET not in .env.local — run these yourself so production picks the writes up:\n` +
        `  curl -H "Authorization: Bearer \\$SECRET" ${warmUrl}\n` +
        `  curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer \\$SECRET" ${refreshUrl}`
    );
    return;
  }

  // Production caches the guest list in a blob for 15 minutes and stores each
  // guest's ICS in another blob. Neither is reachable from here, so without
  // these two calls the site serves the pre-RSVP state for up to 15 minutes and
  // the calendar feeds stay stale indefinitely.
  console.log(`\nSyncing production (${site})…`);
  try {
    const warmed = await fetch(warmUrl, { headers: { Authorization: `Bearer ${secret}` } });
    console.log(`  guest cache: ${warmed.status} ${warmed.ok ? await warmed.text() : warmed.statusText}`);
  } catch (error) {
    warn(`guest cache warm failed: ${String(error)}`);
  }
  try {
    const refreshed = await fetch(refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    });
    console.log(
      `  calendars:   ${refreshed.status} ${refreshed.ok ? await refreshed.text() : refreshed.statusText}`
    );
  } catch (error) {
    warn(`calendar refresh failed: ${String(error)}`);
  }
}

async function apply(): Promise<void> {
  const filePath = process.argv[3];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/record-manual-rsvp.ts apply <entries.json> [--write]');
    process.exit(1);
  }

  const write = hasFlag('--write');
  const opts = { skipMx: hasFlag('--skip-mx'), allowTestGuests: hasFlag('--allow-test-guests') };

  let entries: ManualRSVPEntry[];
  try {
    entries = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Could not read ${filePath}: ${String(error)}`);
    process.exit(1);
  }
  if (!Array.isArray(entries)) {
    console.error('The entries file must contain a JSON array.');
    process.exit(1);
  }

  console.log(
    `Mode: ${write ? 'WRITE' : 'DRY RUN (no writes)'}\n` +
      `Entries: ${entries.length}\n` +
      'Note: sub-event selections are party-level, as on the website form — everyone\n' +
      'marked attending shares one event list. No confirmation emails are sent.'
  );

  // Plan everything first: a file with one bad entry should not half-apply.
  const plans: EntryPlan[] = [];
  const planFailures: string[] = [];
  for (const [index, entry] of entries.entries()) {
    const label = entry.lookup ?? entry.guests?.[0]?.name ?? `entry ${index + 1}`;
    try {
      plans.push(await planEntry(entry, opts));
    } catch (error) {
      const message = error instanceof EntryError ? error.message : String(error);
      planFailures.push(`${label}: ${message}`);
    }
  }

  for (const plan of plans) printPlan(plan);

  if (planFailures.length > 0) {
    console.log(`\n${planFailures.length} entr${planFailures.length === 1 ? 'y' : 'ies'} could not be planned:`);
    for (const failure of planFailures) console.log(`  ✗ ${failure}`);
    console.log('\nNothing was written. Fix these and re-run.');
    process.exit(1);
  }

  if (!write) {
    console.log(`\n${plans.length} entr${plans.length === 1 ? 'y' : 'ies'} planned. Re-run with --write to apply.`);
    return;
  }

  console.log('\n─── writing ───');
  let succeeded = 0;
  const failed: string[] = [];

  // Sequential: each submitRSVP writes the response row plus one Guest List
  // update per member and clears the shared cache. Running parties in parallel
  // buys little and makes a mid-run failure much harder to reason about.
  for (const plan of plans) {
    console.log(`\n▸ ${plan.primary.name} — ${plan.submission.event.toUpperCase()}`);
    try {
      for (const emailWrite of plan.emailWrites) {
        await updateGuestEmail(emailWrite.guestId, emailWrite.email);
        ok(`email recorded for ${emailWrite.name}`);
      }

      const written = await submitRSVP(plan.primary.id, plan.submission);
      ok(`submitRSVP wrote response ${shortId(written.id)}`);

      // Regenerate calendars from the response just written, as POST /api/rsvp
      // does — Notion's query index lags a fresh write. Locally this needs a
      // Netlify Blobs context it does not have, so a failure here is expected
      // and is covered by the production calendar refresh at the end.
      let icsStored = 0;
      for (const member of plan.party) {
        try {
          await generateAndStoreICSForGuest(member.id, written);
          icsStored += 1;
        } catch {
          /* no blob store outside Netlify — handled by the sync step */
        }
      }
      if (icsStored === plan.party.length) ok('calendars regenerated');
      else warn(`calendars not written locally (${icsStored}/${plan.party.length}) — the sync step below covers it`);

      if (await verify(plan, written.id)) succeeded += 1;
      else failed.push(`${plan.primary.name}: written, but verification found problems (above)`);
    } catch (error) {
      bad(String(error));
      failed.push(`${plan.primary.name}: ${String(error)}`);
    }
  }

  console.log(`\n─── done ───\nVerified: ${succeeded}/${plans.length}`);
  if (failed.length > 0) {
    console.log(`Problems (${failed.length}):`);
    for (const failure of failed) console.log(`  ✗ ${failure}`);
  }

  if (succeeded > 0 && !hasFlag('--no-sync')) {
    await syncProduction(flagValue('--site') ?? DEFAULT_SITE);
  }

  if (failed.length > 0) process.exit(1);
}

// ── main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnvLocal();

  const command = process.argv[2];
  if (command === 'scaffold') {
    requireEnv('NOTION_API_KEY', 'NOTION_GUEST_LIST_DB', 'NOTION_EVENT_CATALOG_DB');
    await scaffold();
    return;
  }
  if (command === 'apply') {
    requireEnv(
      'NOTION_API_KEY',
      'NOTION_GUEST_LIST_DB',
      'NOTION_EVENT_CATALOG_DB',
      'NOTION_RSVP_RESPONSES_DB'
    );
    await apply();
    return;
  }

  console.error(
    'Usage:\n' +
      '  npx tsx scripts/record-manual-rsvp.ts scaffold <names.txt> --event nyc|france [-o out.json]\n' +
      '  npx tsx scripts/record-manual-rsvp.ts apply <entries.json> [--write] [--no-sync] [--skip-mx]'
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
