import type { Config } from '@netlify/functions';
import { refreshAllICS } from '../../src/lib/ics-generator';

export default async function handler() {
  console.log('[ics-refresh-weekly] Starting weekly ICS refresh');
  try {
    const result = await refreshAllICS();
    console.log(
      `[ics-refresh-weekly] Done: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`
    );
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error('[ics-refresh-weekly] Refresh failed:', err);
    return new Response(String(err), { status: 500 });
  }
}

export const config: Config = {
  schedule: '0 3 * * 0', // Every Sunday at 03:00 UTC
};
