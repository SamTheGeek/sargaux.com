# Feature Flags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement build-time feature flags with environment variable overrides, ensuring the live site remains unchanged until flags are explicitly enabled.

**Architecture:** Config file (`src/config/features.ts`) defines defaults, env vars override at build time. Helper functions for clean usage in pages. Middleware handles master switch. All new features default to OFF.

**Tech Stack:** Astro 5.x, TypeScript

**IMPORTANT:** After implementation, the live site must appear UNCHANGED. All tests must pass.

---

## Task 1: Create Feature Flags Config File

**Files:**
- Create: `src/config/features.ts`

**Step 1: Create the config directory**

```bash
mkdir -p src/config
```

**Step 2: Create features.ts with defaults and env override logic**

```typescript
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
```

**Step 3: Verify TypeScript compiles**

```bash
npx astro check
```

Expected: No errors related to features.ts

**Step 4: Commit**

```bash
git add src/config/features.ts
git commit -m "feat: add feature flags config with env override support"
```

---

## Task 2: Update Middleware for Master Switch

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Read current middleware**

Understand existing auth protection logic.

**Step 2: Add master switch check at the start**

Add import and check before auth logic:

```typescript
import { defineMiddleware } from 'astro:middleware';
import { getAuthenticatedGuest } from './lib/auth';
import { isSiteEnabled } from './config/features';

const PROTECTED_ROUTES = ['/nyc', '/france', '/registry'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Master switch: if site not enabled, only allow homepage
  if (!isSiteEnabled()) {
    // Allow homepage and static assets
    if (pathname === '/' || pathname.startsWith('/_') || pathname.includes('.')) {
      return next();
    }
    // Redirect everything else to homepage (temporary redirect)
    return context.redirect('/', 302);
  }

  // ... existing auth logic unchanged ...
});
```

**Step 3: Verify site still works**

```bash
npm run dev
```

Visit http://localhost:1213/ - should show current homepage
Visit http://localhost:1213/nyc - should redirect to homepage (site not enabled)

**Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add master switch check to middleware"
```

---

## Task 3: Update Homepage for Master Switch

**Files:**
- Modify: `src/pages/index.astro`

**Step 1: Read current homepage**

Understand current structure and what should show when site is disabled vs enabled.

**Step 2: Add conditional rendering based on weddingSiteEnabled**

The homepage should show:
- **When OFF:** Simple placeholder (current main branch behavior)
- **When ON:** Full hero, login modal, teaser (current feature branch)

Wrap the full wedding site homepage in a conditional:

```astro
---
import WireframeLayout from '../layouts/WireframeLayout.astro';
import ImagePlaceholder from '../components/ImagePlaceholder.astro';
import { getAuthenticatedGuest } from '../lib/auth';
import { isSiteEnabled, isEnabled } from '../config/features';

// If site enabled and already logged in, redirect to NYC
if (isSiteEnabled()) {
  const guest = getAuthenticatedGuest(Astro.cookies);
  if (guest) {
    return Astro.redirect('/nyc');
  }
}
---

{isSiteEnabled() ? (
  <!-- Full wedding site homepage -->
  <WireframeLayout title="Homepage">
    <!-- ... existing full homepage content ... -->
  </WireframeLayout>
) : (
  <!-- Placeholder homepage when site not enabled -->
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Chez Sargaux</title>
      <style>
        body {
          font-family: system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #fafafa;
          color: #1a1a1a;
        }
        h1 {
          font-size: 2.5rem;
          font-weight: 300;
          letter-spacing: 0.1em;
          margin-bottom: 0.5rem;
        }
        p {
          color: #666;
        }
        footer {
          position: absolute;
          bottom: 2rem;
          font-size: 0.875rem;
          color: #888;
        }
      </style>
    </head>
    <body>
      <h1>Chez Sargaux</h1>
      <p>Coming soon</p>
      <footer>&copy; 2026 Sam Gross</footer>
    </body>
  </html>
)}
```

**Step 3: Test both states**

With `FEATURE_GLOBAL_WEDDING_SITE_ENABLED=false` (default):
- Homepage shows "Coming soon" placeholder

With `FEATURE_GLOBAL_WEDDING_SITE_ENABLED=true`:
- Homepage shows full wedding site with login

**Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: homepage conditional render based on master switch"
```

---

## Task 4: Add Section-Level Flag Usage Example

**Files:**
- Modify: `src/pages/index.astro`

**Step 1: Wrap teaser section in feature flag check**

In the full homepage section, wrap the teaser:

```astro
{isEnabled('homepage.teaser') && (
  <section class="teaser">
    <div class="teaser-content">
      <p class="teaser-text">Lorem ipsum dolor sit amet...</p>
    </div>
  </section>
)}
```

**Step 2: Verify teaser doesn't show (flag is off by default)**

```bash
npm run dev
```

Set `FEATURE_GLOBAL_WEDDING_SITE_ENABLED=true` temporarily to test.
Teaser should NOT appear (homepage.teaser defaults to false).

**Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: wrap homepage teaser in feature flag"
```

---

## Task 5: Update README with Feature Flags Documentation

**Files:**
- Modify: `README.md`

**Step 1: Read current README**

Find appropriate section to add feature flags documentation.

**Step 2: Add Feature Flags section**

Add after the Development section:

```markdown
## Feature Flags

This site uses build-time feature flags to control which features are active.

### How It Works

1. **Defaults** are set in `src/config/features.ts`
2. **Environment variables** can override defaults (format: `FEATURE_PATH_TO_FLAG=true|false`)
3. Changes require a **rebuild** to take effect

### Toggling Flags in Netlify

**To change a flag:**

1. Go to [Netlify Dashboard](https://app.netlify.com) → Site → Site settings → Environment variables
2. Add or edit the variable (e.g., `FEATURE_GLOBAL_WEDDING_SITE_ENABLED=true`)
3. Trigger a redeploy: Deploys → Trigger deploy → Deploy site

**Preview deploys** (PRs) can have different flags via `netlify.toml`:

```toml
[context.deploy-preview.environment]
  FEATURE_GLOBAL_WEDDING_SITE_ENABLED = "true"
```

### Available Flags

See `src/config/features.ts` for the complete list and current defaults.

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_GLOBAL_WEDDING_SITE_ENABLED` | `false` | Master switch for full wedding site |
| `FEATURE_GLOBAL_I18N` | `false` | French translation support |
| `FEATURE_HOMEPAGE_TEASER` | `false` | Homepage teaser section |
| ... | ... | See config file for full list |
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add feature flags documentation to README"
```

---

## Task 6: Add netlify.toml for Preview Deploy Overrides

**Files:**
- Create: `netlify.toml`

**Step 1: Create netlify.toml with preview environment**

```toml
# Netlify configuration
# https://docs.netlify.com/configure-builds/file-based-configuration/

[build]
  command = "npm run build"
  publish = "dist"

# Preview deploys (PRs) enable the full wedding site for testing
[context.deploy-preview.environment]
  FEATURE_GLOBAL_WEDDING_SITE_ENABLED = "true"

# Production keeps defaults from src/config/features.ts
# Override specific flags in Netlify Dashboard when ready to launch
```

**Step 2: Commit**

```bash
git add netlify.toml
git commit -m "feat: add netlify.toml with preview deploy feature flags"
```

---

## Task 7: Declare Environment Variables for TypeScript

**Files:**
- Modify: `src/env.d.ts`

**Step 1: Add env var type declarations**

Add interface for feature flag env vars:

```typescript
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    guest?: string;
  }
}

interface ImportMetaEnv {
  // Feature flags (all optional, override defaults in src/config/features.ts)
  readonly FEATURE_GLOBAL_WEDDING_SITE_ENABLED?: string;
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
  readonly FEATURE_REGISTRY_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Step 2: Commit**

```bash
git add src/env.d.ts
git commit -m "feat: add TypeScript declarations for feature flag env vars"
```

---

## Task 8: Build and Test Verification

**Step 1: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests pass. The site should behave exactly as before (master switch is off).

**Step 3: Test with master switch ON**

```bash
FEATURE_GLOBAL_WEDDING_SITE_ENABLED=true npm run build
npm run preview
```

Visit http://localhost:1213/ - should show full wedding site.

**Step 4: Test with master switch OFF (default)**

```bash
npm run build
npm run preview
```

Visit http://localhost:1213/ - should show "Coming soon" placeholder.

**Step 5: Fix any issues and commit if needed**

```bash
git add -A
git commit -m "fix: address any issues from feature flag testing"
```

---

## Summary

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create features.ts config | `feat: add feature flags config` |
| 2 | Update middleware for master switch | `feat: add master switch to middleware` |
| 3 | Update homepage conditional render | `feat: homepage conditional render` |
| 4 | Add section-level flag example | `feat: wrap teaser in flag` |
| 5 | Update README documentation | `docs: add feature flags to README` |
| 6 | Create netlify.toml | `feat: add netlify.toml` |
| 7 | Add TypeScript env declarations | `feat: add env var types` |
| 8 | Build and test verification | (fix commit if needed) |

**Total: 8 tasks, 7-8 commits**

**After completion:** The live site remains unchanged. Preview deploys show the full wedding site. Ready to proceed with wireframe updates plan.
