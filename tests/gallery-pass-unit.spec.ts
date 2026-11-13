import { test, expect } from '@playwright/test';
import { findGalleryPass, isGalleryPassPath } from '../src/lib/gallery-pass';

test.describe('gallery pass', () => {
  test('opens only the event page and the gallery pages', () => {
    for (const path of ['/nyc', '/nyc/', '/nyc/photos/celebration', '/nyc/photos/afterparty/']) {
      expect(isGalleryPassPath(path), path).toBe(true);
    }
    for (const path of [
      '/nyc/faq',
      '/nyc/rsvp',
      '/nyc/rsvp/confirmed',
      '/nyc/photos',
      '/nyc/photos/celebration/extra',
      '/nycfoo',
      '/france',
      '/couple',
      '/registry',
    ]) {
      expect(isGalleryPassPath(path), path).toBe(false);
    }
  });

  test('rejects unknown, malformed and empty codes', () => {
    for (const code of [undefined, null, '', 'short', 'not-a-real-code-123', 'has spaces in it', '../../etc/passwd', 'x'.repeat(65)]) {
      expect(findGalleryPass(code), String(code)).toBeNull();
    }
  });
});
