/**
 * Where each NYC gallery photo's original lives in the S3 bucket behind
 * CloudFront (infra/nyc-photo-originals.yml, docs/photo-originals-aws.md).
 *
 * Shared by scripts/sync-nyc-photos.ts, which uploads the objects, and the
 * server, which signs CloudFront URLs for them. The script runs this file
 * under Node's type stripping, so it must stay free of imports and
 * non-erasable TypeScript.
 */

/** Every object the sync manages sits under this prefix (the IAM user is limited to it). */
export const ORIGINALS_PREFIX = 'nyc/';

/**
 * `nyc/{gallery}/{guid}/{checksum}.jpg`. The original's checksum is in the
 * key, so an edit made in Photos uploads as a new object instead of reusing
 * a cached old one. iCloud checksums are base64 (`+`, `/`, `=`), made
 * URL-safe here.
 */
export function originalObjectKey(gallery: string, photo: { guid: string; original: { checksum: string } }): string {
  const checksum = photo.original.checksum.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${ORIGINALS_PREFIX}${gallery}/${photo.guid}/${checksum}.jpg`;
}

/** The prefix holding every object of one gallery. */
export function galleryPrefix(gallery: string): string {
  return `${ORIGINALS_PREFIX}${gallery}/`;
}
