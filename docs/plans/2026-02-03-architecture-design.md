# Architecture Design — sargaux.com

**Date**: 2026-02-03
**Status**: Approved
**Owner**: Sam

## Summary

Wedding website for Sam & Margaux with two separate events (NYC October 2026, France May 2027). Built on Astro with Notion backend and Netlify hosting.

## Key Decisions

### URL Structure: Event-centric

```
/                       # Homepage
/login                  # Login page
/registry               # Shared registry

/nyc/                   # NYC event pages
/nyc/schedule
/nyc/details
/nyc/travel
/nyc/rsvp
/nyc/calendar.ics

/france/                # France event pages
/france/schedule
/france/details
/france/travel
/france/rsvp
/france/calendar.ics

/api/rsvp               # Server endpoint
```

**Dream feature**: pushState() for seamless toggle between events without page reload.

### Authentication: Hybrid Cookie + localStorage

- **Cookie**: httpOnly session cookie for auth state
- **localStorage**: User preferences (last viewed event, toggle state)
- **Fallback**: Graceful degradation if localStorage unavailable
- **MVP**: Static passwords (Sam, Margaux, each set of parents)
- **Future**: Guest-name based authentication

### Data Layer: Notion with Hybrid Fetching

- **Build-time**: Fetch event details, guest lists, schedule data
- **Runtime**: RSVP submissions write directly to Notion via Astro server endpoints
- **Trigger**: Webhook-triggered rebuilds when Notion content changes (optional)

### Server Endpoints: Astro over Netlify Edge

Chose Astro server endpoints (`src/pages/api/*.ts`) because:
- Code lives alongside components
- Same TypeScript config
- Works with `npm run dev`
- Portable if hosting changes

### Email: Resend

- Free tier covers expected volume (~3k emails total)
- Simple API
- Good deliverability
- Requires SPF/DKIM setup on Spaceship

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Astro v5.x (hybrid SSR) |
| Adapter | @astrojs/netlify |
| Language | TypeScript strict |
| CSS | Astro scoped styles |
| Backend | Notion API |
| Auth | Cookie + localStorage |
| Email | Resend |
| Calendar | ICS generation |
| Hosting | Netlify |
| Testing | Playwright |

## Open Questions

- [ ] Registry for French guests — different service? Currency? (Ask Alice)

## Next Steps

Implementation plans for M1 features:
- F-001: Homepage
- F-005: Authentication (static passwords)
- F-006: Notion integration
