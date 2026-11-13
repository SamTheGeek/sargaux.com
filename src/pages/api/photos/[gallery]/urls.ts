import type { APIRoute } from 'astro';
import { getAuthenticatedGuest } from '../../../../lib/auth';
import { hasGalleryPass } from '../../../../lib/gallery-pass';
import { features } from '../../../../config/features';
import { getNycGallery, isPhotoTestFixture } from '../../../../content/nycGalleries';
import { MAX_BATCH, resolveManyPhotoUrls, usableUntil } from '../../../../lib/icloud-photos';

/** One photo's URLs as the gallery page uses them. */
export interface BatchEntry {
  thumb: string;
  full: string;
  /**
   * How much longer (ms) the page may use these URLs, counted from when it
   * receives them. Relative, so a guest's wrong clock can't stretch it.
   */
  ttl: number;
}

export interface BatchResponse {
  photos: Record<string, BatchEntry>;
}

/** Fixture URLs are our own placeholder endpoint, which never expires. */
const FIXTURE_LIFETIME_MS = 10 * 60 * 1000;

const json = (body: BatchResponse | null, status: number) =>
  new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });

/**
 * GET /api/photos/{gallery}/urls?ids=guid,guid,…
 *
 * Fresh, signed iCloud URLs for up to MAX_BATCH photos of one gallery, so a
 * gallery page loads its thumbnails straight from iCloud with one function
 * call per batch rather than one redirect per image (Celebration alone is
 * 368 photos).
 *
 * Same gate as the redirect endpoint: a signed session cookie, and only GUIDs
 * in that gallery's committed manifest. Unknown GUIDs are left out rather
 * than failing the batch, as are photos iCloud didn't answer for; the page
 * falls back to the redirect endpoint for any photo missing from the answer.
 * Download originals are not included: downloads stay same-origin.
 */
export const GET: APIRoute = async ({ params, url, cookies }) => {
  if (!features.nyc.photoGallery) return json(null, 404);
  if (!getAuthenticatedGuest(cookies) && !hasGalleryPass(cookies)) return json(null, 401);

  const gallery = getNycGallery(params.gallery);
  if (!gallery) return json(null, 404);

  const ids = [...new Set((url.searchParams.get('ids') ?? '').split(',').filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_BATCH) return json(null, 400);

  const wanted = new Set(ids);
  const photos = gallery.photos.filter((p) => wanted.has(p.guid));
  const out: BatchResponse = { photos: {} };

  if (isPhotoTestFixture()) {
    for (const p of photos) {
      const base = `/api/photos/${gallery.id}/${encodeURIComponent(p.guid)}`;
      out.photos[p.guid] = { thumb: `${base}?size=thumb`, full: `${base}?size=full`, ttl: FIXTURE_LIFETIME_MS };
    }
    return json(out, 200);
  }

  if (!gallery.albumToken) return json(null, 404);
  if (photos.length === 0) return json(out, 200);

  const resolved = await resolveManyPhotoUrls(gallery.albumToken, photos);
  for (const p of photos) {
    const r = resolved.get(p.guid);
    const thumb = r?.urls.get(p.thumb.checksum);
    const full = r?.urls.get(p.full.checksum);
    if (!r || !thumb || !full) continue;
    const until = Math.min(usableUntil(r.fetchedAt, thumb), usableUntil(r.fetchedAt, full));
    const ttl = until - Date.now();
    if (ttl > 0) out.photos[p.guid] = { thumb, full, ttl };
  }
  return json(out, 200);
};
