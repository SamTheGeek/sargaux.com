/**
 * Email template functions for all transactional emails.
 * Each returns { subject, html, text } for use with sendEmail().
 *
 * HTML uses simple inline styles — deliberately minimal until post-design-sprint.
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

const baseHtml = (body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Georgia,serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">
          ${body}
          <tr>
            <td style="padding-top:40px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;text-align:center;font-family:sans-serif;">
              Sam &amp; Margaux &middot; sargaux.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── RSVP Confirmation ───────────────────────────────────────────────────────

export interface RSVPConfirmationParams {
  guestName: string;
  event: 'nyc' | 'france';
  attending: boolean;
  guestsAttending: string; // comma-separated names
  dietary?: string;
  updateUrl: string;
}

export function rsvpConfirmation({
  guestName,
  event,
  attending,
  guestsAttending,
  dietary,
  updateUrl,
}: RSVPConfirmationParams): EmailTemplate {
  const isNYC = event === 'nyc';
  const eventName = isNYC ? 'New York' : 'France';
  const eventDate = isNYC ? 'October 11, 2026' : 'May 28–30, 2027';
  const statusWord = attending ? 'attending' : 'unable to attend';

  const dietaryRow = dietary
    ? `<tr><td style="padding:8px 0;font-size:15px;"><strong>Dietary notes:</strong> ${escHtml(dietary)}</td></tr>`
    : '';

  const html = baseHtml(`
    <tr>
      <td style="padding-bottom:32px;">
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:normal;letter-spacing:0.5px;">
          Sam &amp; Margaux
        </h1>
        <p style="margin:0;font-size:13px;color:#888;font-family:sans-serif;letter-spacing:1px;text-transform:uppercase;">
          ${escHtml(eventName)} &middot; ${escHtml(eventDate)}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom:24px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          Dear ${escHtml(guestName)},
        </p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          We've received your RSVP — you are marked as <strong>${statusWord}</strong> for our ${escHtml(eventName)} celebration.
        </p>
      </td>
    </tr>
    ${attending && guestsAttending ? `
    <tr>
      <td style="padding:20px;background:#f9f9f7;margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tr><td style="padding:8px 0;font-size:15px;"><strong>Attending:</strong> ${escHtml(guestsAttending)}</td></tr>
          ${dietaryRow}
        </table>
      </td>
    </tr>
    ` : ''}
    <tr>
      <td style="padding-top:24px;padding-bottom:8px;font-size:15px;line-height:1.6;">
        Need to update your response?
        <a href="${escHtml(updateUrl)}" style="color:#1a1a1a;">Click here to update your RSVP</a>.
      </td>
    </tr>
    <tr>
      <td style="padding-bottom:32px;font-size:15px;line-height:1.6;">
        We're so excited to celebrate with you.
        <br />With love, Sam &amp; Margaux
      </td>
    </tr>
  `);

  const text = [
    `Dear ${guestName},`,
    '',
    `We've received your RSVP — you are marked as ${statusWord} for our ${eventName} celebration (${eventDate}).`,
    attending && guestsAttending ? `\nAttending: ${guestsAttending}` : '',
    dietary ? `Dietary notes: ${dietary}` : '',
    '',
    `Need to update your response? Visit: ${updateUrl}`,
    '',
    "We're so excited to celebrate with you.",
    'With love, Sam & Margaux',
  ]
    .filter((l) => l !== false)
    .join('\n');

  return {
    subject: `RSVP Confirmed — Sam & Margaux's ${eventName} Celebration`,
    html,
    text,
  };
}

// ─── Save the Date: NYC ──────────────────────────────────────────────────────

export interface SaveTheDateParams {
  guestName: string;
}

export function saveTheDateNYC({ guestName }: SaveTheDateParams): EmailTemplate {
  const html = baseHtml(`
    <tr>
      <td style="padding-bottom:32px;">
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:normal;letter-spacing:0.5px;">
          Sam &amp; Margaux
        </h1>
        <p style="margin:0;font-size:13px;color:#888;font-family:sans-serif;letter-spacing:1px;text-transform:uppercase;">
          New York &middot; October 11, 2026
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom:24px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          Dear ${escHtml(guestName)},
        </p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          We're getting married in New York City! Please save the date:
        </p>
        <p style="margin:24px 0;font-size:22px;text-align:center;letter-spacing:0.5px;">
          <strong>Sunday, October 11, 2026</strong>
        </p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          Formal invitation and details to follow.
        </p>
        <p style="margin:0;font-size:16px;line-height:1.6;">
          With love,<br />Sam &amp; Margaux
        </p>
      </td>
    </tr>
  `);

  const text = [
    `Dear ${guestName},`,
    '',
    "We're getting married in New York City! Please save the date:",
    '',
    'Sunday, October 11, 2026',
    '',
    'Formal invitation and details to follow.',
    '',
    'With love,',
    'Sam & Margaux',
  ].join('\n');

  return {
    subject: "Save the Date — Sam & Margaux's New York Celebration",
    html,
    text,
  };
}

// ─── Save the Date: France ───────────────────────────────────────────────────

export function saveTheDateFrance({ guestName }: SaveTheDateParams): EmailTemplate {
  const html = baseHtml(`
    <tr>
      <td style="padding-bottom:32px;">
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:normal;letter-spacing:0.5px;">
          Sam &amp; Margaux
        </h1>
        <p style="margin:0;font-size:13px;color:#888;font-family:sans-serif;letter-spacing:1px;text-transform:uppercase;">
          France &middot; May 28–30, 2027
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom:24px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          Dear ${escHtml(guestName)},
        </p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          We're getting married in France! Please save the date:
        </p>
        <p style="margin:24px 0;font-size:22px;text-align:center;letter-spacing:0.5px;">
          <strong>Thursday–Saturday, May 28–30, 2027</strong>
        </p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          Formal invitation and details to follow.
        </p>
        <p style="margin:0;font-size:16px;line-height:1.6;">
          With love,<br />Sam &amp; Margaux
        </p>
      </td>
    </tr>
  `);

  const text = [
    `Dear ${guestName},`,
    '',
    "We're getting married in France! Please save the date:",
    '',
    'Thursday–Saturday, May 28–30, 2027',
    '',
    'Formal invitation and details to follow.',
    '',
    'With love,',
    'Sam & Margaux',
  ].join('\n');

  return {
    subject: "Save the Date — Sam & Margaux's France Celebration",
    html,
    text,
  };
}

// ─── General Reminder ────────────────────────────────────────────────────────

export interface ReminderGeneralParams {
  guestName: string;
  subject: string;
  body: string; // plain paragraphs, newlines become <br>
}

export function reminderGeneral({
  guestName,
  subject,
  body,
}: ReminderGeneralParams): EmailTemplate {
  const htmlBody = escHtml(body).replace(/\n/g, '<br />');

  const html = baseHtml(`
    <tr>
      <td style="padding-bottom:32px;">
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:normal;letter-spacing:0.5px;">
          Sam &amp; Margaux
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom:32px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          Dear ${escHtml(guestName)},
        </p>
        <p style="margin:0;font-size:16px;line-height:1.6;">
          ${htmlBody}
        </p>
      </td>
    </tr>
  `);

  const text = [`Dear ${guestName},`, '', body].join('\n');

  return { subject, html, text };
}

// ─── Template registry ───────────────────────────────────────────────────────

export const TEMPLATES = {
  'rsvp-confirmation': rsvpConfirmation,
  'save-the-date-nyc': saveTheDateNYC,
  'save-the-date-france': saveTheDateFrance,
  'reminder-general': reminderGeneral,
} as const;

export type TemplateName = keyof typeof TEMPLATES;

// ─── Utility ─────────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
