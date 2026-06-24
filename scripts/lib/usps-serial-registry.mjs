/**
 * Persistent, deterministic serial-number assignment for USPS IMb barcodes.
 *
 * Each mailpiece (household/envelope) needs a serial number that is:
 *   - Calculated, not based on alphabetical order or processing order
 *   - Unique within this Mailer ID
 *   - Stable across every run and re-run of the export script
 *
 * Serials are derived by hashing a stable household key (the sorted Notion
 * page IDs of the household's named members — immutable, opaque, never
 * alphabetical) with SHA-256, then reducing mod the serial space. Collisions
 * are resolved by linear probing. Once assigned, a household's serial is
 * written to a local registry file and never recalculated or changed, even
 * if a later run's hash distribution would have probed differently.
 *
 * The registry stores only opaque household-key hashes → serial numbers; it
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
 * Build the stable household key used to derive a serial. `memberIds` should
 * be the Notion page IDs of the household's named members (not +1
 * placeholders) — immutable per guest, independent of name or address.
 * @param {string[]} memberIds
 */
export function householdKey(memberIds) {
  return [...memberIds].sort().join('|');
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

  /** @param {string} key  Output of householdKey() */
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
