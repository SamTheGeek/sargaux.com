// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import { cacheNetlify } from '@astrojs/netlify/cache';
import node from '@astrojs/node';

// https://astro.build/config
const useNodeAdapter = process.env.ASTRO_ADAPTER === 'node';

/**
 * CDN cache defaults for content pages (couple, faq, details, travel, etc.).
 * These pages only vary per guest in the footer name and the header event
 * toggle, so they are cached durably at the Netlify CDN *per guest*: the
 * middleware sets `Netlify-Vary: cookie=sargaux_auth|sargaux_lang` so each
 * session cookie (and language) gets its own cache variant. This keeps the
 * login wall fully intact — an anonymous request never matches an
 * authenticated guest's cached copy.
 *
 * Netlify purges the CDN cache (including durable) on every deploy, so long
 * windows are safe: content only changes via deploys.
 */
const contentPageCache = { maxAge: 3600, swr: 86400 };

export default defineConfig({
  output: 'server',
  adapter: useNodeAdapter ? node({ mode: 'standalone' }) : netlify(),
  // CDN cache provider is Netlify-only. Under the node adapter (local dev and
  // Playwright runs) no provider is configured, so `cache.enabled` is false,
  // routeRules are inert, and auth middleware runs on every request.
  ...(useNodeAdapter ? {} : { cache: { provider: cacheNetlify() } }),
  routeRules: {
    '/couple': contentPageCache,
    '/registry': contentPageCache,
    '/nyc': contentPageCache,
    '/nyc/details': contentPageCache,
    '/nyc/travel': contentPageCache,
    '/nyc/faq': contentPageCache,
    '/nyc/lookbook': contentPageCache,
    '/france': contentPageCache,
    '/france/details': contentPageCache,
    '/france/travel': contentPageCache,
    '/france/schedule': contentPageCache,
    '/france/lookbook': contentPageCache,
    // RSVP pages and confirmation pages are intentionally NOT cached: they
    // pre-fill live Notion RSVP state. /nyc/rsvp and /france/rsvp also set
    // `Cache-Control: private, no-store` themselves.
  },
  security: {
    checkOrigin: process.env.ASTRO_CHECK_ORIGIN !== 'false',
  },
  server: {
    port: 1213
  }
});
