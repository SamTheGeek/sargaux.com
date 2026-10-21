/**
 * The one definition of which paths belong to which route family.
 *
 * Middleware (the auth wall and the per-event invitation gate) and return-to
 * (which pages a post-login `next` may point at) both classify paths through
 * these helpers. Before this they each had their own idea of a path boundary:
 * middleware used a segment-blind `startsWith('/nyc')`, so `/nycfoo` counted as
 * an NYC route, while return-to required an exact match or a `/` after the prefix.
 *
 * Server-only. `URLPattern` became a global in Node 24, but browsers got it
 * late (Safari 26), so this module must never be imported from `src/scripts/*`
 * or a `<script>` block. The client-bundle scan in tests/best-practices.spec.ts
 * fails the build's tests if it is.
 */

export type EventRoute = 'nyc' | 'france';

/** `/x`, `/x/`, and anything under `/x/`, but never `/xfoo`. Built once, at module load. */
function family(prefix: string): URLPattern {
  return new URLPattern({ pathname: `${prefix}{/*}?` });
}

const EVENT_PATTERNS: ReadonlyArray<readonly [EventRoute, URLPattern]> = [
  ['nyc', family('/nyc')],
  ['france', family('/france')],
];

/** Every route that requires a session; the auth wall's whole scope. */
const PROTECTED_PATTERNS: readonly URLPattern[] = [
  ...EVENT_PATTERNS.map(([, pattern]) => pattern),
  family('/couple'),
  family('/registry'),
];

/** True for every page behind the login wall. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATTERNS.some((pattern) => pattern.test({ pathname }));
}

/** Which wedding a path belongs to, for the invitation gate; null for shared pages. */
export function eventForPath(pathname: string): EventRoute | null {
  return EVENT_PATTERNS.find(([, pattern]) => pattern.test({ pathname }))?.[0] ?? null;
}
