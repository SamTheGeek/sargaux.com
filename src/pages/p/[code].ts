import type { APIRoute } from 'astro';
import { features } from '../../config/features';
import { findGalleryPass, GALLERY_PASS_COOKIE } from '../../lib/gallery-pass';

/**
 * GET /p/{code}: the target of the QR code on the mailed photo cards.
 *
 * A live code sets the gallery pass cookie (until the pass expires) and lands
 * on /nyc, which then shows the galleries without a login. Anything else goes
 * to the homepage login, so a revoked or mistyped code just looks like the
 * normal front door. See src/lib/gallery-pass.ts.
 */
export const GET: APIRoute = ({ params, cookies, redirect }) => {
  const pass = features.nyc.photoGallery ? findGalleryPass(params.code) : null;
  const response = pass ? redirectWithPass() : redirect('/', 302);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;

  function redirectWithPass(): Response {
    cookies.set(GALLERY_PASS_COOKIE, params.code!, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      expires: pass!.expires,
    });
    return redirect('/nyc', 302);
  }
};
