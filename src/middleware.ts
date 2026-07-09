import { defineMiddleware } from 'astro:middleware';
import { getAuthenticatedGuest } from './lib/auth';
import { getPrimaryEventRoute } from './lib/event-routing';
import { isSiteEnabled, features } from './config/features';
import { getGuestById } from './lib/notion';
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

  // Resolve event invitations from the live Notion record, not the session
  // cookie — the cookie lives 90 days and can go stale if invitations change.
  // getGuestById is served from the in-memory/blob guest cache (15-min TTL),
  // so this does not add a Notion round-trip to every page load. The cookie
  // value is only a fallback for the hardcoded-guest-list mode and for
  // transient Notion failures.
  let eventInvitations = auth.eventInvitations;
  if (auth.notionId && features.global.notionBackend) {
    try {
      const record = await getGuestById(auth.notionId);
      if (record) {
        eventInvitations = record.eventInvitations;
      }
    } catch (error) {
      console.error('Live invitation lookup failed, falling back to session cookie:', error);
    }
  }

  // Add guest info to locals for use in pages
  context.locals.guest = auth.guest;
  context.locals.eventInvitations = eventInvitations;
  if (auth.notionId) {
    context.locals.guestId = auth.notionId;
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
