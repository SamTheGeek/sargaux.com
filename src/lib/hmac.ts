/**
 * Shared HMAC helpers for signed tokens (session cookies, calendar URLs).
 */

import { createHmac } from 'crypto';

/** Encode a string as URL-safe base64 (no padding). */
export function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Decode a base64url string. Returns null if decoding fails. */
export function fromBase64Url(input: string): string | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4;
    const b64 = pad === 0 ? padded : padded + '='.repeat(4 - pad);
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

/** HMAC-SHA256 hex digest, optionally truncated. */
export function hmacSha256Hex(secret: string, data: string, length?: number): string {
  const digest = createHmac('sha256', secret).update(data).digest('hex');
  return length !== undefined ? digest.slice(0, length) : digest;
}

/**
 * Constant-time equality for equal-length hex (or other ASCII) strings.
 * Returns false if lengths differ.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}
