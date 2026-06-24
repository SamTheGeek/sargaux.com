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
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const REGISTRY_PATH = new URL('../data/usps-imb-serials.json', import.meta.url).pathname;

function hashKey(householdKey) {
  return createHash('sha256').update(householdKey).digest('hex');
}

function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) return {};
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
}

function saveRegistry(registry) {
  mkdirSync(dirname(REGISTRY_PATH), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(registry).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(REGISTRY_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
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
 * Get the previously-assigned serial for every known household key, plus a
 * function to assign new ones — batched so collision resolution for a whole
 * run is computed against a single consistent snapshot of the registry.
 * @param {number} serialDigits  6 or 9 — width of the serial number field
 */
export function createSerialAssigner(serialDigits) {
  const serialSpace = 10 ** serialDigits;
  const registry = loadRegistry();
  const used = new Set(Object.values(registry));
  let dirty = false;

  /** @param {string} key  Output of mailpieceKey() */
  function getOrAssignSerial(key) {
    const hash = hashKey(key);
    if (registry[hash] !== undefined) return registry[hash];

    let candidate = parseInt(hash.slice(0, 12), 16) % serialSpace;
    while (used.has(candidate)) {
      candidate = (candidate + 1) % serialSpace;
    }

    registry[hash] = candidate;
    used.add(candidate);
    dirty = true;
    return candidate;
  }

  function flush() {
    if (dirty) saveRegistry(registry);
  }

  return { getOrAssignSerial, flush };
}

/** Zero-pad a serial number to the given field width. */
export function formatSerial(serial, serialDigits) {
  return String(serial).padStart(serialDigits, '0');
}
