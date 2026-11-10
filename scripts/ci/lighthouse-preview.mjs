#!/usr/bin/env node
/**
 * Lighthouse every page of a deployed (or locally built) site, logged in as a
 * 🤖 test guest. Used by .github/workflows/lighthouse-preview.yml against the
 * PR's deploy preview; Netlify's own Lighthouse plugin can only audit `/`
 * because it can't send a session cookie.
 *
 * Environment:
 *   LH_BASE_URL     origin to audit, e.g. https://<deploy-id>--sargaux.netlify.app
 *   LH_COOKIE       Cookie header for an authenticated session
 *                   ("sargaux_auth=…; sargaux_lang=…"). Never printed.
 *   LH_REPORT_DIR   where HTML reports go (default: lighthouse-reports)
 *   LH_PAGES        optional comma-separated subset of paths, for local runs
 *   CHROME_PATH     optional Chrome/Chromium binary (chrome-launcher honours it)
 *   GITHUB_STEP_SUMMARY  when set, the score table is appended there too
 *
 * Report-only: scores never fail the run. The run fails only when a page
 * can't be audited as itself — a redirect (lost session), an unexpected
 * status, or a Lighthouse runtime error — so a broken login can't pass as
 * a table of homepage scores.
 */

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { ReportGenerator } from 'lighthouse/report/generator/report-generator.js';

const BASE = (process.env.LH_BASE_URL ?? '').replace(/\/+$/, '');
const COOKIE = process.env.LH_COOKIE ?? '';
const REPORT_DIR = process.env.LH_REPORT_DIR ?? 'lighthouse-reports';

if (!BASE) fail('LH_BASE_URL is required');
if (!COOKIE) fail('LH_COOKIE is required (an authenticated session cookie)');

/**
 * `/` is audited logged out: a signed-in guest is redirected from the
 * homepage to their event route, and the login page is what visitors see.
 * `optional` pages may legitimately 404 on a branch that doesn't have them
 * (the photo galleries exist only once they have photos).
 */
const ALL_PAGES = [
  { path: '/', auth: false },
  { path: '/nyc' },
  { path: '/nyc/details', private: true },
  { path: '/nyc/travel' },
  { path: '/nyc/faq' },
  { path: '/nyc/lookbook' },
  { path: '/nyc/rsvp' },
  { path: '/nyc/photos/celebration', optional: true },
  { path: '/nyc/photos/preparation', optional: true },
  { path: '/nyc/photos/afterparty', optional: true },
  { path: '/france' },
  { path: '/france/details' },
  { path: '/france/schedule', private: true },
  { path: '/france/travel' },
  { path: '/france/faq' },
  { path: '/france/lookbook' },
  { path: '/france/rsvp' },
  { path: '/couple' },
  { path: '/registry' },
];
// `private` pages embed the bot's personal calendar subscription link (a
// capability URL). Their scores go in the table, but their HTML reports are
// never written, so they can't end up in a public artifact.

// Every cookie value, so a report that still contains one is never written.
const COOKIE_VALUES = COOKIE.split(';')
  .map((pair) => pair.slice(pair.indexOf('=') + 1).trim())
  .filter((value) => value.length >= 8);

const subset = process.env.LH_PAGES?.split(',').map((p) => p.trim()).filter(Boolean);
const PAGES = subset ? ALL_PAGES.filter((p) => subset.includes(p.path)) : ALL_PAGES;

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

function fail(message) {
  console.error(`lighthouse-preview: ${message}`);
  process.exit(1);
}

function slug(pagePath) {
  return pagePath === '/' ? 'home' : pagePath.slice(1).replaceAll('/', '-');
}

/** Pre-flight with redirects off, so a lost session shows up as a 3xx. */
async function preflight(page) {
  const headers = page.auth === false ? {} : { Cookie: COOKIE };
  const res = await fetch(BASE + page.path, { headers, redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') };
}

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const rows = [];
  try {
    for (const page of PAGES) {
      const url = BASE + page.path;
      let pre;
      try {
        pre = await preflight(page);
      } catch (err) {
        rows.push({ page, outcome: 'failed', note: `request failed: ${err.message}` });
        continue;
      }

      if (pre.status === 404 && page.optional) {
        rows.push({ page, outcome: 'skipped', note: 'not on this branch (404)' });
        continue;
      }
      if (pre.status !== 200) {
        const where = pre.location ? ` → ${new URL(pre.location, url).pathname}` : '';
        rows.push({ page, outcome: 'failed', note: `HTTP ${pre.status}${where}` });
        continue;
      }

      console.log(`Auditing ${page.path}…`);
      let result;
      try {
        result = await lighthouse(
          url,
          { port: chrome.port, output: 'json', logLevel: 'error' },
          {
            extends: 'lighthouse:default',
            settings: {
              // Mobile emulation + simulated throttling: Lighthouse's defaults,
              // and what Netlify's plugin reports for `/`.
              formFactor: 'mobile',
              onlyCategories: CATEGORIES,
              // Previews send `x-robots-tag: noindex` on purpose.
              skipAudits: ['is-crawlable'],
              extraHeaders: page.auth === false ? {} : { Cookie: COOKIE },
            },
          }
        );
      } catch (err) {
        rows.push({ page, outcome: 'failed', note: `Lighthouse error: ${err.message}` });
        continue;
      }

      const lhr = result?.lhr;
      if (!lhr || lhr.runtimeError) {
        rows.push({ page, outcome: 'failed', note: lhr?.runtimeError?.message ?? 'no result' });
        continue;
      }

      const finalPath = new URL(lhr.finalDisplayedUrl).pathname.replace(/(.)\/+$/, '$1');
      if (finalPath !== page.path) {
        rows.push({ page, outcome: 'failed', note: `ended on ${finalPath}, not the page itself` });
        continue;
      }

      const scores = Object.fromEntries(
        CATEGORIES.map((id) => [id, lhr.categories[id]?.score ?? null])
      );
      if (!page.private) {
        // Lighthouse copies the settings, extraHeaders included, into the LHR
        // the HTML report embeds — that would publish the session cookie in
        // the artifact. Strip it and render the report from the scrubbed LHR.
        if (lhr.configSettings) lhr.configSettings.extraHeaders = null;
        const html = ReportGenerator.generateReportHtml(lhr);
        if (COOKIE_VALUES.some((value) => html.includes(value))) {
          rows.push({ page, outcome: 'failed', note: 'report still contained the session cookie; not written' });
          continue;
        }
        await writeFile(path.join(REPORT_DIR, `${slug(page.path)}.html`), html);
      }
      rows.push({ page, outcome: 'audited', scores });
    }
  } finally {
    chrome.kill();
  }

  const summary = renderSummary(rows);
  console.log(`\n${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }

  const failed = rows.filter((r) => r.outcome === 'failed');
  if (failed.length > 0) fail(`${failed.length} page(s) could not be audited`);
}

function fmt(score) {
  if (score === null || score === undefined) return '–';
  const n = Math.round(score * 100);
  const mark = n >= 90 ? '🟢' : n >= 50 ? '🟠' : '🔴';
  return `${mark} ${n}`;
}

function renderSummary(rows) {
  const lines = [
    '## Lighthouse (mobile) — deploy preview',
    '',
    '| Page | Performance | Accessibility | Best Practices | SEO | Notes |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const { page, outcome, scores, note } of rows) {
    const label = `\`${page.path}\``;
    if (outcome === 'audited') {
      const cells = CATEGORIES.map((id) => fmt(scores[id]));
      const notes = [page.auth === false ? 'logged out' : '', page.private ? 'report withheld (calendar link)' : '']
        .filter(Boolean)
        .join('; ');
      lines.push(`| ${label} | ${cells.join(' | ')} | ${notes} |`);
    } else {
      const status = outcome === 'skipped' ? '⏭️ skipped' : '❌ failed';
      lines.push(`| ${label} | – | – | – | – | ${status}: ${note} |`);
    }
  }
  lines.push('', '_Report-only: no score thresholds. `is-crawlable` is skipped (previews are noindex)._');
  return lines.join('\n');
}

main().catch((err) => fail(err?.stack ?? String(err)));
