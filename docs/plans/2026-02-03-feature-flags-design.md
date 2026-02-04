# Feature Flags System Design

**Purpose:** Build-time feature flags to control page and section visibility, allowing safe development of new features without affecting the live site.

**Key Principle:** All new features default to OFF. The current main branch behavior is preserved until flags are explicitly enabled.

---

## Configuration Structure

**File: `src/config/features.ts`**

```typescript
const defaultFeatures = {
  global: {
    weddingSiteEnabled: false,  // Master switch: placeholder vs full wedding site
    i18n: false,                // French translation + language switcher
    contentLabelsRemoved: false,// Remove wireframe annotations
  },
  homepage: {
    teaser: false,              // Teaser section with welcome text
  },
  nyc: {
    // Pages
    detailsPageConsolidated: false, // Combined schedule+details page
    schedulePage: true,             // Separate schedule page exists (true=keep, false=redirect)

    // Sections
    optionalEvents: false,      // Optional weekend events section
    calendarSubscribe: false,   // Prominent calendar subscribe
    mapEmbeds: false,           // Google Maps Static API embeds
    travelBus: false,           // "By Bus" section
    travelMta: false,           // MTA local transit section
    travelMuseums: false,       // Museums focus in "While you're here"
  },
  france: {
    // Sections
    calendarSubscribe: false,   // Prominent calendar subscribe
    optionalExcursions: false,  // Saturday daytime excursions
    travelRestructured: false,  // Two-part travel structure
    accommodationRequest: false,// Request framing + cost estimate
    euAllergens: false,         // EU allergen checkboxes
    locationMap: false,         // Village de Sully + Paris map
  },
  registry: {
    enabled: true,              // Registry page (placeholder for now)
  }
};
```

---

## Environment Variable Overrides

Environment variables override config defaults at build time.

**Format:**
```
FEATURE_<PATH>=true|false
```

Path uses underscores for nesting, uppercase:
```bash
FEATURE_GLOBAL_WEDDING_SITE_ENABLED=true
FEATURE_NYC_CALENDAR_SUBSCRIBE=true
FEATURE_FRANCE_EU_ALLERGENS=false
```

**Explicit OFF:** Setting `=false` explicitly disables a flag, even if the config default is `true`. Use this to test "off" behavior in preview deploys.

---

## Behavior When Flags Are Off

### Sections
- **Hide/remove:** Content simply doesn't render

### Pages
- **Temporary redirect (302):** Disabled pages redirect to their parent
  - `/nyc/schedule` → `/nyc` (when `schedulePage: false`)

### Master Switch (`weddingSiteEnabled: false`)
- Homepage shows placeholder (current main branch behavior)
- All other routes redirect to homepage with 302

---

## Usage in Code

### Helper Functions

```typescript
// src/config/features.ts
export function isEnabled(path: string): boolean {
  // e.g., isEnabled('nyc.calendarSubscribe')
}

export function isPageEnabled(page: string): boolean {
  // Checks weddingSiteEnabled + page-specific flag
}
```

### In Astro Pages

```astro
---
import { features, isEnabled } from '../config/features';

// Page-level: redirect if disabled
if (!isEnabled('nyc.schedulePage')) {
  return Astro.redirect('/nyc', 302);
}
---

<!-- Section-level: conditional render -->
{isEnabled('nyc.calendarSubscribe') && (
  <section class="calendar-subscribe">
    ...
  </section>
)}
```

### In Middleware

```typescript
// src/middleware.ts
import { features } from './config/features';

if (!features.global.weddingSiteEnabled) {
  // Only allow homepage, redirect everything else
  if (pathname !== '/') {
    return Response.redirect(new URL('/', request.url), 302);
  }
}
```

---

## Netlify Configuration

### Preview Deploys (PRs)

In `netlify.toml`, set context-specific env vars to enable features in previews:

```toml
[context.deploy-preview.environment]
  FEATURE_GLOBAL_WEDDING_SITE_ENABLED = "true"
  FEATURE_NYC_CALENDAR_SUBSCRIBE = "true"
```

**Note for development:** When implementing new features, consider which flags should be enabled in preview deploys. Update `netlify.toml` accordingly when creating PRs.

### Testing "Off" Behavior

To verify disabled behavior works correctly:
1. Set explicit `FEATURE_X=false` in Netlify UI for a specific deploy
2. Or create a test branch with overrides in `netlify.toml`

---

## README Documentation

Add to README.md:

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
2. Add or edit the variable:
   - Name: `FEATURE_GLOBAL_WEDDING_SITE_ENABLED` (example)
   - Value: `true` or `false`
3. Trigger a redeploy:
   - Go to Deploys → Trigger deploy → Deploy site
   - Or push any commit to trigger automatic rebuild

**Preview deploys** (PRs) can have different flags via `netlify.toml`:

[context.deploy-preview.environment]
  FEATURE_GLOBAL_WEDDING_SITE_ENABLED = "true"

### Available Flags

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_GLOBAL_WEDDING_SITE_ENABLED` | `false` | Master switch for full wedding site |
| `FEATURE_GLOBAL_I18N` | `false` | French translation support |
| `FEATURE_GLOBAL_CONTENT_LABELS_REMOVED` | `false` | Remove wireframe annotations |
| `FEATURE_HOMEPAGE_TEASER` | `false` | Homepage teaser section |
| `FEATURE_NYC_DETAILS_PAGE_CONSOLIDATED` | `false` | Combined schedule+details |
| `FEATURE_NYC_SCHEDULE_PAGE` | `true` | Separate schedule page |
| `FEATURE_NYC_OPTIONAL_EVENTS` | `false` | Optional weekend events |
| `FEATURE_NYC_CALENDAR_SUBSCRIBE` | `false` | Prominent calendar subscribe |
| `FEATURE_NYC_MAP_EMBEDS` | `false` | Google Maps embeds |
| `FEATURE_NYC_TRAVEL_BUS` | `false` | "By Bus" travel section |
| `FEATURE_NYC_TRAVEL_MTA` | `false` | MTA transit section |
| `FEATURE_NYC_TRAVEL_MUSEUMS` | `false` | Museums in recommendations |
| `FEATURE_FRANCE_CALENDAR_SUBSCRIBE` | `false` | Prominent calendar subscribe |
| `FEATURE_FRANCE_OPTIONAL_EXCURSIONS` | `false` | Saturday excursions |
| `FEATURE_FRANCE_TRAVEL_RESTRUCTURED` | `false` | Two-part travel structure |
| `FEATURE_FRANCE_ACCOMMODATION_REQUEST` | `false` | Accommodation request framing |
| `FEATURE_FRANCE_EU_ALLERGENS` | `false` | EU allergen selection |
| `FEATURE_FRANCE_LOCATION_MAP` | `false` | Village de Sully + Paris map |
| `FEATURE_REGISTRY_ENABLED` | `true` | Registry page visible |

See `src/config/features.ts` for the complete list and current defaults.
```

---

## Implementation Notes

1. This feature flag system must be implemented BEFORE other wireframe updates
2. After implementation, the live site should appear UNCHANGED
3. All new development wraps features in flag checks
4. When ready to launch, flip `FEATURE_GLOBAL_WEDDING_SITE_ENABLED=true` in production
