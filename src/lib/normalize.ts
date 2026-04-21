/**
 * Normalize a name for comparison:
 * lowercase → remove accents (NFD) → collapse whitespace → trim
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
