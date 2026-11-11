/**
 * Whether the synthetic 🤖 test guests may log in on this request.
 *
 * Their names are committed to this public repo, so a bot login is only safe
 * where a stranger can't use it:
 *
 *  - `global.testGuestLogin` — `npm run dev` and the Playwright server only.
 *    Never set in netlify.toml.
 *  - `global.previewTestGuestLogin` — set for deploy previews only, and it
 *    unlocks nothing alone: the request must also carry an
 *    `X-Test-Guest-Login` header equal to `TEST_GUEST_LOGIN_SECRET` (a runtime
 *    secret scoped to the deploy-preview context). This is how the Lighthouse
 *    job in `.github/workflows/lighthouse-preview.yml` signs in. Production
 *    never builds with the flag, so even a mis-scoped secret can't open it.
 *
 * Kept free of `src/config/features.ts` so the unit suite can import it
 * without a Vite build: callers pass the flags in.
 */

import { timingSafeEqualString } from './hmac';

export const TEST_GUEST_LOGIN_HEADER = 'X-Test-Guest-Login';

export interface TestGuestLoginFlags {
  testGuestLogin: boolean;
  previewTestGuestLogin: boolean;
}

export function testGuestsAllowed(
  request: Request,
  flags: TestGuestLoginFlags,
  secret: string | undefined = process.env.TEST_GUEST_LOGIN_SECRET
): boolean {
  if (flags.testGuestLogin) return true;
  if (!flags.previewTestGuestLogin) return false;
  // Fail closed when the secret is unset or empty, as verifyAdminBearer does.
  if (!secret) return false;

  const provided = request.headers.get(TEST_GUEST_LOGIN_HEADER);
  if (!provided) return false;
  return timingSafeEqualString(provided, secret);
}
