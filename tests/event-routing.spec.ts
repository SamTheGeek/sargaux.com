import { test, expect } from '@playwright/test';
import { getPrimaryEventRoute } from '../src/lib/event-routing';

test.describe('Primary Event Routing', () => {
  test('routes dual-invited guests to NYC before October 15, 2026', () => {
    expect(getPrimaryEventRoute(['nyc', 'france'], new Date('2026-10-14T23:59:59-04:00'))).toBe('/nyc');
  });

  test('routes dual-invited guests to France starting October 15, 2026', () => {
    expect(getPrimaryEventRoute(['nyc', 'france'], new Date('2026-10-15T00:00:00-04:00'))).toBe('/france');
  });

  test('keeps single-event guests on their invited event', () => {
    expect(getPrimaryEventRoute(['nyc'], new Date('2026-11-01T12:00:00-04:00'))).toBe('/nyc');
    expect(getPrimaryEventRoute(['france'], new Date('2026-03-01T12:00:00-05:00'))).toBe('/france');
  });
});

