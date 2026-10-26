import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test, expect } from '@playwright/test';
import { eventForPath, isProtectedPath } from '../src/lib/route-patterns';

/*
  URLPattern replaced three hand-rolled prefix checks. This table runs the old
  logic, inlined below as the reference, against the new helpers over a corpus
  of real and adversarial paths. The two may differ only on the rows listed in
  INTENDED_CHANGES: paths that merely *start with* a route name without being
  under it (`/nycfoo`), which middleware's segment-blind startsWith used to
  protect. Those aren't routes, so they now reach the 404 page instead of a
  login redirect. `/nyc%2Ftravel` is in the same class: Astro decodes with
  decodeURI, which never decodes %2F, so it routes as one literal segment and
  can't reach /nyc/travel.
*/

// ── Reference: the logic this replaced ────────────────────────────────────
const OLD_PROTECTED_ROUTES = ['/nyc', '/france', '/couple', '/registry'];
const oldMiddlewareProtected = (p: string) => OLD_PROTECTED_ROUTES.some((r) => p.startsWith(r));
const oldMiddlewareEvent = (p: string) =>
  p.startsWith('/nyc') ? 'nyc' : p.startsWith('/france') ? 'france' : null;
const oldReturnable = (p: string) =>
  OLD_PROTECTED_ROUTES.some((r) => p === r || p.startsWith(`${r}/`));

// ── Corpus ────────────────────────────────────────────────────────────────
function pageRoutes(): string[] {
  const root = join(process.cwd(), 'src/pages');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
    );
  return walk(root)
    .filter((file) => file.endsWith('.astro'))
    .map((file) => `/${relative(root, file)}`.replace(/\.astro$/, '').replace(/\/index$/, '') || '/');
}

const PAGES = pageRoutes();
const CORPUS = [...new Set([
  ...PAGES,
  ...PAGES.filter((p) => p !== '/').map((p) => `${p}/`),
  '/',
  '/api/login',
  '/api/rsvp',
  '/api/calendar/abc.ics',
  '/nyc/../api/logout',
  '/nyc%2Ftravel',
  '/NYC',
  '/NYC/travel',
  '/France',
  '/nyc//travel',
  '/nyc/does-not-exist',
  '/nycfoo',
  '/francefoo',
  '/couplex',
  '/registry-old',
  '/nyc%2Ftravel/x',
])].map(
  // Both callers pass a URL-normalized pathname (context.url.pathname in
  // middleware, url.pathname in sanitizeReturnTo), so `..` and the like are
  // already resolved by the time a path is classified. Compare on the same input.
  (path) => new URL(path, 'http://route-patterns.invalid').pathname
);

// Paths where middleware intentionally changes: the old prefix match protected
// them (and gated them as event routes); the new segment match doesn't.
const INTENDED_CHANGES = new Set([
  '/nycfoo',
  '/francefoo',
  '/couplex',
  '/registry-old',
  '/nyc%2Ftravel',
  '/nyc%2Ftravel/x',
]);

test('the corpus covers every page in src/pages', () => {
  expect(PAGES).toContain('/nyc/travel');
  expect(PAGES).toContain('/france/rsvp/confirmed');
  expect(PAGES.length).toBeGreaterThanOrEqual(17);
});

test.describe('isProtectedPath matches the old middleware check', () => {
  for (const path of CORPUS) {
    test(path, () => {
      if (INTENDED_CHANGES.has(path)) {
        expect(oldMiddlewareProtected(path)).toBe(true);
        expect(isProtectedPath(path)).toBe(false);
      } else {
        expect(isProtectedPath(path)).toBe(oldMiddlewareProtected(path));
      }
    });
  }
});

test.describe('eventForPath matches the old invitation gate', () => {
  for (const path of CORPUS) {
    test(path, () => {
      if (INTENDED_CHANGES.has(path)) {
        expect(eventForPath(path)).toBeNull();
      } else {
        expect(eventForPath(path)).toBe(oldMiddlewareEvent(path));
      }
    });
  }
});

test.describe('isProtectedPath matches the old return-to check exactly', () => {
  // return-to already required a segment boundary, so there's no intended change here.
  for (const path of CORPUS) {
    test(path, () => {
      expect(isProtectedPath(path)).toBe(oldReturnable(path));
    });
  }
});

test('a raw dot-segment path is resolved before matching, never trusted', () => {
  // The callers never pass one, but if one did, URLPattern resolves `..` itself,
  // so the path is classified as where it actually lands.
  expect(isProtectedPath('/nyc/../api/logout')).toBe(false);
  expect(eventForPath('/nyc/../api/logout')).toBeNull();
});

test('matching is case-sensitive, like startsWith', () => {
  expect(isProtectedPath('/NYC')).toBe(false);
  expect(eventForPath('/France/travel')).toBeNull();
});
