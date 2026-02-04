# Wireframe Review Session Plan

Interactive walkthrough of the wedding website wireframes with Sam & Margaux.

## Context

- **Purpose**: Review site structure and content zones before design/styling work
- **Stage**: Feature development wireframes — will be reimplemented during design phase
- **Focus**: Information architecture, content decisions, image placement

## Session Flow

### 1. Homepage (`/`)
Open: `http://localhost:1213/`

**Review items:**
- [ ] Hero image placement and aspect ratio
- [ ] Site title "Chez Sargaux" — keep or change?
- [ ] Login modal flow — click button to test
- [ ] Teaser section — keep, remove, or modify content?

**Decisions needed:**
- Error messaging style: generic vs. friendly hint?

---

### 2. NYC Landing Page (`/nyc/`)
Open: `http://localhost:1213/nyc/`

**Review items:**
- [ ] Hero image and overlay layout
- [ ] Event date display (October 11, 2026 — may shift)
- [ ] Quick info cards: When / Where / Dress Code
- [ ] Navigation cards to sub-pages
- [ ] Venue preview images section
- [ ] Calendar subscribe placement

**Decisions needed:**
- Dress code for NYC event
- Two-venue flow (dinner → dancing) — how to present?

---

### 3. NYC Sub-pages

#### Schedule (`/nyc/schedule`)
- [ ] Timeline format — works for single evening?
- [ ] Level of detail needed

#### Details (`/nyc/details`)
- [ ] Venue image placeholders
- [ ] Dress code guidance
- [ ] "What to expect" section

#### Travel (`/nyc/travel`)
- [ ] Hotel recommendations — any room block?
- [ ] Transportation guidance
- [ ] "While you're here" suggestions

#### RSVP (`/nyc/rsvp`)
- [ ] Form fields: attendance, names, dietary, song request, message
- [ ] +1 handling
- [ ] RSVP deadline

---

### 4. France Landing Page (`/france/`)
Open: `http://localhost:1213/france/`

**Review items:**
- [ ] Hero image (Village De Sully)
- [ ] Weekend date display (May 28-30, 2027)
- [ ] Quick info cards: When / Where / Accommodation
- [ ] Weekend overview (Fri/Sat/Sun cards)
- [ ] Navigation to sub-pages
- [ ] Venue images section

**Decisions needed:**
- Accommodation pricing display (€75/night)
- How prominent should accommodation booking be?

---

### 5. France Sub-pages

#### Schedule (`/france/schedule`)
- [ ] 3-day format with timeline per day
- [ ] Saturday highlighted as main event
- [ ] Level of detail for each event

#### Details (`/france/details`)
- [ ] Village De Sully presentation
- [ ] Venue spaces (grounds, ceremony, accommodation)
- [ ] Accommodation details section
- [ ] Dress code per event (Fri casual, Sat formal, Sun casual)

#### Travel (`/france/travel`)
- [ ] Getting there (air, train, car)
- [ ] Shuttle service decision
- [ ] Extending the trip suggestions
- [ ] Practical info (currency, language, weather)

#### RSVP (`/france/rsvp`)
- [ ] Accommodation booking integrated with RSVP
- [ ] Night selection (Friday, Saturday)
- [ ] Events attending checkboxes
- [ ] Travel plans for shuttle coordination
- [ ] RSVP deadline

---

### 6. Registry (`/registry`)
Open: `http://localhost:1213/registry`

**Review items:**
- [ ] Intro message placement
- [ ] Registry option cards
- [ ] Honeymoon fund consideration

**Decisions needed:**
- Which registry services to use?
- Honeymoon/experience fund — yes or no?
- French guest registry solution (ask Alice)

---

## Image Placeholders Summary

After the review, these images will need to be sourced:

| Image | Folder | Description |
|-------|--------|-------------|
| `hero-main` | `hero/` | Couple photo for homepage |
| `nyc-hero` | `nyc/` | NYC skyline or venue |
| `nyc-venue` | `nyc/` | Dinner venue interior |
| `nyc-dancing` | `nyc/` | Dancing venue |
| `france-hero` | `france/` | Village De Sully main view |
| `france-grounds` | `france/` | Village outdoor spaces |
| `france-accommodation` | `france/` | Guest rooms |
| `france-ceremony` | `france/` | Ceremony location |
| `couple-registry` | `couple/` | Fun couple photo for registry |

---

## Post-Review Actions

1. Update wireframes based on feedback
2. Document final decisions in feature plan
3. Add images to `public/images/` folders
4. Begin M1 implementation (auth, Notion integration)

---

## Running the Review

```bash
# Start dev server
npm run dev

# Opens at http://localhost:1213
```

Navigate through pages in order above, discussing each section.
