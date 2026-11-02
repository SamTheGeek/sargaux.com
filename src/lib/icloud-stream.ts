/**
 * Pure helpers for Apple's (unofficial) iCloud shared-album web API.
 *
 * Shared by `scripts/sync-nyc-photos.ts` (which builds the committed photo
 * manifests) and `src/lib/icloud-photos.ts` (which resolves short-lived image
 * URLs at request time). It must stay free of relative imports and
 * non-erasable TypeScript syntax, because the sync script runs it under Node's
 * built-in type stripping rather than through Vite.
 *
 * How the API works:
 *   1. POST https://p{NN}-sharedstreams.icloud.com/{token}/sharedstreams/webstream
 *      with `{"streamCtag":null}`. The first host usually answers 330 with the
 *      album's real partition in `X-Apple-MMe-Host`; retry against that host.
 *   2. The response's `photos[]` lists each item's GUID, capture time and
 *      `derivatives` (one entry per rendition size, keyed by size).
 *   3. POST …/webasseturls with `{"photoGuids":[…]}` maps each derivative's
 *      checksum to a signed, expiring URL. Those URLs must never be stored —
 *      the manifest keeps GUIDs and checksums and the URLs are resolved fresh.
 */

export interface PhotoDerivative {
  checksum: string;
  width: number;
  height: number;
}

/** One photo as committed to `src/content/nycPhotos/{gallery}.json`. */
export interface ManifestPhoto {
  guid: string;
  /** ISO capture time. Used only to sort the gallery oldest-first; never rendered. */
  takenAt: string;
  thumb: PhotoDerivative;
  full: PhotoDerivative;
  /** Shown in the gallery's preview on /nyc. */
  featured?: boolean;
}

/** Thumbnails narrower than this look soft in a 3-column grid. */
export const MIN_THUMB_WIDTH = 400;

/** How many photos the first sync features in a gallery's preview. */
export const DEFAULT_FEATURED_COUNT = 6;

/** The partition host to try first; a 330 redirects to the album's real one. */
export function initialHost(token: string): string {
  // Apple derives the partition from the token, but any partition answers with
  // a redirect to the right one, so a fixed starting point is sufficient.
  void token;
  return 'p23-sharedstreams.icloud.com';
}

export function streamBaseUrl(host: string, token: string): string {
  return `https://${host}/${encodeURIComponent(token)}/sharedstreams`;
}

/** Album tokens are short base62-ish strings; reject anything else before it reaches a URL. */
export function isValidAlbumToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{6,64}$/.test(token);
}

/** iCloud photo GUIDs are uppercase hex UUIDs, but accept any conservative id shape. */
export function isValidPhotoGuid(guid: string): boolean {
  return /^[A-Za-z0-9-]{8,64}$/.test(guid);
}

interface RawDerivative {
  checksum?: unknown;
  width?: unknown;
  height?: unknown;
}

interface RawPhoto {
  photoGuid?: unknown;
  dateCreated?: unknown;
  batchDateCreated?: unknown;
  mediaAssetType?: unknown;
  derivatives?: Record<string, RawDerivative | undefined>;
}

function toPositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function parseDerivatives(raw: RawPhoto['derivatives']): PhotoDerivative[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: PhotoDerivative[] = [];
  for (const [key, d] of Object.entries(raw)) {
    // Videos carry `PosterFrame` and HLS renditions alongside stills; only
    // numerically-keyed sizes are plain image renditions.
    if (!/^\d+$/.test(key) || !d) continue;
    const width = toPositiveInt(d.width);
    const height = toPositiveInt(d.height);
    if (typeof d.checksum !== 'string' || !d.checksum || !width || !height) continue;
    out.push({ checksum: d.checksum, width, height });
  }
  return out;
}

/**
 * Picks the grid thumbnail and the lightbox rendition from a photo's sizes:
 * the smallest rendition at least MIN_THUMB_WIDTH wide (falling back to the
 * largest when none is) and the largest overall.
 */
export function pickDerivatives(
  derivatives: PhotoDerivative[]
): { thumb: PhotoDerivative; full: PhotoDerivative } | null {
  if (derivatives.length === 0) return null;
  const bySize = [...derivatives].sort((a, b) => a.width * a.height - b.width * b.height);
  const full = bySize[bySize.length - 1];
  const thumb = bySize.find((d) => d.width >= MIN_THUMB_WIDTH) ?? full;
  return { thumb, full };
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/**
 * Turns a webstream response into manifest entries, sorted oldest-first.
 * Videos and items without a usable still are skipped. Nothing caption-like
 * is copied — the repo is public and captions could name guests.
 */
export function parseWebstream(body: unknown): ManifestPhoto[] {
  const photos = (body as { photos?: unknown })?.photos;
  if (!Array.isArray(photos)) return [];
  const out: ManifestPhoto[] = [];
  for (const raw of photos as RawPhoto[]) {
    if (!raw || typeof raw !== 'object') continue;
    if (raw.mediaAssetType === 'video') continue;
    const guid = typeof raw.photoGuid === 'string' ? raw.photoGuid : '';
    if (!isValidPhotoGuid(guid)) continue;
    const picked = pickDerivatives(parseDerivatives(raw.derivatives));
    if (!picked) continue;
    const takenAt = toIsoDate(raw.dateCreated) ?? toIsoDate(raw.batchDateCreated);
    if (!takenAt) continue;
    out.push({ guid, takenAt, ...picked });
  }
  return sortChronologically(out);
}

/** Oldest first; GUID breaks ties so reruns produce a stable order. */
export function sortChronologically<T extends { guid: string; takenAt: string }>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    const diff = Date.parse(a.takenAt) - Date.parse(b.takenAt);
    if (diff !== 0) return diff;
    return a.guid < b.guid ? -1 : a.guid > b.guid ? 1 : 0;
  });
}

/**
 * Carries the `featured` choice across a resync. Existing flags are kept for
 * photos still in the album (so a hand-curated preview survives); only when
 * none remain are `count` photos chosen at random. `random` is injectable so
 * tests are deterministic.
 */
export function applyFeatured(
  next: ManifestPhoto[],
  previous: ManifestPhoto[],
  count: number = DEFAULT_FEATURED_COUNT,
  random: () => number = Math.random
): ManifestPhoto[] {
  const kept = new Set(previous.filter((p) => p.featured).map((p) => p.guid));
  const stillPresent = next.filter((p) => kept.has(p.guid)).map((p) => p.guid);
  let chosen: Set<string>;
  if (stillPresent.length > 0) {
    chosen = new Set(stillPresent);
  } else {
    // Partial Fisher–Yates: the first `count` slots end up a uniform sample.
    const pool = next.map((p) => p.guid);
    const n = Math.min(count, pool.length);
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    chosen = new Set(pool.slice(0, n));
  }
  return next.map(({ guid, takenAt, thumb, full }) =>
    chosen.has(guid) ? { guid, takenAt, thumb, full, featured: true } : { guid, takenAt, thumb, full }
  );
}

/**
 * Parses a webasseturls response into checksum → absolute URL.
 * Only https URLs on an Apple-controlled host are accepted, so a malformed or
 * hostile response can't turn the photo endpoint into an open redirect.
 */
export function parseAssetUrls(body: unknown): Map<string, string> {
  const items = (body as { items?: unknown })?.items;
  const out = new Map<string, string>();
  if (!items || typeof items !== 'object') return out;
  for (const [checksum, item] of Object.entries(items as Record<string, unknown>)) {
    const loc = (item as { url_location?: unknown })?.url_location;
    const path = (item as { url_path?: unknown })?.url_path;
    if (typeof loc !== 'string' || typeof path !== 'string') continue;
    const url = buildAssetUrl(loc, path);
    if (url) out.set(checksum, url);
  }
  return out;
}

const APPLE_HOST = /(^|\.)(icloud-content\.com|icloud\.com|apple\.com)$/i;

export function buildAssetUrl(location: string, path: string): string | null {
  if (!path.startsWith('/')) return null;
  try {
    const url = new URL(`https://${location}${path}`);
    if (url.protocol !== 'https:' || !APPLE_HOST.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Reads the redirect host from a 330 response, if it names a sharedstreams host. */
export function redirectHost(status: number, headerValue: string | null): string | null {
  if (status !== 330 || !headerValue) return null;
  const host = headerValue.trim().toLowerCase();
  return /^p\d+-sharedstreams\.icloud\.com$/.test(host) ? host : null;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * POSTs to a sharedstreams endpoint, following the one-time 330 partition
 * redirect. Returns the parsed body plus the host that answered (worth caching
 * so later calls skip the redirect).
 */
export async function postStream(
  fetchImpl: Fetch,
  token: string,
  endpoint: 'webstream' | 'webasseturls',
  payload: unknown,
  host: string = initialHost(token),
  signal?: AbortSignal
): Promise<{ body: unknown; host: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetchImpl(`${streamBaseUrl(host, token)}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'manual',
      signal,
    });
    const next = redirectHost(res.status, res.headers.get('X-Apple-MMe-Host'));
    if (next) {
      // Body of a 330 is a tiny JSON blob naming the same host; discard it.
      await res.body?.cancel();
      host = next;
      continue;
    }
    if (!res.ok) throw new Error(`iCloud ${endpoint} returned ${res.status}`);
    return { body: await res.json(), host };
  }
  throw new Error(`iCloud ${endpoint} redirected more than once`);
}
