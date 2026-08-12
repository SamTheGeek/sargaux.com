/**
 * Script-side helpers for excluding synthetic test guests.
 * Keep normalized names in sync with src/lib/test-guests.ts.
 */

export const TEST_GUEST_NORMALIZED_NAMES = new Set(['alex rivera', 'jordan chen', 'riley dubois']);

/**
 * Match src/lib/normalize.ts for name comparison in scripts — same fold order:
 * lowercase → ligature/stroke letters → NFD accent strip → drop apostrophes →
 * dashes to spaces → collapse whitespace. Keep the two in sync, or a guest
 * whose stored and submitted names differ only in punctuation ("O'Reilly",
 * "Jean‑Pierre" with a Unicode hyphen) reads as a non-match here while the
 * site matches them fine.
 */
export function normalizeName(input) {
  return input
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2018\u2019\u02BC`\u00B4]/g, '')
    .replace(/[-\u2010-\u2014]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getGuestFullName(page) {
  return (
    page.properties['Full Name']?.formula?.string ||
    page.properties['Name of Guest']?.title?.[0]?.plain_text ||
    ''
  );
}

export function isTestGuestPage(page) {
  if (page.properties['Test Guest']?.checkbox === true) return true;
  const name = normalizeName(getGuestFullName(page));
  return TEST_GUEST_NORMALIZED_NAMES.has(name);
}

export function excludeTestGuestPages(pages) {
  return pages.filter((page) => !isTestGuestPage(page));
}
