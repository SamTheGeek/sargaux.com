import { test, expect } from '@playwright/test';
import {
  checkRateLimit,
  clientIp,
  rateLimitResponse,
  resetRateLimitsForTests,
} from '../src/lib/rate-limit';

/**
 * Unit-style tests for the in-memory rate limiter. These run in the Playwright
 * Node context (not the browser) to directly test the module's logic, following
 * the same pattern as auth-unit.spec.ts.
 *
 * Playwright runs each spec file in its own worker process, so mutating
 * process.env.RATE_LIMIT_DISABLED here cannot leak into other suites.
 */

const originalDisabled = process.env.RATE_LIMIT_DISABLED;

test.beforeEach(() => {
  // The e2e webServer sets RATE_LIMIT_DISABLED=true, but these unit tests must
  // exercise the real limiter. Clear it here and restore after the suite.
  delete process.env.RATE_LIMIT_DISABLED;
  resetRateLimitsForTests();
});

test.afterAll(() => {
  if (originalDisabled === undefined) {
    delete process.env.RATE_LIMIT_DISABLED;
  } else {
    process.env.RATE_LIMIT_DISABLED = originalDisabled;
  }
  resetRateLimitsForTests();
});

test.describe('Rate Limiter — checkRateLimit', () => {
  test('allows requests under the limit', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit('under-limit', 5, 60_000);
      expect(result.ok).toBe(true);
      expect(result.retryAfterSec).toBeUndefined();
    }
  });

  test('rejects the request over the limit', () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit('over-limit', 3, 60_000).ok).toBe(true);
    }
    const rejected = checkRateLimit('over-limit', 3, 60_000);
    expect(rejected.ok).toBe(false);
  });

  test('rejected requests do not consume window slots', () => {
    for (let i = 0; i < 2; i++) {
      expect(checkRateLimit('no-consume', 2, 60_000).ok).toBe(true);
    }
    // Hammering past the limit should not extend the lockout window
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('no-consume', 2, 60_000).ok).toBe(false);
    }
  });

  test('rejection carries Retry-After seconds within the window bounds', () => {
    const windowMs = 60_000;
    for (let i = 0; i < 2; i++) {
      checkRateLimit('retry-after', 2, windowMs);
    }
    const rejected = checkRateLimit('retry-after', 2, windowMs);
    expect(rejected.ok).toBe(false);
    expect(rejected.retryAfterSec).toBeDefined();
    // Hits were just recorded, so the wait should be (almost) the full window
    expect(rejected.retryAfterSec!).toBeGreaterThanOrEqual(1);
    expect(rejected.retryAfterSec!).toBeLessThanOrEqual(Math.ceil(windowMs / 1000));
    expect(rejected.retryAfterSec!).toBeGreaterThanOrEqual(59);
  });

  test('separate keys have independent buckets', () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit('key-a', 3, 60_000).ok).toBe(true);
    }
    expect(checkRateLimit('key-a', 3, 60_000).ok).toBe(false);
    // key-b is untouched by key-a's exhaustion
    expect(checkRateLimit('key-b', 3, 60_000).ok).toBe(true);
  });

  test('window expiry frees up slots (tiny wall-clock window)', async () => {
    // The limiter is wall-clock based with no time injection, so use a tiny
    // window instead of faking timers.
    const windowMs = 100;
    for (let i = 0; i < 2; i++) {
      expect(checkRateLimit('window-reset', 2, windowMs).ok).toBe(true);
    }
    expect(checkRateLimit('window-reset', 2, windowMs).ok).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, windowMs + 50));
    expect(checkRateLimit('window-reset', 2, windowMs).ok).toBe(true);
  });

  test('resetRateLimitsForTests clears all buckets', () => {
    checkRateLimit('reset-me', 1, 60_000);
    expect(checkRateLimit('reset-me', 1, 60_000).ok).toBe(false);

    resetRateLimitsForTests();
    expect(checkRateLimit('reset-me', 1, 60_000).ok).toBe(true);
  });

  test('RATE_LIMIT_DISABLED kill switch bypasses the limiter', () => {
    process.env.RATE_LIMIT_DISABLED = 'true';
    try {
      for (let i = 0; i < 20; i++) {
        expect(checkRateLimit('kill-switch', 1, 60_000).ok).toBe(true);
      }
    } finally {
      delete process.env.RATE_LIMIT_DISABLED;
    }
  });
});

test.describe('Rate Limiter — clientIp', () => {
  const requestWithHeaders = (headers: Record<string, string>) =>
    new Request('http://localhost:1213/api/login', { headers });

  test('prefers the Netlify platform header', () => {
    const request = requestWithHeaders({
      'x-nf-client-connection-ip': '203.0.113.7',
      'x-forwarded-for': '198.51.100.1, 10.0.0.1',
    });
    expect(clientIp(request)).toBe('203.0.113.7');
  });

  test('falls back to the first X-Forwarded-For entry', () => {
    const request = requestWithHeaders({
      'x-forwarded-for': '198.51.100.1, 10.0.0.1',
    });
    expect(clientIp(request)).toBe('198.51.100.1');
  });

  test('falls back to a shared key when no headers are present', () => {
    expect(clientIp(requestWithHeaders({}))).toBe('unknown');
  });
});

test.describe('Rate Limiter — rateLimitResponse', () => {
  test('returns a 429 JSON response with Retry-After', async () => {
    const response = rateLimitResponse(42);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body.error).toContain('Too many requests');
  });

  test('defaults Retry-After to 60 seconds', () => {
    expect(rateLimitResponse().headers.get('Retry-After')).toBe('60');
  });
});
