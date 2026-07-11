/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Best-effort on Netlify (per warm instance). Still effective against
 * single-IP bursts and name-guessing bots; not a global distributed quota.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec?: number;
}

/**
 * Check and record a hit for `key` within a sliding window.
 * @param limit max requests allowed in the window
 * @param windowMs window length in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  // Playwright / local node adapter sets this so the suite is not self-throttled
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return { ok: true };
  }

  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) {
      // Evict oldest-ish entry to bound memory
      const firstKey = buckets.keys().next().value;
      if (firstKey !== undefined) buckets.delete(firstKey);
    }
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // Drop timestamps outside the window
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0]!;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { ok: false, retryAfterSec };
  }

  bucket.timestamps.push(now);
  return { ok: true };
}

/**
 * Client IP from Netlify / proxy headers, falling back to a shared key.
 *
 * Trust model: on Netlify production, `x-nf-client-connection-ip` is set by
 * the platform on every request and cannot be spoofed by clients, so it is
 * the authoritative source. The `X-Forwarded-For` / `cf-connecting-ip`
 * fallbacks only apply under the node adapter (local dev, Playwright), where
 * they are client-controlled — rate limits there are best-effort and
 * spoofable, which is acceptable for non-production use. Buckets are also
 * per-instance and in-memory, so they reset on serverless cold starts;
 * this limiter is a burst brake, not a global distributed quota.
 */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/** Build a JSON 429 response with Retry-After. */
export function rateLimitResponse(retryAfterSec = 60): Response {
  return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSec),
    },
  });
}

/** Reset all buckets — for unit tests only. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}
