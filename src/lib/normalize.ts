/**
 * Normalize a name for comparison:
 * lowercase → remove accents (NFD) → hyphens to spaces → collapse whitespace → trim
 *
 * Hyphens are treated as word separators (equivalent to spaces) so that
 * hyphenated names match regardless of whether the guest types the hyphen
 * (e.g. "Jean-Pierre" and "Jean Pierre" both normalize to "jean pierre").
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
