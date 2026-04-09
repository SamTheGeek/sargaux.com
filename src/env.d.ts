/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    guest?: string;
    guestId?: string; // Notion page ID (when notionBackend is enabled)
    eventInvitations?: ('nyc' | 'france')[];
    lang?: import('./content/strings').Lang;
  }
}

// Runtime env vars accessed via process.env (set in Netlify Dashboard — NEVER commit these)
declare namespace NodeJS {
  interface ProcessEnv {
    NOTION_API_KEY?: string;
    NOTION_GUEST_LIST_DB?: string; // Guest List database page ID
    NOTION_EVENT_CATALOG_DB?: string; // Event Catalog database page ID
    NOTION_RSVP_RESPONSES_DB?: string; // RSVP Responses database page ID
    CALENDAR_HMAC_SECRET?: string; // Signing secret for personalized calendar tokens (never commit)
    RESEND_API_KEY?: string; // Resend transactional email API key (never commit)
    RESEND_FROM_ADDRESS?: string; // e.g. "Sargaux Wedding <hello@sargaux.com>"
    ADMIN_SECRET?: string; // Secret for protecting admin endpoints (never commit)
  }
}

interface ImportMetaEnv {
  // Feature flags (all optional, override defaults in src/config/features.ts)
  readonly FEATURE_GLOBAL_WEDDING_SITE_ENABLED?: string;
  readonly FEATURE_GLOBAL_NOTION_BACKEND?: string;
  readonly FEATURE_GLOBAL_I18N?: string;
  readonly FEATURE_GLOBAL_CONTENT_LABELS_REMOVED?: string;
  readonly FEATURE_HOMEPAGE_TEASER?: string;
  readonly FEATURE_NYC_DETAILS_PAGE_CONSOLIDATED?: string;
  readonly FEATURE_NYC_SCHEDULE_PAGE?: string;
  readonly FEATURE_NYC_OPTIONAL_EVENTS?: string;
  readonly FEATURE_NYC_CALENDAR_SUBSCRIBE?: string;
  readonly FEATURE_NYC_MAP_EMBEDS?: string;
  readonly FEATURE_NYC_TRAVEL_BUS?: string;
  readonly FEATURE_NYC_TRAVEL_MTA?: string;
  readonly FEATURE_NYC_TRAVEL_MUSEUMS?: string;
  readonly FEATURE_FRANCE_CALENDAR_SUBSCRIBE?: string;
  readonly FEATURE_FRANCE_OPTIONAL_EXCURSIONS?: string;
  readonly FEATURE_FRANCE_TRAVEL_RESTRUCTURED?: string;
  readonly FEATURE_FRANCE_ACCOMMODATION_REQUEST?: string;
  readonly FEATURE_FRANCE_EU_ALLERGENS?: string;
  readonly FEATURE_FRANCE_LOCATION_MAP?: string;
  readonly FEATURE_NYC_RSVP_ENABLED?: string;
  readonly FEATURE_FRANCE_RSVP_ENABLED?: string;
  readonly FEATURE_REGISTRY_ENABLED?: string;
  readonly FEATURE_GLOBAL_EMAIL_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
