/**
 * Shared admin Bearer auth for /api/admin/* and ops endpoints (/api/warm).
 *
 * Uses RESEND_ADMIN_SECRET (historical name — also gates non-email admin ops).
 */

import { timingSafeEqualString } from './hmac';

export function getAdminSecret(): string | undefined {
  return process.env.RESEND_ADMIN_SECRET;
}

/**
 * Verify Authorization: Bearer {RESEND_ADMIN_SECRET} with constant-time compare.
 */
export function verifyAdminBearer(request: Request): boolean {
  const secret = getAdminSecret();
  if (!secret) return false;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const provided = authHeader.slice('Bearer '.length);
  return timingSafeEqualString(provided, secret);
}

/**
 * Require admin auth. Returns a 401 Response on failure, or null on success.
 * Logs a short audit line (no PII).
 */
export function requireAdminAuth(request: Request, endpoint: string): Response | null {
  const ok = verifyAdminBearer(request);
  logAdminAudit(endpoint, ok);
  if (ok) return null;

  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Short audit log: timestamp, endpoint, success/fail — no guest PII. */
export function logAdminAudit(endpoint: string, success: boolean): void {
  console.log(
    `[admin-audit] ${new Date().toISOString()} endpoint=${endpoint} auth=${success ? 'ok' : 'fail'}`
  );
}
