#!/usr/bin/env node
/**
 * Rebuilds the NYC photo-gallery manifests from their iCloud shared albums.
 *
 * Usage (from the repo root, Node 24 — runs under built-in type stripping):
 *   node scripts/sync-nyc-photos.ts              # every gallery with an album token
 *   node scripts/sync-nyc-photos.ts afterparty   # just one
 *   node scripts/sync-nyc-photos.ts afterparty --reshuffle   # re-pick the random preview
 *   node scripts/sync-nyc-photos.ts --build      # Netlify build step: never uploads, never fails
 *
 * The album tokens come from env vars (NYC_ALBUM_TOKEN_CELEBRATION, …; see
 * src/content/nycGalleryConfig.ts), never from the repo. Locally:
 *   node --env-file-if-exists=.env.local scripts/sync-nyc-photos.ts
 *
 * Writes src/content/nycPhotos/{id}.json: one entry per still photo (videos
 * are skipped) with its asset id, capture time and the two renditions the site
 * uses, sorted oldest-first. No URLs (iCloud's expire ~15 minutes after issue;
 * the /api/photos endpoint fetches fresh ones), and no captions, filenames or
 * owner details (the repo is public). Every Netlify build runs this with
 * `--build` and deploys the result, so committing is optional: the
 * committed manifests are only the fallback for a build that can't reach
 * iCloud, and the starting point for random preview picks.
 *
 * Filtering: a photo with a 👎 reaction from any album member is left out.
 * Removing the 👎 in Photos brings it back on the next sync. Who reacted is
 * never read.
 *
 * Preview: the photos with a 🔥 reaction (from anyone) are marked
 * `featured`, which is what /nyc shows: oldest first, at most
 * DEFAULT_FEATURED_COUNT, and fewer stay fewer. A photo with both a 🔥 and a
 * 👎 is hidden. Only a gallery with no 🔥 at all falls back to random picks:
 * the first sync marks DEFAULT_FEATURED_COUNT at random, reruns keep them (so
 * they can be hand-edited there), a lost one is replaced at random, and
 * `--reshuffle` draws a new set.
 *
 * Originals on AWS: when NYC_PHOTOS_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID and
 * AWS_SECRET_ACCESS_KEY are set, each gallery's download originals are
 * mirrored into that S3 bucket (which CloudFront serves to signed URLs, see
 * docs/photo-originals-aws.md) before its manifest is written: new photos
 * and edited ones are uploaded, and once the manifest is written, objects no
 * photo points at any more (a 👎, a removal, an old edit) are deleted. A
 * failed upload leaves that gallery's manifest unchanged, so the site never
 * lists a photo whose original isn't there. Without those variables the sync
 * only rewrites the manifests and says so; `--no-upload` skips the mirror on
 * purpose.
 *
 * Needs network access to *.icloud.com (ckdatabasews + its p*- partitions),
 * and to {bucket}.s3.{region}.amazonaws.com when mirroring.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NYC_GALLERY_CONFIG, albumTokenFor } from '../src/content/nycGalleryConfig.ts';
import {
  applyPicks,
  fetchAlbumForSync,
  iCloudErrorStatus,
  isValidAlbumToken,
  lookupRenditionUrls,
  resolveShare,
  toManifest,
  type ManifestPhoto,
  type ShareHandle,
} from '../src/lib/icloud-stream.ts';
import {
  deleteObject,
  eachLimit,
  galleryPrefix,
  listKeys,
  missingS3Env,
  originalObjectKey,
  planMirror,
  putOriginal,
  s3FromEnv,
  type S3Target,
} from './lib/photo-originals-s3.ts';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const reshuffle = args.includes('--reshuffle');
/**
 * `--build`: the Netlify build step (netlify.toml). Never uploads, and never
 * fails: a gallery that can't be synced keeps its committed manifest, so an
 * iCloud outage can't break a deploy.
 */
const buildMode = args.includes('--build');
const noUpload = buildMode || args.includes('--no-upload');
const s3 = noUpload ? null : s3FromEnv();
if (buildMode) {
  console.log('Build step: refreshing gallery manifests from iCloud (no S3 uploads; failures keep the committed manifest).');
} else if (noUpload) {
  console.log('--no-upload: originals are not mirrored to S3 this run.');
} else if (!s3) {
  console.warn(
    `Originals are NOT being mirrored to S3 (missing ${missingS3Env().join(', ')}). ` +
      'New photos will download from the site instead of the CDN until a sync runs with them set.'
  );
}

/** Parallel uploads: enough to keep a home connection busy without tripping iCloud. */
const UPLOAD_CONCURRENCY = 6;
/** Re-resolve the share before Apple's ~20-minute access token runs out. */
const SHARE_MAX_AGE_MS = 10 * 60 * 1000;

/** Fetches one photo's original from iCloud with a freshly looked-up URL (album URLs expire in ~15 min). */
function originalFetcher(token: string) {
  let share: { handle: ShareHandle; at: number } | null = null;
  const getShare = async (force = false) => {
    if (force || !share || Date.now() - share.at > SHARE_MAX_AGE_MS) {
      share = { handle: await resolveShare(fetch, token), at: Date.now() };
    }
    return share.handle;
  };
  const lookup = async (photo: ManifestPhoto) => {
    try {
      return await lookupRenditionUrls(fetch, token, await getShare(), [photo.guid, photo.master]);
    } catch (err) {
      const status = iCloudErrorStatus(err);
      if (status !== 401 && status !== 403) throw err;
      return lookupRenditionUrls(fetch, token, await getShare(true), [photo.guid, photo.master]);
    }
  };
  return async (photo: ManifestPhoto): Promise<Uint8Array<ArrayBuffer>> => {
    const url = (await lookup(photo)).get(photo.original.checksum);
    if (!url) throw new Error(`iCloud returned no URL for the original of ${photo.guid}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`iCloud original ${photo.guid}: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Every original is a JPEG (pickOriginal never picks a HEIC): check the magic bytes.
    if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw new Error(`iCloud original ${photo.guid} is not a JPEG`);
    }
    return bytes;
  };
}

/** Upload what the manifest needs; returns the objects to delete once the manifest is written. */
async function mirrorUploads(target: S3Target, galleryId: string, token: string, manifest: ManifestPhoto[]) {
  const byKey = new Map(manifest.map((p) => [originalObjectKey(galleryId, p), p]));
  const plan = planMirror(galleryId, byKey.keys(), await listKeys(target, galleryPrefix(galleryId)));
  const fetchOriginal = originalFetcher(token);
  let done = 0;
  await eachLimit(plan.upload, UPLOAD_CONCURRENCY, async (key) => {
    await putOriginal(target, key, await fetchOriginal(byKey.get(key)!));
    done++;
    if (done % 25 === 0 || done === plan.upload.length) console.log(`${galleryId}: uploaded ${done}/${plan.upload.length} originals`);
  });
  return plan;
}
const requested = args.filter((a) => !a.startsWith('--'));

const known = new Set(NYC_GALLERY_CONFIG.map((g) => g.id as string));
for (const id of requested) {
  if (!known.has(id)) {
    console.error(`Unknown gallery "${id}". Known: ${[...known].join(', ')}`);
    process.exit(1);
  }
}

const targets = NYC_GALLERY_CONFIG.map((g) => ({ ...g, albumToken: albumTokenFor(g) })).filter((g) =>
  requested.length > 0 ? requested.includes(g.id) : g.albumToken
);

let failed = false;
for (const gallery of targets) {
  if (!gallery.albumToken) {
    console.error(`${gallery.id}: ${gallery.tokenEnv} is not set — skipped`);
    failed = true;
    continue;
  }
  if (!isValidAlbumToken(gallery.albumToken)) {
    console.error(`${gallery.id}: album token looks malformed — skipped`);
    failed = true;
    continue;
  }

  const file = join(root, 'src/content/nycPhotos', `${gallery.id}.json`);
  let previous: ManifestPhoto[] = [];
  try {
    previous = JSON.parse(readFileSync(file, 'utf8')) as ManifestPhoto[];
  } catch {
    // First sync for this gallery.
  }

  try {
    const album = await fetchAlbumForSync(fetch, gallery.albumToken);
    const hidden = album.photos.filter((p) => album.thumbsDown.has(p.guid)).length;
    const photos = toManifest(album.photos.filter((p) => !album.thumbsDown.has(p.guid)));
    if (photos.length === 0) {
      console.error(`${gallery.id}: no photos left to show — manifest left unchanged`);
      failed = true;
      continue;
    }
    const manifest = applyPicks(photos, album.fire, undefined, reshuffle ? [] : previous);
    const pickedByFire = manifest.some((p) => p.featured && album.fire.has(p.guid));
    // Originals first: the manifest is only written once every photo it lists is in the bucket.
    const plan = s3 ? await mirrorUploads(s3, gallery.id, gallery.albumToken, manifest) : null;
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
    if (s3 && plan) {
      // Photos hidden by a 👎 (or gone from the album) stop being downloadable.
      await eachLimit(plan.remove, UPLOAD_CONCURRENCY, (key) => deleteObject(s3, key));
      console.log(`${gallery.id}: S3 originals +${plan.upload.length} uploaded / -${plan.remove.length} deleted`);
    }

    const before = new Set(previous.map((p) => p.guid));
    const after = new Set(manifest.map((p) => p.guid));
    const added = manifest.filter((p) => !before.has(p.guid)).length;
    const removed = previous.filter((p) => !after.has(p.guid)).length;
    const featured = manifest.filter((p) => p.featured).length;
    console.log(
      `${gallery.id}: ${manifest.length} photos (${hidden} hidden by 👎; +${added} / -${removed}), ${featured} featured (${pickedByFire ? '🔥' : 'random'}) → ${file}`
    );
  } catch (err) {
    console.error(`${gallery.id}: ${err instanceof Error ? err.message : err}`);
    failed = true;
  }
}

if (targets.length === 0) {
  console.log(`No album tokens set (${NYC_GALLERY_CONFIG.map((g) => g.tokenEnv).join(', ')}); manifests left as committed.`);
}
if (buildMode && failed) console.warn('Some galleries could not be synced; their committed manifests will be used.');
process.exit(failed && !buildMode ? 1 : 0);
