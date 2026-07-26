# Feature Flags

The site uses a **build-time** feature-flag system (`src/config/features.ts`) for gradual rollout and to protect production. Flags resolve at build time via Vite's static `import.meta.env` replacement, so changing a flag requires a rebuild. Each flag must be a **static** `import.meta.env.FEATURE_*` reference — dynamic access like `import.meta.env[key]` does not work.

## Design principle

All new features default to **OFF**. Current production behavior is preserved until a flag is explicitly enabled. This system predates most of the features documented elsewhere in this wiki — it's the mechanism nearly every later feature ([RSVP & Calendar](RSVP-And-Calendar), [Flight Collection](Flight-Collection), i18n) shipped behind.

## Master switch

`global.weddingSiteEnabled`:

- **Production (default `false`)**: only a minimal "Chez Sargaux" placeholder is shown; all other routes 302 to `/`.
- **Local dev (`npm run dev`)**: automatically enabled.
- **Netlify preview deploys**: automatically enabled via `netlify.toml`.

## Environment variable format

`FEATURE_{AREA}_{FLAG_NAME}`, e.g.:

- `global.weddingSiteEnabled` → `FEATURE_GLOBAL_WEDDING_SITE_ENABLED`
- `nyc.calendarSubscribe` → `FEATURE_NYC_CALENDAR_SUBSCRIBE`
- `france.euAllergens` → `FEATURE_FRANCE_EU_ALLERGENS`

Setting a flag to `=false` explicitly disables it even if the code default is `true` — useful for testing "off" behavior on a preview deploy.

## Behavior when a flag is off

- **Sections**: content simply doesn't render.
- **Pages**: a disabled page 302-redirects to its parent (e.g. `/nyc/schedule` → `/nyc` when `schedulePage` is off).
- **Master switch off**: homepage shows the placeholder; every other route 302s to `/`.

## Adding a new flag (4-step checklist)

1. Add to the `FeatureFlags` type definition in `src/config/features.ts`.
2. Add a static `import.meta.env.FEATURE_*` reference in the features object.
3. Add to the `ImportMetaEnv` interface in `src/env.d.ts`.
4. Add to `netlify.toml`'s `[context.deploy-preview.environment]` so preview deploys exercise it.

Every feature documented elsewhere in this wiki that shipped behind a flag followed this same checklist — see [RSVP & Calendar](RSVP-And-Calendar) and [Flight Collection](Flight-Collection) for examples.

## Key flags

See `src/config/features.ts` for the authoritative current list. Notable ones:

- `global.weddingSiteEnabled` — master switch for the entire site
- `global.notionBackend` — use the Notion Guest List for auth (requires `NOTION_API_KEY` + `NOTION_GUEST_LIST_DB`); falls back to a hardcoded list when off
- `global.i18n` — French language support (see [Localization (i18n)](Localization-i18n))
- `nyc.wytheRoomBlock` — visibility of the Wythe Hotel row on the NYC travel page
- `nyc.rsvpPreview` / `france.rsvpPreview` — renders RSVP forms with mock party data when no Notion `guestId` is present, for local/preview use without a Notion backend (**keep off in production**)
- `global.rsvpDeleteEnabled` — allows authenticated guests to `DELETE /api/rsvp` for test cleanup (**keep off in production**; on in Playwright and deploy-preview; an admin Bearer token can also authorize DELETE when the flag is off)
- `registry.enabled` — registry page visibility

## Original design intent

From the system's initial design doc: this was meant to let development proceed safely on `main` without a long-lived feature branch, with the explicit acceptance criterion that after the flags system itself shipped, "the live site should appear UNCHANGED" and preview deploys would show the full wedding site in progress. That property has held since.
