import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseEventPage } from '../src/lib/notion';

/**
 * parseEventPage decides what the entire site can see: the RSVP forms, the
 * confirmation pages, and every personalized ICS feed all read their events
 * through getEventCatalog, which is this function applied to each row.
 *
 * `Show on Website` is how an event is cancelled. Unchecking it keeps the
 * Notion page (and its page ID, which guests' stored responses point at) while
 * removing the event from all of those surfaces.
 */

type EventProps = Record<string, unknown>;

/** Build a minimal Event Catalog page in the shape the Notion API returns. */
function eventPage(props: EventProps, id = 'event-1') {
  return {
    object: 'page',
    id,
    properties: {
      'Event Name': { title: [{ plain_text: 'Leaf Peeping Ride' }] },
      Wedding: { select: { name: 'New York' } },
      'Show on Website': { checkbox: true },
      ...props,
    },
  };
}

test.describe('parseEventPage — Show on Website', () => {
  test('a checked event is returned', () => {
    const result = parseEventPage(eventPage({}), 'nyc');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Leaf Peeping Ride');
    expect(result?.showOnWebsite).toBe(true);
  });

  test('an unchecked event is dropped from the catalog', () => {
    const result = parseEventPage(
      eventPage({ 'Show on Website': { checkbox: false } }),
      'nyc'
    );

    expect(result).toBeNull();
  });

  test('a missing checkbox is treated as cancelled, not as live', () => {
    // Notion omits the property entirely on a row created before the column
    // existed. Failing closed keeps an un-curated row off the site.
    const result = parseEventPage(eventPage({ 'Show on Website': undefined }), 'nyc');

    expect(result).toBeNull();
  });

  test('cancelling one event leaves its siblings alone', () => {
    const pages = [
      eventPage({ 'Event Name': { title: [{ plain_text: 'Cocktails' }] } }, 'keep-1'),
      eventPage(
        {
          'Event Name': { title: [{ plain_text: 'Museum Visit' }] },
          'Show on Website': { checkbox: false },
        },
        'cancelled'
      ),
      eventPage({ 'Event Name': { title: [{ plain_text: 'Dancing' }] } }, 'keep-2'),
    ];

    const catalog = pages
      .map((page) => parseEventPage(page, 'nyc'))
      .filter((event) => event !== null);

    expect(catalog.map((event) => event?.id)).toEqual(['keep-1', 'keep-2']);
  });

  test('cancelling every optional event yields an empty optional list', () => {
    // The state the NYC RSVP form renders after both optional events are
    // cancelled: core events survive, the optional section has nothing in it.
    const pages = [
      eventPage(
        {
          'Event Name': { title: [{ plain_text: 'Cocktails' }] },
          'Event Type': { select: { name: 'Core' } },
        },
        'core-1'
      ),
      eventPage(
        {
          'Event Name': { title: [{ plain_text: 'Bike Ride' }] },
          'Event Type': { select: { name: 'Optional' } },
          'Show on Website': { checkbox: false },
        },
        'optional-1'
      ),
      eventPage(
        {
          'Event Name': { title: [{ plain_text: 'Museum Visit' }] },
          'Event Type': { select: { name: 'Optional' } },
          'Show on Website': { checkbox: false },
        },
        'optional-2'
      ),
    ];

    const catalog = pages
      .map((page) => parseEventPage(page, 'nyc'))
      .filter((event) => event !== null);

    expect(catalog.filter((event) => event?.type === 'Core')).toHaveLength(1);
    expect(catalog.filter((event) => event?.type === 'Optional')).toEqual([]);
  });
});

test.describe('parseEventPage — other skip rules', () => {
  test('the other wedding’s events are not returned', () => {
    expect(parseEventPage(eventPage({}), 'france')).toBeNull();
    expect(
      parseEventPage(eventPage({ Wedding: { select: { name: 'France' } } }), 'france')
    ).not.toBeNull();
  });

  test('an untitled row is skipped', () => {
    expect(parseEventPage(eventPage({ 'Event Name': { title: [] } }), 'nyc')).toBeNull();
  });

  test('a non-page result is skipped', () => {
    expect(parseEventPage({ object: 'database', id: 'db-1' }, 'nyc')).toBeNull();
  });
});

test.describe('parseEventPage — field mapping', () => {
  test('optional fields default to undefined rather than empty strings', () => {
    const result = parseEventPage(eventPage({}), 'nyc');

    expect(result?.time).toBeUndefined();
    expect(result?.startTime).toBeUndefined();
    expect(result?.location).toBeUndefined();
    expect(result?.nameFr).toBeUndefined();
    expect(result?.dayId).toBeUndefined();
    // Event Type defaults to Core when the select is unset.
    expect(result?.type).toBe('Core');
  });

  test('reads timing, location and French display variants', () => {
    const result = parseEventPage(
      eventPage({
        'Event Type': { select: { name: 'Optional' } },
        Time: { rich_text: [{ plain_text: '9:00 AM' }] },
        'Start Time': { rich_text: [{ plain_text: '9:00 AM' }] },
        Duration: { rich_text: [{ plain_text: '3h' }] },
        'Event Date': { date: { start: '2026-10-10' } },
        Location: { rich_text: [{ plain_text: 'Grand Army Plaza' }] },
        'Event Name FR': { rich_text: [{ plain_text: 'Balade à vélo' }] },
        Day: { relation: [{ id: 'day-1' }] },
      }),
      'nyc'
    );

    expect(result?.type).toBe('Optional');
    expect(result?.startTime).toBe('9:00 AM');
    expect(result?.duration).toBe('3h');
    expect(result?.date).toBe('2026-10-10');
    expect(result?.location).toBe('Grand Army Plaza');
    expect(result?.nameFr).toBe('Balade à vélo');
    expect(result?.dayId).toBe('day-1');
  });
});

/**
 * Static guards on the pages that render the catalog.
 *
 * With both NYC optional events cancelled, `optionalEvents` is empty on every
 * request. These read the source rather than the rendered page because the
 * empty state is only reachable with a Notion backend and a real catalog —
 * the browser suites either skip (no credentials) or render the preview
 * fixtures, so a regression here would not fail any test that actually runs.
 */
test.describe('empty optional-events state is guarded in the page source', () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8');

  // Rendering the band unconditionally would leave a heading with nothing
  // under it once the last optional event is cancelled.
  for (const page of ['src/pages/nyc/rsvp.astro', 'src/pages/nyc/rsvp/confirmed.astro']) {
    test(`${page} hides the optional band when the list is empty`, () => {
      expect(read(page)).toContain('{optionalEvents.length > 0 && (');
    });
  }

  // France keeps an optional excursion, so it says so rather than vanishing.
  test('france/rsvp.astro renders a placeholder instead of hiding the section', () => {
    const source = read('src/pages/france/rsvp.astro');
    expect(source).toContain('optionalEvents.length === 0');
    expect(source).toContain('data-testid="no-optional-events"');
  });

  // Both weddings must also survive an empty *core* list.
  for (const page of [
    'src/pages/nyc/rsvp.astro',
    'src/pages/france/rsvp.astro',
    'src/pages/nyc/rsvp/confirmed.astro',
    'src/pages/france/rsvp/confirmed.astro',
  ]) {
    test(`${page} handles an empty core-events list`, () => {
      expect(read(page)).toContain('coreEvents.length === 0');
    });
  }

  // An empty catalog must not be read as "this party declined everything".
  test('POST /api/rsvp guards its decline normalization on a non-empty catalog', () => {
    expect(read('src/pages/api/rsvp.ts')).toContain(
      'invitedEventIds.size > 0 && body.eventsAttending.length === 0'
    );
  });
});
