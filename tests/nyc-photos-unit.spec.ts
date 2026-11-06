import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import {
  applyFeatured,
  buildAssetUrl,
  parseAlbumRecords,
  parseShareHandle,
  lookupRenditionUrls,
  queryAlbumReactions,
  renditionUrlsFromRecords,
  queryAlbumRecords,
  sortChronologically,
  thumbsDownAssetIds,
  toManifest,
  urlsByChecksum,
  DEFAULT_FEATURED_COUNT,
  type ManifestPhoto,
  type ShareHandle,
} from '../src/lib/icloud-stream';
import { NYC_GALLERY_CONFIG, downloadFilename } from '../src/content/nycGalleryConfig';
import { CACHE_TTL_MS, URL_LIFETIME_MS, URL_SAFETY_MS, redirectMaxAge, urlExpiry } from '../src/lib/icloud-photos';

// Shapes copied from a real photos.icloud.com shared-album response, with
// invented ids, checksums and signatures.
const ZONE = { zoneName: 'SharedCollection-TEST', ownerRecordName: '_owner', zoneType: 'REGULAR_CUSTOM_ZONE' };
const dl = (sum: string) =>
  `https://cvws-h2.icloud-content.com/B/${sum}/\${f}?o=signed&v=1&x=3`;

function res(sum: string, w: number, h: number, prefix: string) {
  return {
    [`${prefix}Res`]: { type: 'ASSETID', value: { fileChecksum: sum, size: 1000, downloadURL: dl(sum) } },
    [`${prefix}Width`]: { type: 'INT64', value: w },
    [`${prefix}Height`]: { type: 'INT64', value: h },
  };
}

function master(name: string, extra: Record<string, unknown> = {}) {
  return {
    recordName: name,
    recordType: 'CPLMaster',
    fields: {
      itemType: { value: 'public.jpeg' },
      filenameEnc: { value: 'c2VjcmV0LW5hbWUuanBn' },
      originalCreationDate: { value: 1791778800000 },
      ...res(`${name}-t`, 509, 339, 'resJPEGThumb'),
      ...res(`${name}-m`, 2172, 1448, 'resJPEGMed'),
      ...extra,
    },
  };
}

function asset(guid: string, masterName: string, assetDate: number | undefined, extra: Record<string, unknown> = {}) {
  return {
    recordName: guid,
    recordType: 'CPLAsset',
    fields: {
      ...(assetDate === undefined ? {} : { assetDate: { value: assetDate } }),
      masterRef: { value: { recordName: masterName, zoneID: ZONE } },
      ...extra,
    },
  };
}

test.describe('parseAlbumRecords', () => {
  test('pairs assets with masters and sorts oldest first', () => {
    const photos = parseAlbumRecords([
      master('M3'), asset('cccccccc-3', 'M3', 1791790000000),
      master('M1'), asset('aaaaaaaa-1', 'M1', 1791770000000),
      master('M2'), asset('bbbbbbbb-2', 'M2', 1791780000000),
    ]);
    expect(photos.map((p) => p.guid)).toEqual(['aaaaaaaa-1', 'bbbbbbbb-2', 'cccccccc-3']);
    expect(photos[0].thumb).toEqual({ checksum: 'M1-t', width: 509, height: 339 });
    expect(photos[0].full).toEqual({ checksum: 'M1-m', width: 2172, height: 1448 });
    expect(photos[0].thumbUrl).toBe('https://cvws-h2.icloud-content.com/B/M1-t/photo.jpg?o=signed&v=1&x=3');
  });

  test('falls back to the master creation date when the asset has none', () => {
    const [p] = parseAlbumRecords([master('M1'), asset('aaaaaaaa-1', 'M1', undefined)]);
    expect(p.takenAt).toBe(new Date(1791778800000).toISOString());
  });

  test('prefers an edited rendition on the asset over the master', () => {
    const [p] = parseAlbumRecords([
      master('M1'),
      asset('aaaaaaaa-1', 'M1', 1791770000000, res('EDIT-f', 2000, 2000, 'resJPEGFull')),
    ]);
    expect(p.full.checksum).toBe('EDIT-f');
  });

  test('skips videos, orphans, bad ids and photos without both renditions', () => {
    const noMed = master('M4');
    delete (noMed.fields as Record<string, unknown>).resJPEGMedRes;
    const photos = parseAlbumRecords([
      master('M1', { itemType: { value: 'com.apple.quicktime-movie' } }), asset('aaaaaaaa-1', 'M1', 1),
      asset('bbbbbbbb-2', 'MISSING', 2),
      master('M3'), asset('bad id!', 'M3', 3),
      noMed, asset('dddddddd-4', 'M4', 4),
      master('M5'), asset('eeeeeeee-5', 'M5', 5),
    ]);
    expect(photos.map((p) => p.guid)).toEqual(['eeeeeeee-5']);
  });

  test('the manifest copies no URL, filename or other free text', () => {
    const manifest = toManifest(parseAlbumRecords([master('M1'), asset('aaaaaaaa-1', 'M1', 1)]));
    expect(Object.keys(manifest[0]).sort()).toEqual(['full', 'guid', 'master', 'original', 'takenAt', 'thumb']);
    expect(manifest[0].master).toBe('M1');
    const text = JSON.stringify(manifest);
    expect(text).not.toContain('http');
    expect(text).not.toContain('c2VjcmV0');
  });

  test('urlsByChecksum maps every rendition, the download original included', () => {
    const jpegOriginal = { resOriginalFileType: { value: 'public.jpeg' }, ...res('M1-o', 3200, 2133, 'resOriginal') };
    const urls = urlsByChecksum(parseAlbumRecords([master('M1', jpegOriginal), asset('aaaaaaaa-1', 'M1', 1)]));
    expect([...urls.keys()].sort()).toEqual(['M1-m', 'M1-o', 'M1-t']);
  });
});

test.describe('per-photo URL lookup', () => {
  const share: ShareHandle = { partition: 'https://p121-ckdatabasews.icloud.com', accessToken: 'TOK', zoneID: ZONE };

  test('looks up the named records with only the rendition fields, and maps checksum → URL', async () => {
    let sent: Record<string, any> = {};
    let url = '';
    const fake = async (u: string, init?: RequestInit) => {
      url = u;
      sent = JSON.parse(String(init?.body));
      // An unedited photo: the asset carries no renditions, the master three.
      return new Response(JSON.stringify({ records: [
        { recordName: 'aaaaaaaa-1', recordType: 'CPLAsset', fields: {} },
        { recordName: 'M1', recordType: 'CPLMaster', fields: {
          ...res('T1', 509, 339, 'resJPEGThumb'), ...res('D1', 2172, 1448, 'resJPEGMed'), ...res('O1', 3200, 2133, 'resOriginal'),
        } },
      ] }), { status: 200 });
    };
    const urls = await lookupRenditionUrls(fake, 'SHARETOKEN', share, ['aaaaaaaa-1', 'M1']);
    expect([...urls.keys()].sort()).toEqual(['D1', 'O1', 'T1']);
    expect(urls.get('O1')).toBe('https://cvws-h2.icloud-content.com/B/O1/photo.jpg?o=signed&v=1&x=3');
    expect(sent.records).toEqual([{ recordName: 'aaaaaaaa-1' }, { recordName: 'M1' }]);
    expect(sent.zoneID).toEqual(ZONE);
    expect(sent.desiredKeys).toEqual(['resJPEGThumbRes', 'resJPEGMedRes', 'resJPEGFullRes', 'resOriginalRes']);
    const u = new URL(url);
    expect(u.pathname).toContain('/shared/records/lookup');
    expect(u.searchParams.get('publicAccessAuthToken')).toBe('TOK');
  });

  test('an edit on the asset contributes its URL too; foreign hosts are dropped', () => {
    const urls = renditionUrlsFromRecords([
      { recordType: 'CPLAsset', fields: res('EDIT', 3000, 2000, 'resJPEGFull') },
      { recordType: 'CPLMaster', fields: { resJPEGThumbRes: { value: { fileChecksum: 'BAD', downloadURL: 'https://evil.example.com/${f}' } } } },
    ]);
    expect([...urls.keys()]).toEqual(['EDIT']);
  });

  test('an expired share token surfaces as a 401 the resolver can retry on', async () => {
    const fake = async () => new Response('{}', { status: 401 });
    const err = await lookupRenditionUrls(fake, 'SHARETOKEN', share, ['x']).catch((e) => e);
    expect(err.status).toBe(401);
  });
});

test.describe('download original', () => {
  const pick = (masterExtra: Record<string, unknown>, assetExtra: Record<string, unknown> = {}) =>
    parseAlbumRecords([master('M1', masterExtra), asset('aaaaaaaa-1', 'M1', 1, assetExtra)])[0].original;

  test('is the camera original when it is a JPEG', () => {
    const o = pick({ resOriginalFileType: { value: 'public.jpeg' }, ...res('ORIG', 3200, 2133, 'resOriginal') });
    expect(o).toEqual({ checksum: 'ORIG', width: 3200, height: 2133 });
  });

  test('skips a HEIC original for the largest JPEG', () => {
    const heic = { resOriginalFileType: { value: 'public.heic' }, ...res('HEIC', 4032, 3024, 'resOriginal') };
    expect(pick(heic).checksum).toBe('M1-m');
    expect(pick({ ...heic, ...res('FULLJPEG', 4032, 3024, 'resJPEGFull') }).checksum).toBe('FULLJPEG');
  });

  test('an edited rendition on the asset wins over the original', () => {
    const o = pick(
      { resOriginalFileType: { value: 'public.jpeg' }, ...res('ORIG', 3200, 2133, 'resOriginal') },
      res('EDIT', 3000, 2000, 'resJPEGFull')
    );
    expect(o.checksum).toBe('EDIT');
  });
});

test('downloadFilename numbers photos by gallery position, never by iCloud name', () => {
  expect(downloadFilename('afterparty', 12)).toBe('sargaux-nyc-afterparty-012.jpg');
  expect(downloadFilename('celebration', 1, 'svg')).toBe('sargaux-nyc-celebration-001.svg');
  expect(downloadFilename('preparation', 1234)).toBe('sargaux-nyc-preparation-1234.jpg');
});

test.describe('buildAssetUrl', () => {
  test('fills the filename placeholder and accepts only https on icloud-content.com', () => {
    expect(buildAssetUrl(dl('X'))).toBe('https://cvws-h2.icloud-content.com/B/X/photo.jpg?o=signed&v=1&x=3');
    expect(buildAssetUrl('https://evil.example.com/${f}')).toBeNull();
    expect(buildAssetUrl('https://cvws.icloud-content.com.evil.com/${f}')).toBeNull();
    expect(buildAssetUrl('http://cvws.icloud-content.com/${f}')).toBeNull();
    expect(buildAssetUrl(undefined)).toBeNull();
  });
});

test.describe('parseShareHandle', () => {
  const good = {
    results: [{
      zoneID: ZONE,
      ownerIdentity: { lookupInfo: { emailAddress: 'owner@example.com' } },
      anonymousPublicAccess: { token: 'TOKEN', databasePartition: 'https://p121-ckdatabasews.icloud.com:443' },
    }],
  };

  test('reads the partition, token and zone, and nothing about the owner', () => {
    const handle = parseShareHandle(good);
    expect(handle).toEqual({
      partition: 'https://p121-ckdatabasews.icloud.com',
      accessToken: 'TOKEN',
      zoneID: ZONE,
    });
    expect(JSON.stringify(handle)).not.toContain('owner@example.com');
  });

  test('rejects a partition that is not a CloudKit host', () => {
    const bad = structuredClone(good);
    bad.results[0].anonymousPublicAccess.databasePartition = 'https://evil.example.com';
    expect(parseShareHandle(bad)).toBeNull();
    expect(parseShareHandle({ results: [] })).toBeNull();
    expect(parseShareHandle(null)).toBeNull();
  });
});

test.describe('queryAlbumRecords', () => {
  const share: ShareHandle = { partition: 'https://p121-ckdatabasews.icloud.com', accessToken: 'TOK', zoneID: ZONE };

  test('follows continuationMarker until the album is exhausted', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const urls: string[] = [];
    const fake = async (url: string, init?: RequestInit) => {
      urls.push(url);
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      const page = bodies.length;
      return new Response(
        JSON.stringify(page === 1 ? { records: [master('M1')], continuationMarker: 'NEXT' } : { records: [asset('aaaaaaaa-1', 'M1', 1)] }),
        { status: 200 }
      );
    };
    const records = await queryAlbumRecords(fake, 'SHARETOKEN', share);
    expect(records).toHaveLength(2);
    expect(bodies[1].continuationMarker).toBe('NEXT');
    expect(bodies[0].zoneID).toEqual(ZONE);
    const u = new URL(urls[0]);
    expect(u.hostname).toBe('p121-ckdatabasews.icloud.com');
    expect(u.pathname).toContain('/shared/records/query');
    expect(u.searchParams.get('publicAccessAuthToken')).toBe('TOK');
    expect(u.searchParams.get('sharing_url_key')).toBe('SHARETOKEN');
  });

  test('surfaces an HTTP error', async () => {
    const fake = async () => new Response('{}', { status: 421 });
    await expect(queryAlbumRecords(fake, 'SHARETOKEN', share)).rejects.toThrow(/421/);
  });
});

function photo(guid: string, takenAt: string, featured = false): ManifestPhoto {
  const d = { checksum: guid, width: 10, height: 10 };
  return { guid, master: `M-${guid}`, takenAt, thumb: d, full: d, original: d, ...(featured ? { featured: true } : {}) };
}

test('sortChronologically breaks ties by GUID so reruns are stable', () => {
  const t = '2026-10-11T23:00:00.000Z';
  expect(sortChronologically([photo('B', t), photo('A', t)]).map((p) => p.guid)).toEqual(['A', 'B']);
});

test.describe('thumbsDownAssetIds', () => {
  const react = (asset: string, emoji: string, extra: Record<string, unknown> = {}) => ({
    recordName: `R-${asset}-${emoji.codePointAt(0)}`,
    recordType: 'CPLReact',
    created: { userRecordName: '_reactor-secret', timestamp: 1 },
    modified: { userRecordName: '_reactor-secret', timestamp: 1 },
    fields: {
      emojiStringEnc: { type: 'STRING', value: emoji },
      associatedAssetRef: { type: 'REFERENCE', value: { recordName: asset, zoneID: ZONE } },
    },
    ...extra,
  });

  test('a 👎 from anyone hides the photo, with any skin tone or presentation selector', () => {
    const ids = thumbsDownAssetIds([
      react('aaaaaaaa-1', '👎'),
      react('bbbbbbbb-2', '👎🏽'),
      react('cccccccc-3', '👎\uFE0F'),
    ]);
    expect([...ids].sort()).toEqual(['aaaaaaaa-1', 'bbbbbbbb-2', 'cccccccc-3']);
  });

  test('other reactions are ignored', () => {
    expect(thumbsDownAssetIds([react('aaaaaaaa-1', '👍'), react('bbbbbbbb-2', '❤️'), react('cccccccc-3', '😂')]).size).toBe(0);
  });

  test('a removed 👎 (tombstone) does not hide the photo', () => {
    const removed = { recordName: 'R-gone', recordType: 'CPLReact', deleted: true };
    const deletedWithFields = react('aaaaaaaa-1', '👎', { deleted: true });
    expect(thumbsDownAssetIds([removed, deletedWithFields]).size).toBe(0);
  });

  test('several 👎 on one photo count once, and non-reaction records are skipped', () => {
    const ids = thumbsDownAssetIds([
      react('aaaaaaaa-1', '👎'),
      react('aaaaaaaa-1', '👎🏻'),
      master('M1'),
      asset('bbbbbbbb-2', 'M1', 1),
    ]);
    expect([...ids]).toEqual(['aaaaaaaa-1']);
  });

  test('never reads who reacted', () => {
    const ids = thumbsDownAssetIds([react('aaaaaaaa-1', '👎')]);
    expect(JSON.stringify([...ids])).not.toContain('_reactor-secret');
  });
});

test.describe('queryAlbumReactions', () => {
  const share: ShareHandle = { partition: 'https://p121-ckdatabasews.icloud.com', accessToken: 'TOK', zoneID: ZONE };
  const reactRecord = (n: number) => ({
    recordName: `R${n}`,
    recordType: 'CPLReact',
    fields: { emojiStringEnc: { value: '👎' }, associatedAssetRef: { value: { recordName: `aaaaaaaa-${n}` } } },
  });

  test('follows the change feed across pages and keeps only reactions', async () => {
    const bodies: Array<Record<string, any>> = [];
    const urls: string[] = [];
    const fake = async (url: string, init?: RequestInit) => {
      urls.push(url);
      bodies.push(JSON.parse(String(init?.body)));
      const page = bodies.length;
      const zone =
        page === 1
          ? { records: [reactRecord(1), master('M1')], syncToken: 'T1', moreComing: true }
          : { records: [reactRecord(2)], syncToken: 'T2', moreComing: false };
      return new Response(JSON.stringify({ zones: [zone] }), { status: 200 });
    };
    const records = await queryAlbumReactions(fake, 'SHARETOKEN', share);
    expect(records.map((r) => (r as { recordName: string }).recordName)).toEqual(['R1', 'R2']);
    expect(bodies[0].zones[0].desiredRecordTypes).toEqual(['CPLReact']);
    expect(bodies[0].zones[0].zoneID).toEqual(ZONE);
    expect(bodies[0].zones[0].syncToken).toBeUndefined();
    expect(bodies[1].zones[0].syncToken).toBe('T1');
    const u = new URL(urls[0]);
    expect(u.pathname).toContain('/shared/changes/zone');
    expect(u.searchParams.get('publicAccessAuthToken')).toBe('TOK');
    expect(u.searchParams.get('sharing_url_key')).toBe('SHARETOKEN');
  });

  test('surfaces an HTTP error', async () => {
    const fake = async () => new Response('{}', { status: 403 });
    await expect(queryAlbumReactions(fake, 'SHARETOKEN', share)).rejects.toThrow(/403/);
  });
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

  test('a resync that loses nothing leaves a hand-curated set exactly as it was', () => {
    const previous = photos.map((p) => (['G03', 'G11'].includes(p.guid) ? { ...p, featured: true } : p));
    const out = applyFeatured(photos, previous, DEFAULT_FEATURED_COUNT, () => 0);
    expect(out.filter((p) => p.featured).map((p) => p.guid)).toEqual(['G03', 'G11']);
  });

  test('a featured photo that drops out (e.g. thumbed down) is replaced, keeping the count', () => {
    const featuredBefore = ['G01', 'G05', 'G09', 'G13', 'G15', 'G17'];
    const previous = photos.map((p) => (featuredBefore.includes(p.guid) ? { ...p, featured: true } : p));
    // G05 and G13 got a 👎, so the sync leaves them out.
    const next = photos.filter((p) => p.guid !== 'G05' && p.guid !== 'G13');
    const out = applyFeatured(next, previous, DEFAULT_FEATURED_COUNT, () => 0.5);
    const featured = out.filter((p) => p.featured).map((p) => p.guid);
    expect(featured).toHaveLength(6);
    for (const kept of ['G01', 'G09', 'G15', 'G17']) expect(featured).toContain(kept);
    expect(featured).not.toContain('G05');
    expect(featured).not.toContain('G13');
  });

  test('draws a fresh set only when every featured photo has left the album', () => {
    const previous = [photo('GONE', '2026-10-11T22:00:00.000Z', true)];
    const out = applyFeatured(photos, previous, 3, () => 0);
    expect(out.filter((p) => p.featured)).toHaveLength(3);
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
        expect(Object.keys(p).every((k) => ['guid', 'master', 'takenAt', 'thumb', 'full', 'original', 'featured'].includes(k))).toBe(true);
        expect(typeof p.master === 'string' && p.master.length > 0).toBe(true);
        for (const d of [p.thumb, p.full, p.original]) {
          expect(typeof d.checksum).toBe('string');
          expect(d.width).toBeGreaterThan(0);
          expect(d.height).toBeGreaterThan(0);
        }
      }
    });
  }
});

test.describe('redirectMaxAge (iCloud URLs expire ~15 minutes after issue)', () => {
  const t0 = Date.UTC(2026, 10, 2, 12, 0, 0);
  const min = 60 * 1000;

  test('a freshly issued URL may be cached for at most 5 minutes', () => {
    expect(redirectMaxAge(t0, t0)).toBe(300);
  });

  test('never lets a browser hold a redirect past the URL lifetime minus the margin', () => {
    // Issued 8 min ago (the oldest a cached set can be): 15 − 2 − 8 = 5 min left.
    expect(redirectMaxAge(t0, t0 + CACHE_TTL_MS)).toBe(300);
    expect(redirectMaxAge(t0, t0 + 11 * min)).toBe(120);
    for (let ago = 0; ago <= 15 * min; ago += 30 * 1000) {
      const now = t0 + ago;
      const maxAge = redirectMaxAge(t0, now);
      if (maxAge > 0) {
        expect(now + maxAge * 1000).toBeLessThanOrEqual(t0 + URL_LIFETIME_MS - URL_SAFETY_MS);
      }
    }
  });

  test('an expired or nearly expired URL is not cached at all', () => {
    expect(redirectMaxAge(t0, t0 + 13 * min)).toBe(0);
    expect(redirectMaxAge(t0, t0 + 20 * min)).toBe(0);
  });

  test("honours the URL's own e= expiry when it is sooner", () => {
    const url = `https://cvws-h2.icloud-content.com/B/X/photo.jpg?o=s&e=${Math.floor((t0 + 5 * min) / 1000)}`;
    expect(urlExpiry(url)).toBe(t0 + 5 * min);
    // 5 min stated − 2 min margin = 3 min, despite a fresh fetch.
    expect(redirectMaxAge(t0, t0, url)).toBe(180);
    // A later stated expiry never extends past issue + 15 min.
    const late = `https://cvws-h2.icloud-content.com/B/X/photo.jpg?e=${Math.floor((t0 + 60 * min) / 1000)}`;
    expect(redirectMaxAge(t0, t0 + 11 * min, late)).toBe(120);
    expect(urlExpiry('https://cvws-h2.icloud-content.com/B/X/photo.jpg')).toBeNull();
  });

  test('the server cache is shorter than the URL lifetime minus the margin', () => {
    expect(CACHE_TTL_MS).toBeLessThan(URL_LIFETIME_MS - URL_SAFETY_MS);
  });
});
