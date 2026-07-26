import { test, expect } from '@playwright/test';
import { withRecipient } from '../src/lib/email';
import {
  TEMPLATES,
  saveTheDateNYC,
  saveTheDateFrance,
} from '../src/lib/email-templates';
import type { TemplateName } from '../src/lib/email-templates';

/**
 * Unit-style tests for outbound email payload assembly. These run in the
 * Playwright Node context (not the browser).
 *
 * These exist because the admin send endpoints short-circuit to
 * `{ skipped: true }` whenever `global.emailEnabled` is off — which is the
 * default, and how the suite always runs. tests/admin.spec.ts therefore never
 * reaches the code that builds a payload, so a bulk sender can be broken
 * without any test noticing. It was: both endpoints passed a template result
 * straight to sendToGuests, and templates carry no `to` field, so Resend would
 * have rejected every send with no recipient.
 */

const GUEST = { email: 'guest@example.com', name: 'Robin Marchetti' };

test.describe('Email — payload assembly', () => {
  test('withRecipient attaches the guest address to a template result', () => {
    const payload = withRecipient(GUEST, saveTheDateNYC({ guestName: GUEST.name }));

    expect(payload.to).toBe('guest@example.com');
    expect(payload.subject).toBeTruthy();
    expect(payload.html).toBeTruthy();
    expect(payload.text).toBeTruthy();
  });

  test('withRecipient does not let a template override the recipient', () => {
    // Templates are spread after `to` is set, so a stray `to` in a template
    // would win. Guard the ordering explicitly.
    const template = {
      subject: 's',
      html: 'h',
      text: 't',
      to: 'attacker@example.com',
    } as unknown as ReturnType<typeof saveTheDateNYC>;

    expect(withRecipient(GUEST, template).to).toBe('guest@example.com');
  });

  // Minimal valid params per template — each takes a different shape, and the
  // ones with required fields beyond guestName throw without them.
  const TEMPLATE_PARAMS: Record<TemplateName, Record<string, unknown>> = {
    'save-the-date-nyc': { guestName: GUEST.name },
    'save-the-date-france': { guestName: GUEST.name },
    'rsvp-confirmation': {
      guestName: GUEST.name,
      event: 'nyc',
      attending: true,
      guestsAttending: GUEST.name,
      updateUrl: 'https://sargaux.com/nyc/rsvp',
    },
    'reminder-general': {
      guestName: GUEST.name,
      subject: 'A reminder',
      body: 'First paragraph.\n\nSecond paragraph.',
    },
  };

  test.describe('every registered template composes into a sendable payload', () => {
    for (const name of Object.keys(TEMPLATES) as TemplateName[]) {
      test(name, () => {
        // Each template declares its own params interface, so calling them
        // through a single loop needs the same erasure the send-email endpoint uses.
        const template = (TEMPLATES[name] as unknown as (p: Record<string, unknown>) => {
          subject: string;
          html: string;
          text: string;
        })(TEMPLATE_PARAMS[name]);

        const payload = withRecipient(GUEST, template);

        expect(payload.to, `${name} must carry a recipient`).toBe(GUEST.email);
        expect(payload.subject.length, `${name} must have a subject`).toBeGreaterThan(0);
        expect(payload.html.length, `${name} must have an HTML body`).toBeGreaterThan(0);
        expect(payload.text.length, `${name} must have a text body`).toBeGreaterThan(0);
      });
    }
  });

  test('save-the-date templates greet the guest by name', () => {
    for (const template of [saveTheDateNYC, saveTheDateFrance]) {
      const { html, text } = template({ guestName: GUEST.name });
      expect(html).toContain(GUEST.name);
      expect(text).toContain(GUEST.name);
    }
  });
});
