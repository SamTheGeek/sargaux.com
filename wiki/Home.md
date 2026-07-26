# sargaux.com — Project Wiki

This is the wedding website for **Sam Gross** and **Margaux Ancel**, built with [Astro](https://astro.build/) and hosted on Netlify. The site covers two separate events with distinct guest lists:

- **NYC Event** — October 11, 2026, Dinner + Dancing (New York City)
- **France Event** — May 28–30, 2027, a weekend at Village de Sully

The [repository](https://github.com/SamTheGeek/sargaux.com) is public — PRs from friends are welcome, and it doubles as a low-stakes place to experiment with agentic coding. See [Guest Privacy & Security](Guest-Privacy-And-Security) before touching anything that could expose a real guest's data.

This wiki is generated from the `wiki/` folder in the repo (see `.github/workflows/wiki-sync.yml`) — **edit the source files there, not these pages directly**; direct wiki edits are overwritten on the next sync.

## Start here

| If you want to understand... | Read |
|---|---|
| The overall stack and how the pieces fit together | [Architecture Overview](Architecture-Overview) |
| How guests log in and how sessions work | [Authentication & Sessions](Authentication-And-Sessions) |
| How the RSVP flow and calendar subscriptions work | [RSVP & Calendar](RSVP-And-Calendar) |
| How the Notion backend is modeled and cached | [Notion Backend](Notion-Backend) |
| How new features get shipped safely | [Feature Flags](Feature-Flags) |
| The privacy rules and security posture of a *public* wedding-site repo | [Guest Privacy & Security](Guest-Privacy-And-Security) |
| The admin/ops HTTP endpoints | [Admin Endpoints](Admin-Endpoints) |
| How the test suite and synthetic test guest work | [Testing Guide](Testing-Guide) |
| The view-transition/animation system and login UI | [View Transitions & UI](View-Transitions-And-UI) |
| French-language support | [Localization (i18n)](Localization-i18n) |
| The Joy registry integration and its custom CSS | [Registry Integration](Registry-Integration) |
| The visual brand system and how it was chosen | [Brand & Design](Brand-And-Design) |
| Guest flight tracking / Flighty sync | [Flight Collection](Flight-Collection) |
| What images the site needs and where they go | [Image Asset Guide](Image-Asset-Guide) |
| The original product spec (feature list, milestones) | [Feature Plan / Product Spec](Feature-Plan-Product-Spec) |
| A chronological index of every design/implementation plan | [Project History](Project-History) |
| The instructions coding agents (Claude Code, etc.) load automatically | [Agent Instructions](Agent-Instructions) |

## Quick facts

- **Framework**: Astro v7 (SSR, hybrid), TypeScript strict mode
- **Backend**: Notion (guest list, event catalog, RSVP responses), fetched at build time with targeted runtime lookups
- **Hosting**: Netlify, with `@astrojs/netlify` and CDN caching per-guest
- **Auth**: name-based login (no passwords), HMAC-signed session cookie
- **Email**: Resend (save-the-dates, RSVP confirmations)
- **Dev server**: `npm run dev` → `http://localhost:1213` (port 1213 = the engagement date, 12/13, and must never change)
- **License**: site source is CC BY-NC 4.0; text/photos/media are unlicensed and © Sam Gross

For day-to-day development commands (build, test, versioning, git workflow), see the repo's `CLAUDE.md` / `README.md` — those stay in the repo itself since coding agents load them automatically, but they link back into this wiki for deeper context.
