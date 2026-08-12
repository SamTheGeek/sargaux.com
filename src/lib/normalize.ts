/**
 * Normalize a name for comparison:
 * lowercase → remove accents (NFD) → drop apostrophes → dashes to spaces →
 * collapse whitespace → trim
 *
 * Apostrophes are removed entirely, and every apostrophe-like character is
 * treated the same: iOS/macOS "smart punctuation" replaces a typed straight
 * apostrophe (U+0027) with a curly one (U+2019), so "O'Reilly" and "O'Reilly"
 * typed on an iPhone must both normalize to "oreilly" no matter which form
 * the keyboard produced or which form is stored in Notion.
 *
 * Hyphens (and their Unicode dash variants) are treated as word separators
 * (equivalent to spaces) so that hyphenated names match regardless of whether
 * the guest types the hyphen (e.g. "Jean-Pierre" and "Jean Pierre" both
 * normalize to "jean pierre").
 *
 * Ligature and stroke letters (œ, æ, ø, ł, ß, đ) have no NFD decomposition,
 * so the accent strip leaves them untouched — a record holding "Cœur" or
 * "Groß" would never match the conventional ASCII form the guest actually
 * types ("Coeur", "Gross"), and vice versa. Fold them explicitly.
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    // Non-decomposable letters, folded to their conventional ASCII spellings.
    // After toLowerCase, so only the lowercase forms need mapping.
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Apostrophe-like: straight ', curly (U+2018/U+2019), modifier letter
    // (U+02BC), backtick (U+0060), acute accent (U+00B4)
    .replace(/['‘’ʼ`´]/g, '')
    // ASCII hyphen plus Unicode hyphen/dash variants (U+2010..U+2014)
    .replace(/[-‐-—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
