# sargaux.com

Wedding website for Sam & Margaux

## Tech Stack

[![Netlify Status](https://api.netlify.com/api/v1/badges/03408f0d-5152-46f6-bade-bd6a69486657/deploy-status)](https://app.netlify.com/projects/sargaux/deploys)

- **Framework**: [Astro](https://astro.build/) v5.16.8
- **Language**: TypeScript (strict mode)
- **Node.js**: v24.12.0 (current)
- **Package Manager**: npm v11.6.2

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test
```

The dev server runs at `http://localhost:1213`.

### Local Notion/RSVP Environment

Put local environment variables in:

- `.env.local`

For dynamic RSVP pages and Notion-backed flows in local dev:

```bash
./scripts/setup-local-env.sh
```

This writes `.env.local` with the required values:

- `NOTION_API_KEY`
- `NOTION_GUEST_LIST_DB`
- `NOTION_EVENT_CATALOG_DB`
- `NOTION_RSVP_RESPONSES_DB`
- RSVP/Notion feature flags set to `true` for local usage

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
| ------ | --------- | ------------- |
| `FEATURE_GLOBAL_WEDDING_SITE_ENABLED` | `false` | Master switch for full wedding site |
| `FEATURE_GLOBAL_I18N` | `false` | French translation support |
| `FEATURE_HOMEPAGE_TEASER` | `false` | Homepage teaser section |
| ... | ... | See config file for full list |

## Testing

Automated tests run on every PR:

- **Accessibility Tests**: WCAG 2.0/2.1 AA compliance, semantic HTML, keyboard navigation
- **Performance Tests**: Core Web Vitals (LCP, FCP, CLS), page load times, resource optimization

Both test suites run in parallel for faster feedback.

## License

The website source code (HTML, CSS, JavaScript) is licensed under
**Creative Commons Attribution–NonCommercial 4.0 (CC BY-NC 4.0)**.

- ✅ You may reuse and adapt the code for non-commercial purposes
- ✅ Attribution is required
- ❌ Commercial use is not permitted

**Website text, photos, and media are not licensed**
and remain © Sam Gross.
