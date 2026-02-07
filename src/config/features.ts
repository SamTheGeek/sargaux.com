// src/config/features.ts

/**
 * Feature flags for build-time control of site features.
 *
 * Each flag reads a static import.meta.env reference so Vite can replace
 * it at build time. Set env vars in netlify.toml or the shell:
 *
 *   FEATURE_GLOBAL_WEDDING_SITE_ENABLED=true npm run dev
 *
 * Changes require a rebuild to take effect.
 */

/** Helper: env var to boolean. Vite may replace with string or boolean. */
function flag(value: string | boolean | undefined, fallback: boolean): boolean {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return fallback;
}

type FeatureFlags = {
  global: {
    weddingSiteEnabled: boolean;
    i18n: boolean;
    contentLabelsRemoved: boolean;
  };
  homepage: {
    teaser: boolean;
  };
  nyc: {
    detailsPageConsolidated: boolean;
    schedulePage: boolean;
    optionalEvents: boolean;
    calendarSubscribe: boolean;
    mapEmbeds: boolean;
    travelBus: boolean;
    travelMta: boolean;
    travelMuseums: boolean;
  };
  france: {
    calendarSubscribe: boolean;
    optionalExcursions: boolean;
    travelRestructured: boolean;
    accommodationRequest: boolean;
    euAllergens: boolean;
    locationMap: boolean;
  };
  registry: {
    enabled: boolean;
  };
};

// Each import.meta.env.* reference must be static so Vite replaces it at build time.
// Dynamic access like import.meta.env[key] does NOT work with Vite's static replacement.
const features: FeatureFlags = {
  global: {
    weddingSiteEnabled: flag(import.meta.env.FEATURE_GLOBAL_WEDDING_SITE_ENABLED, false) || import.meta.env.DEV,
    i18n: flag(import.meta.env.FEATURE_GLOBAL_I18N, false),
    contentLabelsRemoved: flag(import.meta.env.FEATURE_GLOBAL_CONTENT_LABELS_REMOVED, false),
  },
  homepage: {
    teaser: flag(import.meta.env.FEATURE_HOMEPAGE_TEASER, false),
  },
  nyc: {
    detailsPageConsolidated: flag(import.meta.env.FEATURE_NYC_DETAILS_PAGE_CONSOLIDATED, false),
    schedulePage: flag(import.meta.env.FEATURE_NYC_SCHEDULE_PAGE, true),
    optionalEvents: flag(import.meta.env.FEATURE_NYC_OPTIONAL_EVENTS, false),
    calendarSubscribe: flag(import.meta.env.FEATURE_NYC_CALENDAR_SUBSCRIBE, false),
    mapEmbeds: flag(import.meta.env.FEATURE_NYC_MAP_EMBEDS, false),
    travelBus: flag(import.meta.env.FEATURE_NYC_TRAVEL_BUS, false),
    travelMta: flag(import.meta.env.FEATURE_NYC_TRAVEL_MTA, false),
    travelMuseums: flag(import.meta.env.FEATURE_NYC_TRAVEL_MUSEUMS, false),
  },
  france: {
    calendarSubscribe: flag(import.meta.env.FEATURE_FRANCE_CALENDAR_SUBSCRIBE, false),
    optionalExcursions: flag(import.meta.env.FEATURE_FRANCE_OPTIONAL_EXCURSIONS, false),
    travelRestructured: flag(import.meta.env.FEATURE_FRANCE_TRAVEL_RESTRUCTURED, false),
    accommodationRequest: flag(import.meta.env.FEATURE_FRANCE_ACCOMMODATION_REQUEST, false),
    euAllergens: flag(import.meta.env.FEATURE_FRANCE_EU_ALLERGENS, false),
    locationMap: flag(import.meta.env.FEATURE_FRANCE_LOCATION_MAP, false),
  },
  registry: {
    enabled: flag(import.meta.env.FEATURE_REGISTRY_ENABLED, true),
  },
};

export { features };

/**
 * Check if a feature is enabled by dot-path
 * @example isEnabled('nyc.calendarSubscribe')
 */
export function isEnabled(path: string): boolean {
  const parts = path.split('.');
  if (parts.length !== 2) {
    console.warn(`Invalid feature path: ${path}`);
    return false;
  }
  // @ts-expect-error - dynamic path access
  const value = features[parts[0]]?.[parts[1]];
  return value === true;
}

/**
 * Check if the full wedding site is enabled
 */
export function isSiteEnabled(): boolean {
  return features.global.weddingSiteEnabled;
}
