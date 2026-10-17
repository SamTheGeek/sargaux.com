import type { EventInvitation } from './auth';
import { getPrimaryEventRoute } from './event-routing';
import { eventForPath, isProtectedPath } from './route-patterns';

/**
 * Query parameter carrying the page an unauthenticated guest originally asked
 * for, so login can land them there instead of on their default event route.
 *
 * It is a *visible* query param rather than a cookie on purpose: a `Set-Cookie`
 * on the (cacheable) 302 would risk handing one guest's destination to another.
 *
 * Two things keep it safe against the CDN. The logged-out homepage is cached
 * (`Astro.cache.set` in src/pages/index.astro), so the middleware's
 * `Netlify-Vary` lists `query=next` — the language switcher server-renders this
 * param into its hrefs, and without varying on it the first visitor to warm `/`
 * would pin their destination into everyone else's links. And the login script
 * reads the value from `location.search` in the browser rather than from
 * anything server-rendered, so the POST carries the right destination even if a
 * cached body ever disagreed with the URL.
 */
export const RETURN_TO_PARAM = 'next';

/** Generous enough for any real path + query, short enough to bound abuse. */
const MAX_RETURN_TO_LENGTH = 512;

/**
 * Backslashes and control characters are both normalized away by browsers
 * (`/\evil.com` navigates to `//evil.com`), so either one can smuggle an
 * authority past a leading-slash check. Whitespace is rejected for the same
 * reason. Written as an explicit character class rather than a range literal
 * so the intent survives a reformat.
 */
const UNSAFE_PATH_CHARS = new RegExp('[\\\\\\s\\x00-\\x1F\\x7F]');

/**
 * Normalize a candidate return-to path, or reject it.
 *
 * This is the open-redirect gate, so it fails closed on anything it does not
 * positively recognize. Note `//evil.com` is a protocol-relative URL that
 * browsers navigate off-site, which is why a leading `/` alone is not enough.
 *
 * Returns `pathname + search`; the hash is dropped because browsers never send
 * it to the server, so preserving it here would be a lie.
 */
export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;

  const value = raw.trim();
  if (!value || value.length > MAX_RETURN_TO_LENGTH) return null;

  // Same-site absolute paths only: one leading slash, no scheme, no authority.
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (UNSAFE_PATH_CHARS.test(value)) return null;

  const url = URL.parse(value, 'http://return-to.invalid');
  if (!url) return null;

  // `new URL` resolves `..` segments, so this is the post-normalization path —
  // `/nyc/../api/logout` has already collapsed to `/api/logout` and is refused
  // by the check below rather than sneaking through it.
  //
  // Only protected routes are returnable: they're the only pages a guest can be
  // bounced off, so the only ones worth returning to. Keeping the set closed
  // (rather than allowing any same-site path) means a stray `next` can't aim
  // login at an API route or a page that never required a session.
  const { pathname } = url;
  if (!isProtectedPath(pathname)) return null;

  return `${pathname}${url.search}`;
}

/**
 * Where a successful login should land.
 *
 * A permitted `next` wins; anything else falls back to the guest's default
 * event route. The fallback is deliberately silent: the two guest lists barely
 * overlap, so an NYC-only guest being forwarded a France link is an ordinary
 * mistake by a well-meaning relative, not an error worth showing them. The
 * event gate also spares them a visible bounce — middleware would redirect them
 * off the uninvited route anyway (src/middleware.ts), just one flash later.
 */
export function resolveLoginDestination(
  raw: string | null | undefined,
  eventInvitations: EventInvitation[],
  now?: Date
): string {
  const returnTo = sanitizeReturnTo(raw);

  if (returnTo) {
    const event = eventForPath(returnTo.split('?')[0]);
    // /couple and /registry belong to no event: open to any authenticated guest
    const allowed = event === null || eventInvitations.includes(event);
    if (allowed) return returnTo;
  }

  return getPrimaryEventRoute(eventInvitations, now);
}

/**
 * Build the login URL an unauthenticated guest should be redirected to.
 * Falls back to a bare `/` when the requested path isn't one we return to.
 */
export function loginUrlFor(pathname: string, search = ''): string {
  const returnTo = sanitizeReturnTo(`${pathname}${search}`);
  return returnTo ? `/?${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}` : '/';
}
