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
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
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
