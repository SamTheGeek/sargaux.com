import { defineMiddleware } from 'astro:middleware';
import { getAuthenticatedGuest, AUTH_COOKIE_NAME } from './lib/auth';
import { getPrimaryEventRoute } from './lib/event-routing';
import { getRegistryDestination, FRENCH_REGISTRY_URL } from './lib/registry-routing';
import { isSiteEnabled, features } from './config/features';
import { getGuestById } from './lib/notion';
import { normalize } from './lib/normalize';
import type { Lang } from './content/strings';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/nyc',
  '/france',
  '/couple',
  '/registry',
];

// Routes that are always public
const PUBLIC_ROUTES = [
  '/',
  '/api/login',
  '/api/logout',
];

// Security headers for every SSR page response (audit P1-5).
//
// Frame policy: X-Frame-Options SAMEORIGIN + CSP `frame-ancestors 'self'` are
// deliberately equivalent. X-Frame-Options is kept (rather than relying on
// frame-ancestors alone) because `frame-ancestors` is ignored in a
// Report-Only policy, so until the CSP is enforced it is the only header
// actually blocking framing.
//
// The CSP stays Report-Only: there is no `report-to`/`report-uri` endpoint,
// so violations are only visible in guests' devtools consoles. Do not switch
// to enforcement until reporting is wired up and the policy has been tuned
// against real traffic. Policy notes: `script-src`/`style-src` need
// 'unsafe-inline' (Astro inline scripts + scoped styles are used heavily);
// `img-src https:` covers Google static maps and Joy registry photos.
const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  // HSTS conventionally belongs on ALL responses (APIs included), but Netlify
  // already sends platform-level HSTS on every response, so page scope here is
  // sufficient and keeps this list on the single existing code path.
  // 180 days, no `preload` (rollback stays possible). `includeSubDomains` is
  // safe: the only subdomain is www, a Netlify auto-HTTPS 301 to the apex.
  ['Strict-Transport-Security', 'max-age=15552000; includeSubDomains'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'],
  [
    'Content-Security-Policy-Report-Only',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
  ],
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Per-guest CDN cache variants (see astro.config.mjs routeRules).
  // Cached content pages must vary on the auth cookie — this keeps the login
  // wall intact (an anonymous request never matches a guest's cached copy)
  // and lets the personalized footer/toggle stay server-rendered — and on the
  // language cookie. Applied to redirects too, so a cached 302 (e.g. the
  // unauthenticated redirect to `/`) can never be served to a logged-in
  // guest's variant. Harmless on uncached responses and under the node
  // adapter; Netlify only consults it when a response is CDN-cached.
  const withVary = (response: Response): Response => {
    if (!pathname.startsWith('/api/')) {
      // `query=lang` is required: setting a custom Netlify-Vary makes the CDN
      // stop varying on the query string, so without it `/page?lang=fr` collides
      // with the cached English variant (same cookies, since `sargaux_lang`
      // hasn't flipped yet) and is served from cache — the origin never runs, the
      // language cookie never gets set, and the switcher becomes a silent no-op.
      response.headers.set('Netlify-Vary', 'query=lang,cookie=sargaux_auth|sargaux_lang');

      // Security headers (audit P1-5). These must be set here, not in
      // netlify.toml: Netlify [[headers]] rules apply only to statically-served
      // files, never to function responses — and under the Netlify adapter every
      // SSR page (i.e. the whole site) is a function response. Applied to
      // redirects too, mirroring Netlify-Vary above.
      for (const [name, value] of SECURITY_HEADERS) {
        response.headers.set(name, value);
      }
    }
    return response;
  };
  const withCacheVary = async (): Promise<Response> => withVary(await next());

  // Language detection (runs for all routes, gated by i18n feature flag)
  if (features.global.i18n) {
    const langParam = context.url.searchParams.get('lang');
    if (langParam === 'fr' || langParam === 'en') {
      context.locals.lang = langParam as Lang;
      context.cookies.set('sargaux_lang', langParam, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        httpOnly: false,
        sameSite: 'lax',
      });
    } else {
      const cookieLang = context.cookies.get('sargaux_lang')?.value;
      context.locals.lang = (cookieLang === 'fr' ? 'fr' : 'en') as Lang;
    }
  } else {
    context.locals.lang = 'en';
  }

  // Master switch: if site not enabled, only allow homepage and static assets
  if (!isSiteEnabled()) {
    if (pathname === '/' || pathname.startsWith('/_') || pathname.includes('.')) {
      return withCacheVary();
    }
    // Redirect everything else to homepage (temporary redirect)
    return withVary(context.redirect('/', 302));
  }

  // Check if route is public
  const isPublic = PUBLIC_ROUTES.some(route => pathname === route);
  if (isPublic) {
    return withCacheVary();
  }

  // Check if route is protected
  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  if (!isProtected) {
    return withCacheVary();
  }

  // Check authentication
  const auth = getAuthenticatedGuest(context.cookies);

  if (!auth) {
    // Redirect to homepage for login
    return withVary(context.redirect('/'));
  }

  // Resolve event invitations (and country) from the live Notion record, not
  // the session cookie — the cookie lives 90 days and can go stale if the
  // Notion record changes. getGuestById is served from the in-memory/blob
  // guest cache (15-min TTL), so this does not add a Notion round-trip to
  // every page load. The cookie value is only a fallback for the
  // hardcoded-guest-list mode and for transient Notion failures.
  //
  // Also bind cookie display name ↔ live Notion record: a forged session
  // with a stolen calendar notionId + arbitrary guest name must fail closed.
  let eventInvitations = auth.eventInvitations;
  let country = auth.country;
  if (auth.notionId && features.global.notionBackend) {
    try {
      const record = await getGuestById(auth.notionId);
      if (record) {
        if (normalize(auth.guest) !== record.normalizedName) {
          // Delete the cookie, don't just redirect: the homepage trusts any
          // HMAC-valid cookie and redirects to the primary event route, so a
          // stale-but-signed session (e.g. the guest's name was edited in
          // Notion after login) would otherwise ping-pong `/` ↔ `/nyc` forever
          // ("too many redirects"). Clearing it lands the guest on the login
          // page, self-repairing every affected device on its next visit.
          // The signature verified, so this is a genuine record mismatch — not
          // a transient config failure like a missing SESSION_HMAC_SECRET.
          console.warn('Session guest/notionId mismatch — clearing session cookie');
          context.cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
          return withVary(context.redirect('/'));
        }
        eventInvitations = record.eventInvitations;
        country = record.country ?? null;
      }
    } catch (error) {
      console.error('Live invitation lookup failed, falling back to session cookie:', error);
    }
  }

  // Add guest info to locals for use in pages
  context.locals.guest = auth.guest;
  context.locals.eventInvitations = eventInvitations;
  context.locals.country = country;
  if (auth.notionId) {
    context.locals.guestId = auth.notionId;
  }

  // French-side guests use the external MilleMercis registry — never the
  // native Joy page. Redirect direct visits (footer link, bookmarks) there.
  if (pathname.startsWith('/registry') && getRegistryDestination(country) === 'millemercis') {
    return withVary(context.redirect(FRENCH_REGISTRY_URL, 302));
  }

  const invitedToNyc = eventInvitations.includes('nyc');
  const invitedToFrance = eventInvitations.includes('france');
  const primaryEventRoute = getPrimaryEventRoute(eventInvitations);

  // Event-level route access control
  if (pathname.startsWith('/nyc') && !invitedToNyc) {
    return withVary(context.redirect(primaryEventRoute, 302));
  }

  if (pathname.startsWith('/france') && !invitedToFrance) {
    return withVary(context.redirect(primaryEventRoute, 302));
  }

  return withCacheVary();
});
