import { test, expect } from '@playwright/test';
import { parseRSVPPage, toRichTextItems } from '../src/lib/notion';

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

  test('reads Details split across multiple rich_text items', () => {
    // Long Details JSON (a big party's attendance array, France allergen text)
    // is written chunked because Notion rejects a single item over 2,000 chars.
    // The parser must concatenate every item, not read only the first.
    const details = {
      allergens: 'shellfish, '.repeat(300).trim(),
      eventsAttending: ['ceremony'],
      attendance: [{ guestId: 'guest-a', attending: true }],
    };
    const json = JSON.stringify(details);
    expect(json.length).toBeGreaterThan(2000);

    const items = toRichTextItems(json);
    expect(items.length).toBeGreaterThan(1);
    for (const item of items) {
      expect(item.text.content.length).toBeLessThanOrEqual(2000);
    }

    const page = {
      object: 'page',
      id: 'page-chunked',
      properties: {
        Details: {
          rich_text: items.map((item) => ({ plain_text: item.text.content })),
        },
      },
    };

    const result = parseRSVPPage(page, 'guest-a', 'france');

    expect(result).not.toBeNull();
    expect(result?.eventsAttending).toEqual(['ceremony']);
    expect(result?.attendanceById).toEqual({ 'guest-a': true });
    expect(result?.details).toEqual({ allergens: details.allergens });
  });

  test('toRichTextItems never emits an empty array', () => {
    expect(toRichTextItems('')).toEqual([{ text: { content: '' } }]);
  });
});
