# Changelog

All notable changes to sargaux.com are recorded here, newest first. The format loosely follows [Keep a Changelog](https://keepachangelog.com/), and versioning follows the wedding-milestone scheme in `CLAUDE.md` (`0.x` pre-launch, `1.0` = NYC event launch, `2.0` = France event launch, patch on every merge). Entries below are reconstructed from the actual merge history on `main`, cross-referenced with each PR's own description — see [Project History](https://github.com/SamTheGeek/sargaux.com/wiki/Project-History) in the wiki for the deeper design rationale behind the larger changes.

Guest privacy note: entries here describe changes by shape, not by the guests who reported or reproduced them — see the wiki's [Guest Privacy & Security](https://github.com/SamTheGeek/sargaux.com/wiki/Guest-Privacy-And-Security) page.

## [1.2.2] - 2026-07-26

- Migrated `docs/` and every historical implementation plan into a topic-organized GitHub wiki (architecture, auth, RSVP/calendar, Notion backend, feature flags, security, testing, brand & design, and more), added a `wiki-sync` workflow to keep the real wiki in sync automatically, and added this changelog.

## [1.2.1] - 2026-07-26

- Fixed the bulk save-the-date/transactional email senders, which were silently failing for every recipient because the outgoing payload never carried a `to` address (#244).
- Added `astro check` as a CI-gated type-checking pass and fixed the ~99 pre-existing type errors it surfaced across the RSVP pages, the transitions script, and test fixtures; TypeScript is now explicitly pinned to the 6.x line.

## [1.2.0] - 2026-07-26

- Login now also accepts a guest's printed invitation-envelope name or any combination of a household's first names plus their surname, with an inline picker when a name resolves to more than one person (#238).

## [1.1.16] - 2026-07-26

- Fixed RSVP API test assertions to read the pre-fill response's actual (top-level) `eventsAttending` field instead of a path it never populated (#234, test-only).

## [1.1.15] - 2026-07-20

- Fixed RSVP submissions where a guest declined every event: the response is now correctly recorded (and written back to the Guest List) as a full decline instead of "Attending" with zero events (#230).

## [1.1.14] - 2026-07-18

- Replaced the RSVP form's per-event checkboxes with required Attending/Not-attending dropdowns, with a "Regretfully Decline" submit-button state when every event is declined (#229).

## [1.1.13] - 2026-07-17

- Fixed login and a redirect-loop bug for guest names containing an apostrophe: name normalization now treats every apostrophe/dash variant the same way, and a stale session that no longer matches its Notion record now self-heals instead of looping (#228).

## [1.1.12] - 2026-07-15

- Made the France details-page village photos full-bleed inside their cards, and renamed "Look Book" to "Lookbook" throughout the English copy (#227).

## [1.1.10] - 2026-07-15

- Nudged the France homepage's sun disc down on narrow screens so it clears the header (#226).

## [1.1.9] - 2026-07-14

- Fixed a view-transition z-index gap that made the header logo, event toggle, and RSVP button flicker out and back in during the NYC ↔ France switch; also added the cloud-session pre-installed-Chromium auto-detection for Playwright (#225).

## [1.1.8] - 2026-07-12

- Consolidated duplicated footer markup across 11 pages into a single reusable `SiteFooter` component (#219).

## [1.1.7] - 2026-07-11

- Security audit hardening: HMAC-signed session cookies, RSVP payload validation bound to the authenticated guest, rate limiting on login and sensitive endpoints, admin/ops endpoint lockdown, and security headers (#218).

## [1.1.5] - 2026-07-11

- Added new France venue photos, a feature flag for the "Staying at the Village" overview list, flattened the France travel page's gradient fills to solid colors, and added a second hardcoded dev-fallback login name (#217).

## [1.1.4] - 2026-07-10

- Guests logging in with a Notion `Country` of France or Canada now default to the French site instead of English (#216).

## [1.1.3] - 2026-07-10

- Split the registry destination by guest country: US/Canada guests keep the native Joy-backed `/registry`; France/UK guests are routed to the couple's MilleMercisMariage registry instead, which has no API and is always a link-out (#214).

## [1.1.2] - 2026-07-09

- Removed a registry footer link on NYC pages that had been left in place after registry links were otherwise removed site-wide (#215).

## [1.1.1] - 2026-07-09

- Fixed the French language switcher doing nothing on the live site — a custom `Netlify-Vary` header had stopped the CDN from varying its cache on the `?lang=` query string (#212).

## [1.1.0] - 2026-07-08

- Rebuilt `/registry` as a native page rendering the couple's Joy registry via its unofficial GraphQL API, with a graceful link-out fallback, and added a matching custom-CSS theme for the Joy-hosted page (#206).

## [1.0.1] - 2026-07-04

- Updated the RSVP form's required-email error message to also recommend an email address for every party member (#201).

## [1.0.0] - 2026-06-22

- Version bumped to mark the 1.0 milestone (NYC event launch numbering, per the versioning convention in `CLAUDE.md`), bundled with invitation-mailing CSV generation scripts (household grouping and envelope-address formatting) and a CSS/view-transitions script refactor (#157).

## [0.11.1] - 2026-06-08

- Routine dependency bump (Astro 6.4.2 → 6.4.4) — the earliest version bump reachable in the current git history.

## Earlier — Foundation (through mid-2026)

The site's foundational work — the initial Astro/Notion/Netlify architecture, static-password and then Notion-backed authentication, the feature-flags system, the M1 wireframes, the brand/design system and design sprint, the first Notion guest-data model and RSVP endpoints, and the first version of personalized calendar subscriptions — predates the git history reachable from `main` today (the earliest reachable commit is 2026-06-08; the repository was created 2026-01-12). That work is documented from its original design and implementation plans, dated between February and May 2026, in the wiki's [Project History](https://github.com/SamTheGeek/sargaux.com/wiki/Project-History) page rather than reconstructed here as version entries.

---

Future entries should be added to the top of this file as part of the same PR that bumps `package.json`'s version, per `CLAUDE.md`'s versioning rules.
