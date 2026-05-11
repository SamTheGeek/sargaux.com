import { getStore } from '@netlify/blobs';

const STORE_NAME = 'ics';

// In-memory store used when CALENDAR_TEST_MODE=true.
// Module-level so it persists across requests within a single server process.
const _testStore = new Map<string, string>();

function store() {
  if (process.env.CALENDAR_TEST_MODE === 'true') {
    return {
      get: async (key: string, _opts?: unknown) => _testStore.get(key) ?? null,
      set: async (key: string, value: string) => { _testStore.set(key, value); },
    };
  }
  return getStore(STORE_NAME);
}

/**
 * Read a stored ICS file for a guest.
 * Returns null if the key does not exist (not an error — caller should 503).
 * Throws if the blob store is unreachable.
 */
export async function getICS(guestId: string): Promise<string | null> {
  const result = await store().get(guestId, { type: 'text' });
  return result ?? null;
}

/**
 * Write an ICS file for a guest.
 */
export async function setICS(guestId: string, content: string): Promise<void> {
  await store().set(guestId, content);
}

/**
 * Check if the blob store is reachable.
 * A null return (key not found) still means the store is up.
 * A thrown error means the store is unreachable.
 */
export async function checkBlobStoreHealth(): Promise<boolean> {
  try {
    await store().get('__health_probe__', { type: 'text' });
    return true;
  } catch {
    return false;
  }
}
