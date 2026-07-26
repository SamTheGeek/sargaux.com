# Localization (i18n)

French support is controlled by the `global.i18n` feature flag (see [Feature Flags](Feature-Flags)).

## Event display strings

`src/lib/event-i18n.ts`: the Event Catalog carries optional French **display** properties — `Event Name FR`, `Time FR`, `Location FR`, `Description FR`. All event display goes through `localizeEvent(event, lang)`, which falls back per-field to English, so a partially translated event always renders something sensible.

Timing is deliberately language-neutral: there are **no** FR variants of `Start Time`/`Duration`/`Event Date`, and calendar `DTSTART`/`DTEND` always come from the canonical (English-keyed) fields — see [RSVP & Calendar](RSVP-And-Calendar). `getEventCatalog` sorts events by `Event Date` then parsed `Start Time`.

## Locale routing

`getDefaultLocale(guest.country)` (`src/lib/locale-routing.ts`) maps a guest's Notion `Country` to a default locale — `FRANCE`/`CANADA` → `fr`, otherwise `en`. This same rule:

- Seeds the login `sargaux_lang` cookie.
- Determines the language personalized ICS calendars are generated in.

## Brand copy rules for both languages

From the brand identity guide (see [Brand & Design](Brand-And-Design)): English uses spaced uppercase meridiems (`5:30 PM`, `9:00 AM`); French uses 24-hour format with `h` (`17h30`, `09h00`). Avoid poetic metaphors, "happily ever after"/"to follow"/ceremony language, and exclamation marks in either language.

## Original i18n refactor plan (Feb 2026)

The refactor that introduced this system centralized all user-visible copy into `src/content/strings.ts` (EN + FR variants keyed by page/component) with a thin `t(key, lang)` helper in `src/lib/i18n.ts`, driven by `Astro.locals.lang`. It was deliberately sequenced before a live copy-edit sprint with Sam and Margaux, so that sprint had one file to work in via Astro's HMR (edit a string, save, watch the page update) rather than editing scattered `.astro` templates. Both EN and FR needed review before a version bump; font/visual changes were explicitly out of scope for this pass (that was the parallel [design sprint](Brand-And-Design)).
