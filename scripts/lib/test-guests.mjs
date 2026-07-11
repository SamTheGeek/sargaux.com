/**
 * Script-side helpers for excluding synthetic test guests.
 * Keep normalized names in sync with src/lib/test-guests.ts.
 */

export const TEST_GUEST_NORMALIZED_NAMES = new Set(['alex rivera', 'jordan chen']);

/** Match src/lib/normalize.ts for name comparison in scripts. */
export function normalizeName(input) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ')
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
