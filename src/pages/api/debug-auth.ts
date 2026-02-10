/**
 * Debug endpoint to help diagnose authentication issues.
 * Only returns safe, non-sensitive information.
 * DELETE THIS FILE once debugging is complete.
 */

import type { APIRoute } from 'astro';
import { features } from '../../config/features';

export const GET: APIRoute = async () => {
  const debug = {
    featureFlags: {
      notionBackend: features.global.notionBackend,
      weddingSiteEnabled: features.global.weddingSiteEnabled,
    },
    environment: {
      // Check if env vars are set (but don't expose values)
      hasNotionApiKey: !!process.env.NOTION_API_KEY,
      hasNotionGuestListDb: !!process.env.NOTION_GUEST_LIST_DB,
      hasNotionEventCatalogDb: !!process.env.NOTION_EVENT_CATALOG_DB,
      hasNotionRsvpResponsesDb: !!process.env.NOTION_RSVP_RESPONSES_DB,
    },
    runtime: {
      nodeEnv: process.env.NODE_ENV || 'not set',
      isProd: import.meta.env.PROD,
      isDev: import.meta.env.DEV,
    },
  };

  return new Response(JSON.stringify(debug, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
