/**
 * Persistent, deterministic serial-number assignment for USPS IMb barcodes.
 *
 * A serial number identifies one physical mailpiece, not a household — a
 * household that receives multiple mailings (e.g. a save-the-date AND an
 * invitation) needs a distinct serial for each piece. Each serial is:
 *   - Calculated, not based on alphabetical order or processing order
 *   - Unique within this Mailer ID, per mailpiece
 *   - Stable across every run and re-run of the export script
 *
 * Serials are derived by hashing a stable mailpiece key — the sorted Notion
 * page IDs of the household's named members plus a mailpiece label (e.g.
 * "Invitation", "SaveTheDate") — with SHA-256, then reducing mod the serial
 * space. Collisions are resolved by linear probing. Once assigned, a
 * mailpiece's serial is written to a local registry file and never
 * recalculated or changed, even if a later run's hash distribution would
 * have probed differently.
 *
 * The registry stores only opaque mailpiece-key hashes → serial numbers; it
 * contains no guest names, addresses, or other PII, so it's safe to commit.
 *
 * **Frozen (2026-10-17).** The invitations are all mailed and no more pieces
 * will be, so serial assignment is retired: `createSerialAssigner()` throws,
 * and nothing in the repo writes the registry any more. It's kept as the
 * read-only record of the barcodes already in the mail, which
 * check-usps-imb-status.mjs reads through `lookupSerial()`. The derivation
 * described above is history; the registry, not a re-derivation, is the
 * source of truth.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const REGISTRY_PATH = new URL('../data/usps-imb-serials.json', import.meta.url).pathname;

function hashKey(householdKey) {
  return createHash('sha256').update(householdKey).digest('hex');
}

function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) return {};
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
}

/**
 * Build the stable key used to derive a mailpiece's serial. `memberIds`
 * should be the Notion page IDs of the household's named members (not +1
 * placeholders) — immutable per guest, independent of name or address.
 * `piece` distinguishes multiple mailings to the same household (e.g.
 * "SaveTheDate" vs "Invitation") so each gets its own unique serial.
 * @param {string[]} memberIds
 * @param {string} piece
 */
export function mailpieceKey(memberIds, piece) {
  if (!piece) throw new Error('mailpieceKey requires a piece label');
  return [...memberIds].sort().join('|') + '#' + piece;
}

/**
 * Look up the serial already assigned to a mailpiece key, without assigning
 * one if it's missing. Returns null for a key that has never been mailed.
 * @param {string} key  Output of mailpieceKey()
 * @returns {number | null}
 */
export function lookupSerial(key) {
  const registry = loadRegistry();
  const serial = registry[hashKey(key)];
  return serial === undefined ? null : serial;
}

/**
 * Retired. Assigning a serial wrote a new entry to the registry, and no new
 * mailpieces will be sent, so this now refuses rather than ever growing or
 * touching the record of barcodes already in the mail.
 * @returns {never}
 */
export function createSerialAssigner() {
  throw new Error(
    'USPS serial assignment is retired: every invitation has been mailed, and ' +
      'scripts/data/usps-imb-serials.json is now a frozen record. Use lookupSerial() to read it.'
  );
}

/** Zero-pad a serial number to the given field width. */
export function formatSerial(serial, serialDigits) {
  return String(serial).padStart(serialDigits, '0');
}
