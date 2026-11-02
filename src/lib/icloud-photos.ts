/**
 * Resolves the signed, short-lived iCloud URLs for a gallery's photos.
 * Server-only (it is imported by the /api/photos endpoint, never by a page
 * script).
 *
 * iCloud's asset URLs (cvws.icloud-content.com) expire about 15 minutes after
 * they are issued, so the committed manifests hold GUIDs and checksums and
 * this module turns them into URLs on demand: one batched round-trip covers
 * the whole gallery, then the answer is reused for CACHE_TTL_MS. Every reader
 * also gets `fetchedAt`, so the endpoint can cap how long a browser may keep
 * the redirect to what is actually left of the URL's life.
 *
 * Never throws: a failure resolves to an empty map and the endpoint answers
 * 502 for that image, the same fail-soft contract as `src/lib/joy.ts`.
 */
import { getStore } from '@netlify/blobs';
import { parseAssetUrls, postStream } from './icloud-stream';

/** How long Apple's signed asset URLs stay valid after issue. */
export const URL_LIFETIME_MS = 15 * 60 * 1000;

/**
 * How long a resolved URL set is reused. Kept well under URL_LIFETIME_MS so a
 * reused URL still has minutes left when the browser follows the redirect.
 */
export const CACHE_TTL_MS = 8 * 60 * 1000;

/** Margin for clock skew and slow image loads; never hand out a URL closer to expiry than this. */
export const URL_SAFETY_MS = 2 * 60 * 1000;

export interface ResolvedUrls {
  urls: Map<string, string>;
  /** When Apple issued these URLs (ms since epoch). */
  fetchedAt: number;
}

/** Seconds a browser may cache a redirect to a URL issued at `fetchedAt`. */
export function redirectMaxAge(fetchedAt: number, now: number = Date.now()): number {
  const left = fetchedAt + URL_LIFETIME_MS - URL_SAFETY_MS - now;
  return Math.max(0, Math.min(300, Math.floor(left / 1000)));
}

/** Apple rejects very large `photoGuids` lists; chunk well under that. */
const GUID_BATCH = 25;

const FETCH_TIMEOUT_MS = 8000;
const BLOB_STORE = 'photo-urls';

interface CachedUrls {
  fetchedAt: number;
  urls: Record<string, string>;
}

const memory = new Map<string, CachedUrls>();
const inFlight = new Map<string, Promise<ResolvedUrls>>();
/** The album's partition host, learnt from the first 330 redirect. */
const hosts = new Map<string, string>();

function fresh(entry: CachedUrls | null | undefined): entry is CachedUrls {
  return Boolean(entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS);
}

function blobKey(token: string): string {
  return `v2:${token}`;
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
export async function resolvePhotoUrls(token: string, guids: string[]): Promise<ResolvedUrls> {
  if (guids.length === 0) return { urls: new Map(), fetchedAt: Date.now() };

  const cached = memory.get(token);
  if (fresh(cached)) return { urls: new Map(Object.entries(cached.urls)), fetchedAt: cached.fetchedAt };

  const pending = inFlight.get(token);
  if (pending) return pending;

  const work = (async () => {
    const blob = await readBlob(token);
    if (fresh(blob)) {
      memory.set(token, blob);
      return { urls: new Map(Object.entries(blob.urls)), fetchedAt: blob.fetchedAt };
    }
    // Stamp before the request: Apple's clock starts when it signs, not when we finish reading.
    const fetchedAt = Date.now();
    try {
      const urls = await fetchUrls(token, guids);
      if (urls.size > 0) {
        const entry: CachedUrls = { fetchedAt, urls: Object.fromEntries(urls) };
        memory.set(token, entry);
        await writeBlob(token, entry);
      }
      return { urls, fetchedAt };
    } catch (err) {
      console.warn('[photos] iCloud URL resolution failed:', err instanceof Error ? err.message : err);
      return { urls: new Map<string, string>(), fetchedAt };
    }
  })();

  inFlight.set(token, work);
  try {
    return await work;
  } finally {
    inFlight.delete(token);
  }
}
