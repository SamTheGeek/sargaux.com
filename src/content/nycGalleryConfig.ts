/**
 * Which iCloud shared album backs each NYC photo gallery, in the order the
 * galleries appear on /nyc (chronological through the day).
 *
 * Kept apart from `nycGalleries.ts` because `scripts/sync-nyc-photos.ts` reads
 * it under Node's built-in type stripping: no relative imports, no JSON
 * imports, no `import.meta.env`, and only erasable TypeScript syntax.
 *
 * A gallery goes live by setting its token, running
 * `node scripts/sync-nyc-photos.ts <id>`, and committing the manifest.
 * Display titles live in `strings.nyc.photos.galleries`, keyed by id.
 */

export type NycGalleryId = 'preparation' | 'event' | 'afterparty';

export interface NycGalleryConfig {
  id: NycGalleryId;
  /** The token from the album's public share link (icloud.com/sharedalbum/#TOKEN). */
  albumToken: string | null;
}

export const NYC_GALLERY_CONFIG: readonly NycGalleryConfig[] = [
  { id: 'preparation', albumToken: null },
  { id: 'event', albumToken: null },
  { id: 'afterparty', albumToken: '0d25IMBv-34QfR6fX_9rXc9aA' },
];
