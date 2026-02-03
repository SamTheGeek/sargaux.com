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
- F-003: Infrastructure to send emails. If this is incompatible with the current architecture, work on a plan to extend the architecture to send emails. Do research and select a vendor.
- F-004: Subscribe to a calendar on each wedding's page. This will be in ics format and will be generated from the events information. Example as a PNG, but make sure to include only events we have scheduled (create/update the first few in Notion, make sure to link them to the existing 'date' pages for NYC, Friday, Saturday, and Sunday)
- F-005: Login experience should, for now, use a static password (one for Sam, one for Margaux, and one for each set of parents). Eventually this will use guest names as the login information.
- F-006: Notion will serve as the backend for all of the guest data and also the events. We already have a workspace that needs to be connected and possibly updated to store the information.
- F-007: Cookie & Privacy Banner — consent management.
- F-008: No analytics and tracking anywhere in the site.
- F-009: Accessibility features — keyboard nav, ARIA, semantic HTML.
- F-010: Performance optimizations — critical CSS, image CDN if necessary, caching.
- F-011: The ability for guests to RSVP on the website with their RSVP updating the Notion guest database.

## Acceptance criteria (per feature, testable)

- Write this for launch version. AI can suggest things to go here.

## Information Architecture (high-level)

- AI assistant, please propose an information architecture

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

- AI Assistant — fill this in from the existing notes.

## Security & Privacy

- HTTPS everywhere, HSTS
- CSP header configuration
- Minimal PII collection; privacy-first default for tracking
- Data retention & deletion process documented

## Integrations

- Auth: Wedding website auth (out of scope for now)
- CRM: Notion backend (please ask for help connecting if you need it. I've installed the plugin.)
- Observability: Sentry for frontend errors

## Milestones & timeline (example)

- M1 (February): Basic site, framework, early features.
- M2 (March): Emailing, login, save-the-date style pages.
- M3 (April): Full launch of October (NYC) portion.
- M4 (May): Save-the-date launch of May 2027 (France) portion
- M5 (October): Full launch of May 2027 (France) portion

## Risks & mitigations

- Suggest some!

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
