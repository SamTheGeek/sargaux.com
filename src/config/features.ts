// src/config/features.ts

/**
 * Feature flags for build-time control of site features.
 *
 * Defaults are set here. Environment variables can override:
 *   FEATURE_GLOBAL_WEDDING_SITE_ENABLED=true
 *   FEATURE_NYC_CALENDAR_SUBSCRIBE=false
 *
 * Changes require a rebuild to take effect.
 */

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

const defaultFeatures: FeatureFlags = {
  global: {
    weddingSiteEnabled: false,
    i18n: false,
    contentLabelsRemoved: false,
  },
  homepage: {
    teaser: false,
  },
  nyc: {
    detailsPageConsolidated: false,
    schedulePage: true,
    optionalEvents: false,
    calendarSubscribe: false,
    mapEmbeds: false,
    travelBus: false,
    travelMta: false,
    travelMuseums: false,
  },
  france: {
    calendarSubscribe: false,
    optionalExcursions: false,
    travelRestructured: false,
    accommodationRequest: false,
    euAllergens: false,
    locationMap: false,
  },
  registry: {
    enabled: true,
  },
};

/**
 * Convert a dot-path like "nyc.calendarSubscribe" to env var name
 * "FEATURE_NYC_CALENDAR_SUBSCRIBE"
 */
function pathToEnvKey(path: string): string {
  return 'FEATURE_' + path
    .replace(/\./g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase();
}

/**
 * Get environment variable override for a flag path
 */
function getEnvOverride(path: string): boolean | undefined {
  const envKey = pathToEnvKey(path);
  const value = import.meta.env[envKey];
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Apply environment variable overrides to default features
 */
function applyOverrides(defaults: FeatureFlags): FeatureFlags {
  const result = deepClone(defaults);

  // Iterate through all paths and check for overrides
  const paths = [
    'global.weddingSiteEnabled',
    'global.i18n',
    'global.contentLabelsRemoved',
    'homepage.teaser',
    'nyc.detailsPageConsolidated',
    'nyc.schedulePage',
    'nyc.optionalEvents',
    'nyc.calendarSubscribe',
    'nyc.mapEmbeds',
    'nyc.travelBus',
    'nyc.travelMta',
    'nyc.travelMuseums',
    'france.calendarSubscribe',
    'france.optionalExcursions',
    'france.travelRestructured',
    'france.accommodationRequest',
    'france.euAllergens',
    'france.locationMap',
    'registry.enabled',
  ];

  for (const path of paths) {
    const override = getEnvOverride(path);
    if (override !== undefined) {
      const parts = path.split('.');
      // @ts-expect-error - dynamic path access
      result[parts[0]][parts[1]] = override;
    }
  }

  return result;
}

/**
 * The resolved feature flags (defaults + env overrides)
 */
export const features = applyOverrides(defaultFeatures);

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
