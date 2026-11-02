/**
 * Resolves the signed, short-lived iCloud URLs for a gallery's photos.
 * Server-only (it is imported by the /api/photos endpoint, never by a page
 * script).
 *
 * iCloud's asset URLs expire after a few hours, so the committed manifests
 * hold GUIDs and checksums and this module turns them into URLs on demand:
 * one batched `webasseturls` round-trip covers the whole gallery, then the
 * answer is cached in memory and in Netlify Blobs for URL_TTL_MS, comfortably
 * inside Apple's expiry, so a page of thumbnails costs one iCloud call per
 * function instance per half hour at most.
 *
 * Never throws: a failure resolves to an empty map and the endpoint answers
 * 502 for that image, the same fail-soft contract as `src/lib/joy.ts`.
 */
import { getStore } from '@netlify/blobs';
import { parseAssetUrls, postStream } from './icloud-stream';

/** How long a resolved URL set is reused. Apple's URLs last for hours. */
export const URL_TTL_MS = 30 * 60 * 1000;

/** Apple rejects very large `photoGuids` lists; chunk well under that. */
const GUID_BATCH = 25;

const FETCH_TIMEOUT_MS = 8000;
const BLOB_STORE = 'photo-urls';

interface CachedUrls {
  fetchedAt: number;
  urls: Record<string, string>;
}

const memory = new Map<string, CachedUrls>();
const inFlight = new Map<string, Promise<Map<string, string>>>();
/** The album's partition host, learnt from the first 330 redirect. */
const hosts = new Map<string, string>();

function fresh(entry: CachedUrls | null | undefined): entry is CachedUrls {
  return Boolean(entry && Date.now() - entry.fetchedAt < URL_TTL_MS);
}

function blobKey(token: string): string {
  return `v1:${token}`;
}

async function readBlob(token: string): Promise<CachedUrls | null> {
  try {
    const raw = (await getStore(BLOB_STORE).get(blobKey(token), { type: 'json' })) as CachedUrls | null;
    return raw && typeof raw.fetchedAt === 'number' && raw.urls ? raw : null;
  } catch {
    // No Blobs context (local node adapter) or a transient error — skip the layer.
    return null;
  }
}

async function writeBlob(token: string, entry: CachedUrls): Promise<void> {
  try {
    await getStore(BLOB_STORE).setJSON(blobKey(token), entry);
  } catch {
    // Best-effort.
  }
}

async function fetchUrls(token: string, guids: string[]): Promise<Map<string, string>> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const batches: string[][] = [];
  for (let i = 0; i < guids.length; i += GUID_BATCH) batches.push(guids.slice(i, i + GUID_BATCH));

  // Resolve the partition host with the first batch, then run the rest in parallel.
  const urls = new Map<string, string>();
  const first = await postStream(fetch, token, 'webasseturls', { photoGuids: batches[0] }, hosts.get(token), signal);
  hosts.set(token, first.host);
  for (const [k, v] of parseAssetUrls(first.body)) urls.set(k, v);

  const rest = await Promise.all(
    batches.slice(1).map((photoGuids) =>
      postStream(fetch, token, 'webasseturls', { photoGuids }, first.host, signal)
    )
  );
  for (const { body } of rest) for (const [k, v] of parseAssetUrls(body)) urls.set(k, v);
  return urls;
}

/**
 * Checksum → signed URL for every photo in an album. `guids` should be the
 * gallery's full manifest so one call warms every image on the page.
 */
export async function resolvePhotoUrls(token: string, guids: string[]): Promise<Map<string, string>> {
  if (guids.length === 0) return new Map();

  const cached = memory.get(token);
  if (fresh(cached)) return new Map(Object.entries(cached.urls));

  const pending = inFlight.get(token);
  if (pending) return pending;

  const work = (async () => {
    const blob = await readBlob(token);
    if (fresh(blob)) {
      memory.set(token, blob);
      return new Map(Object.entries(blob.urls));
    }
    try {
      const urls = await fetchUrls(token, guids);
      if (urls.size > 0) {
        const entry: CachedUrls = { fetchedAt: Date.now(), urls: Object.fromEntries(urls) };
        memory.set(token, entry);
        await writeBlob(token, entry);
      }
      return urls;
    } catch (err) {
      console.warn('[photos] iCloud URL resolution failed:', err instanceof Error ? err.message : err);
      return new Map<string, string>();
    }
  })();

  inFlight.set(token, work);
  try {
    return await work;
  } finally {
    inFlight.delete(token);
  }
}
