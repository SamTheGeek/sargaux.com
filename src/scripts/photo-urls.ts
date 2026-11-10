/**
 * Loads gallery photos straight from iCloud, asking our server for their
 * signed URLs in batches (`GET /api/photos/{gallery}/urls`): one function call
 * per batch instead of one redirect per image.
 *
 * - Requests made in the same tick are merged and sent BATCH_SIZE at a time.
 * - Each photo's URLs are kept until the server says they stop being usable
 *   (a relative `ttl`, so a wrong device clock can't stretch it); a later
 *   request after that asks again.
 * - Every failure falls back to the redirect endpoint the tile carries in
 *   its data attributes, which always works: the batch path only saves calls.
 *
 * Shared by PhotoGallery (tiles) and PhotoLightbox (full-size images).
 */

export interface PhotoUrls {
  thumb: string;
  full: string;
}

interface Entry extends PhotoUrls {
  until: number;
}

interface Waiter {
  guid: string;
  resolve: (urls: PhotoUrls | null) => void;
}

/** Matches MAX_BATCH in src/lib/icloud-photos.ts. */
export const BATCH_SIZE = 48;

const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<PhotoUrls | null>>();
const queues = new Map<string, Waiter[]>();
let flushScheduled = false;

const keyOf = (gallery: string, guid: string) => `${gallery}/${guid}`;

/** URLs already in hand and still usable, or null. Never makes a request. */
export function cachedPhotoUrls(gallery: string, guid: string): PhotoUrls | null {
  const entry = cache.get(keyOf(gallery, guid));
  return entry && entry.until > Date.now() ? entry : null;
}

/** True when asking for this photo would add it to a request: not cached, not already on its way. */
export function needsPhotoUrls(gallery: string, guid: string): boolean {
  return !cachedPhotoUrls(gallery, guid) && !pending.has(keyOf(gallery, guid));
}

/**
 * Fresh URLs for one photo, batched with every other request this tick. A
 * photo already on its way shares that request. Null on any failure.
 */
export function photoUrls(gallery: string, guid: string): Promise<PhotoUrls | null> {
  const cached = cachedPhotoUrls(gallery, guid);
  if (cached) return Promise.resolve(cached);
  const key = keyOf(gallery, guid);
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = new Promise<PhotoUrls | null>((resolve) => {
    const queue = queues.get(gallery) ?? [];
    queue.push({ guid, resolve });
    queues.set(gallery, queue);
    if (!flushScheduled) {
      flushScheduled = true;
      setTimeout(flush, 0);
    }
  }).finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

function flush() {
  flushScheduled = false;
  for (const [gallery, waiters] of queues) {
    queues.delete(gallery);
    for (let i = 0; i < waiters.length; i += BATCH_SIZE) {
      const batch = waiters.slice(i, i + BATCH_SIZE);
      void fetchBatch(gallery, batch.map((w) => w.guid)).then(() => {
        for (const w of batch) w.resolve(cachedPhotoUrls(gallery, w.guid));
      });
    }
  }
}

async function fetchBatch(gallery: string, guids: string[]): Promise<void> {
  try {
    const res = await fetch(`/api/photos/${encodeURIComponent(gallery)}/urls?ids=${guids.map(encodeURIComponent).join(',')}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) return;
    const body = (await res.json()) as { photos?: Record<string, { thumb?: unknown; full?: unknown; ttl?: unknown }> };
    const now = Date.now();
    for (const [guid, p] of Object.entries(body.photos ?? {})) {
      if (typeof p.thumb !== 'string' || typeof p.full !== 'string' || typeof p.ttl !== 'number') continue;
      cache.set(keyOf(gallery, guid), { thumb: p.thumb, full: p.full, until: now + p.ttl });
    }
  } catch {
    // Offline, aborted by a navigation, or a bad response: callers fall back.
  }
}

// ── Tiles ─────────────────────────────────────────────────────

const loading = new WeakMap<HTMLImageElement, Promise<void>>();

/**
 * Gives a deferred tile image (`data-photo-deferred`, no src yet) its
 * source: iCloud URLs from a batch, else the redirect fallbacks in its
 * `data-fallback-src` / `data-fallback-srcset`. Resolves once the src is set
 * (not loaded). Safe to call repeatedly; a tile that already has a source
 * resolves at once.
 */
export function loadTile(img: HTMLImageElement): Promise<void> {
  if (!img.hasAttribute('data-photo-deferred')) return Promise.resolve();
  const existing = loading.get(img);
  if (existing) return existing;
  const item = img.closest<HTMLElement>('[data-photo-guid]');
  const gallery = img.closest<HTMLElement>('[data-photo-gallery]')?.dataset.photoGallery;
  const guid = item?.dataset.photoGuid;
  const promise = (gallery && guid ? photoUrls(gallery, guid) : Promise.resolve(null)).then((urls) => {
    img.removeAttribute('data-photo-deferred');
    if (urls) {
      // One fallback if iCloud refuses the URL anyway (e.g. it expired early).
      img.addEventListener('error', () => useFallback(img), { once: true });
      img.srcset = `${urls.thumb} ${img.dataset.thumbWidth}w, ${urls.full} ${img.dataset.fullWidth}w`;
      img.src = urls.thumb;
    } else {
      useFallback(img);
    }
  });
  loading.set(img, promise);
  return promise;
}

function useFallback(img: HTMLImageElement) {
  const src = img.dataset.fallbackSrc;
  if (!src || img.getAttribute('src') === src) return;
  img.srcset = img.dataset.fallbackSrcset ?? '';
  img.src = src;
}

/** The full-size URL to show in the lightbox: iCloud when we have one, else the redirect. */
export async function fullUrlFor(item: HTMLElement): Promise<string | null> {
  const gallery = item.closest<HTMLElement>('[data-photo-gallery]')?.dataset.photoGallery;
  const guid = item.dataset.photoGuid;
  const fallback = item.dataset.fullSrc ?? null;
  if (!gallery || !guid) return fallback;
  const urls = await photoUrls(gallery, guid);
  return urls?.full ?? fallback;
}

/** Fetch URLs ahead of need (e.g. the lightbox's neighbours), without touching any tile. */
export function warmPhotoUrls(items: Array<HTMLElement | undefined>) {
  for (const item of items) {
    const gallery = item?.closest<HTMLElement>('[data-photo-gallery]')?.dataset.photoGallery;
    const guid = item?.dataset.photoGuid;
    if (gallery && guid) void photoUrls(gallery, guid);
  }
}
