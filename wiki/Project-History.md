# Project History

A chronological index of every design/implementation plan that shaped the site. Most of this content was folded into the topic pages linked from [Home](Home) — this page exists so nothing from the original `docs/plans/` history feels lost. Each entry links to the page(s) that absorbed its content.

For a version-by-version, PR-by-PR history (what actually shipped in each release), see the repo's [`CHANGELOG.md`](https://github.com/SamTheGeek/sargaux.com/blob/main/CHANGELOG.md) instead — this page covers design rationale and planning documents, the changelog covers shipped changes.

| Date | Plan | Absorbed into |
|---|---|---|
| 2026-02-03 | Architecture Design — URL structure, Astro/Notion/Netlify stack decisions | [Architecture Overview](Architecture-Overview) |
| 2026-02-03 | Feature Flags System Design | [Feature Flags](Feature-Flags) |
| 2026-02-03 | Feature Flags Implementation Plan — config file, middleware master switch, env overrides, square-favicon task | [Feature Flags](Feature-Flags) |
| 2026-02-03 | M1 Foundation Implementation Plan — homepage, static auth, Netlify adapter, base layout, initial Notion wiring | [Architecture Overview](Architecture-Overview), [Authentication & Sessions](Authentication-And-Sessions) |
| 2026-02-03 | Wireframe Updates — applied wireframe-review decisions across global cleanup, homepage, NYC, and France sub-pages | [Brand & Design](Brand-And-Design) |
| 2026-02-06 | Notion Integration Plan — hardcoded list → Notion-backed auth/RSVP, Event Catalog, event-level invitations, four-phase rollout | [Notion Backend](Notion-Backend) |
| 2026-02-15 | Design Sprint Plan — collaborative Phase 0 discovery conversation, then CSS tokens, dark mode, full redesign | [Brand & Design](Brand-And-Design) |
| 2026-02-20 | Calendar Subscriptions Design (F-004) — HMAC token scheme, ICS architecture (stage 1: live Notion query) | [RSVP & Calendar](RSVP-And-Calendar) |
| 2026-02-20 | Calendar Subscriptions Implementation | [RSVP & Calendar](RSVP-And-Calendar) |
| 2026-02-24 | Copy-Edit Sprint + i18n Refactor — centralized `strings.ts`, then a live EN/FR copy review | [Localization (i18n)](Localization-i18n) |
| 2026-02-25 | Flight Collection Design (F-013) — Guest Flights database, Flighty/Mac Mini sync architecture | [Flight Collection](Flight-Collection) |
| 2026-02-25 | Flight Collection Implementation | [Flight Collection](Flight-Collection) |
| 2026-05-11 | Calendar Refactor — replaced live Notion queries with pre-generated Netlify Blobs ICS files (stage 2, fixed iOS subscription drops) | [RSVP & Calendar](RSVP-And-Calendar) |
| 2026-07-04 | Astro 7 Upgrade — CDN caching adoption, Notion perf/caching pass, RSVP loading indicators, a compiler regression fix | [Architecture Overview](Architecture-Overview), [Notion Backend](Notion-Backend) |
| (undated) | Wireframe Review Session — interactive page-by-page walkthrough that preceded the visual redesign | [Brand & Design](Brand-And-Design) |

For endpoint-level and threat-model history, see the [July 2026 security audit](Guest-Privacy-And-Security).
