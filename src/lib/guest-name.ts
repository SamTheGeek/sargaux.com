/**
 * Guest List name write-back, decided in one place.
 *
 * The RSVP form lets a guest correct any party member's name — most often an
 * unnamed plus-one recorded as "<host> +1", which only the host can fill in.
 * `submitRSVP` persists that edit to `First Name` / `Last Name` (which drive
 * the `Full Name` login formula) and to the `Name of Guest` title.
 *
 * Pure and Notion-free so the decision is testable: the write itself can only
 * be exercised by renaming a real Guest List row, which the API suite
 * deliberately refuses to do.
 */

/**
 * Split a typed full name into first and last.
 *
 * The last whitespace-delimited token is the surname; everything before it is
 * the given name, so two-word and hyphenated given names survive intact. A
 * single token is a given name with no surname — which is how a plus-one known
 * only by their first name is stored.
 *
 * Returns null for a name with no tokens at all.
 */
export function splitGuestName(full: string): { first: string; last: string } | null {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/**
 * What to write for one party member, or null to leave their name alone.
 *
 * `storedName` is the member's `Full Name`; `typedName` is whatever came back
 * in that member's form row, or undefined when the form threaded no id for
 * them (a legacy client) and no edit can be attributed.
 *
 * Only whitespace is normalized before comparing. Case and accents are **not**:
 * a guest correcting "Jerome" to "Jérôme" is making a real edit, and silently
 * discarding it would leave them unable to log in as the name they just fixed.
 */
export function guestNameEdit(
  storedName: string,
  typedName: string | undefined
): { first: string; last: string; title: string } | null {
  if (!typedName) return null;

  const collapse = (value: string) => value.trim().replace(/\s+/g, ' ');
  const title = collapse(typedName);
  const stored = collapse(storedName);
  if (!title || title === stored) return null;

  // Case-only differences are usually a real correction — a badly-cased row
  // being fixed to "Mary Anne Whitlock" — and those must persist so the guest
  // can log in as what they just typed. The one exception is the opposite
  // direction: an all-lowercase name replacing a properly-cased one is a phone
  // keyboard, not an edit, and would permanently lowercase the row that
  // envelopes, place cards and the follow-up export read from.
  //
  // Accents are deliberately NOT folded here — `sensitivity: 'accent'` ignores
  // case while keeping accents significant, so "Jerome" → "Jérôme" is not
  // case-only and always persists.
  const caseOnly = title.localeCompare(stored, undefined, { sensitivity: 'accent' }) === 0;
  if (caseOnly && title === title.toLowerCase() && stored !== stored.toLowerCase()) {
    return null;
  }

  const split = splitGuestName(title);
  return split ? { ...split, title } : null;
}

/**
 * The `Also Known As` text a renamed guest should carry, or null to leave it be.
 *
 * A rename overwrites the only copy of a guest's name. That is exactly right for
 * an unnamed plus-one — "<host> +1" is a slot, not a name — but not for someone
 * who simply typed what they go by: shortening "Matthew" to "Matt" on the RSVP
 * form would otherwise discard the formal name their invitation was addressed
 * with, and stop them logging in as it.
 *
 * Keeping the previous name here preserves both. `Also Known As` is read by
 * envelope login (src/lib/envelope-name.ts), so the old name keeps working, and
 * the formal name stays on the record for envelopes and place cards.
 */
export function preserveFormerName(
  storedName: string,
  existingAka: string[] | undefined
): string | null {
  const previous = storedName.trim().replace(/\s+/g, ' ');
  if (!previous) return null;

  // An unnamed plus-one placeholder is not a name worth keeping.
  if (/\+\s*1$/.test(previous)) return null;

  const lines = (existingAka ?? []).map((line) => line.trim()).filter(Boolean);
  const already = lines.some(
    (line) => line.localeCompare(previous, undefined, { sensitivity: 'accent' }) === 0
  );
  if (already) return null;

  return [...lines, previous].join('\n');
}
