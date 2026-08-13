/**
 * First-name variants: diminutives, formal/short pairs, and derived initials.
 *
 * These widen *first-name* matching only, and only inside the envelope-name
 * rules (src/lib/envelope-name.ts). Exact `Full Name` and `Name of Guest`
 * matching run first and are untouched, so no guest who logs in today can be
 * affected by anything here.
 *
 * Surnames are deliberately excluded. A surname is the only thing keeping a
 * household's namespace distinct, and "close enough" surnames are how you sign
 * a guest into a stranger's RSVP.
 *
 * This table covers *common* diminutives. One-off nicknames ("Bitsy" for
 * Elizabeth) are not derivable from the name and belong in the Notion
 * `Also Known As` property instead, which needs no deploy to change.
 */

import { normalize } from './normalize';

/**
 * Interchangeable-name classes. Every member of a class accepts every other
 * member as a login variant.
 *
 * Stored as classes rather than a variant→canonical map because the mapping is
 * genuinely many-to-many: "Ted" is short for both Edward and Theodore, and a
 * single canonical root would have to pick one and lock the other guest out.
 * Membership is looked up from the *stored* name, so Edward accepts "Ted" and
 * Theodore accepts "Ted" without Edward ever accepting "Theo".
 *
 * Entries are normalized at module load, so accents may be written naturally.
 * Names that are independently given today are omitted on purpose — Jack is
 * not treated as John, Liam not as William, Julie not as Juliette.
 */
const NAME_CLASSES: readonly (readonly string[])[] = [
  // ── English ───────────────────────────────────────────────────────────────
  ['Alexander', 'Alexandre', 'Alex', 'Xander', 'Sasha'],
  ['Alexandra', 'Alex', 'Alexa', 'Sasha', 'Sandra'],
  ['Andrew', 'Andy', 'Drew'],
  ['Anthony', 'Antoine', 'Tony'],
  ['Benjamin', 'Ben', 'Benji', 'Benny'],
  ['Catherine', 'Katherine', 'Kathryn', 'Kate', 'Katie', 'Cathy', 'Kathy', 'Kat'],
  ['Charles', 'Charlie', 'Chuck'],
  ['Charlotte', 'Charlie', 'Lottie'],
  ['Christopher', 'Chris'],
  ['Christina', 'Christine', 'Chris', 'Chrissy', 'Tina'],
  ['Daniel', 'Dan', 'Danny'],
  ['Deborah', 'Deb', 'Debbie'],
  ['Edward', 'Ed', 'Eddie', 'Ted', 'Teddy'],
  ['Theodore', 'Theo', 'Ted', 'Teddy'],
  ['Elizabeth', 'Elisabeth', 'Liz', 'Lizzie', 'Beth', 'Betty', 'Eliza', 'Libby'],
  ['Frederick', 'Frederic', 'Fred', 'Freddie', 'Freddy'],
  ['Frederica', 'Frederique', 'Freddie', 'Freddy'],
  ['Gregory', 'Gregoire', 'Greg'],
  ['Isabelle', 'Isabel', 'Isabella', 'Izzy', 'Belle'],
  ['Jacqueline', 'Jackie', 'Jacky'],
  ['James', 'Jim', 'Jimmy'],
  ['Jennifer', 'Jen', 'Jenny'],
  ['Jonathan', 'Jon', 'Jonny'],
  ['Joseph', 'Joe', 'Joey'],
  ['Katherine', 'Kate', 'Katie', 'Kitty'],
  ['Kenneth', 'Ken', 'Kenny'],
  ['Margaret', 'Maggie', 'Meg', 'Peggy'],
  ['Matthew', 'Mathieu', 'Matthieu', 'Matt'],
  ['Michael', 'Mike', 'Mikey', 'Mick'],
  ['Nicholas', 'Nicolas', 'Nick', 'Nicky', 'Nico'],
  ['Patricia', 'Pat', 'Patty', 'Trish'],
  ['Patrick', 'Pat', 'Paddy'],
  ['Philip', 'Phillip', 'Philippe', 'Phil'],
  ['Rebecca', 'Becca', 'Becky'],
  ['Richard', 'Rich', 'Richie', 'Rick', 'Ricky', 'Dick'],
  ['Robert', 'Rob', 'Robbie', 'Bob', 'Bobby'],
  ['Samuel', 'Sam', 'Sammy'],
  ['Samantha', 'Sam', 'Sammy'],
  ['Sebastian', 'Sebastien', 'Seb'],
  ['Stephen', 'Steven', 'Steve', 'Stevie'],
  ['Susan', 'Sue', 'Susie', 'Suzy'],
  ['Thomas', 'Tom', 'Tommy'],
  ['Timothy', 'Tim', 'Timmy'],
  ['Victoria', 'Vicky', 'Tori'],
  ['Vincent', 'Vince', 'Vinny'],
  ['William', 'Will', 'Bill', 'Billy', 'Willy'],
  ['Zachary', 'Zach', 'Zack'],

  // ── French ────────────────────────────────────────────────────────────────
  ['Clementine', 'Clem'],
  ['Constance', 'Coco'],
  ['Dominique', 'Dom', 'Domi'],
  ['Emmanuel', 'Manu'],
  ['Emmanuelle', 'Manu'],
  ['Genevieve', 'Gen'],
  ['Guillaume', 'Guigui'],
  ['Jean-Baptiste', 'JB'],
  ['Jean-Christophe', 'JC'],
  ['Jean-Francois', 'JF'],
  ['Jean-Michel', 'JM'],
  ['Jean-Philippe', 'JP'],
  ['Marguerite', 'Margot', 'Maggie'],
  ['Olivier', 'Oliver', 'Ollie', 'Oli'],
  ['Raphael', 'Raph'],
  ['Stephane', 'Steph'],
  ['Stephanie', 'Steph'],
  ['Veronique', 'Vero'],
  ['Xavier', 'Xavi', 'Xav'],
];

/**
 * token → every token interchangeable with it, unioned across all classes it
 * appears in. Built once at module load.
 */
const VARIANTS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, Set<string>>();

  for (const nameClass of NAME_CLASSES) {
    // A class entry may itself be multi-token once normalized
    // ("Jean-Baptiste" → "jean baptiste"), which single-token lookup can never
    // see. Those are handled by `deriveInitials`; keep only single tokens here.
    const members = nameClass
      .map((name) => normalize(name))
      .filter((name) => name && !name.includes(' '));

    for (const member of members) {
      const existing = map.get(member);
      if (existing) for (const other of members) existing.add(other);
      else map.set(member, new Set(members));
    }
  }

  return map;
})();

/**
 * Every first-name token acceptable for a stored token, including itself.
 *
 * Looked up from the name as *stored in Notion*, never from what was typed:
 * that asymmetry is what stops Edward accepting "Theo" just because both
 * Edward and Theodore answer to "Ted".
 */
export function nameVariants(token: string): ReadonlySet<string> {
  return VARIANTS.get(token) ?? new Set([token]);
}

/**
 * Initials of a multi-token given name — "Pierre-Jérôme" → "pj".
 *
 * Covers the French hyphenated names that get shortened to their initials in
 * everyday use (Jean-Baptiste → JB, Marie-Claire → MC) without needing a table
 * entry per guest. `normalize()` has already turned hyphens into spaces, so
 * this sees "pierre jerome" whether or not the guest typed the hyphen.
 *
 * Returns null for single-token names (an initial alone is far too weak) and
 * for names of more than three parts.
 */
export function deriveInitials(firstNameTokens: string[]): string | null {
  if (firstNameTokens.length < 2 || firstNameTokens.length > 3) return null;
  const initials = firstNameTokens.map((token) => token[0]).join('');
  return initials.length >= 2 ? initials : null;
}
