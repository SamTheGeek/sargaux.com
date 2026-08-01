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

/**
 * Best-guess locale from the browser's `Accept-Language` header, for visitors
 * we know nothing else about — i.e. before they log in, when there is no Notion
 * `Country` and no `sargaux_lang` cookie yet.
 *
 * Returns 'fr' only when French genuinely outranks English in the header, so a
 * `fr-FR,fr;q=0.9,en-US;q=0.8` browser gets French while `en-US,en;q=0.9,fr;q=0.8`
 * stays English. Anything unparseable, absent, or with no opinion falls back to
 * 'en' — this only ever *upgrades* a guess we were making blindly before.
 *
 * Only the primary subtag is compared, so `fr-CA` and `fr-CH` count as French.
 * A wildcard `*` expresses no preference and is ignored rather than treated as
 * a match for either language.
 */
export function detectLocaleFromAcceptLanguage(header: string | null | undefined): Lang {
  if (!header) return 'en';

  // Highest quality seen per language. Absent `q` means 1.0 (RFC 9110).
  const best: Record<Lang, number> = { en: 0, fr: 0 };

  for (const part of header.split(',')) {
    const [tagPart, ...params] = part.trim().split(';');
    const tag = tagPart?.trim().toLowerCase();
    if (!tag || tag === '*') continue;

    const primary = tag.split('-')[0];
    if (primary !== 'en' && primary !== 'fr') continue;

    const qParam = params.find((p) => p.trim().startsWith('q='));
    const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
    // A malformed q is not a reason to drop an otherwise valid tag, but q=0
    // explicitly means "not acceptable" and must not win.
    const quality = Number.isFinite(q) ? q : 1;
    if (quality <= 0) continue;

    if (quality > best[primary]) best[primary] = quality;
  }

  return best.fr > best.en ? 'fr' : 'en';
}
