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

- Goal: Launch a wedding website for Sam Gross and Margaux Ancel. The 
- Primary audience: Wedding guests.
- Secondary audience: Family members and staff needing to check details.
- Wedding Dates: Tentative October 11, 2026 in NYC, confirmed May 28-30, 2027.

## Objectives (SMART)

- O1: Increase trial signups by 30% within 3 months of launch.
- O2: Achieve Lighthouse Performance score >= 90.
- O3: Meet WCAG 2.1 AA accessibility standards site-wide.
- O4: Rank for 5 target keywords on page 1 within 6 months.

## Success metrics (KPIs)

- Conversion rate (visitor → signup)
- Organic traffic (sessions)
- Time to interactive (TTI)
- Bounce rate on landing pages
- Accessibility issues fixed / automated audit pass rate

## Personas

- Persona A: Product Manager (researches solutions; values clarity, pricing)
- Persona B: Developer (reads docs, checks integrations)
- Persona C: Decision-maker (CRO/CTO; needs ROI info & case studies)

## Scope

- In scope: Landing pages, Pricing, Docs hub, Blog, Contact/Lead form, Integrations list, Privacy & TOS.
- Out of scope (MVP): Full customer portal, billing engine, elaborate personalization.

## Features (ID, title, brief)

- F-001: Homepage — hero, value props, CTAs, social proof.
- F-002: Pricing — tiers, feature table, billing CTA.
- F-003: Documentation hub — searchable, versioned, code snippets.
- F-004: Blog — SEO-friendly posts, tags, RSS.
- F-005: Contact & Lead Form — form validation, spam protection, GTM event.
- F-006: Integrations page — logos, short descriptions, links.
- F-007: Cookie & Privacy Banner — consent management.
- F-008: Analytics & Tracking — GA4, events, funnel tracking.
- F-009: Accessibility features — keyboard nav, ARIA, semantic HTML.
- F-010: Performance optimizations — critical CSS, image CDN, caching.

## Acceptance criteria (per feature, testable)

- Homepage loads TTI < 2s on 3G fast emulation (F-001).
- Pricing table accessible via keyboard and screen reader (F-002).
- Docs search returns relevant results within 200ms and supports code blocks (F-003).
- Blog template includes meta tags for Open Graph and structured data (F-004).
- Contact form submits and creates lead in CRM; client and server validation present (F-005).
- Cookie consent persists user choice and blocks trackers until consent (F-007).

## Information Architecture (high-level)

- / (home)
- /pricing
- /docs/
  - /docs/getting-started
  - /docs/api
- /blog/
- /integrations
- /contact
- /legal/privacy
- /legal/terms

## User flows (primary)

1. Visitor → Homepage → Pricing → Signup CTA → Signup page/form.
2. Developer → Docs landing → API doc → Copy snippet → Try.
3. Visitor → Blog → CTA → Lead form → Scheduled demo.

## Content strategy

- Headline-first writing; 2–3 key value points per page.
- Reusable component content (feature descriptions, CTAs).
- Structured metadata for SEO and social sharing.
- Author and publish process: editorial checklist, SEO checklist.

## SEO & Structured Data

- Target keywords per page, title & meta templates.
- JSON-LD: Organization, BreadcrumbList, Article for blog posts.
- Sitemap.xml, robots.txt, canonical URLs.

## Accessibility

- WCAG 2.1 AA baseline.
- Keyboard-first testing, color-contrast >= 4.5:1 for body text.
- Screen-reader tested labels, skip links.

## Performance & Hosting

- Host: static site on CDN (e.g., Vercel/Netlify) or S3 + CloudFront.
- Use image CDN, responsive images (srcset, AVIF/WebP fallbacks).
- Prefetch critical assets, lazy-load below-the-fold images.

## Tech stack (recommended)

- Framework: Next.js (static + SSR where needed)
- Styling: Tailwind CSS or scoped CSS-in-JS
- Docs: Markdown + MDX with search (Algolia or Lunr)
- CI/CD: GitHub Actions
- Analytics: GA4, server-side events optional
- CRM/Forms: HubSpot or Zapier integration

## Security & Privacy

- HTTPS everywhere, HSTS
- CSP header configuration
- Minimal PII collection; privacy-first default for tracking
- Data retention & deletion process documented

## Integrations

- Auth: OAuth / SSO (deferred)
- CRM: HubSpot / Salesforce
- Payments: Stripe (if needed in phase 2)
- Observability: Sentry for frontend errors

## Milestones & timeline (example)

- M1 (2 weeks): Content strategy, IA, wireframes.
- M2 (3 weeks): MVP pages, basic styling, SEO metadata.
- M3 (2 weeks): Docs hub + search integration.
- M4 (2 weeks): QA, accessibility, performance tuning.
- M5 (1 week): Launch & post-launch monitoring.

## Risks & mitigations

- Content delays → prioritize skeleton pages and placeholders.
- Third-party downtime → graceful degradation, cached fallbacks.
- SEO migration loss → preserve URLs and implement redirects.

## QA & Release checklist

- Automated tests for critical flows
- Lighthouse score checks in CI
- Accessibility audit pass
- Analytics events validated
- Backup and roll-back plan

## Next steps (immediate)

- Assign owner for each feature ID.
- Finalize content & SEO keywords.
- Create design tokens and component inventory.
- Schedule kickoff meeting.

Appendices

- Glossary: CTA, TTI, WCAG, SEO, MDX
- Machine-friendly summary: feature IDs, acceptance criteria, endpoints (to be added)
