/**
 * Resend email client wrapper.
 *
 * IMPORTANT: RESEND_API_KEY must NEVER be committed to the repository.
 * Store it in Netlify environment variables / GitHub Secrets only.
 *
 * Uses process.env (not import.meta.env) because Netlify Dashboard env vars
 * are runtime-only and not available at build time via Vite.
 */

import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not set. Add it to Netlify environment variables (never commit it).'
    );
  }
  resendClient = new Resend(apiKey);
  return resendClient;
}

const FROM = () =>
  process.env.RESEND_FROM_ADDRESS ?? 'Sam Gross <sam@mail.sargaux.com>';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const client = getClient();
  const { error } = await client.emails.send({ from: FROM(), ...payload });
  if (error) throw new Error(`Resend error: ${(error as { message?: string }).message ?? String(error)}`);
}

/**
 * Send one email per guest, isolating failures so one bad address
 * doesn't stop the rest (fire-and-forget bulk).
 */
export async function sendToGuests(
  guests: { email: string; name: string }[],
  buildPayload: (guest: { email: string; name: string }) => EmailPayload
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const guest of guests) {
    try {
      await sendEmail(buildPayload(guest));
      sent++;
    } catch (err) {
      console.error(`Failed to send email to ${guest.email}:`, err);
      failed++;
    }
  }
  return { sent, failed };
}
