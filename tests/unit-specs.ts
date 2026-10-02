/**
 * Specs that import `src/` modules directly and never touch the server or a
 * browser. They run in two places:
 *
 *  - `playwright.unit.config.ts` (`npm run test:unit`): no webServer, no
 *    browser, no secrets — the fast CI gate.
 *  - the main config, so a local `npm test` still runs everything. CI's e2e job
 *    sets `SKIP_UNIT_SPECS=1` to avoid running them a second time.
 *
 * A spec belongs here only if it needs neither `page`, `request`, nor
 * Notion/network access. Add new `*-unit.spec.ts` files to this list.
 */
export const UNIT_SPECS = [
  'auth-unit',
  'calendar-unit',
  'email-unit',
  'envelope-login-unit',
  'event-catalog-unit',
  'event-routing',
  'guest-name-unit',
  'locale-routing',
  'login-geo-unit',
  'notion-rsvp',
  'rate-limit-unit',
  'registry-routing',
  'return-to-unit',
  'rsvp-attendance-unit',
  'rsvp-split-unit',
].map((name) => `${name}.spec.ts`);
