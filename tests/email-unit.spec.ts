import { test, expect } from '@playwright/test';
import { withRecipient } from '../src/lib/email';
import {
  TEMPLATES,
  saveTheDateNYC,
  saveTheDateFrance,
  reminderGeneral,
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

test.describe('reminder-general body Markdown', () => {
  const render = (body: string) => reminderGeneral({ guestName: 'Alex Rivera', subject: 'S', body });

  test('bold, links and bullets become HTML', () => {
    const { html } = render(
      '**Meet Up Point:**\nBy the trees.\n\n* G train\n* Ferry\n\nBook [here](https://example.com/park?a=1&b=2).',
    );
    expect(html).toContain('<strong>Meet Up Point:</strong><br />By the trees.');
    expect(html).toMatch(/<ul[^>]*><li[^>]*>G train<\/li><li[^>]*>Ferry<\/li><\/ul>/);
    expect(html).toContain('<a href="https://example.com/park?a=1&amp;b=2"');
    expect(html).toContain('>here</a>');
    expect(html).not.toContain('**');
    expect(html).not.toContain('](');
  });

  test('plain-text part drops markers and spells out links', () => {
    const { text } = render('**Bold** and [here](https://example.com/x).\n\n- one\n- two\n\nSee [sargaux.com](http://sargaux.com/)');
    expect(text).toContain('Bold and here (https://example.com/x).');
    expect(text).toContain('• one\n• two');
    expect(text).toContain('See http://sargaux.com/');
  });

  test('markup and unsafe link schemes are escaped, not rendered', () => {
    const { html } = render('<script>x</script> [bad](javascript:alert(1)) "quoted"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('&quot;quoted&quot;');
  });

  test('stray indentation and invisible paste characters are dropped', () => {
    const { html, text } = render('First.\n\u2800\n Second.');
    expect(html).toContain('>First.</p>');
    expect(html).toContain('>Second.</p>');
    expect(text).toBe('Dear Alex Rivera,\n\nFirst.\n\nSecond.');
  });
});
