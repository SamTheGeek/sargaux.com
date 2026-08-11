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

const FROM = () => {
  const env = process.env.RESEND_FROM_ADDRESS;
  if (!env) return 'Margaux Ancel & Sam Gross <hello@mail.sargaux.com>';
  // If env var already contains a display name, use as-is; otherwise wrap it
  return env.includes('<') ? env : `Margaux Ancel & Sam Gross <${env}>`;
};

const REPLY_TO = 'hello@sargaux.com';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const client = getClient();
  const { error } = await client.emails.send({ from: FROM(), replyTo: REPLY_TO, ...payload });
  if (error) throw new Error(`Resend error: ${(error as { message?: string }).message ?? String(error)}`);
}

/**
 * Attach a recipient to a template result.
 *
 * Templates in email-templates.ts return { subject, html, text } and carry no
 * recipient, so they are not a complete EmailPayload on their own. Routing every
 * bulk send through this helper keeps `to` from going missing — Resend rejects a
 * payload without one, and sendToGuests would silently count every guest as failed.
 */
export function withRecipient(
  guest: { email: string },
  template: Omit<EmailPayload, 'to'>
): EmailPayload {
  // `to` is set last so a stray recipient on a template result can never
  // redirect the mail away from the intended guest.
  return { ...template, to: guest.email };
}

export interface SendToGuestsOptions<G> {
  /** Pause between consecutive sends (Resend allows 2 req/s). */
  delayMs?: number;
  /**
   * Runs after each successful send — e.g. to record "sent" in Notion so an
   * interrupted bulk run resumes instead of double-mailing. A callback failure
   * does not mark the email as failed (it went out); it's logged and counted
   * separately so the caller can surface it.
   */
  onSent?: (guest: G) => Promise<void> | void;
}

/**
 * Send one email per guest, isolating failures so one bad address
 * doesn't stop the rest (fire-and-forget bulk).
 *
 * Generic over the recipient shape so callers can thread extra per-recipient
 * data (e.g. a Notion guest id for per-guest calendar links) into the builder.
 */
export async function sendToGuests<G extends { email: string; name: string }>(
  guests: G[],
  buildPayload: (guest: G) => EmailPayload,
  options: SendToGuestsOptions<G> = {}
): Promise<{ sent: number; failed: number; onSentFailed: number }> {
  let sent = 0;
  let failed = 0;
  let onSentFailed = 0;
  let first = true;
  for (const guest of guests) {
    if (!first && options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    first = false;
    try {
      await sendEmail(buildPayload(guest));
      sent++;
    } catch (err) {
      console.error(`Failed to send email to ${guest.email}:`, err);
      failed++;
      continue;
    }
    if (options.onSent) {
      try {
        await options.onSent(guest);
      } catch (err) {
        console.error(`Post-send callback failed for ${guest.email}:`, err);
        onSentFailed++;
      }
    }
  }
  return { sent, failed, onSentFailed };
}
