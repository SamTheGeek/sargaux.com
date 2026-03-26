import { defineMiddleware } from 'astro:middleware';
import { getAuthenticatedGuest } from './lib/auth';
import { getPrimaryEventRoute } from './lib/event-routing';
import { isSiteEnabled, features } from './config/features';
import type { Lang } from './content/strings';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/nyc',
  '/france',
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
      return next();
    }
    // Redirect everything else to homepage (temporary redirect)
    return context.redirect('/', 302);
  }

  // Check if route is public
  const isPublic = PUBLIC_ROUTES.some(route => pathname === route);
  if (isPublic) {
    return next();
  }

  // Check if route is protected
  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  if (!isProtected) {
    return next();
  }

  // Check authentication
  const auth = getAuthenticatedGuest(context.cookies);

  if (!auth) {
    // Redirect to homepage for login
    return context.redirect('/');
  }

  // Add guest info to locals for use in pages
  context.locals.guest = auth.guest;
  context.locals.eventInvitations = auth.eventInvitations;
  if (auth.notionId) {
    context.locals.guestId = auth.notionId;
  }

  const invitedToNyc = auth.eventInvitations.includes('nyc');
  const invitedToFrance = auth.eventInvitations.includes('france');
  const primaryEventRoute = getPrimaryEventRoute(auth.eventInvitations);

  // Event-level route access control
  if (pathname.startsWith('/nyc') && !invitedToNyc) {
    return context.redirect(primaryEventRoute, 302);
  }

  if (pathname.startsWith('/france') && !invitedToFrance) {
    return context.redirect(primaryEventRoute, 302);
  }

  return next();
});
