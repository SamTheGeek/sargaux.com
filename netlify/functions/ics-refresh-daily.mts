import type { Config } from '@netlify/functions';
import { refreshAllICS } from '../../src/lib/ics-generator';

/**
 * Returns true if the current UTC datetime falls within either pre-wedding
 * daily-refresh window.
 *
 * Uses plain UTC Date comparisons — no toLocaleString() or timezone parsing.
 * The boundaries are 1-day generous on each end so server/timezone edge cases
 * don't matter.
 */
function isInPreWeddingWindow(): boolean {
  const now = new Date();
  // NYC: Sep 27 – Oct 13, 2026 (generous: includes Sep 27 00:00Z through Oct 14 00:00Z)
  const nycStart = new Date('2026-09-27T00:00:00Z');
  const nycEnd = new Date('2026-10-14T00:00:00Z');
  // France: May 14 – May 31, 2027
  const franceStart = new Date('2027-05-14T00:00:00Z');
  const franceEnd = new Date('2027-06-01T00:00:00Z');
  return (
    (now >= nycStart && now < nycEnd) ||
    (now >= franceStart && now < franceEnd)
  );
}

export default async function handler() {
  if (!isInPreWeddingWindow()) {
    console.log('[ics-refresh-daily] Outside pre-wedding window — skipping');
    return new Response('Skipped', { status: 200 });
  }

  console.log('[ics-refresh-daily] In pre-wedding window — starting daily ICS refresh');
  try {
    const result = await refreshAllICS();
    console.log(
      `[ics-refresh-daily] Done: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`
    );
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error('[ics-refresh-daily] Refresh failed:', err);
    return new Response(String(err), { status: 500 });
  }
}

export const config: Config = {
  schedule: '0 3 * * *', // Every day at 03:00 UTC
};
