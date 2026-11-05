/**
 * Build-stable shuffling.
 *
 * `__BUILD_SEED__` is injected by `vite.define` in `astro.config.mjs` and is
 * fixed for the lifetime of one build, so every request served by that build
 * (every serverless instance, every CDN variant) sees the same order, and the
 * next build draws a new one. Use this where the order should change per
 * deploy, not per request — `/couple` reshuffles per request on purpose and
 * does its own thing.
 */
declare const __BUILD_SEED__: number;

const BUILD_SEED: number = typeof __BUILD_SEED__ === 'number' ? __BUILD_SEED__ : 0;

/** mulberry32 — tiny deterministic PRNG, plenty for shuffling a photo grid. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle with a seeded PRNG. Returns a new array. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffle in this build's order. `salt` lets two lists on one page get
 * independent orders from the same build seed.
 */
export function buildShuffle<T>(items: readonly T[], salt = 0): T[] {
  return seededShuffle(items, (BUILD_SEED ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0);
}
