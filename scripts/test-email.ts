#!/usr/bin/env tsx
/**
 * Quick test: sends a sample RSVP confirmation email via Resend.
 *
 * Usage:
 *   RESEND_API_KEY=re_xxx RESEND_FROM_ADDRESS="Sam Gross <sam@mail.sargaux.com>" \
 *     npx tsx scripts/test-email.ts
 *
 * Or add RESEND_API_KEY to .env.local and run:
 *   npx tsx scripts/test-email.ts
 */

import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('❌  RESEND_API_KEY is not set. Pass it as an env var:\n');
  console.error('  RESEND_API_KEY=re_xxx npx tsx scripts/test-email.ts\n');
  process.exit(1);
}

const from = process.env.RESEND_FROM_ADDRESS ?? 'Sam Gross <sam@mail.sargaux.com>';
const to = process.env.TEST_EMAIL ?? 'sam@samthegeek.net';

console.log(`Sending test RSVP confirmation email...`);
console.log(`  From: ${from}`);
console.log(`  To:   ${to}\n`);

const resend = new Resend(apiKey);

const template = {
  subject: "RSVP Confirmed — Sam & Margaux's New York Celebration",
  html: `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#fff;font-family:Georgia,serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="padding-bottom:32px;">
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:normal;">Sam &amp; Margaux</h1>
        <p style="margin:0;font-size:13px;color:#888;font-family:sans-serif;text-transform:uppercase;letter-spacing:1px;">New York &middot; October 11, 2026</p>
      </td></tr>
      <tr><td style="padding-bottom:24px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Dear Sam Gross,</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">We've received your RSVP — you are marked as <strong>attending</strong> for our New York celebration.</p>
      </td></tr>
      <tr><td style="padding:20px;background:#f9f9f7;">
        <p style="margin:0;font-size:15px;"><strong>Attending:</strong> Sam Gross</p>
      </td></tr>
      <tr><td style="padding-top:24px;font-size:15px;line-height:1.6;">
        Need to update? <a href="http://localhost:1213/nyc/rsvp" style="color:#1a1a1a;">Update your RSVP</a>.
      </td></tr>
      <tr><td style="padding-bottom:32px;font-size:15px;line-height:1.6;">We're so excited to celebrate with you.<br/>With love, Sam &amp; Margaux</td></tr>
      <tr><td style="padding-top:40px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;text-align:center;font-family:sans-serif;">Sam &amp; Margaux &middot; sargaux.com</td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  text: `Dear Sam Gross,\n\nWe've received your RSVP — you are marked as attending for our New York celebration (October 11, 2026).\n\nAttending: Sam Gross\n\nNeed to update? Visit: http://localhost:1213/nyc/rsvp\n\nWe're so excited to celebrate with you.\nWith love, Sam & Margaux`,
};

const { data, error } = await resend.emails.send({
  from,
  to,
  subject: template.subject,
  html: template.html,
  text: template.text,
});

if (error) {
  console.error('❌  Failed:', error);
  process.exit(1);
}

console.log('✅  Email sent! ID:', data?.id);
