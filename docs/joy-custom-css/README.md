# Joy registry custom CSS

`joy-theme.css` restyles the public Joy registry page
([withjoy.com/sargaux/registry](https://withjoy.com/sargaux/registry)) to match
the sargaux.com NYC/default light theme (warm cream, dark moss, burnt amber,
Helvetica Now Display headings).

## How to apply

Paste the full contents of `joy-theme.css` into Joy's designer custom-CSS
field (the unofficial "under the hood" option in the Joy website designer).

## Caveats

- **Unofficial and unsupported.** Joy does not officially support custom CSS;
  a Joy product update can break these styles at any time without notice.
- **The pasted copy in Joy is the live source of truth.** If you tweak styles
  directly in Joy's field, copy the result back into this file — this repo
  copy is the recovery point if Joy ever clears the field.
- **Selectors use stable class prefixes.** Joy's styled-components class names
  end in hashes that change between deploys; the prefixes (e.g.
  `ProductTilestyles__StyledProductTile`) are stable, so every selector uses
  `[class*="..."]`. If a section loses its styling after a Joy update,
  re-inspect the page and update the prefix.
- **Fonts depend on a CORS header.** The `@font-face` rules load Helvetica Now
  Display from `https://sargaux.com/fonts/...`, which requires the
  `Access-Control-Allow-Origin: *` header configured for `/fonts/*` in
  `netlify.toml`. If Joy's field sanitizes `@font-face` or external `url()`,
  delete that block and keep the color/spacing overrides — the font stacks
  fall back to Helvetica/Arial.

## Iteration loop

Hover states, the item detail modal, the cart drawer, and checkout surfaces
are not yet styled — they need live inspection while interacting with the
page. After pasting: reload the Joy registry, screenshot, compare against
sargaux.com, refine, and sync the result back here.
