# Wireframe Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all decisions from the wireframe review session, updating pages with corrected content, consolidated structure, and placeholders for future features.

**Architecture:** Update existing Astro pages with review feedback. Consolidate NYC schedule+details into single page. Add placeholder sections for features requiring Notion integration (optional events, personalized calendars, i18n).

**Tech Stack:** Astro 5.x, TypeScript, scoped CSS

---

## Phase 1: Global Wireframe Cleanup

### Task 1: Remove Content Labels from All Pages

**Files:**
- Modify: `src/layouts/WireframeLayout.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/nyc/index.astro`
- Modify: `src/pages/nyc/schedule.astro`
- Modify: `src/pages/nyc/details.astro`
- Modify: `src/pages/nyc/travel.astro`
- Modify: `src/pages/nyc/rsvp.astro`
- Modify: `src/pages/france/index.astro`
- Modify: `src/pages/france/schedule.astro`
- Modify: `src/pages/france/details.astro`
- Modify: `src/pages/france/travel.astro`
- Modify: `src/pages/france/rsvp.astro`
- Modify: `src/pages/registry.astro`

**Step 1: Remove content-label class and styles from WireframeLayout**

In `src/layouts/WireframeLayout.astro`, remove the `.content-label` CSS class definition.

**Step 2: Remove all `<p class="content-label">` elements from each page**

Search for and remove all instances of `<p class="content-label">...</p>` from every page listed above.

**Step 3: Verify pages render without labels**

Run: `npm run dev`
Visit each page and confirm content labels are gone.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove wireframe content labels from all pages"
```

---

## Phase 2: Homepage Updates

### Task 2: Homepage Final Polish

**Files:**
- Modify: `src/pages/index.astro`

**Step 1: Verify teaser section has placeholder text**

Already completed during review session. Confirm the teaser section contains:
```html
<section class="teaser">
  <div class="teaser-content">
    <p class="teaser-text">Lorem ipsum dolor sit amet...</p>
  </div>
</section>
```

**Step 2: Verify login error message is shortened**

Already completed. Confirm `/api/login.ts` returns:
```
"Please enter your name as it appears on your invitation."
```

**Step 3: No commit needed if no changes**

---

## Phase 3: NYC Event Updates

### Task 3: NYC Landing Page Updates

**Files:**
- Modify: `src/pages/nyc/index.astro`

**Step 1: Update hero image aspect ratio**

Change the ImagePlaceholder aspectRatio from "21/9" to "16/9" for a smaller hero:

```astro
<ImagePlaceholder
  name="nyc-hero"
  folder="nyc"
  description="NYC skyline or venue exterior"
  aspectRatio="16/9"
/>
```

**Step 2: Mark date as tentative**

Update the date display to include "(Tentative)":

```html
<p class="event-date">October 11, 2026 <span class="tentative">(Tentative)</span></p>
```

Add CSS:
```css
.tentative {
  font-size: 0.875rem;
  color: #888;
  font-style: italic;
}
```

**Step 3: Update dress code to "Festive Attire"**

Find the dress code card and update:

```html
<h4>Dress Code</h4>
<p>Festive Attire</p>
```

**Step 4: Add placeholder for optional weekend events section**

After the main venue cards, add:

```html
<!-- Optional Weekend Events -->
<section class="optional-events">
  <h3>More to Explore</h3>
  <p class="placeholder-note">Optional events throughout the weekend will be listed here once confirmed.</p>
</section>
```

**Step 5: Make calendar subscribe more prominent**

Move calendar subscribe above the navigation cards and style it more prominently.

**Step 6: Run dev server and verify changes**

Run: `npm run dev`
Visit: http://localhost:1213/nyc/

**Step 7: Commit**

```bash
git add src/pages/nyc/index.astro
git commit -m "feat(nyc): update landing page per wireframe review"
```

---

### Task 4: Consolidate NYC Schedule + Details

**Files:**
- Modify: `src/pages/nyc/details.astro` (becomes combined page)
- Delete: `src/pages/nyc/schedule.astro`
- Modify: `src/pages/nyc/index.astro` (update nav links)

**Step 1: Read both schedule.astro and details.astro**

Understand current content in both files.

**Step 2: Merge schedule content into details.astro**

Create a consolidated page with:
1. Event timeline/schedule section
2. Venue details (dinner + dancing) with horizontal/vertical responsive layout
3. "What to Expect" section
4. Dress code (Festive Attire)
5. Calendar subscribe link
6. Google Maps Static API placeholders for venues

Structure:
```astro
---
import WireframeLayout from '../../layouts/WireframeLayout.astro';
import ImagePlaceholder from '../../components/ImagePlaceholder.astro';

const guest = Astro.locals.guest;
if (!guest) return Astro.redirect('/');
---

<WireframeLayout title="NYC Details | Chez Sargaux">
  <main>
    <a href="/nyc" class="back-link">&larr; Back to NYC</a>

    <h1>The Evening</h1>
    <p class="subtitle">October 11, 2026 <span class="tentative">(Tentative)</span></p>

    <!-- Schedule Timeline -->
    <section class="schedule">
      <h2>Schedule</h2>
      <div class="timeline">
        <div class="timeline-item">
          <span class="time">6:00 PM</span>
          <div class="event">
            <h4>Cocktails & Dinner</h4>
            <p>Join us for an evening of celebration</p>
          </div>
        </div>
        <div class="timeline-item">
          <span class="time">9:00 PM</span>
          <div class="event">
            <h4>Dancing</h4>
            <p>Continue the celebration at our second venue</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Venues - Responsive horizontal/vertical -->
    <section class="venues">
      <h2>The Venues</h2>
      <div class="venue-grid">
        <div class="venue-card">
          <ImagePlaceholder
            name="nyc-dinner"
            folder="nyc"
            description="Dinner venue interior"
            aspectRatio="4/3"
          />
          <h3>Dinner</h3>
          <p>Venue name TBD</p>
          <div class="map-placeholder">
            <!-- Google Maps Static API placeholder -->
            <p class="placeholder-note">Map will be added here</p>
          </div>
        </div>
        <div class="venue-card">
          <ImagePlaceholder
            name="nyc-dancing"
            folder="nyc"
            description="Dancing venue"
            aspectRatio="4/3"
          />
          <h3>Dancing</h3>
          <p>Venue name TBD</p>
          <div class="map-placeholder">
            <p class="placeholder-note">Map will be added here</p>
          </div>
        </div>
      </div>
    </section>

    <!-- What to Expect -->
    <section class="what-to-expect">
      <h2>What to Expect</h2>
      <p>The evening will begin with cocktails and a non-seated dinner at our first venue. Later, we'll move to a second location for dancing and continued celebration.</p>
    </section>

    <!-- Dress Code -->
    <section class="dress-code">
      <h2>Dress Code</h2>
      <p><strong>Festive Attire</strong></p>
      <p>Think jackets but no tie required. The couple will be in suits.</p>
    </section>

    <!-- Calendar Subscribe -->
    <section class="calendar-section">
      <h2>Add to Calendar</h2>
      <a href="#" class="calendar-btn">Subscribe to Calendar</a>
      <p class="placeholder-note">Personalized calendar link based on your RSVP</p>
    </section>
  </main>
</WireframeLayout>

<style>
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
  }

  .back-link {
    display: inline-block;
    margin-bottom: 2rem;
    color: #666;
    text-decoration: none;
  }

  .back-link:hover {
    color: #1a1a1a;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 300;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #666;
    margin-bottom: 3rem;
  }

  .tentative {
    font-size: 0.875rem;
    font-style: italic;
  }

  section {
    margin-bottom: 3rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 400;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #e5e5e5;
    padding-bottom: 0.5rem;
  }

  /* Timeline */
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .timeline-item {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
  }

  .time {
    font-weight: 600;
    min-width: 80px;
    color: #1a1a1a;
  }

  .event h4 {
    margin: 0 0 0.25rem 0;
    font-weight: 500;
  }

  .event p {
    margin: 0;
    color: #666;
  }

  /* Venue Grid - Horizontal on desktop, vertical on mobile */
  .venue-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }

  @media (max-width: 768px) {
    .venue-grid {
      grid-template-columns: 1fr;
    }
  }

  .venue-card {
    border: 1px solid #e5e5e5;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .venue-card h3 {
    margin: 1rem;
    font-size: 1.25rem;
    font-weight: 500;
  }

  .venue-card > p {
    margin: 0 1rem 1rem;
    color: #666;
  }

  .map-placeholder {
    margin: 1rem;
    padding: 2rem;
    background: #f5f5f5;
    border-radius: 0.25rem;
    text-align: center;
  }

  .placeholder-note {
    font-size: 0.875rem;
    color: #888;
    font-style: italic;
  }

  /* Dress Code */
  .dress-code p {
    margin: 0.5rem 0;
  }

  /* Calendar */
  .calendar-section {
    text-align: center;
    padding: 2rem;
    background: #f9f9f9;
    border-radius: 0.5rem;
  }

  .calendar-btn {
    display: inline-block;
    padding: 0.875rem 2rem;
    background: #1a1a1a;
    color: white;
    text-decoration: none;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .calendar-btn:hover {
    background: #333;
  }
</style>
```

**Step 3: Delete schedule.astro**

```bash
rm src/pages/nyc/schedule.astro
```

**Step 4: Update navigation links in nyc/index.astro**

Remove the "Schedule" navigation card, keep only "Details", "Travel", "RSVP".

**Step 5: Run dev server and verify**

Run: `npm run dev`
Visit: http://localhost:1213/nyc/details

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(nyc): consolidate schedule and details into single page"
```

---

### Task 5: NYC Travel Page Updates

**Files:**
- Modify: `src/pages/nyc/travel.astro`

**Step 1: Add "By Bus" section**

Add section for bus travel to NYC.

**Step 2: Add "MTA" section for local transit**

Add section about subway/local transit.

**Step 3: Update "While You're Here" to focus on museums/exhibitions**

Remove restaurant recommendations, replace with museum/exhibition suggestions.

**Step 4: Verify changes**

Run: `npm run dev`
Visit: http://localhost:1213/nyc/travel

**Step 5: Commit**

```bash
git add src/pages/nyc/travel.astro
git commit -m "feat(nyc): update travel page with bus, MTA, and museums focus"
```

---

### Task 6: NYC RSVP Page Structure

**Files:**
- Modify: `src/pages/nyc/rsvp.astro`

**Step 1: Update RSVP deadline to September 1, 2026**

**Step 2: Add structure for individual guest toggles**

Show each linked guest with their own accept/decline toggle, editable (but prefilled) names.

**Step 3: Add +1 handling**

+1s should have blank name field, deselected by default.

**Step 4: Add optional events section placeholder**

Section for optional weekend events (to be populated from Notion).

**Step 5: Verify changes**

Run: `npm run dev`
Visit: http://localhost:1213/nyc/rsvp

**Step 6: Commit**

```bash
git add src/pages/nyc/rsvp.astro
git commit -m "feat(nyc): update RSVP page structure per wireframe review"
```

---

## Phase 4: France Event Updates

### Task 7: France Landing Page Updates

**Files:**
- Modify: `src/pages/france/index.astro`

**Step 1: Update hero image aspect ratio to 16/9**

**Step 2: Add map placeholder showing Village de Sully AND Paris**

Add a placeholder for a map that shows both locations for context.

**Step 3: Keep accommodation pricing (€75/night) and RSVP note**

Verify these are present and clear.

**Step 4: Verify changes**

Run: `npm run dev`
Visit: http://localhost:1213/france/

**Step 5: Commit**

```bash
git add src/pages/france/index.astro
git commit -m "feat(france): update landing page per wireframe review"
```

---

### Task 8: France Schedule Page Updates

**Files:**
- Modify: `src/pages/france/schedule.astro`

**Step 1: Add calendar subscribe button**

Add prominent calendar subscribe section like NYC.

**Step 2: Add check-in/check-out times**

- Check-in: 4pm Friday
- Check-out: 4pm Sunday

**Step 3: Add placeholder for Saturday optional excursions**

**Step 4: Verify changes**

Run: `npm run dev`
Visit: http://localhost:1213/france/schedule

**Step 5: Commit**

```bash
git add src/pages/france/schedule.astro
git commit -m "feat(france): update schedule with calendar, times, and excursions"
```

---

### Task 9: France Details Page Updates

**Files:**
- Modify: `src/pages/france/details.astro`

**Step 1: Add "strongly recommend staying on-site" note**

Add prominent note about limited nearby hotels.

**Step 2: Verify changes**

Run: `npm run dev`
Visit: http://localhost:1213/france/details

**Step 3: Commit**

```bash
git add src/pages/france/details.astro
git commit -m "feat(france): add on-site accommodation recommendation"
```

---

### Task 10: France Travel Page Updates

**Files:**
- Modify: `src/pages/france/travel.astro`

**Step 1: Restructure into two sections**

1. "Getting to France" (will be conditionally hidden for French guests later)
2. "Getting to the Venue from Paris" (shown to everyone)

**Step 2: Fix region from "Burgundy" to "Ile de France"**

**Step 3: Update practical info to be date-specific**

- Time difference: 6 hours ahead of New York (late May)
- Reference date: May 28, 2027
- Weather: placeholder for later

**Step 4: Verify changes**

Run: `npm run dev`
Visit: http://localhost:1213/france/travel

**Step 5: Commit**

```bash
git add src/pages/france/travel.astro
git commit -m "feat(france): restructure travel page, fix region, add date-specific info"
```

---

### Task 11: France RSVP Page Updates

**Files:**
- Modify: `src/pages/france/rsvp.astro`

**Step 1: Update RSVP deadline to March 15, 2027 (placeholder)**

**Step 2: Frame accommodation as "request, not reservation"**

Add note: "We'll email you with final room details closer to the event."

**Step 3: Add live cost estimate section**

Show: €75/person/night with dynamic calculation placeholder.

**Step 4: Add payment timing note**

"Payment will be collected closer to the event."

**Step 5: Add EU allergens selection**

List the 14 major EU allergens as checkboxes.

**Step 6: Add kosher-style note**

"If you keep kosher-style, you do not need to mark allergies here."

**Step 7: Add transportation note**

"Ubers are available around Mantes La Jolie station. Taxis are right in front."

**Step 8: Apply same guest toggle pattern as NYC**

Individual toggles, editable names, +1 handling.

**Step 9: Verify changes**

Run: `npm run dev`
Visit: http://localhost:1213/france/rsvp

**Step 10: Commit**

```bash
git add src/pages/france/rsvp.astro
git commit -m "feat(france): update RSVP with accommodation, allergens, and transport info"
```

---

## Phase 5: Build Verification

### Task 12: Full Build and Test

**Step 1: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 2: Run test suite**

```bash
npm test
```

Expected: All accessibility, best practices, and performance tests pass.

**Step 3: Fix any issues**

If tests fail, address issues before proceeding.

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address test failures from wireframe updates"
```

---

## Future Implementation Notes

The following features were identified during the review but require additional infrastructure:

### Notion Integration (separate plan needed)
- Guest database connection
- Optional events management
- RSVP submission storage
- Country field for i18n defaults

### Personalized Calendar (separate plan needed)
- **Prominent calendar subscribe on BOTH NYC and France pages**
- Unique ICS link per guest
- Include events based on RSVP selections (optional events appear if RSVPed)
- Google Calendar / Apple Calendar subscribe

### i18n / French Translation (separate plan needed)
- Full French translation of all pages
- Language switcher in header/footer
- Default language based on Notion "Country" field
- Bilingual login placeholder text
- Homepage "Entrer" button for French

### Google Maps Static API (separate plan needed)
- Reference samthegeek.net implementation
- Venue location embeds
- France overview map (Village de Sully + Paris)

### Registry Page (deferred)
- To be revisited later per review decision

---

## Summary

| Phase | Tasks | Estimated Commits |
|-------|-------|-------------------|
| Phase 1: Global Cleanup | 1 | 1 |
| Phase 2: Homepage | 1 | 0 (already done) |
| Phase 3: NYC | 4 | 4 |
| Phase 4: France | 5 | 5 |
| Phase 5: Verification | 1 | 0-1 |

**Total: 12 tasks, ~10-11 commits**
