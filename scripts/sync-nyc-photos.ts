#!/usr/bin/env node
/**
 * Rebuilds the NYC photo-gallery manifests from their iCloud shared albums.
 *
 * Usage (from the repo root, Node 24 — runs under built-in type stripping):
 *   node scripts/sync-nyc-photos.ts              # every gallery with an album token
 *   node scripts/sync-nyc-photos.ts afterparty   # just one
 *   node scripts/sync-nyc-photos.ts afterparty --reshuffle   # re-pick the random preview
 *
 * Writes src/content/nycPhotos/{id}.json: one entry per still photo (videos
 * are skipped) with its GUID, capture time and the two renditions the site
 * uses, sorted oldest-first. No URLs (iCloud's expire within hours; the
 * /api/photos endpoint resolves fresh ones) and no captions (the repo is
 * public). Commit the result.
 *
 * Preview: the first sync marks DEFAULT_FEATURED_COUNT random photos
 * `featured`, which is what /nyc shows. Reruns keep those flags, so you can
 * also hand-edit them to curate the preview; `--reshuffle` draws a new random
 * set.
 *
 * Needs network access to *.icloud.com.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NYC_GALLERY_CONFIG } from '../src/content/nycGalleryConfig.ts';
import {
  applyFeatured,
  isValidAlbumToken,
  parseWebstream,
  postStream,
  type ManifestPhoto,
} from '../src/lib/icloud-stream.ts';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const reshuffle = args.includes('--reshuffle');
const requested = args.filter((a) => !a.startsWith('--'));

const known = new Set(NYC_GALLERY_CONFIG.map((g) => g.id as string));
for (const id of requested) {
  if (!known.has(id)) {
    console.error(`Unknown gallery "${id}". Known: ${[...known].join(', ')}`);
    process.exit(1);
  }
}

const targets = NYC_GALLERY_CONFIG.filter((g) =>
  requested.length > 0 ? requested.includes(g.id) : g.albumToken
);

let failed = false;
for (const gallery of targets) {
  if (!gallery.albumToken) {
    console.error(`${gallery.id}: no album token in src/content/nycGalleryConfig.ts — skipped`);
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
    const { body } = await postStream(fetch, gallery.albumToken, 'webstream', { streamCtag: null });
    const photos = parseWebstream(body);
    if (photos.length === 0) {
      console.error(`${gallery.id}: the album returned no photos — manifest left unchanged`);
      failed = true;
      continue;
    }
    const manifest = applyFeatured(photos, reshuffle ? [] : previous);
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);

    const before = new Set(previous.map((p) => p.guid));
    const after = new Set(manifest.map((p) => p.guid));
    const added = manifest.filter((p) => !before.has(p.guid)).length;
    const removed = previous.filter((p) => !after.has(p.guid)).length;
    const featured = manifest.filter((p) => p.featured).length;
    console.log(
      `${gallery.id}: ${manifest.length} photos (+${added} / -${removed}), ${featured} featured → ${file}`
    );
  } catch (err) {
    console.error(`${gallery.id}: ${err instanceof Error ? err.message : err}`);
    failed = true;
  }
}

if (targets.length === 0) console.log('No galleries with an album token.');
process.exit(failed ? 1 : 0);
