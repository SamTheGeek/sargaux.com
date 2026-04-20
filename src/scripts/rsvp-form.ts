/**
 * Shared RSVP form client script.
 *
 * Handles guest-toggle updates, email validation, payload assembly, and
 * form submission for both the NYC and France RSVP pages.
 *
 * Configuration is read from data attributes on the #rsvp-form element:
 *   data-event            – "nyc" | "france"
 *   data-email-required   – validation message shown when no email is provided
 *                           but the send-confirmation checkbox is checked
 *
 * Dietary field detection:
 *   NYC uses  <textarea name="dietary">
 *   France uses <textarea name="allergens">
 *   The script queries for whichever is present.
 *
 * France-specific details (accommodation, allergens) are included only when
 * those elements exist in the DOM.
 */

const isLocalDev = import.meta.env.DEV;

const form = document.getElementById('rsvp-form') as HTMLFormElement | null;

if (form) {
  const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  const successMessage = document.getElementById('form-success');
  const errorMessage = document.getElementById('form-error');
  const defaultErrorMessage =
    errorMessage?.textContent || 'We could not submit your RSVP. Please try again.';
  const confirmationEmailRequired =
    form.dataset.emailRequired ||
    'Add at least one email address to receive a confirmation.';
  const eventType = form.dataset.event || '';

  const showError = (message: string) => {
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  };

  const updateGuestStatus = (row: Element) => {
    const checkbox = row.querySelector('.guest-attending') as HTMLInputElement | null;
    const status = row.querySelector('.guest-status');
    if (status && checkbox) {
      status.textContent = checkbox.checked ? 'Attending' : 'Not attending';
    }
  };

  // Initialise guest toggle rows on load
  form.querySelectorAll('[data-guest-row]').forEach((row) => {
    updateGuestStatus(row);
    row.querySelector('.guest-attending')?.addEventListener('change', () => updateGuestStatus(row));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const originalButtonText = submitButton?.textContent || 'Submit RSVP';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Saving...';
    }
    if (successMessage) successMessage.hidden = true;
    if (errorMessage) {
      errorMessage.hidden = true;
      errorMessage.textContent = defaultErrorMessage;
    }

    // ── Guests ──────────────────────────────────────────────────────────────

    const anyAttending = Array.from(form.querySelectorAll('.guest-attending')).some(
      (cb) => (cb as HTMLInputElement).checked
    );

    const guestsAttending = Array.from(form.querySelectorAll('[data-guest-row]')).map((row) => {
      const nameInput = row.querySelector('.guest-name') as HTMLInputElement | null;
      const checkbox = row.querySelector('.guest-attending') as HTMLInputElement | null;
      return {
        name: nameInput?.value?.trim() || 'Guest',
        attending: checkbox?.checked === true,
      };
    });

    // ── Events ──────────────────────────────────────────────────────────────

    const coreEventIds = Array.from(
      form.querySelectorAll('.event-attending[data-event-type="core"]')
    )
      .map((input) => (input as HTMLInputElement).dataset.eventId)
      .filter(Boolean);

    const optionalEventIds = Array.from(
      form.querySelectorAll('.event-attending[data-event-type="optional"]')
    )
      .filter((input) => (input as HTMLInputElement).checked)
      .map((input) => (input as HTMLInputElement).dataset.eventId)
      .filter(Boolean);

    // ── Dietary / details ────────────────────────────────────────────────────

    // NYC uses name="dietary"; France uses name="allergens"
    const dietaryInput = form.querySelector(
      'textarea[name="dietary"], textarea[name="allergens"]'
    ) as HTMLTextAreaElement | null;
    const dietaryValue = dietaryInput?.value?.trim() || undefined;

    const details: Record<string, string | undefined> = {};
    const accommodationSelect = form.querySelector(
      'select[name="accommodation"]'
    ) as HTMLSelectElement | null;
    if (accommodationSelect) {
      details.accommodation = accommodationSelect.value || undefined;
    }
    if (dietaryInput?.name === 'allergens' && dietaryValue) {
      details.allergens = dietaryValue;
    }

    // ── Confirmation emails ──────────────────────────────────────────────────

    const sendConfirmationCheckbox = form.querySelector(
      'input[name="sendConfirmation"]'
    ) as HTMLInputElement | null;

    const guestEmails = Array.from(form.querySelectorAll('[data-guest-email-id]')).map((input) => {
      const el = input as HTMLInputElement;
      return {
        guestId: el.dataset.guestEmailId,
        name: el.dataset.guestEmailName || 'Guest',
        email: el.value?.trim() || undefined,
      };
    });

    if (sendConfirmationCheckbox?.checked && guestEmails.every((guest) => !guest.email)) {
      showError(confirmationEmailRequired);
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
      return;
    }

    // ── Payload ──────────────────────────────────────────────────────────────

    const payload = {
      event: eventType,
      guestsAttending,
      guestEmails,
      eventsAttending: anyAttending ? [...coreEventIds, ...optionalEventIds] : [],
      dietary: dietaryValue,
      message:
        (form.querySelector('textarea[name="message"]') as HTMLTextAreaElement | null)?.value?.trim() ||
        undefined,
      details,
      sendConfirmation: sendConfirmationCheckbox?.checked === true,
    };

    // ── Submit ───────────────────────────────────────────────────────────────

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || defaultErrorMessage);
      }

      window.location.href = `/${eventType}/rsvp/confirmed`;
    } catch (error) {
      showError(error instanceof Error ? error.message : defaultErrorMessage);

      if (isLocalDev) {
        window.setTimeout(() => {
          window.location.href = `/${eventType}/rsvp/confirmed?mock=dev`;
        }, 1600);
        return;
      }

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}
