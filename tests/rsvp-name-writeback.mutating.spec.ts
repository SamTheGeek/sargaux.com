/**
 * RSVP name write-back, against Notion.
 *
 * This is the one suite that renames a real Guest List row, which is why it
 * lives in its own Playwright project (`mutating` in playwright.config.ts) that
 * depends on `chromium`: several suites assert on this guest's name, files run
 * in parallel, and a rename window of even a few seconds would flake them.
 * Running last means nothing is reading the name while it is changed.
 *
 * Only the synthetic 🤖 party is touched — see docs/test-guests.md.
 *
 * **Idempotent by construction.** Both `beforeAll` and `afterAll` write the
 * canonical names from tests/fixtures.ts rather than whatever was read at the
 * start, so a run that dies mid-rename is repaired by the next one. If a crash
 * ever leaves the party renamed and the rest of the suite red because of it,
 * repair it directly with:
 *
 *     npx playwright test --project=mutating
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  TEST_GUEST_NAME,
  TEST_GUEST_PARTNER_NAME,
  TEST_GUEST_AKA,
  TEST_GUEST_PARTNER_AKA,
} from './fixtures';

/** The temporary name the partner is renamed to and back from. */
const RENAMED_TO = 'Wren Calloway';

test.describe('RSVP name write-back', () => {
  test.describe.configure({ mode: 'serial' });

  test.skip(
    process.env.FEATURE_GLOBAL_NOTION_BACKEND !== 'true',
    'Notion backend not configured'
  );

  let api: APIRequestContext;
  let authHeaders: Record<string, string>;
  let eventIds: string[] = [];

  interface Row {
    guestId: string;
    name: string;
  }

  /** The party as the RSVP form renders it: page id + currently stored name. */
  async function readRows(): Promise<Row[]> {
    const page = await api.get('/nyc/rsvp', { headers: authHeaders });
    expect(page.status()).toBe(200);
    const html = await page.text();
    const rows = [
      ...html.matchAll(
        /data-guest-row data-guest-id="([^"]+)"[\s\S]*?class="guest-name" value="([^"]*)"/g
      ),
    ].map((m) => ({ guestId: m[1], name: m[2] }));
    expect(rows.length).toBeGreaterThan(1);
    return rows;
  }

  /** Submit an RSVP carrying exactly these names, as the form would. */
  async function submitNames(rows: Row[]): Promise<void> {
    const response = await api.post('/api/rsvp', {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: {
        event: 'nyc',
        guestsAttending: rows.map((row) => ({ ...row, attending: true })),
        eventsAttending: eventIds,
        dietary: '',
      },
    });
    expect(response.status()).toBe(200);
  }

  /** Read one guest's `Also Known As` lines straight from Notion. */
  async function readAka(guestId: string): Promise<string> {
    const res = await fetch(`https://api.notion.com/v1/pages/${guestId}`, {
      headers: {
        Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
      },
    });
    const page = await res.json();
    return ((page.properties?.['Also Known As']?.rich_text ?? []) as { plain_text?: string }[])
      .map((block) => block.plain_text ?? '')
      .join('');
  }

  /**
   * Write `Also Known As` directly, bypassing the app.
   *
   * The only place the suite touches Notion outside the API, and it exists
   * because a rename *appends* the former name to this property
   * (preserveFormerName), so renaming the bot and back leaves two alias lines
   * behind. Nothing in the app can clear them, and left alone they accumulate
   * on every run and hand the bot login aliases it should not have.
   */
  async function writeAka(guestId: string, value: string): Promise<void> {
    await fetch(`https://api.notion.com/v1/pages/${guestId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { 'Also Known As': { rich_text: [{ text: { content: value } }] } },
      }),
    });
  }

  /**
   * Force the party back to the names AND alternate names in fixtures.ts,
   * whatever it holds now. Names first: restoring a name is itself a rename, so
   * it appends to `Also Known As` and must be undone afterwards, not before.
   */
  async function restoreCanonicalNames(): Promise<void> {
    const rows = await readRows();
    if (rows.length < 2) return;
    await submitNames([
      { guestId: rows[0].guestId, name: TEST_GUEST_NAME },
      { guestId: rows[1].guestId, name: TEST_GUEST_PARTNER_NAME },
    ]);
    await writeAka(rows[0].guestId, TEST_GUEST_AKA);
    await writeAka(rows[1].guestId, TEST_GUEST_PARTNER_AKA);
  }

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:1213' });

    const login = await api.post('/api/login', { form: { name: TEST_GUEST_NAME } });
    expect(login.status()).toBe(200);
    const { cookies } = await api.storageState();
    const cookie = cookies.find((c) => c.name === 'sargaux_auth')?.value;
    expect(cookie).toBeTruthy();
    // Sent explicitly: the auth cookie is Secure, and the request-context jar
    // refuses to attach Secure cookies over plain http://127.0.0.1.
    authHeaders = { Cookie: `sargaux_auth=${cookie}` };

    const html = await (await api.get('/nyc/rsvp', { headers: authHeaders })).text();
    eventIds = [...html.matchAll(/data-event-id="([^"]+)"/g)].map((m) => m[1]);
    expect(eventIds.length).toBeGreaterThan(0);

    // Repair a rename left behind by a run that died before its afterAll
    await restoreCanonicalNames();
  });

  test.afterAll(async () => {
    if (api) {
      await restoreCanonicalNames();
      await api.dispose();
    }
  });

  test('a renamed party member is persisted and readable back', async () => {
    const before = await readRows();
    expect(before.map((r) => r.name)).toContain(TEST_GUEST_PARTNER_NAME);

    const partner = before.find((r) => r.name === TEST_GUEST_PARTNER_NAME)!;
    await submitNames(
      before.map((row) => (row.guestId === partner.guestId ? { ...row, name: RENAMED_TO } : row))
    );

    const after = await readRows();
    expect(after.map((r) => r.name)).toContain(RENAMED_TO);
    expect(after.map((r) => r.name)).not.toContain(TEST_GUEST_PARTNER_NAME);
    // The other member is untouched — a rename is per-row, not per-party
    expect(after.map((r) => r.name)).toContain(TEST_GUEST_NAME);
  });

  test('the new name drives the Full Name login formula', async ({ playwright }) => {
    // The whole point of writing First/Last rather than only the title: the
    // renamed guest can log in as the name that was just typed for them.
    const fresh = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:1213' });
    const login = await fresh.post('/api/login', { form: { name: RENAMED_TO } });
    expect(login.status()).toBe(200);
    expect((await login.json()).guest).toBe(RENAMED_TO);
    await fresh.dispose();
  });

  test('the former name is kept as an alternate, so the old name still logs in', async ({
    playwright,
  }) => {
    // A guest who shortens their name on the form must not lose the name their
    // invitation was addressed with — nor the ability to log in as it.
    const rows = await readRows();
    const renamed = rows.find((r) => r.name === RENAMED_TO)!;
    expect(await readAka(renamed.guestId)).toContain(TEST_GUEST_PARTNER_NAME);

    const fresh = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:1213' });
    const login = await fresh.post('/api/login', { form: { name: TEST_GUEST_PARTNER_NAME } });
    expect(login.status()).toBe(200);
    await fresh.dispose();
  });

  test('restoring puts the original name back', async () => {
    await restoreCanonicalNames();

    const rows = await readRows();
    expect(rows.map((r) => r.name)).toContain(TEST_GUEST_PARTNER_NAME);
    expect(rows.map((r) => r.name)).not.toContain(RENAMED_TO);
    // And the alias list is back to the fixture value rather than carrying
    // every name this suite has ever written.
    expect(await readAka(rows[1].guestId)).toBe(TEST_GUEST_PARTNER_AKA);
  });

  test('an emptied name field does not overwrite the stored name', async ({ page }) => {
    // Exercises the form script rather than the API: clearing the box used to
    // submit the literal "Guest", which persisted as a real rename.
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');
    await page.waitForURL(/\/(nyc|france)$/);

    await page.goto('/nyc/rsvp');
    const partnerInput = page.locator('[data-guest-row] .guest-name').nth(1);
    const original = await partnerInput.inputValue();
    expect(original).toBe(TEST_GUEST_PARTNER_NAME);

    await partnerInput.fill('');
    await page.click('button[type="submit"]');
    // A successful submit navigates to the confirmation page
    await page.waitForURL(/\/nyc\/rsvp\/confirmed$/);

    await page.goto('/nyc/rsvp');
    await expect(page.locator('[data-guest-row] .guest-name').nth(1)).toHaveValue(original);
  });
});
