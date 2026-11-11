/**
 * The NYC photo galleries with their photos. Each gallery's photos are listed
 * in `src/content/nycPhotos/{id}.json` (oldest first), rebuilt by
 * `node scripts/sync-nyc-photos.ts [id…]`; the album tokens live in
 * `nycGalleryConfig.ts`.
 *
 * A gallery with no album token or an empty manifest is hidden everywhere — no
 * empty section on /nyc and a 404 for its page.
 */
import type { ManifestPhoto } from '../lib/icloud-stream';
import { NYC_GALLERY_CONFIG, type NycGalleryConfig, type NycGalleryId } from './nycGalleryConfig';
import celebration from './nycPhotos/celebration.json';
import preparation from './nycPhotos/preparation.json';
import afterparty from './nycPhotos/afterparty.json';
import fixture from './nycPhotos/fixture.json';
import fixtureCelebration from './nycPhotos/fixture-celebration.json';

export type { NycGalleryId };
export { downloadFilename, downloadPath } from './nycGalleryConfig';

const MANIFESTS: Record<NycGalleryId, ManifestPhoto[]> = {
  celebration: celebration as ManifestPhoto[],
  preparation: preparation as ManifestPhoto[],
  afterparty: afterparty as ManifestPhoto[],
};

/**
 * Playwright builds with PHOTOS_TEST_FIXTURE so the gallery tests see known,
 * invented photos in `celebration` and `afterparty` and an empty
 * `preparation` (the hidden-gallery case), whatever the real manifests hold.
 */
const useFixture = import.meta.env.PHOTOS_TEST_FIXTURE === 'true';

export function isPhotoTestFixture(): boolean {
  return useFixture;
}

export interface NycGallery extends NycGalleryConfig {
  photos: ManifestPhoto[];
}

function photosFor(id: NycGalleryId): ManifestPhoto[] {
  if (useFixture) {
    if (id === 'afterparty') return fixture as ManifestPhoto[];
    if (id === 'celebration') return fixtureCelebration as ManifestPhoto[];
    return [];
  }
  return MANIFESTS[id];
}

/** Every configured gallery, with its photos (oldest first, as committed). */
export function getNycGalleries(): NycGallery[] {
  return NYC_GALLERY_CONFIG.map((config) => ({ ...config, photos: photosFor(config.id) }));
}

/** Galleries that have photos and an album to resolve them from. */
export function getVisibleNycGalleries(): NycGallery[] {
  return getNycGalleries().filter((g) => g.photos.length > 0 && (g.albumToken || useFixture));
}

export function getNycGallery(id: string | undefined): NycGallery | null {
  return getVisibleNycGalleries().find((g) => g.id === id) ?? null;
}

/**
 * The photos shown in a gallery's /nyc preview: the `featured` ones (picked at
 * random by the first sync, hand-editable afterwards), in chronological order.
 */
export function previewPhotos(gallery: NycGallery): ManifestPhoto[] {
  const featured = gallery.photos.filter((p) => p.featured);
  return featured.length > 0 ? featured : gallery.photos.slice(0, 6);
}
