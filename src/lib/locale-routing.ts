/**
 * Default locale rules.
 *
 * Guests whose Notion Guest List `Country` is FRANCE or CANADA default to the
 * French site on login; everyone else (USA, UNITED KINGDOM, or no country on
 * file) defaults to English. This is only ever a *default* — an explicit
 * `?lang=` selection or an existing `sargaux_lang` cookie always wins.
 */

import type { Lang } from '../content/strings';

const FRENCH_DEFAULT_COUNTRIES = new Set(['FRANCE', 'CANADA']);

export function getDefaultLocale(country: string | null | undefined): Lang {
  return country && FRENCH_DEFAULT_COUNTRIES.has(country) ? 'fr' : 'en';
}
