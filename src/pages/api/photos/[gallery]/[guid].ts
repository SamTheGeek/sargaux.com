import type { APIRoute } from 'astro';
import { getAuthenticatedGuest } from '../../../../lib/auth';
import { features } from '../../../../config/features';
import { getNycGallery, isPhotoTestFixture } from '../../../../content/nycGalleries';
import { redirectMaxAge, resolvePhotoUrls } from '../../../../lib/icloud-photos';

/**
 * GET /api/photos/{gallery}/{guid}?size=thumb|full
 *
 * Redirects to a fresh, signed iCloud URL for one gallery photo. The photos
 * stay hosted on iCloud; this only exists because Apple's URLs expire, so
 * pages can embed this stable path instead.
 *
 * - Session required. `/api/*` sits outside middleware's auth wall, so the
 *   signed `sargaux_auth` cookie is verified here. That check is cookie-only on
 *   purpose: a page of thumbnails fires dozens of these at once, and the page
 *   that embeds them already ran middleware's live Notion checks.
 * - Not an open proxy: only a GUID in a visible gallery's committed manifest
 *   resolves, and `parseAssetUrls` only accepts Apple-hosted https URLs.
 * - Apple's URLs expire ~15 minutes after issue, so the redirect is
 *   browser-cached only for what is left of that URL's life (minus a margin),
 *   never longer than 5 minutes.
 */
export const GET: APIRoute = async ({ params, url, cookies }) => {
  if (!features.nyc.photoGallery) return new Response(null, { status: 404 });
  if (!getAuthenticatedGuest(cookies)) return new Response(null, { status: 401 });

  const gallery = getNycGallery(params.gallery);
  const photo = gallery?.photos.find((p) => p.guid === params.guid);
  if (!gallery || !photo) return new Response(null, { status: 404 });

  const size = url.searchParams.get('size') === 'full' ? 'full' : 'thumb';
  const derivative = photo[size];

  if (isPhotoTestFixture()) {
    return new Response(placeholderSvg(derivative.width, derivative.height), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'private, max-age=60',
      },
    });
  }

  if (!gallery.albumToken) return new Response(null, { status: 404 });
  const { urls, fetchedAt } = await resolvePhotoUrls(
    gallery.albumToken,
    gallery.photos.map((p) => p.guid)
  );
  const target = urls.get(derivative.checksum);
  if (!target) {
    return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': `private, max-age=${redirectMaxAge(fetchedAt)}`,
    },
  });
};

/** A flat tile of the photo's exact aspect ratio, used only by the test fixture. */
function placeholderSvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#8a9a7b"/></svg>`;
}
