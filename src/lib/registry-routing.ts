/**
 * Registry destination rules.
 *
 * Guests coming from the French side of the Atlantic (Country = FRANCE or
 * UNITED KINGDOM in the Notion Guest List) use the couple's MilleMercisMariage
 * registry, which opens externally in a new tab. Everyone else (USA, CANADA,
 * or no country on file) uses the native Joy-backed /registry page.
 *
 * MilleMercis has no read API (server-rendered HTML only), so the French
 * registry is always a link-out — never rendered natively like Joy.
 *
 * This governs *links*, not access: /registry itself is never redirected. A
 * French-side guest who types or bookmarks the URL is asking for the Joy page
 * on purpose (nothing in the UI points them there), so they get it.
 */

export const FRENCH_REGISTRY_URL =
  'https://www.millemercismariage.com/sargaux/liste.html';

export type RegistryDestination = 'joy' | 'millemercis';

export function getRegistryDestination(
  country: string | null | undefined
): RegistryDestination {
  return country === 'FRANCE' || country === 'UNITED KINGDOM'
    ? 'millemercis'
    : 'joy';
}

/**
 * Resolve the registry link for a guest: the native /registry page, or the
 * external MilleMercis registry (render with target="_blank" rel="noopener"
 * when `external` is true).
 */
export function getRegistryLink(country: string | null | undefined): {
  href: string;
  external: boolean;
} {
  const external = getRegistryDestination(country) === 'millemercis';
  return { href: external ? FRENCH_REGISTRY_URL : '/registry', external };
}
