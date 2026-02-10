import { test, expect } from '@playwright/test';
import { parseRSVPPage } from '../src/lib/notion';

test.describe('parseRSVPPage', () => {
  test('handles missing properties defensively', () => {
    const page = {
      object: 'page',
      id: 'page-123',
      properties: {},
    };

    const result = parseRSVPPage(page, 'guest-1', 'nyc');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('page-123');
    expect(result?.guestId).toBe('guest-1');
    expect(result?.event).toBe('nyc');
    expect(result?.status).toBe('Attending');
    expect(result?.guestsAttending).toBe('');
    expect(result?.dietary).toBeUndefined();
    expect(result?.message).toBeUndefined();
    expect(result?.details).toBeUndefined();
    expect(result?.eventsAttending).toBeUndefined();
  });

  test('handles invalid details JSON without throwing', () => {
    const page = {
      object: 'page',
      id: 'page-456',
      properties: {
        Details: { rich_text: [{ plain_text: '{invalid' }] },
      },
    };

    const result = parseRSVPPage(page, 'guest-2', 'france');

    expect(result).not.toBeNull();
    expect(result?.details).toBeUndefined();
    expect(result?.eventsAttending).toBeUndefined();
  });

  test('extracts eventsAttending safely from details', () => {
    const page = {
      object: 'page',
      id: 'page-789',
      properties: {
        Details: {
          rich_text: [
            {
              plain_text: JSON.stringify({
                eventsAttending: ['welcome', 123, 'afterparty'],
                notes: 'all good',
              }),
            },
          ],
        },
      },
    };

    const result = parseRSVPPage(page, 'guest-3', 'nyc');

    expect(result).not.toBeNull();
    expect(result?.eventsAttending).toEqual(['welcome', 'afterparty']);
    expect(result?.details).toEqual({ notes: 'all good' });
  });
});
