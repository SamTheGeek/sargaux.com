/**
 * Email template functions for all transactional emails.
 * Each returns { subject, html, text } for use with sendEmail().
 *
 * HTML uses inline styles for maximum email client compatibility.
 * Design mirrors the NYC (dark moss) and France (prussian blue) site themes.
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Shared event info type ───────────────────────────────────────────────────

export interface EventInfo {
  name: string;
  time?: string;
  location?: string;
}

// ─── RSVP Confirmation ───────────────────────────────────────────────────────

export interface RSVPConfirmationParams {
  guestName: string;
  event: 'nyc' | 'france';
  attending: boolean;
  guestsAttending: string;   // comma-separated names
  coreEvents?: EventInfo[];
  optionalEvents?: EventInfo[];
  dietary?: string;
  updateUrl: string;
  calendarUrl?: string;      // personalised .ics subscription URL
}

export function rsvpConfirmation({
  guestName,
  event,
  attending,
  guestsAttending,
  coreEvents,
  optionalEvents,
  dietary,
  updateUrl,
  calendarUrl,
}: RSVPConfirmationParams): EmailTemplate {
  const isNYC = event === 'nyc';

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const surface   = isNYC ? '#17320b' : '#0d244d';
  const bodyText  = isNYC ? '#17320b' : '#0d244d';
  const textMuted = isNYC ? 'rgba(23,50,11,0.6)' : 'rgba(13,36,77,0.6)';
  const cream     = '#FFF9F0';
  const amber     = '#e65a17';
  const footerSep = isNYC ? 'rgba(23,50,11,0.12)' : 'rgba(13,36,77,0.12)';
  const footerClr = isNYC ? 'rgba(23,50,11,0.45)' : 'rgba(13,36,77,0.45)';

  // NYC uses Helvetica Neue throughout; France uses Century Gothic for body
  // and Georgia for header bands. Email clients rarely support @font-face
  // reliably, so we rely on system-font stacks that best approximate each brand.
  const sansStack   = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const headerStack = isNYC ? sansStack : "Georgia,'Times New Roman',serif";
  const bodyStack   = isNYC ? sansStack : "'Century Gothic','Trebuchet MS',sans-serif";

  // ── Copy ────────────────────────────────────────────────────────────────────
  const locationLabel = isNYC ? 'New York' : 'France';
  const dateLabel     = isNYC ? 'October 11, 2026' : 'May 28\u201330, 2027';
  const siteUrl       = isNYC ? 'sargaux.com/nyc' : 'sargaux.com/france';
  const fullSiteUrl   = isNYC ? 'https://sargaux.com/nyc' : 'https://sargaux.com/france';

  const openingLine = attending
    ? `We've received your RSVP \u2014 we're excited that you are <strong>attending</strong> our ${escHtml(locationLabel)} celebration.`
    : `We've received your RSVP \u2014 we're sorry to miss you.`;

  const signOff = attending
    ? `We're so excited to celebrate with you!`
    : `We hope to see you another time.`;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Full-width dark band used as section label */
  const band = (label: string) => `
    <tr>
      <td style="background:${surface};padding:9px 40px;">
        <p style="margin:0;font-family:${headerStack};font-size:10px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:${cream};">${label}</p>
      </td>
    </tr>`;

  /** Render a list of EventInfo rows (name + optional meta line) */
  const eventRows = (events: EventInfo[]) =>
    events.map((ev, i) => {
      const isLast = i === events.length - 1;
      const meta = [ev.time, ev.location].filter(Boolean).join(' \u00b7 ');
      return `
        <tr>
          <td${isLast ? '' : ' style="padding-bottom:12px;"'}>
            <p style="margin:0;font-family:${bodyStack};font-size:14px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${bodyText};line-height:1.3;">${escHtml(ev.name)}</p>
            ${meta ? `<p style="margin:2px 0 0;font-family:${bodyStack};font-size:13px;line-height:1.4;color:${textMuted};">${escHtml(meta)}</p>` : ''}
          </td>
        </tr>`;
    }).join('');

  // ── Attending-only sections ──────────────────────────────────────────────────
  const attendingBlock = attending ? `
    ${band('Guests Attending')}
    <tr>
      <td style="background:${cream};padding:18px 40px 20px;">
        <p style="margin:0;font-family:${bodyStack};font-size:15px;line-height:1.65;color:${bodyText};">${escHtml(guestsAttending)}</p>
      </td>
    </tr>
    ${coreEvents && coreEvents.length > 0 ? `
    ${band('Events')}
    <tr>
      <td style="background:${cream};padding:18px 40px 20px;">
        <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
          ${eventRows(coreEvents)}
        </table>
      </td>
    </tr>` : ''}
    ${optionalEvents && optionalEvents.length > 0 ? `
    ${band('Special Activities')}
    <tr>
      <td style="background:${cream};padding:18px 40px 20px;">
        <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
          ${eventRows(optionalEvents)}
        </table>
      </td>
    </tr>` : ''}
    ${dietary ? `
    ${band('Dietary Notes')}
    <tr>
      <td style="background:${cream};padding:18px 40px 20px;">
        <p style="margin:0;font-family:${bodyStack};font-size:15px;line-height:1.65;color:${bodyText};">${escHtml(dietary)}</p>
      </td>
    </tr>` : ''}
    ${calendarUrl ? `
    <tr>
      <td style="background:${cream};padding:24px 40px 16px;">
        <p style="margin:0 0 16px;font-family:${bodyStack};font-size:15px;line-height:1.65;color:${bodyText};">Subscribe to your personalized calendar event feed and it'll stay up to date automatically.</p>
      </td>
    </tr>
    <tr>
      <td style="background:${cream};padding:0 40px 32px;">
        <a href="${escHtml(calendarUrl)}" style="display:inline-block;padding:13px 28px;background:${amber};color:${cream};font-family:${sansStack};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;line-height:1;">Add to Calendar</a>
      </td>
    </tr>` : ''}` : '';

  // ── Full HTML ────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#e8e4df;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:${cream};">

          <!-- HEADER BAND -->
          <tr>
            <td style="background:${surface};padding:32px 40px 28px;">
              <p style="margin:0 0 10px;font-family:${headerStack};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,249,240,0.55);">${escHtml(locationLabel)}</p>
              <p style="margin:0 0 10px;font-family:${headerStack};font-size:30px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:${cream};line-height:1.05;word-break:break-word;overflow-wrap:break-word;"><span style="white-space:nowrap">Margaux &amp;</span> Sam</p>
              <p style="margin:0;font-family:${headerStack};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,249,240,0.45);">${escHtml(dateLabel)}</p>
            </td>
          </tr>

          <!-- OPENING -->
          <tr>
            <td style="background:${cream};padding:32px 40px 24px;">
              <p style="margin:0 0 16px;font-family:${bodyStack};font-size:16px;line-height:1.65;color:${bodyText};">Dear ${escHtml(guestName)},</p>
              <p style="margin:0 0 14px;font-family:${bodyStack};font-size:16px;line-height:1.65;color:${bodyText};">${openingLine}</p>
              <p style="margin:0;font-family:${bodyStack};font-size:16px;line-height:1.65;color:${bodyText};">For more details, visit <a href="${fullSiteUrl}" style="color:${bodyText};text-decoration:underline;">${escHtml(siteUrl)}</a>.</p>
            </td>
          </tr>

          ${attendingBlock}

          <!-- UPDATE LINK -->
          <tr>
            <td style="background:${cream};padding:0 40px 20px;">
              <p style="margin:0;font-family:${bodyStack};font-size:15px;line-height:1.65;color:${bodyText};">Need to update your response? <a href="${escHtml(updateUrl)}" style="color:${amber};text-decoration:underline;">Update your RSVP</a>.</p>
            </td>
          </tr>

          <!-- SIGN-OFF -->
          <tr>
            <td style="background:${cream};padding:0 40px 40px;">
              <p style="margin:0;font-family:${bodyStack};font-size:15px;line-height:1.65;color:${bodyText};">${signOff}<br/><br/>With love,<br/><span style="white-space:nowrap">Margaux &amp;</span> Sam</p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:16px 40px;border-top:1px solid ${footerSep};font-family:${sansStack};font-size:11px;color:${footerClr};text-align:center;">
              <span style="white-space:nowrap">Margaux &amp;</span> Sam &middot; sargaux.com
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ── Plain text ───────────────────────────────────────────────────────────────
  const textLines: string[] = [
    `Dear ${guestName},`,
    '',
    attending
      ? `We've received your RSVP \u2014 we're excited that you are attending our ${locationLabel} celebration (${dateLabel}).`
      : `We've received your RSVP \u2014 we're sorry to miss you.`,
    '',
    `For more details, visit ${fullSiteUrl}`,
    '',
  ];

  if (attending) {
    if (guestsAttending) {
      textLines.push(`Guests Attending: ${guestsAttending}`, '');
    }
    if (coreEvents && coreEvents.length > 0) {
      textLines.push('Events:');
      for (const ev of coreEvents) {
        const meta = [ev.time, ev.location].filter(Boolean).join(' \u00b7 ');
        textLines.push(`  - ${ev.name}${meta ? ` (${meta})` : ''}`);
      }
      textLines.push('');
    }
    if (optionalEvents && optionalEvents.length > 0) {
      textLines.push('Special Activities:');
      for (const ev of optionalEvents) {
        const meta = [ev.time, ev.location].filter(Boolean).join(' \u00b7 ');
        textLines.push(`  - ${ev.name}${meta ? ` (${meta})` : ''}`);
      }
      textLines.push('');
    }
    if (dietary) {
      textLines.push(`Dietary Notes: ${dietary}`, '');
    }
    if (calendarUrl) {
      textLines.push(
        "Subscribe to your personalized calendar event feed and it'll stay up to date automatically.",
        calendarUrl,
        ''
      );
    }
  }

  textLines.push(
    `Need to update your response? Visit: ${updateUrl}`,
    '',
    signOff,
    '',
    'With love,',
    'Margaux & Sam',
  );

  return {
    subject: `RSVP Confirmation \u2014 Margaux Ancel & Sam Gross \u00b7 ${locationLabel} Celebration`,
    html,
    text: textLines.join('\n'),
  };
}

// ─── Save the Date: NYC ──────────────────────────────────────────────────────

export interface SaveTheDateParams {
  guestName: string;
}

export function saveTheDateNYC({ guestName }: SaveTheDateParams): EmailTemplate {
  const sans    = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const cream   = '#FFF9F0';
  const surface = '#17320b';
  const bodyText = '#17320b';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#e8e4df;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:${cream};">
          <tr>
            <td style="background:${surface};padding:32px 40px 28px;">
              <p style="margin:0 0 10px;font-family:${sans};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,249,240,0.55);">New York</p>
              <p style="margin:0 0 10px;font-family:${sans};font-size:30px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:${cream};line-height:1.05;"><span style="white-space:nowrap">Margaux &amp;</span> Sam</p>
              <p style="margin:0;font-family:${sans};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,249,240,0.45);">October 11, 2026</p>
            </td>
          </tr>
          <tr>
            <td style="background:${cream};padding:32px 40px 40px;">
              <p style="margin:0 0 16px;font-family:${sans};font-size:16px;line-height:1.65;color:${bodyText};">Dear ${escHtml(guestName)},</p>
              <p style="margin:0 0 16px;font-family:${sans};font-size:16px;line-height:1.65;color:${bodyText};">We're getting married in New York City! Please save the date:</p>
              <p style="margin:24px 0;font-family:${sans};font-size:22px;font-weight:700;text-align:center;letter-spacing:0.03em;text-transform:uppercase;color:${bodyText};">Sunday, October 11, 2026</p>
              <p style="margin:0 0 24px;font-family:${sans};font-size:16px;line-height:1.65;color:${bodyText};">Formal invitation and details to follow.</p>
              <p style="margin:0;font-family:${sans};font-size:15px;line-height:1.65;color:${bodyText};">With love,<br/><span style="white-space:nowrap">Margaux &amp;</span> Sam</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px;border-top:1px solid rgba(23,50,11,0.12);font-family:${sans};font-size:11px;color:rgba(23,50,11,0.45);text-align:center;">
              <span style="white-space:nowrap">Margaux &amp;</span> Sam &middot; sargaux.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
    'Margaux & Sam',
  ].join('\n');

  return {
    subject: "Save the Date \u2014 Margaux Ancel & Sam Gross \u00b7 New York Celebration",
    html,
    text,
  };
}

// ─── Save the Date: France ───────────────────────────────────────────────────

export function saveTheDateFrance({ guestName }: SaveTheDateParams): EmailTemplate {
  const sans     = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const header   = "Georgia,'Times New Roman',serif";
  const bodyFont = "'Century Gothic','Trebuchet MS',sans-serif";
  const cream    = '#FFF9F0';
  const surface  = '#0d244d';
  const bodyText = '#0d244d';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#e8e4df;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:${cream};">
          <tr>
            <td style="background:${surface};padding:32px 40px 28px;">
              <p style="margin:0 0 10px;font-family:${header};font-size:11px;font-weight:400;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,249,240,0.55);">France</p>
              <p style="margin:0 0 10px;font-family:${header};font-size:30px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:${cream};line-height:1.05;"><span style="white-space:nowrap">Margaux &amp;</span> Sam</p>
              <p style="margin:0;font-family:${header};font-size:11px;font-weight:400;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,249,240,0.45);">May 28\u201330, 2027</p>
            </td>
          </tr>
          <tr>
            <td style="background:${cream};padding:32px 40px 40px;">
              <p style="margin:0 0 16px;font-family:${bodyFont};font-size:16px;line-height:1.65;color:${bodyText};">Dear ${escHtml(guestName)},</p>
              <p style="margin:0 0 16px;font-family:${bodyFont};font-size:16px;line-height:1.65;color:${bodyText};">We're getting married in France! Please save the date:</p>
              <p style="margin:24px 0;font-family:${bodyFont};font-size:22px;font-weight:700;text-align:center;letter-spacing:0.03em;text-transform:uppercase;color:${bodyText};">Thursday\u2013Saturday, May 28\u201330, 2027</p>
              <p style="margin:0 0 24px;font-family:${bodyFont};font-size:16px;line-height:1.65;color:${bodyText};">Formal invitation and details to follow.</p>
              <p style="margin:0;font-family:${bodyFont};font-size:15px;line-height:1.65;color:${bodyText};">With love,<br/><span style="white-space:nowrap">Margaux &amp;</span> Sam</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px;border-top:1px solid rgba(13,36,77,0.12);font-family:${sans};font-size:11px;color:rgba(13,36,77,0.45);text-align:center;">
              <span style="white-space:nowrap">Margaux &amp;</span> Sam &middot; sargaux.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Dear ${guestName},`,
    '',
    "We're getting married in France! Please save the date:",
    '',
    'Thursday\u2013Saturday, May 28\u201330, 2027',
    '',
    'Formal invitation and details to follow.',
    '',
    'With love,',
    'Margaux & Sam',
  ].join('\n');

  return {
    subject: "Save the Date \u2014 Margaux Ancel & Sam Gross \u00b7 France Celebration",
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
  const sans     = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const cream    = '#FFF9F0';
  const surface  = '#17320b';
  const bodyText = '#17320b';
  const htmlBody = escHtml(body).replace(/\n/g, '<br />');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#e8e4df;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:${cream};">
          <tr>
            <td style="background:${surface};padding:32px 40px 28px;">
              <p style="margin:0 0 10px;font-family:${sans};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,249,240,0.55);">Margaux &amp; Sam</p>
              <p style="margin:0;font-family:${sans};font-size:30px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:${cream};line-height:1.05;"><span style="white-space:nowrap">Margaux &amp;</span> Sam</p>
            </td>
          </tr>
          <tr>
            <td style="background:${cream};padding:32px 40px 40px;">
              <p style="margin:0 0 16px;font-family:${sans};font-size:16px;line-height:1.65;color:${bodyText};">Dear ${escHtml(guestName)},</p>
              <p style="margin:0;font-family:${sans};font-size:16px;line-height:1.65;color:${bodyText};">${htmlBody}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px;border-top:1px solid rgba(23,50,11,0.12);font-family:${sans};font-size:11px;color:rgba(23,50,11,0.45);text-align:center;">
              <span style="white-space:nowrap">Margaux &amp;</span> Sam &middot; sargaux.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const plainText = [`Dear ${guestName},`, '', body].join('\n');

  return { subject, html, text: plainText };
}

// ─── Template registry ───────────────────────────────────────────────────────

export const TEMPLATES = {
  'rsvp-confirmation': rsvpConfirmation,
  'save-the-date-nyc': saveTheDateNYC,
  'save-the-date-france': saveTheDateFrance,
  'reminder-general': reminderGeneral,
} as const;

export type TemplateName = keyof typeof TEMPLATES;
