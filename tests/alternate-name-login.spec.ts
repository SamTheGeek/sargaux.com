/**
 * Alternate-name login, end to end against Notion.
 *
 * `tests/envelope-login-unit.spec.ts` covers the matching rules as pure
 * functions. This file covers the plumbing those rules depend on and unit tests
 * cannot see: that `Also Known As` is actually read off the Guest List page,
 * that the targeted candidate query finds a guest by an alias rather than their
 * name, and that `POST /api/login` returns the right shape for each outcome.
 *
 * Runs entirely against the synthetic 🤖 party (see docs/test-guests.md), which
 * is why it can hit the real database at all — no real guest's record is read,
 * written, or named here.
 *
 * Notion data these assertions depend on, set on the Guest List rows:
 *   Alex Rivera   Also Known As: "Lex"
 *   Jordan Chen   Also Known As: "Jordan Delacroix"
 */

import { test, expect } from '@playwright/test';
import {
  TEST_GUEST_NAME,
  TEST_GUEST_PARTNER_NAME,
  TEST_GUEST_AKA_GIVEN_NAME,
  TEST_GUEST_AKA_SURNAME,
} from './fixtures';

const BASE_URL = 'http://localhost:1213';

interface LoginResult {
  status: number;
  guest?: string;
  needsIdentity?: boolean;
  candidates?: { id: string; name: string }[];
}

test.describe('Alternate-name login (Notion-backed)', () => {
  test.skip(
    process.env.FEATURE_GLOBAL_NOTION_BACKEND !== 'true',
    'Notion backend not configured'
  );

  async function login(
    request: import('@playwright/test').APIRequestContext,
    name: string
  ): Promise<LoginResult> {
    const response = await request.post(`${BASE_URL}/api/login`, {
      form: { name },
      headers: { Origin: BASE_URL },
    });
    const status = response.status();
    if (status !== 200) return { status };
    return { status, ...(await response.json()) };
  }

  test('the stored name still logs in directly', async ({ request }) => {
    // The guarantee the whole design rests on: exact `Full Name` is untouched
    const result = await login(request, TEST_GUEST_NAME);
    expect(result.status).toBe(200);
    expect(result.guest).toBe(TEST_GUEST_NAME);
    expect(result.needsIdentity).toBeFalsy();
  });

  test('a single-token Also Known As logs the right person in', async ({ request }) => {
    const [, surname] = TEST_GUEST_NAME.split(' ');

    const withSurname = await login(request, `${TEST_GUEST_AKA_GIVEN_NAME} ${surname}`);
    expect(withSurname.status).toBe(200);
    expect(withSurname.guest).toBe(TEST_GUEST_NAME);

    // A given name on its own already resolves when it names one person
    const alone = await login(request, TEST_GUEST_AKA_GIVEN_NAME);
    expect(alone.status).toBe(200);
    expect(alone.guest).toBe(TEST_GUEST_NAME);
  });

  test('an Also Known As surname joins the whole household', async ({ request }) => {
    // "Jordan Delacroix" is stored on one member, but a surname belongs to the
    // household — so it pairs with either member's given name.
    const partnerFirst = TEST_GUEST_PARTNER_NAME.split(' ')[0];
    const guestFirst = TEST_GUEST_NAME.split(' ')[0];

    const partner = await login(request, `${partnerFirst} ${TEST_GUEST_AKA_SURNAME}`);
    expect(partner.status).toBe(200);
    expect(partner.guest).toBe(TEST_GUEST_PARTNER_NAME);

    const other = await login(request, `${guestFirst} ${TEST_GUEST_AKA_SURNAME}`);
    expect(other.status).toBe(200);
    expect(other.guest).toBe(TEST_GUEST_NAME);
  });

  test('the alternate surname alone names nobody', async ({ request }) => {
    const result = await login(request, TEST_GUEST_AKA_SURNAME);
    expect(result.status).toBe(401);
  });

  test('naming the whole household asks who they are', async ({ request }) => {
    const guestFirst = TEST_GUEST_NAME.split(' ')[0];
    const partnerFirst = TEST_GUEST_PARTNER_NAME.split(' ')[0];
    const surname = TEST_GUEST_NAME.split(' ')[1];

    const result = await login(request, `${guestFirst} & ${partnerFirst} ${surname}`);
    expect(result.status).toBe(200);
    expect(result.needsIdentity).toBe(true);
    expect(result.guest).toBeUndefined();
    expect(result.candidates?.map((c) => c.name).sort()).toEqual(
      [TEST_GUEST_NAME, TEST_GUEST_PARTNER_NAME].sort()
    );
  });

  test('a name nobody answers to is still refused', async ({ request }) => {
    const surname = TEST_GUEST_NAME.split(' ')[1];
    // Same surname, a given name no rule and no alias can reach
    expect((await login(request, `Wendell ${surname}`)).status).toBe(401);
  });

  test('an alias cannot be paired with another household\'s surname', async ({ request }) => {
    expect((await login(request, `${TEST_GUEST_AKA_GIVEN_NAME} Nkemelu`)).status).toBe(401);
  });
});
