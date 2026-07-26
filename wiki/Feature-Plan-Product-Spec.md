# Feature Plan / Product Spec

This is the original product requirements document (Feb 2026) that kicked off the build. Some details below have since been superseded by actual decisions documented elsewhere in this wiki (noted inline) — this page is kept as the historical spec, not a live source of truth.

## Summary

- **Goal**: launch a wedding website for Sam Gross and Margaux Ancel, held in two parts with separate invitation lists (minimal overlap): New York in October 2026, France in May 2027.
- **Primary audience**: wedding guests. **Secondary**: family/staff checking details.

## Event details

**NYC**: dinner and dancing modeled as separate events (to allow digital-only dancing invites as add-ons — see [Notion Backend](Notion-Backend) for how this shipped). Originally tentative for Sunday October 11, 2026 (a Columbus Day long weekend), with Friday Welcome Drinks and Sunday Brunch as optional add-ons.

**France**: a weekend at [Village de Sully](https://www.groupeamadeus.com/le-village-de-sully), Friday May 28 – Sunday May 30, 2027. Guests may stay on-site (€75/night, breakfast included). Friday welcome dinner; Saturday breakfast, ceremony, cocktail hour, reception; Sunday breakfast and brunch.

## Scope

- **MVP**: landing pages per event, hardcoded per-person passwords (superseded — see [Authentication & Sessions](Authentication-And-Sessions)), Notion connection.
- **Launch**: design, guest-name-based login, email infrastructure, RSVP experience.

## Feature list (as originally specified)

- **F-001**: Homepage — hero, welcome information, login CTA.
- **F-002**: Two experiences (NYC/France), with an event toggle for dual-invited guests.
- **F-003**: Resend transactional email infrastructure (SPF/DKIM on `sargaux.com`), for save-the-dates, reminders, RSVP confirmations.
- **F-004**: Calendar subscription (`.ics`) per wedding — see [RSVP & Calendar](RSVP-And-Calendar).
- **F-005**: Login — originally static per-person passwords, evolved to name-based auth — see [Authentication & Sessions](Authentication-And-Sessions).
- **F-006**: Notion as the backend for guest and event data — see [Notion Backend](Notion-Backend).
- **F-007**: Cookie & privacy banner / consent management.
- **F-008**: No analytics or tracking anywhere on the site.
- **F-009**: Accessibility — keyboard nav, ARIA, semantic HTML.
- **F-010**: Performance — critical CSS, image CDN, caching.
- **F-011**: Guest RSVP updating the Notion guest database — see [RSVP & Calendar](RSVP-And-Calendar).
- **F-012**: Wedding registry, shared across both events at `/registry` — see [Registry Integration](Registry-Integration) for how the France/US split actually shipped.
- **F-013**: Guest flight collection and Flighty sync — added later, see [Flight Collection](Flight-Collection).

## Information architecture (original)

```text
/                       # Homepage — hero, welcome, login CTA
/login                  # Login page
/registry               # Shared wedding registry

/nyc/                   # NYC event landing page
/nyc/schedule
/nyc/details
/nyc/travel
/nyc/rsvp
/nyc/calendar.ics

/france/                # France event landing page
/france/schedule
/france/details
/france/travel
/france/rsvp
/france/calendar.ics

/api/rsvp
```

Event toggle: visible only to guests invited to both events; base implementation is standard navigation links, with a "dream feature" of `pushState()` for seamless updates (see [Architecture Overview](Architecture-Overview) for what actually shipped — Astro view transitions).

## Non-functional requirements (original)

- SEO: the site should **not** be search-optimized; robots should discourage AI ingestion; private content stays behind login.
- Accessibility: WCAG 2.1 AA baseline, keyboard-first, ≥4.5:1 body-text contrast, screen-reader-tested labels and skip links.
- Performance: static Netlify hosting, image CDN with responsive images (srcset, AVIF/WebP fallback), prefetch/lazy-load.
- Security & privacy: HTTPS/HSTS, CSP, minimal PII collection — see [Guest Privacy & Security](Guest-Privacy-And-Security) for what actually shipped (this went considerably further than the original spec, via a dedicated security audit).

## Original milestones

- M1 (Feb 2026): basic framework, Notion integration, auth.
- M1.5: NYC content review/copy edit.
- M2 (Mar 2026): email infrastructure, save-the-dates, calendar subscriptions.
- M3 (Apr 2026): NYC full launch — RSVP, registry, all NYC pages.
- M3.5: France content review/copy edit.
- M4 (May 2026): France save-the-date launch.
- M5 (Oct 2026): France full launch.

## Original risks

| Risk | Mitigation |
|---|---|
| Notion API rate limits | Cache at build time; runtime writes only for RSVP |
| Two-event confusion | Clear UI separation, confirmation flows, event-specific URLs |
| Password sharing | Accepted for MVP; planned migration to guest-name auth |
| Email deliverability | Resend with SPF/DKIM on the `sargaux.com` domain |
| NYC timeline pressure | Prioritize NYC in M1–M3; France iterates after |
| Notion data staleness | Webhook-triggered or manual rebuilds |

## Open question from the original doc

Registry handling for French guests (different service? currency?) — resolved; see [Registry Integration](Registry-Integration).

See [Project History](Project-History) for the chronological index of every design/implementation plan that turned this spec into the shipped site.
