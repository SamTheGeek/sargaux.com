/**
 * Gallery passes: a code printed as a QR code on mailed cards that opens the
 * NYC photo galleries without a guest login.
 *
 * Scanning `/p/{code}` sets the `sargaux_gallery` cookie and lands on `/nyc`.
 * With that cookie and no session, middleware lets through exactly the paths in
 * `isGalleryPassPath` (the event page and the gallery pages) plus the photo API.
 * Every other page still sends the visitor to the login, as before.
 *
 * Only a SHA-256 of each code is stored here. The repository is public, and a
 * hash of a 128-bit random code can't be reversed. To revoke a pass, delete its
 * entry and deploy: the cookie holds the code itself, so a revoked code stops
 * working on every device that already scanned it.
 *
 * Server-only.
 */
import { createHash, timingSafeEqual } from 'crypto';

export const GALLERY_PASS_COOKIE = 'sargaux_gallery';

interface GalleryPass {
  /** Hex SHA-256 of the code. Never commit the code itself. */
  sha256: string;
  /** Last moment the pass works. Also the cookie's expiry. */
  expires: string;
}

const PASSES: readonly GalleryPass[] = [
  // NYC photo card QR, mailed November 2026. One year.
  {
    sha256: '2d920d1a9f65d1f8b8eabdc85957e1fc53981684186b20e269d6b33df693c5bb',
    expires: '2027-11-13T23:59:59-05:00',
  },
];

/**
 * Invented code accepted only in Playwright builds (`PHOTOS_TEST_FIXTURE`,
 * which is never set in netlify.toml), so the e2e tests can exercise the flow
 * without the real code being in the repository.
 */
export const TEST_GALLERY_PASS_CODE = 'test-gallery-pass-code';

// Same build-time switch as isPhotoTestFixture() in src/content/nycGalleries.ts,
// read directly so this module doesn't pull in the gallery manifests. The
// try/catch is for the unit-test runner, which has no import.meta.env; Vite
// replaces the expression statically in every real build.
const acceptTestCode = (() => {
  try {
    return import.meta.env.PHOTOS_TEST_FIXTURE === 'true';
  } catch {
    return false;
  }
})();

const CODE_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** The pass a code unlocks, or null if it is unknown, malformed, or expired. */
export function findGalleryPass(
  code: string | undefined | null,
  now: number = Date.now()
): { expires: Date } | null {
  if (!code || !CODE_PATTERN.test(code)) return null;
  if (acceptTestCode && code === TEST_GALLERY_PASS_CODE) {
    return { expires: new Date(now + 24 * 60 * 60 * 1000) };
  }
  const digest = sha256(code);
  for (const pass of PASSES) {
    const expected = Buffer.from(pass.sha256, 'hex');
    if (expected.length === digest.length && timingSafeEqual(expected, digest)) {
      const expires = new Date(pass.expires);
      return expires.getTime() > now ? { expires } : null;
    }
  }
  return null;
}

/** True when the request carries a live gallery pass cookie. */
export function hasGalleryPass(cookies: {
  get(name: string): { value: string } | undefined;
}): boolean {
  return findGalleryPass(cookies.get(GALLERY_PASS_COOKIE)?.value) !== null;
}

/** The pages a gallery pass opens: `/nyc` and `/nyc/photos/{gallery}`. */
export function isGalleryPassPath(pathname: string): boolean {
  return /^\/nyc\/?$/.test(pathname) || /^\/nyc\/photos\/[a-z0-9-]+\/?$/.test(pathname);
}
