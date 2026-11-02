import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import {
  applyFeatured,
  buildAssetUrl,
  parseAssetUrls,
  parseWebstream,
  pickDerivatives,
  postStream,
  redirectHost,
  sortChronologically,
  DEFAULT_FEATURED_COUNT,
  type ManifestPhoto,
} from '../src/lib/icloud-stream';
import { NYC_GALLERY_CONFIG } from '../src/content/nycGalleryConfig';

const derivative = (checksum: string, width: number, height: number) => ({
  checksum,
  width: String(width),
  height: String(height),
  fileSize: '1000',
});

function rawPhoto(guid: string, dateCreated: string | undefined, extra: Record<string, unknown> = {}) {
  return {
    photoGuid: guid,
    dateCreated,
    batchDateCreated: '2026-10-12T05:00:00Z',
    caption: 'should never be copied',
    derivatives: {
      '342': derivative(`${guid}-s`, 342, 256),
      '2049': derivative(`${guid}-l`, 2048, 1536),
    },
    ...extra,
  };
}

function photo(guid: string, takenAt: string, featured = false): ManifestPhoto {
  const d = { checksum: guid, width: 10, height: 10 };
  return { guid, takenAt, thumb: d, full: d, ...(featured ? { featured: true } : {}) };
}

test.describe('parseWebstream', () => {
  test('sorts oldest first regardless of album order', () => {
    const parsed = parseWebstream({
      photos: [
        rawPhoto('CCCCCCCC-3', '2026-10-12T01:00:00Z'),
        rawPhoto('AAAAAAAA-1', '2026-10-11T23:00:00Z'),
        rawPhoto('BBBBBBBB-2', '2026-10-12T00:30:00Z'),
      ],
    });
    expect(parsed.map((p) => p.guid)).toEqual(['AAAAAAAA-1', 'BBBBBBBB-2', 'CCCCCCCC-3']);
  });

  test('falls back to batchDateCreated when the capture time is missing', () => {
    const [p] = parseWebstream({ photos: [rawPhoto('AAAAAAAA-1', undefined)] });
    expect(p.takenAt).toBe('2026-10-12T05:00:00.000Z');
  });

  test('skips videos and items without usable stills', () => {
    const parsed = parseWebstream({
      photos: [
        rawPhoto('AAAAAAAA-1', '2026-10-11T23:00:00Z', { mediaAssetType: 'video' }),
        rawPhoto('BBBBBBBB-2', '2026-10-11T23:00:00Z', { derivatives: { PosterFrame: derivative('x', 640, 480) } }),
        rawPhoto('bad guid!', '2026-10-11T23:00:00Z'),
        rawPhoto('CCCCCCCC-3', '2026-10-11T23:00:00Z'),
      ],
    });
    expect(parsed.map((p) => p.guid)).toEqual(['CCCCCCCC-3']);
  });

  test('copies no caption or other free text', () => {
    const [p] = parseWebstream({ photos: [rawPhoto('AAAAAAAA-1', '2026-10-11T23:00:00Z')] });
    expect(Object.keys(p).sort()).toEqual(['full', 'guid', 'takenAt', 'thumb']);
    expect(JSON.stringify(p)).not.toContain('should never be copied');
  });

  test('returns nothing for a malformed body', () => {
    expect(parseWebstream(null)).toEqual([]);
    expect(parseWebstream({ photos: 'nope' })).toEqual([]);
  });
});

test.describe('pickDerivatives', () => {
  test('thumb is the smallest rendition at least 400px wide, full the largest', () => {
    const picked = pickDerivatives([
      { checksum: 'l', width: 2048, height: 1536 },
      { checksum: 's', width: 342, height: 256 },
      { checksum: 'm', width: 640, height: 480 },
    ]);
    expect(picked?.thumb.checksum).toBe('m');
    expect(picked?.full.checksum).toBe('l');
  });

  test('falls back to the largest rendition when every one is small', () => {
    const picked = pickDerivatives([
      { checksum: 'a', width: 300, height: 200 },
      { checksum: 'b', width: 342, height: 256 },
    ]);
    expect(picked?.thumb.checksum).toBe('b');
  });
});

test('sortChronologically breaks ties by GUID so reruns are stable', () => {
  const t = '2026-10-11T23:00:00.000Z';
  expect(sortChronologically([photo('B', t), photo('A', t)]).map((p) => p.guid)).toEqual(['A', 'B']);
});

test.describe('applyFeatured', () => {
  const photos = Array.from({ length: 20 }, (_, i) =>
    photo(`G${String(i).padStart(2, '0')}`, `2026-10-11T23:${String(i).padStart(2, '0')}:00.000Z`)
  );

  test('first sync features DEFAULT_FEATURED_COUNT photos at random, not the first few', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out = applyFeatured(photos, [], DEFAULT_FEATURED_COUNT, random);
    const featured = out.filter((p) => p.featured).map((p) => p.guid);
    expect(featured).toHaveLength(DEFAULT_FEATURED_COUNT);
    expect(featured).not.toEqual(photos.slice(0, DEFAULT_FEATURED_COUNT).map((p) => p.guid));
    // Order is untouched — still oldest first.
    expect(out.map((p) => p.guid)).toEqual(photos.map((p) => p.guid));
  });

  test('a resync keeps the existing featured choice', () => {
    const previous = photos.map((p) => (['G03', 'G11'].includes(p.guid) ? { ...p, featured: true } : p));
    const out = applyFeatured(photos, previous, DEFAULT_FEATURED_COUNT, () => 0);
    expect(out.filter((p) => p.featured).map((p) => p.guid)).toEqual(['G03', 'G11']);
  });

  test('draws a fresh set only when every featured photo has left the album', () => {
    const previous = [photo('GONE', '2026-10-11T22:00:00.000Z', true)];
    const out = applyFeatured(photos, previous, 3, () => 0);
    expect(out.filter((p) => p.featured)).toHaveLength(3);
  });
});

test.describe('asset URLs', () => {
  test('builds https URLs on Apple hosts only', () => {
    expect(buildAssetUrl('cvws.icloud-content.com', '/S/abc/IMG.JPG?o=1')).toBe(
      'https://cvws.icloud-content.com/S/abc/IMG.JPG?o=1'
    );
    expect(buildAssetUrl('evil.example.com', '/x')).toBeNull();
    expect(buildAssetUrl('cvws.icloud-content.com.evil.com', '/x')).toBeNull();
    expect(buildAssetUrl('cvws.icloud-content.com', 'x')).toBeNull();
  });

  test('parseAssetUrls maps checksum → URL and drops bad entries', () => {
    const urls = parseAssetUrls({
      items: {
        c1: { url_location: 'cvws.icloud-content.com', url_path: '/a' },
        c2: { url_location: 'evil.example.com', url_path: '/b' },
        c3: { url_path: '/c' },
      },
    });
    expect([...urls.keys()]).toEqual(['c1']);
  });
});

test.describe('postStream', () => {
  test('follows the one-time 330 partition redirect', async () => {
    const calls: string[] = [];
    const fake = async (url: string) => {
      calls.push(url);
      if (url.includes('p23-')) {
        return new Response('{}', { status: 330, headers: { 'X-Apple-MMe-Host': 'p42-sharedstreams.icloud.com' } });
      }
      return new Response(JSON.stringify({ photos: [] }), { status: 200 });
    };
    const { host, body } = await postStream(fake, 'TOKEN123', 'webstream', { streamCtag: null });
    expect(host).toBe('p42-sharedstreams.icloud.com');
    expect(body).toEqual({ photos: [] });
    expect(calls).toHaveLength(2);
  });

  test('ignores a redirect to a non-sharedstreams host', () => {
    expect(redirectHost(330, 'evil.example.com')).toBeNull();
    expect(redirectHost(200, 'p42-sharedstreams.icloud.com')).toBeNull();
  });
});

test.describe('committed manifests', () => {
  const dir = join(import.meta.dirname, '../src/content/nycPhotos');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  test('there is one manifest per configured gallery', () => {
    for (const { id } of NYC_GALLERY_CONFIG) expect(files).toContain(`${id}.json`);
  });

  for (const file of files) {
    test(`${file} is valid, oldest first, and caption-free`, () => {
      const photos = JSON.parse(readFileSync(join(dir, file), 'utf8')) as ManifestPhoto[];
      expect(Array.isArray(photos)).toBe(true);
      expect(new Set(photos.map((p) => p.guid)).size).toBe(photos.length);
      for (let i = 1; i < photos.length; i++) {
        expect(Date.parse(photos[i].takenAt)).toBeGreaterThanOrEqual(Date.parse(photos[i - 1].takenAt));
      }
      for (const p of photos) {
        expect(Object.keys(p).every((k) => ['guid', 'takenAt', 'thumb', 'full', 'featured'].includes(k))).toBe(true);
        for (const d of [p.thumb, p.full]) {
          expect(typeof d.checksum).toBe('string');
          expect(d.width).toBeGreaterThan(0);
          expect(d.height).toBeGreaterThan(0);
        }
      }
    });
  }
});
