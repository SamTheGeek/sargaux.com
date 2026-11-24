/**
 * Which iCloud shared album backs each NYC photo gallery, in the order the
 * galleries appear on /nyc. The order is Sam's choice (the main event first),
 * not chronological: Preparation was shot before Celebration.
 *
 * Kept apart from `nycGalleries.ts` because `scripts/sync-nyc-photos.ts` reads
 * it under Node's built-in type stripping: no relative imports, no JSON
 * imports, no `import.meta.env`, and only erasable TypeScript syntax.
 *
 * The album tokens are secrets, read from the environment, never committed.
 * A token is the key to the album's public link
 * (photos.icloud.com/shared/album/TOKEN): anyone holding it can browse the
 * whole album, 👎'd photos included, without the site's login or gallery pass.
 * They live in Netlify (Builds + Functions scopes: the build-time sync and the
 * photo API both need them) and GitHub Actions secrets (the S3 sync). A
 * gallery whose variable is unset is hidden. The tokens committed here until
 * 2026-11 were rotated (Public Website off/on in Photos) when they moved out.
 *
 * A gallery goes live by adding its variable where the site and the sync run;
 * the next deploy builds its manifest (see netlify.toml). Display titles live
 * in `strings.nyc.photos.galleries`, keyed by id.
 */

export type NycGalleryId = 'celebration' | 'preparation' | 'afterparty';

export interface NycGalleryConfig {
  id: NycGalleryId;
  /** The env var holding the token from the album's public link. */
  tokenEnv: string;
}

export const NYC_GALLERY_CONFIG: readonly NycGalleryConfig[] = [
  { id: 'celebration', tokenEnv: 'NYC_ALBUM_TOKEN_CELEBRATION' },
  { id: 'preparation', tokenEnv: 'NYC_ALBUM_TOKEN_PREPARATION' },
  { id: 'afterparty', tokenEnv: 'NYC_ALBUM_TOKEN_AFTERPARTY' },
];

/**
 * A gallery's album token, or null when its variable is unset. Read on every
 * call rather than at module load, so a runtime-only env var (Netlify
 * Functions) is always seen. Server and scripts only: never ship to a browser.
 */
export function albumTokenFor(
  config: Pick<NycGalleryConfig, 'tokenEnv'>,
  env: Record<string, string | undefined> | undefined = typeof process === 'undefined' ? undefined : process.env
): string | null {
  return env?.[config.tokenEnv]?.trim() || null;
}

/**
 * The name a downloaded photo is saved under: gallery plus its 1-based position
 * in the (oldest-first) gallery, e.g. `sargaux-nyc-afterparty-012.jpg`. iCloud's
 * own filenames are never used — they can carry people's names.
 */
export function downloadFilename(galleryId: NycGalleryId, position: number, ext = 'jpg'): string {
  return `sargaux-nyc-${galleryId}-${String(position).padStart(3, '0')}.${ext}`;
}

/** Same-origin path that streams a photo's original as an attachment. */
export function downloadPath(galleryId: NycGalleryId, guid: string): string {
  return `/api/photos/${galleryId}/${encodeURIComponent(guid)}/download`;
}
