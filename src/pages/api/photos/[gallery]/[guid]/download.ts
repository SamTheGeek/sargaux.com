import type { APIRoute } from 'astro';
import { getAuthenticatedGuest } from '../../../../../lib/auth';
import { features } from '../../../../../config/features';
import { downloadFilename, getNycGallery, isPhotoTestFixture } from '../../../../../content/nycGalleries';
import { resolvePhotoUrls } from '../../../../../lib/icloud-photos';
import { placeholderSvg } from '../../../../../lib/photo-placeholder';

const UPSTREAM_TIMEOUT_MS = 20_000;

/**
 * GET /api/photos/{gallery}/{guid}/download
 *
 * Streams a photo's original (the best JPEG, see pickOriginal in
 * icloud-stream.ts) as an attachment, from our own origin. It can't be a
 * redirect like the image endpoint: browsers ignore `<a download>` and
 * Content-Disposition on a cross-origin URL, so the file has to be served
 * from here to save under a name instead of opening in a tab.
 *
 * Same gate as the image endpoint: a signed session cookie, and only GUIDs in
 * a visible gallery's committed manifest. The upstream URL only ever comes
 * from `parseAssetUrls`, which accepts https on *.icloud-content.com, so this
 * can't be pointed anywhere else.
 */
export const GET: APIRoute = async ({ params, cookies }) => {
  if (!features.nyc.photoGallery) return new Response(null, { status: 404 });
  if (!getAuthenticatedGuest(cookies)) return new Response(null, { status: 401 });

  const gallery = getNycGallery(params.gallery);
  const index = gallery?.photos.findIndex((p) => p.guid === params.guid) ?? -1;
  if (!gallery || index < 0) return new Response(null, { status: 404 });
  const photo = gallery.photos[index];

  if (isPhotoTestFixture()) {
    return new Response(placeholderSvg(photo.original.width, photo.original.height), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Content-Disposition': `attachment; filename="${downloadFilename(gallery.id, index + 1, 'svg')}"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  }

  if (!gallery.albumToken) return new Response(null, { status: 404 });
  const { urls } = await resolvePhotoUrls(gallery.albumToken);
  const source = urls.get(photo.original.checksum);
  if (!source) return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });

  let upstream: Response;
  try {
    upstream = await fetch(source, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch {
    return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel();
    return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  const headers = new Headers({
    'Content-Type': 'image/jpeg',
    'Content-Disposition': `attachment; filename="${downloadFilename(gallery.id, index + 1)}"`,
    // The bytes behind a checksum never change, so the browser may keep them.
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  const length = upstream.headers.get('Content-Length');
  if (length && /^\d+$/.test(length)) headers.set('Content-Length', length);

  return new Response(upstream.body, { status: 200, headers });
};
