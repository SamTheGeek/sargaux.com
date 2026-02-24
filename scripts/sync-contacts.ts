#!/usr/bin/env tsx
/**
 * Sync Notion guest list → Resend contact audiences.
 *
 * Run manually:    npx tsx scripts/sync-contacts.ts
 * Run in CI:       triggered by .github/workflows/sync-contacts.yml
 *
 * Required env vars:
 *   NOTION_API_KEY        — Notion integration token
 *   NOTION_GUEST_LIST_DB  — Notion Guest List database page ID
 *   RESEND_API_KEY        — Resend API key
 *
 * Behaviour:
 *   - Ensures two Resend audiences exist: "NYC Guests" and "France Guests"
 *   - Full sync per audience:
 *       1. Upsert all Notion guests (with email) into the appropriate audience(s)
 *       2. Remove any contacts whose emails are no longer in the Notion list
 *   - Guests invited to both events appear in BOTH audiences
 *   - Guests without an email are counted and logged, not errored
 */

import { Resend } from 'resend';

// ─── Config ──────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_GUEST_LIST_DB = process.env.NOTION_GUEST_LIST_DB;

if (!RESEND_API_KEY) {
  console.error('❌  RESEND_API_KEY is not set');
  process.exit(1);
}
if (!NOTION_API_KEY) {
  console.error('❌  NOTION_API_KEY is not set');
  process.exit(1);
}
if (!NOTION_GUEST_LIST_DB) {
  console.error('❌  NOTION_GUEST_LIST_DB is not set');
  process.exit(1);
}

const AUDIENCE_NAMES = {
  nyc: 'NYC Guests',
  france: 'France Guests',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface NotionGuest {
  id: string;
  name: string;
  email?: string;
  eventInvitations: ('nyc' | 'france')[];
}

interface ResendAudience {
  id: string;
  name: string;
}

interface ResendContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  unsubscribed: boolean;
}

// ─── Notion helpers ───────────────────────────────────────────────────────────

async function fetchNotionGuests(): Promise<NotionGuest[]> {
  const guests: NotionGuest[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_GUEST_LIST_DB}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err: any = await res.json();
      throw new Error(`Notion API error: ${err.message ?? res.status}`);
    }

    const data: any = await res.json();

    for (const page of data.results) {
      if (page.object !== 'page') continue;
      const props = page.properties;

      const fullName =
        props['Full Name']?.formula?.string ||
        props['Name of Guest']?.title?.[0]?.plain_text ||
        '';
      if (!fullName) continue;

      const email: string | undefined = props['Guest Email']?.email ?? undefined;

      // Derive event invitations
      let eventInvitations: ('nyc' | 'france')[];
      const invProp = props['Event Invitations'];
      if (invProp?.multi_select?.length > 0) {
        eventInvitations = invProp.multi_select
          .map((opt: { name: string }) => opt.name.toLowerCase())
          .filter((e: string) => e === 'nyc' || e === 'france') as ('nyc' | 'france')[];
      } else {
        const country: string | null = props['Country']?.select?.name ?? null;
        eventInvitations = deriveEventInvitations(country);
      }

      guests.push({ id: page.id, name: fullName, email, eventInvitations });
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return guests;
}

function deriveEventInvitations(country: string | null): ('nyc' | 'france')[] {
  switch (country) {
    case 'USA':
    case 'CANADA':
      return ['nyc'];
    case 'FRANCE':
    case 'UNITED KINGDOM':
      return ['france'];
    default:
      return ['nyc', 'france'];
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Resend helpers ───────────────────────────────────────────────────────────

const resend = new Resend(RESEND_API_KEY);

async function listAudiences(): Promise<ResendAudience[]> {
  const { data, error } = await resend.audiences.list();
  if (error) throw new Error(`Failed to list audiences: ${(error as any).message}`);
  return (data?.data ?? []) as ResendAudience[];
}

async function createAudience(name: string): Promise<ResendAudience> {
  const { data, error } = await resend.audiences.create({ name });
  if (error) throw new Error(`Failed to create audience "${name}": ${(error as any).message}`);
  return data as ResendAudience;
}

async function ensureAudience(name: string, existing: ResendAudience[]): Promise<ResendAudience> {
  const found = existing.find((a) => a.name === name);
  if (found) return found;
  console.log(`  Creating audience: "${name}"`);
  return createAudience(name);
}

async function listContacts(audienceId: string): Promise<ResendContact[]> {
  const { data, error } = await resend.contacts.list({ audienceId });
  if (error) throw new Error(`Failed to list contacts: ${(error as any).message}`);
  return (data?.data ?? []) as ResendContact[];
}

async function upsertContact(
  audienceId: string,
  guest: { email: string; firstName: string; lastName?: string }
): Promise<void> {
  const { error } = await resend.contacts.create({
    audienceId,
    email: guest.email,
    firstName: guest.firstName,
    lastName: guest.lastName,
    unsubscribed: false,
  });
  if (error) throw new Error(`Failed to upsert ${guest.email}: ${(error as any).message}`);
}

async function deleteContact(audienceId: string, contactId: string): Promise<void> {
  const { error } = await resend.contacts.remove({ audienceId, id: contactId });
  if (error) throw new Error(`Failed to delete contact ${contactId}: ${(error as any).message}`);
}

// ─── Name parsing ─────────────────────────────────────────────────────────────

function parseName(fullName: string): { firstName: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// ─── Sync one audience ────────────────────────────────────────────────────────

async function syncAudience(
  event: 'nyc' | 'france',
  audienceId: string,
  guestsForEvent: NotionGuest[]
): Promise<{ upserted: number; removed: number; failed: number }> {
  const withEmail = guestsForEvent.filter((g) => g.email);
  const targetEmails = new Set(withEmail.map((g) => g.email!.toLowerCase()));

  // Fetch existing contacts
  const existing = await listContacts(audienceId);
  const existingByEmail = new Map(existing.map((c) => [c.email.toLowerCase(), c]));

  let upserted = 0;
  let removed = 0;
  let failed = 0;

  // Upsert all Notion guests with email
  for (const guest of withEmail) {
    try {
      const { firstName, lastName } = parseName(guest.name);
      await upsertContact(audienceId, { email: guest.email!, firstName, lastName });
      upserted++;
      await sleep(600);
    } catch (err) {
      console.error(`  ✗ Failed to upsert ${guest.email}:`, err);
      failed++;
    }
  }

  // Remove stale contacts (in Resend but not in Notion list)
  for (const [emailLower, contact] of existingByEmail) {
    if (!targetEmails.has(emailLower)) {
      try {
        await deleteContact(audienceId, contact.id);
        removed++;
        console.log(`  - Removed stale contact: ${contact.email}`);
      } catch (err) {
        console.error(`  ✗ Failed to remove ${contact.email}:`, err);
        failed++;
      }
    }
  }

  return { upserted, removed, failed };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄  Syncing Notion guests → Resend contacts\n');

  // Fetch guests from Notion
  console.log('Fetching guests from Notion...');
  const allGuests = await fetchNotionGuests();
  console.log(`  Found ${allGuests.length} guests total`);

  const withEmail = allGuests.filter((g) => g.email);
  const noEmail = allGuests.length - withEmail.length;
  if (noEmail > 0) {
    console.log(`  ⚠️  ${noEmail} guest(s) have no email on file — skipping`);
  }

  // Ensure audiences exist
  console.log('\nEnsuring Resend audiences exist...');
  const existingAudiences = await listAudiences();
  const nycAudience = await ensureAudience(AUDIENCE_NAMES.nyc, existingAudiences);
  await sleep(600);
  const franceAudience = await ensureAudience(AUDIENCE_NAMES.france, existingAudiences);
  const audiences: Record<'nyc' | 'france', ResendAudience> = {
    nyc: nycAudience,
    france: franceAudience,
  };
  console.log(`  ✓ NYC Guests:    ${audiences.nyc.id}`);
  console.log(`  ✓ France Guests: ${audiences.france.id}`);

  // Sync each audience
  const results: Record<string, { upserted: number; removed: number; failed: number }> = {};

  for (const event of ['nyc', 'france'] as const) {
    const label = AUDIENCE_NAMES[event];
    console.log(`\nSyncing "${label}"...`);

    const guestsForEvent = allGuests.filter((g) => g.eventInvitations.includes(event));
    console.log(
      `  ${guestsForEvent.length} invited, ${guestsForEvent.filter((g) => g.email).length} with email`
    );

    results[event] = await syncAudience(event, audiences[event].id, guestsForEvent);
    const r = results[event];
    console.log(`  ✓ Upserted: ${r.upserted}  Removed: ${r.removed}  Failed: ${r.failed}`);
  }

  // Summary
  console.log('\n── Summary ──────────────────────────────────────');
  let totalFailed = 0;
  for (const [event, r] of Object.entries(results)) {
    console.log(`  ${AUDIENCE_NAMES[event as 'nyc' | 'france']}: +${r.upserted} upserted, -${r.removed} removed, ${r.failed} failed`);
    totalFailed += r.failed;
  }

  if (totalFailed > 0) {
    console.error(`\n❌  ${totalFailed} operation(s) failed — check logs above`);
    process.exit(1);
  }

  console.log('\n✅  Sync complete');
}

main().catch((err) => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
