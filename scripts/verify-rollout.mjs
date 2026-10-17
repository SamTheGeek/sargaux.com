#!/usr/bin/env node
/**
 * Post-deploy smoke check for a runtime or infrastructure rollout.
 *
 * Automates the read-only checks from Phases 3 and 4 of
 * docs/plans/2026-10-01-node-24-upgrade.md, so a deploy preview and production
 * get exactly the same checks, run the same way each time. It's written for the
 * Node 24 upgrade, but nothing in it depends on that release.
 *
 * Usage (from the repo root):
 *   node scripts/verify-rollout.mjs                         # production
 *   node scripts/verify-rollout.mjs --base <preview URL>    # a deploy preview
 *   node scripts/verify-rollout.mjs --compare-ics <calendar URL>
 *   node scripts/verify-rollout.mjs --refresh-calendars     # production only; writes
 *
 * Read-only by default. The checks:
 *   1. GET /                     200, and the security headers. Against a preview, the
 *                                values must also match production's.
 *   2. GET /api/calendar/health  exactly {"ok":true}, with no config flags leaked
 *   3. POST /api/login           an unknown name gets a 401 with an `error` string
 *   4. GET /?next=…              200. If the language switcher renders, its links keep
 *                                *this* request's `next`. Another value there means the
 *                                CDN served a cached variant (the Netlify-Vary
 *                                query=next contract).
 *   5. GET /api/warm             200 with the admin bearer from .env.local; prints timing
 *   6. --compare-ics <url>       the calendar from --base and from production, identical
 *                                apart from DTSTAMP. The URL is a capability secret, so
 *                                it's taken as an argument and never printed in full.
 *   7. --refresh-calendars       POST /api/admin/refresh-calendars. Off unless asked for,
 *                                because it rewrites every guest's stored ICS. Refused for
 *                                any base except production; never run it on a preview.
 *
 * Exits non-zero if any check fails. It finishes by printing the manual steps it
 * can't see for itself (deploy log, function runtime, the 7-day watch).
 */

import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

const PRODUCTION = 'https://sargaux.com';

// The headers middleware sets on every page response. Only the names are listed
// here. tests/security-headers.spec.ts owns the expected values, and this script
// checks a preview's values against production's live ones, so they aren't
// duplicated.
const SECURITY_HEADERS = [
  'strict-transport-security',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'content-security-policy-report-only',
];

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: PRODUCTION },
    'compare-ics': { type: 'string' },
    'refresh-calendars': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (args.help) {
  console.log('Usage: node scripts/verify-rollout.mjs [--base <url>] [--compare-ics <calendar url>] [--refresh-calendars]');
  process.exit(0);
}

// The checks send the admin bearer and, with --compare-ics, a calendar
// capability URL, so they only ever go to this site's own origins. A mistyped
// or pasted --base must not hand either one to someone else's server.
const ALLOWED_ORIGIN = /^https:\/\/(sargaux\.com|deploy-preview-\d+--sargaux\.netlify\.app)$/;

const base = URL.parse(args.base)?.origin;
if (!base || !ALLOWED_ORIGIN.test(base)) {
  console.error(`Refusing --base ${args.base}: only ${PRODUCTION} and its deploy previews are allowed.`);
  process.exit(2);
}
const isProduction = base === PRODUCTION;

if (args['refresh-calendars'] && !isProduction) {
  console.error(`Refusing --refresh-calendars against ${base}: it runs on production only.`);
  process.exit(2);
}

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const adminSecret = process.env.RESEND_ADMIN_SECRET;

// Every request below uses redirect: 'manual', so a redirect fails its status
// check instead of being followed. A preview that redirected to production would
// otherwise pass by checking production against itself.
let failures = 0;

function pass(name, detail = '') {
  console.log(`PASS  ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail) {
  failures += 1;
  console.log(`FAIL  ${name}: ${detail}`);
}

function skip(name, detail) {
  console.log(`SKIP  ${name}: ${detail}`);
}

/** Runs one check, so an exception inside it fails that check instead of the whole run. */
async function check(name, fn) {
  try {
    await fn();
  } catch (err) {
    fail(name, err instanceof Error ? err.message : String(err));
  }
}

/** Shows a capability URL's origin and path prefix, never its token. */
function redact(url) {
  const u = new URL(url);
  return `${u.origin}${u.pathname.slice(0, 16)}…`;
}

await check('homepage + security headers', async () => {
  const res = await fetch(`${base}/`, { redirect: 'manual' });
  if (res.status !== 200) return fail('homepage + security headers', `status ${res.status}`);

  const missing = SECURITY_HEADERS.filter((h) => !res.headers.get(h));
  if (missing.length) return fail('homepage + security headers', `missing ${missing.join(', ')}`);
  if (res.headers.get('content-security-policy')) {
    return fail('homepage + security headers', 'CSP is enforcing; it must stay report-only');
  }

  if (!isProduction) {
    const prod = await fetch(`${PRODUCTION}/`, { redirect: 'manual' });
    // Netlify replaces HSTS on *.netlify.app with its own preload policy, so a
    // preview's HSTS value can never match production's. It's still required to be present.
    const differing = SECURITY_HEADERS.filter(
      (h) => h !== 'strict-transport-security' && res.headers.get(h) !== prod.headers.get(h)
    );
    if (differing.length) {
      return fail('homepage + security headers', `differs from production: ${differing.join(', ')}`);
    }
    return pass('homepage + security headers', 'match production');
  }
  pass('homepage + security headers');
});

await check('calendar health', async () => {
  const res = await fetch(`${base}/api/calendar/health`, { redirect: 'manual' });
  const body = await res.text();
  if (res.status !== 200) return fail('calendar health', `status ${res.status}`);
  if (body.trim() !== '{"ok":true}') return fail('calendar health', `unexpected body ${body.slice(0, 80)}`);
  pass('calendar health');
});

await check('login rejects an unknown name', async () => {
  const name = `rollout check ${randomBytes(6).toString('hex')}`;
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base },
    body: new URLSearchParams({ name }),
  });
  const body = await res.json().catch(() => null);
  if (res.status !== 401) return fail('login rejects an unknown name', `status ${res.status}`);
  if (typeof body?.error !== 'string') {
    return fail('login rejects an unknown name', '401 body has no `error` string');
  }
  pass('login rejects an unknown name');
});

await check('deep-link homepage keeps its own next', async () => {
  // A different `next` on each run, so a cached copy from an earlier run can't pass.
  const next = `/nyc/travel?rollout=${randomBytes(4).toString('hex')}`;
  const res = await fetch(`${base}/?next=${encodeURIComponent(next)}`, { redirect: 'manual' });
  if (res.status !== 200) return fail('deep-link homepage keeps its own next', `status ${res.status}`);

  const html = await res.text();
  const switcher = html.match(/class="lang-switcher"[\s\S]*?<\/div>/)?.[0];
  if (!switcher) return pass('deep-link homepage keeps its own next', 'no language switcher rendered');

  const hrefs = [...switcher.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replaceAll('&amp;', '&'));
  const carried = hrefs.filter((href) => new URL(href, base).searchParams.get('next') === next);
  if (hrefs.length === 0 || carried.length !== hrefs.length) {
    return fail('deep-link homepage keeps its own next', 'language links carry a different next (cached variant?)');
  }
  pass('deep-link homepage keeps its own next', `${hrefs.length} language links`);
});

await check('cache warm', async () => {
  if (!adminSecret) return skip('cache warm', 'RESEND_ADMIN_SECRET not in .env.local');
  const started = performance.now();
  const res = await fetch(`${base}/api/warm`, {
    headers: { Authorization: `Bearer ${adminSecret}` },
    redirect: 'manual',
  });
  const ms = Math.round(performance.now() - started);
  const body = await res.json().catch(() => null);
  if (res.status !== 200 || body?.warmed !== true) {
    return fail('cache warm', `status ${res.status}, body ${JSON.stringify(body)}`);
  }
  pass('cache warm', `${ms} ms`);
});

if (args['compare-ics']) {
  await check('calendar feed matches production', async () => {
    const path = new URL(args['compare-ics'].replace(/^webcal:/, 'https:'));
    if (!ALLOWED_ORIGIN.test(path.origin)) {
      return fail('calendar feed matches production', 'the calendar URL is not on this site; refusing to fetch it');
    }
    const fetchIcs = async (origin) => {
      const res = await fetch(`${origin}${path.pathname}${path.search}`, { redirect: 'manual' });
      if (res.status !== 200) throw new Error(`${origin} returned ${res.status}`);
      return (await res.text()).split(/\r?\n/).filter((line) => !line.startsWith('DTSTAMP:'));
    };
    if (isProduction) return skip('calendar feed matches production', '--base is production; nothing to compare');

    const [candidate, prod] = await Promise.all([fetchIcs(base), fetchIcs(PRODUCTION)]);
    const firstDiff = candidate.findIndex((line, i) => line !== prod[i]);
    if (candidate.length !== prod.length || firstDiff !== -1) {
      return fail(
        'calendar feed matches production',
        `${redact(path.href)} differs (line ${firstDiff === -1 ? Math.min(candidate.length, prod.length) + 1 : firstDiff + 1})`
      );
    }
    pass('calendar feed matches production', `${candidate.length} lines`);
  });
}

if (args['refresh-calendars']) {
  await check('refresh calendars', async () => {
    if (!adminSecret) return fail('refresh calendars', 'RESEND_ADMIN_SECRET not in .env.local');
    const res = await fetch(`${base}/api/admin/refresh-calendars`, {
      method: 'POST',
      redirect: 'manual',
      // A JSON content type is required even with no body, or Astro's
      // checkOrigin rejects the POST before it reaches the endpoint.
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSecret}` },
    });
    const body = await res.json().catch(() => null);
    if (res.status !== 200 || !body) return fail('refresh calendars', `status ${res.status}`);
    const summary = `total ${body.total}, succeeded ${body.succeeded}, failed ${body.failed}`;
    if (body.failed > 0) return fail('refresh calendars', summary);
    pass('refresh calendars', summary);
  });
}

console.log(`
Not covered by this script; check these by hand:
  - The deploy log shows "Now using node v24", and the Functions tab shows a Node 24 runtime
    for the SSR function and both ics-refresh-* functions.
  - gh workflow run calendar-health.yml && gh workflow run cache-warmup.yml
  - Function logs: no new errors or deprecation warnings compared with a production sample.
  - The 7-day watch: the first ics-refresh-weekly run (Sunday 03:00 UTC), the function
    error rate, RSVPs with email addresses still arriving, and SSR p50/p95 against the
    Node 22 baseline.`);

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll automated checks passed.');
