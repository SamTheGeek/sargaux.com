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
import { fetchAlbum, urlsByChecksum } from './icloud-stream';

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

/**
 * When a signed URL expires (ms since epoch), from its `e=` parameter (unix
 * seconds), or null when it has none.
 */
export function urlExpiry(url: string): number | null {
  try {
    const e = Number(new URL(url).searchParams.get('e'));
    return Number.isFinite(e) && e > 0 ? e * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Seconds a browser may cache a redirect to a URL issued at `fetchedAt`:
 * never more than 5 minutes, and never past the URL's expiry minus a margin.
 * The expiry is the URL's own `e=` when present, else issue time + 15 minutes,
 * whichever is sooner.
 */
export function redirectMaxAge(fetchedAt: number, now: number = Date.now(), url?: string): number {
  const assumed = fetchedAt + URL_LIFETIME_MS;
  const stated = url ? urlExpiry(url) : null;
  const expiry = stated === null ? assumed : Math.min(stated, assumed);
  const left = expiry - URL_SAFETY_MS - now;
  return Math.max(0, Math.min(300, Math.floor(left / 1000)));
}

const FETCH_TIMEOUT_MS = 8000;
const BLOB_STORE = 'photo-urls';

interface CachedUrls {
  fetchedAt: number;
  urls: Record<string, string>;
}

const memory = new Map<string, CachedUrls>();
const inFlight = new Map<string, Promise<ResolvedUrls>>();

function fresh(entry: CachedUrls | null | undefined): entry is CachedUrls {
  return Boolean(entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS);
}

function blobKey(token: string): string {
  return `v3:${token}`;
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

async function fetchUrls(token: string): Promise<Map<string, string>> {
  // One resolve + one query (the album fits in a page) returns every photo's
  // renditions with freshly signed URLs.
  return urlsByChecksum(await fetchAlbum(fetch, token, AbortSignal.timeout(FETCH_TIMEOUT_MS)));
}

/** Rendition checksum → signed URL for every photo in an album; one fetch warms every image on the page. */
export async function resolvePhotoUrls(token: string): Promise<ResolvedUrls> {

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
      const urls = await fetchUrls(token);
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
