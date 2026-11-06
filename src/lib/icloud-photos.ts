/**
 * Resolves the signed, short-lived iCloud URLs for a gallery's photos.
 * Server-only (it is imported by the /api/photos endpoint, never by a page
 * script).
 *
 * iCloud's asset URLs (cvws.icloud-content.com) expire about 15 minutes after
 * they are issued, so the committed manifests hold record ids and checksums
 * and this module turns them into URLs on demand, **one photo at a time**: a
 * record lookup of the photo's asset + master answers in ~0.4 s. Re-querying
 * the whole album instead costs ~5 s per 100 photos (Celebration, at 384
 * photos, took ~20 s) — far past a function's time budget.
 *
 * Two in-memory caches per function instance:
 *  - the share's anonymous access token (Apple gives it ~20 minutes; reused
 *    for SHARE_TTL_MS), so a lookup is one round-trip, not two;
 *  - each photo's URLs, reused for CACHE_TTL_MS. Every reader also gets
 *    `fetchedAt`, so the endpoint can cap how long a browser may keep the
 *    redirect to what is actually left of the URL's life.
 * Concurrent requests for the same photo share one lookup.
 *
 * Never throws: a failure resolves to an empty map and the endpoint answers
 * 502 for that image, the same fail-soft contract as `src/lib/joy.ts`.
 */
import { iCloudErrorStatus, lookupRenditionUrls, resolveShare, type ShareHandle } from './icloud-stream';

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

/** Apple's anonymous share tokens last ~20 minutes; refresh well before. */
const SHARE_TTL_MS = 15 * 60 * 1000;

interface CachedUrls {
  fetchedAt: number;
  urls: Map<string, string>;
}

const shares = new Map<string, { handle: ShareHandle; at: number }>();
const photoUrls = new Map<string, CachedUrls>();
const inFlight = new Map<string, Promise<ResolvedUrls>>();

async function getShare(token: string, signal: AbortSignal, refresh = false): Promise<ShareHandle> {
  const cached = shares.get(token);
  if (!refresh && cached && Date.now() - cached.at < SHARE_TTL_MS) return cached.handle;
  const handle = await resolveShare(fetch, token, signal);
  shares.set(token, { handle, at: Date.now() });
  return handle;
}

async function lookup(token: string, recordNames: string[], signal: AbortSignal): Promise<Map<string, string>> {
  try {
    return await lookupRenditionUrls(fetch, token, await getShare(token, signal), recordNames, signal);
  } catch (err) {
    // A cached access token Apple has since expired: resolve the share again once.
    const status = iCloudErrorStatus(err);
    if (status !== 401 && status !== 403) throw err;
    return lookupRenditionUrls(fetch, token, await getShare(token, signal, true), recordNames, signal);
  }
}

/**
 * checksum → signed URL for every rendition of one photo (its thumbnail,
 * lightbox image and download original), looked up by its asset and master
 * record ids.
 */
export async function resolvePhotoUrls(token: string, photo: { guid: string; master: string }): Promise<ResolvedUrls> {
  const key = `${token}:${photo.guid}`;
  const cached = photoUrls.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const work = (async (): Promise<ResolvedUrls> => {
    // Stamp before the request: Apple's clock starts when it signs, not when we finish reading.
    const fetchedAt = Date.now();
    try {
      const urls = await lookup(token, [photo.guid, photo.master], AbortSignal.timeout(FETCH_TIMEOUT_MS));
      if (urls.size > 0) photoUrls.set(key, { fetchedAt, urls });
      return { urls, fetchedAt };
    } catch (err) {
      console.warn('[photos] iCloud URL lookup failed:', err instanceof Error ? err.message : err);
      return { urls: new Map<string, string>(), fetchedAt };
    }
  })();

  inFlight.set(key, work);
  try {
    return await work;
  } finally {
    inFlight.delete(key);
  }
}
