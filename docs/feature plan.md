---
title: "Website Build — Product Document"
owner: "Product"
repo: "sargaux.com"
path: "docs/feature plan.md"
date: 2026-02-03
status: draft
version: 0.1
tags: [website, product, requirements]
---


## Short summary

- Goal: Launch a wedding website for Sam Gross and Margaux Ancel. The wedding will be held in two parts, with separate invitation lists (and minimal overlap) for each. The first event will be in New York in October 2026 and the second event will be in France in May 2027.
- Primary audience: Wedding guests.
- Secondary audience: Family members and staff needing to check details.
- Wedding Dates: Tentative October 11, 2026 in NYC, confirmed May 28-30, 2027.

## First Event Details

- Dinner, followed by dancing.
- Date is tentatively set for Sunday October 11, 2026
- Holiday long weekend — Monday is Columbus Day
- Still might move to Saturday the 10th or a later weekend. Will keep updating.
- Dinner will be several hours of cocktail at a restaurant to be confirmed
- Dancing to follow at a secondary location, also to be confirmed.

## Second Event Details

- Weekend at Village De Sully
- Location: <https://maps.app.goo.gl/JHZfysCfNYZqmN4T9>
- URL: <https://www.groupeamadeus.com/le-village-de-sully>
- Dates: Friday, May 28 2027 - Sunday May 30 2027
- Guests may choose to stay at the village (€75 per night, breakfast included)
- Friday night welcome dinner
- Saturday breakfast for those staying
- Saturday afternoon ceremony
- Saturday afternoon cocktail hour
- Saturday night reception
- Sunday morning breakfast for those staying
- Sunday brunch
- Event details should be stored in the Notion workspace and statically saved whenever the website is built

## Scope

- In scope (MVP): Landing pages for each event, password protection for pages (hard code a password for Margaux and Sam and a separate one for each set of parents), Notion connection
- In Scope (Launch): Design (to be completed later), login experience (will be based on Notion Data),  email sending infrastructure, RSVP experience.

## Features (ID, title, brief)

- F-001: Homepage — hero, welcome information, log in CTA
- F-002: Two experiences, one for guests invited to each event. No evidence of the other event unless the guest is marked as invited to both (in this early stage, anyone logged in can be assumed as invited to both). Guests can switch between the two of them with a toggle in the upper right.
- F-003: Infrastructure to send emails using Resend (transactional email vendor). Set up SPF/DKIM on sargaux.com domain via Spaceship. Used for save-the-dates, reminders, and RSVP confirmations.
- F-004: Subscribe to a calendar on each wedding's page. This will be in ics format and will be generated from the events information. Example as a PNG, but make sure to include only events we have scheduled (create/update the first few in Notion, make sure to link them to the existing 'date' pages for NYC, Friday, Saturday, and Sunday)
- F-005: Login experience should, for now, use a static password (one for Sam, one for Margaux, and one for each set of parents). Eventually this will use guest names as the login information.
- F-006: Notion will serve as the backend for all of the guest data and also the events. We already have a workspace that needs to be connected and possibly updated to store the information.
- F-007: Cookie & Privacy Banner — consent management.
- F-008: No analytics and tracking anywhere in the site.
- F-009: Accessibility features — keyboard nav, ARIA, semantic HTML.
- F-010: Performance optimizations — critical CSS, image CDN if necessary, caching.
- F-011: The ability for guests to RSVP on the website with their RSVP updating the Notion guest database.
- F-012: Wedding registry page — single shared page accessible from both events at /registry. Content TBD (see open questions re: French guests).

## Acceptance criteria (per feature, testable)

- Write this for launch version. AI can suggest things to go here.

## Information Architecture (high-level)

### URL Structure (Event-centric)

```text
/                       # Homepage — hero, welcome, login CTA
/login                  # Login page (password entry)
/registry               # Shared wedding registry (accessible from both events)

/nyc/                   # NYC event landing page
/nyc/schedule           # NYC event schedule/timeline
/nyc/details            # NYC venue, dress code, etc.
/nyc/travel             # NYC travel & accommodation info
/nyc/rsvp               # NYC RSVP form
/nyc/calendar.ics       # NYC calendar subscription

/france/                # France event landing page
/france/schedule        # France weekend schedule (Fri-Sun)
/france/details         # Village De Sully info, accommodation options
/france/travel          # France travel & accommodation info
/france/rsvp            # France RSVP form
/france/calendar.ics    # France calendar subscription

/api/rsvp               # Server endpoint for RSVP submissions
```

### Event Toggle Behavior

- Toggle in header switches between NYC and France views
- Only visible to guests invited to both events
- Base implementation: standard navigation links
- Dream feature: pushState() for seamless URL updates without page reload

### Auth & Access Control

- Unauthenticated: Homepage only, all other routes redirect to /login
- Authenticated: Access to event(s) based on invitation status
- Cookie stores auth state (httpOnly, secure)
- localStorage stores preferences (last viewed event, toggle state)

## User flows (primary)

1. Visitor → Homepage → Login → See their event → RSVP.
2. Guest → No access → Sees login CTA
3. Visitor → Event → Subscribe to Calendar.

## Content strategy

- Headline-first writing; 2–3 key value points per page.
- Reusable component content (feature descriptions, CTAs).
- Structured metadata for social sharing (via iMessage).
- Placeholders for images that we can add, with guidance on where to put them.

## SEO & Structured Data

- This website should not be search optimized. Robots should discourage AI ingestion. All private content should be "behind the break"
- Sitemap.xml, robots.txt, canonical URLs.

## Accessibility

- WCAG 2.1 AA baseline.
- Keyboard-first testing, color-contrast >= 4.5:1 for body text.
- Screen-reader tested labels, skip links.

## Performance & Hosting

- Host: Static on Netlify as it exists now.
- Use image CDN, responsive images (srcset, AVIF/WebP fallbacks). Convert images on build/deploy if they do not match.
- Prefetch critical assets, lazy-load below-the-fold images.

## Tech stack (recommended)

- **Framework**: Astro v5.x with SSR hybrid mode (static pages + server endpoints)
- **Adapter**: @astrojs/netlify for server endpoints (RSVP writes, etc.)
- **Language**: TypeScript with strict mode
- **CSS**: Astro scoped styles (Tailwind optional, add when design work begins)
- **Backend**: Notion API — build-time fetch for content, runtime writes for RSVPs
- **Auth**: Cookie-based session + localStorage for preferences (with graceful fallback)
- **Email**: Resend (transactional email vendor, free tier covers expected volume)
- **Calendar**: ICS file generation from Notion events data
- **Hosting**: Netlify (static hosting + edge functions)
- **Testing**: Playwright for accessibility, performance, and best practices

## Security & Privacy

- HTTPS everywhere, HSTS
- CSP header configuration
- Minimal PII collection; privacy-first default for tracking
- Data retention & deletion process documented

## Integrations

- Auth: Wedding website auth (out of scope for now)
- CRM: Notion backend (please ask for help connecting if you need it. I've installed the plugin.)
- Observability: Sentry for frontend errors

## Milestones & timeline

- **M1 (February 2026)**: Basic site framework, Notion integration, authentication (F-001, F-005, F-006)
- **M2 (March 2026)**: Email infrastructure, save-the-date pages, calendar subscriptions (F-003, F-004)
- **M3 (April 2026)**: NYC full launch — RSVP, registry, all NYC pages (F-002, F-011, F-012 for NYC)
- **M4 (May 2026)**: France save-the-date launch
- **M5 (October 2026)**: France full launch — RSVP, all France pages complete

## Risks & mitigations

| Risk | Impact | Likelihood | Mitigation |
| ------ | -------- | ------------ | ------------ |
| Notion API rate limits | Build failures, slow RSVP | Low | Cache at build-time, only runtime writes for RSVPs |
| Two-event confusion | Guest RSVPs to wrong event | Medium | Clear UI separation, confirmation flows, event-specific URLs |
| Password sharing | Unauthorized access | Medium | Acceptable for MVP; plan migration to guest-name auth for launch |
| Email deliverability | Save-the-dates go to spam | Medium | Use Resend with proper SPF/DKIM on sargaux.com domain |
| Timeline pressure | NYC go-live is fixed (Oct 2026) | High | Prioritize NYC features in M1-M3, France can iterate after |
| Notion data sync | Stale content on site | Low | Webhook-triggered rebuilds, or manual rebuild after updates |

## Open questions

- [ ] How do we handle registry for French guests? (Ask Alice) — Different registry service? Currency considerations?

## QA & Release checklist

- Automated tests for critical flows
- Lighthouse score checks in CI
- Accessibility audit pass
- Backup and roll-back plan

## Next steps (immediate)

- Start building!
- Add more next steps in a new document in the docs folder.

Appendices

- Glossary: CTA, TTI, WCAG, SEO, MDX
- Machine-friendly summary: feature IDs, acceptance criteria, endpoints (to be added)
