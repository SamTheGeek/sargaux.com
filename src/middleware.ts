import { defineMiddleware } from 'astro:middleware';
import { getAuthenticatedGuest } from './lib/auth';
import { isSiteEnabled } from './config/features';

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
  const guest = getAuthenticatedGuest(context.cookies);

  if (!guest) {
    // Redirect to homepage for login
    return context.redirect('/');
  }

  // Add guest info to locals for use in pages
  context.locals.guest = guest;

  return next();
});
