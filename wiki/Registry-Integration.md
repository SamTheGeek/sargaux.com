# Registry Integration

## Joy registry (`src/lib/joy.ts` + `src/pages/registry.astro`)

`/registry` renders the couple's [withjoy.com](https://withjoy.com) registry natively by querying Joy's **unofficial** GraphQL endpoint (`https://withjoy.com/graphql`, `registryItemsByEventId`) server-side, with a 15-minute in-memory cache.

- `JOY_EVENT_ID` / `JOY_EVENT_HANDLE` are runtime env vars (`.env.local` + Netlify Dashboard). When unset, or when Joy is unreachable, the page falls back to a link-out card — the fetch must never throw.
- Joy models group-gifted physical items as `donationFund` entries with `fundType: "gift"` (real price, normal item-count semantics). Only `fundType: "cash"` entries belong in the Funds section.
- **Per-item deep links**: `https://withjoy.com/{handle}/registry?pid={registryItemId}` (`joyItemUrl()`) opens that item's detail/buy modal directly on Joy — always link cards to their specific item, not the registry root.
- Cash-fund `stillNeeded`/`totalRequested` are in **cents of the goal**, not item counts.

## Custom CSS theming

`joy-theme.css` (in `docs/joy-custom-css/` — kept as a real file in the repo, not just documented here, since it needs to be pasted somewhere external) restyles the public Joy registry page to match sargaux.com's NYC/default light theme (warm cream, dark moss, burnt amber, Helvetica Now Display headings).

- **How to apply**: paste the full contents of `joy-theme.css` into Joy's designer custom-CSS field (the unofficial "under the hood" option in Joy's website designer).
- **Unofficial and unsupported** — a Joy product update can break these styles at any time without notice.
- **The pasted copy in Joy is the live source of truth.** If styles are tweaked directly in Joy's field, copy the result back into `joy-theme.css` — the repo copy is the recovery point if Joy ever clears the field.
- **Selectors use stable class prefixes.** Joy's styled-components class names end in hashes that change between deploys; prefixes (e.g. `ProductTilestyles__StyledProductTile`) are stable, so every selector uses `[class*="..."]`. If a section loses styling after a Joy update, re-inspect the page and update the prefix.
- **Fonts depend on a CORS header.** The `@font-face` rules load Helvetica Now Display from `https://sargaux.com/fonts/...`, which requires the `Access-Control-Allow-Origin: *` header configured for `/fonts/*` in `netlify.toml`. If Joy's field ever sanitizes `@font-face`/external `url()`, delete that block and keep the color/spacing overrides — fonts fall back to Helvetica/Arial.
- **Iteration loop**: hover states, the item detail modal, the cart drawer, and checkout surfaces aren't styled yet — they need live inspection while interacting with the page. After pasting: reload the Joy registry, screenshot, compare against sargaux.com, refine, and sync the result back into `joy-theme.css`.

## Registry split by country

`src/lib/registry-routing.ts` routes the registry destination by the Guest List `Country` select:

- `FRANCE`/`UNITED KINGDOM` guests → the external MilleMercisMariage registry (`FRENCH_REGISTRY_URL`, opens in a new tab; the strip-row arrow rotates to ↗ on hover via the `--external` modifier class).
- Everyone else (`USA`, `CANADA`, unset) → the native Joy `/registry` page above.

All registry links must go through `getRegistryLink(Astro.locals.country)` — never hardcode `href="/registry"`. Middleware 302-redirects French-side guests who hit `/registry` directly. `country` flows Notion → `GuestRecord` → `Astro.locals.country` (a live middleware lookup, with a session-cookie fallback like `eventInvitations`).

MilleMercis has **no API** — it's server-rendered jQuery HTML with only a contribution POST endpoint — so it is always a link-out, never rendered natively.

## Origin

The original product spec left the French-guest registry question open ("different registry service? currency considerations?"). Joy (native, themed) for US/Canada plus MilleMercis (link-out) for France/UK is the resolution that shipped.
