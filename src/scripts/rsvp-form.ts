/**
 * Shared client script for the NYC and France RSVP forms.
 *
 * The two pages ran byte-identical copies of this logic apart from the event
 * name, the confirmation redirect, and the France-only accommodation select
 * and allergens textarea. Those are now read from the DOM: the France-only
 * controls are absent on the NYC page, so their handlers no-op there.
 *
 * This is a bundled module, not `is:inline` — TypeScript syntax is stripped at
 * build time, and the `export` keeps it a module rather than a global script.
 */

export function initRsvpForm(): void {
  const form = document.getElementById('rsvp-form');
  if (!form || form.dataset.rsvpInitialized) return;
  // Named `weddingEvent`, not `event`: the submit handler below takes an
  // `event` parameter, and the shadowing silently produced a redirect to
  // `/[object SubmitEvent]/rsvp/confirmed`.
  const weddingEvent = form.dataset.event;
  if (weddingEvent !== 'nyc' && weddingEvent !== 'france') return;
  form.dataset.rsvpInitialized = 'true';

  const confirmationEmailRequired = form.dataset.confirmEmailRequired ?? '';
  const confirmationEmailAllRequired = form.dataset.confirmEmailAllRequired ?? '';
  const requireAllEmails = form.dataset.requireAllEmails === 'true';
  const attendingLabel = form.dataset.attendingLabel ?? 'Attending';
  const notAttendingLabel = form.dataset.notAttendingLabel ?? 'Not attending';
  const isLocalDev = form.dataset.isLocalDev === 'true';

  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const successMessage = document.getElementById('form-success');
  const errorMessage = document.getElementById('form-error');
  const defaultErrorMessage = errorMessage?.textContent || 'We could not submit your RSVP. Please try again.';

  const showError = (message: string) => {
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  };

  const updateGuestStatus = (row: Element) => {
    const checkbox = row.querySelector<HTMLInputElement>('.guest-attending');
    const status = row.querySelector('.guest-status');
    if (status && checkbox) {
      status.textContent = checkbox.checked ? attendingLabel : notAttendingLabel;
    }
  };

  // Toggle states remembered while every event is declined, so restoring is
  // possible when an event flips back to "Attending". Null outside that state.
  let preDeclineToggles: Map<HTMLInputElement, boolean> | null = null;

  const guestRows = form.querySelectorAll<HTMLElement>('[data-guest-row]');
  guestRows.forEach((row) => {
    updateGuestStatus(row);
    const checkbox = row.querySelector<HTMLInputElement>('.guest-attending');
    checkbox?.addEventListener('change', () => {
      // A toggle the guest sets by hand wins over the automatic restore.
      preDeclineToggles?.delete(checkbox);
      updateGuestStatus(row);
    });
  });

  // Submit button reads "Regretfully Decline" when every event is declined.
  const declineLabel = form.dataset.declineLabel ?? 'Regretfully Decline';
  const eventSelects = Array.from(form.querySelectorAll<HTMLSelectElement>('select.event-attending'));
  const submitLabel = submitButton?.querySelector('.btn-label');
  const defaultSubmitLabel = submitLabel?.textContent ?? '';

  const allEventsDeclined = () =>
    eventSelects.length > 0 && eventSelects.every((select) => select.value === 'no');

  const updateSubmitLabel = () => {
    if (!submitLabel) return;
    submitLabel.textContent = allEventsDeclined() ? declineLabel : defaultSubmitLabel;
  };

  // Declining every event flips the guest toggles off so the form shows the
  // decline it will submit. Choosing "Attending" for an event again restores
  // the toggles as they were before the decline.
  const syncTogglesToDecline = () => {
    if (allEventsDeclined()) {
      if (preDeclineToggles) return;
      // Held in a local so the non-null narrowing survives into the callback.
      const toggles = new Map<HTMLInputElement, boolean>();
      preDeclineToggles = toggles;
      guestRows.forEach((row) => {
        const checkbox = row.querySelector<HTMLInputElement>('.guest-attending');
        if (!checkbox) return;
        toggles.set(checkbox, checkbox.checked);
        checkbox.checked = false;
        updateGuestStatus(row);
      });
    } else if (preDeclineToggles) {
      const toggles = preDeclineToggles;
      guestRows.forEach((row) => {
        const checkbox = row.querySelector<HTMLInputElement>('.guest-attending');
        if (!checkbox) return;
        // One lookup instead of has() + get(); absent means the guest was
        // added or re-toggled since the decline, so leave them alone.
        const wasChecked = toggles.get(checkbox);
        if (wasChecked === undefined) return;
        checkbox.checked = wasChecked;
        updateGuestStatus(row);
      });
      preDeclineToggles = null;
    }
  };

  const setEventError = (select: HTMLSelectElement, hasError: boolean) => {
    select.classList.toggle('has-error', hasError);
    if (hasError) {
      select.setAttribute('aria-invalid', 'true');
    } else {
      select.removeAttribute('aria-invalid');
    }
    const errorEl = select.closest('.event-row')?.querySelector<HTMLElement>('.event-row-error');
    if (errorEl) errorEl.hidden = !hasError;
  };

  // querySelector returns the first match in document order, so the scroll
  // always lands on the highest error on the page.
  const scrollToFirstError = () => {
    form
      .querySelector('.event-select.has-error, select[name="accommodation"].has-error, .group-email-input.has-error')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const accommodationSelect = form.querySelector<HTMLSelectElement>('select[name="accommodation"]');
  const setAccommodationError = (hasError: boolean) => {
    if (!accommodationSelect) return;
    accommodationSelect.classList.toggle('has-error', hasError);
    if (hasError) {
      accommodationSelect.setAttribute('aria-invalid', 'true');
    } else {
      accommodationSelect.removeAttribute('aria-invalid');
    }
    const errorEl = form.querySelector<HTMLElement>('.accommodation-error');
    if (errorEl) errorEl.hidden = !hasError;
  };

  accommodationSelect?.addEventListener('change', () => setAccommodationError(false));

  eventSelects.forEach((select) =>
    select.addEventListener('change', () => {
      setEventError(select, false);
      updateSubmitLabel();
      syncTogglesToDecline();
    })
  );
  updateSubmitLabel();
  syncTogglesToDecline();

  const restoreSubmitButton = () => {
    if (!submitButton) return;
    submitButton.disabled = false;
    submitButton.classList.remove('is-loading');
    submitButton.removeAttribute('aria-busy');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add('is-loading');
      submitButton.setAttribute('aria-busy', 'true');
    }
    if (successMessage) successMessage.hidden = true;
    if (errorMessage) {
      errorMessage.hidden = true;
      errorMessage.textContent = defaultErrorMessage;
    }
    form.querySelectorAll('.group-email-input').forEach((el) => el.classList.remove('has-error'));
    form.querySelectorAll<HTMLElement>('.group-email-error').forEach((el) => { el.hidden = true; });
    eventSelects.forEach((select) => setEventError(select, false));
    setAccommodationError(false);

    // Every event needs an explicit Attending / Not attending choice, and
    // the accommodation question needs an active answer.
    const missingSelections = eventSelects.filter((select) => !select.value);
    const accommodationMissing = accommodationSelect && !accommodationSelect.value;
    if (missingSelections.length > 0 || accommodationMissing) {
      missingSelections.forEach((select) => setEventError(select, true));
      if (accommodationMissing) setAccommodationError(true);
      scrollToFirstError();
      restoreSubmitButton();
      return;
    }

    const anyAttending = Array.from(form.querySelectorAll<HTMLInputElement>('.guest-attending')).some((checkbox) => checkbox.checked);

    const guestsAttending = Array.from(form.querySelectorAll<HTMLElement>('[data-guest-row]')).map((row) => {
      const nameInput = row.querySelector<HTMLInputElement>('.guest-name');
      const checkbox = row.querySelector<HTMLInputElement>('.guest-attending');
      // An emptied name field falls back to the server-rendered value
      // (`defaultValue`), not a placeholder: the API requires a non-empty name,
      // and sending one would persist as a real rename — clearing the box would
      // silently overwrite that guest's Guest List row with "Guest".
      const typedName = nameInput?.value?.trim();
      return {
        guestId: row.dataset.guestId || undefined,
        name: typedName || nameInput?.defaultValue?.trim() || 'Guest',
        attending: checkbox?.checked === true,
      };
    });

    const attendingEventIds = eventSelects
      .filter((select) => select.value === 'yes')
      .map((select) => select.dataset.eventId)
      .filter(Boolean);

    // France collects this as `allergens` (EU labelling), NYC as `dietary`.
    // Only one exists per page; both map to the same Notion field.
    const allergensField = form.querySelector<HTMLTextAreaElement>('textarea[name="allergens"]');
    const dietaryField = form.querySelector<HTMLTextAreaElement>('textarea[name="dietary"]');
    const dietaryText = (allergensField ?? dietaryField)?.value?.trim();

    const sendConfirmationCheckbox = form.querySelector<HTMLInputElement>('input[name="sendConfirmation"]');
    const guestEmails = Array.from(form.querySelectorAll<HTMLInputElement>('[data-guest-email-id]')).map((input) => ({
      guestId: input.dataset.guestEmailId,
      name: input.dataset.guestEmailName || 'Guest',
      email: input.value?.trim() || undefined,
    }));

    const markEmailError = (guestId: string | undefined, message = 'Required') => {
      const input = form.querySelector(`[data-guest-email-id="${guestId}"]`);
      if (!input) return;
      input.classList.add('has-error');
      const errorEl = input.parentElement?.querySelector<HTMLElement>('.group-email-error');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }
    };

    if (guestEmails.every((guest) => !guest.email)) {
      guestEmails.forEach((guest) => markEmailError(guest.guestId));
      showError(confirmationEmailRequired);
      scrollToFirstError();
      restoreSubmitButton();
      return;
    }

    if (requireAllEmails) {
      const missing = guestEmails.find((guest) => !guest.email);
      if (missing) {
        markEmailError(missing.guestId);
        showError(confirmationEmailAllRequired);
        scrollToFirstError();
        restoreSubmitButton();
        return;
      }
    }

    const payload = {
      event: form.dataset.event,
      guestsAttending,
      guestEmails,
      eventsAttending: anyAttending ? attendingEventIds : [],
      dietary: dietaryText || undefined,
      message: form.querySelector<HTMLTextAreaElement>('textarea[name="message"]')?.value?.trim() || undefined,
      details: {
        ...(accommodationSelect ? { accommodation: accommodationSelect.value || undefined } : {}),
        ...(allergensField ? { allergens: dietaryText || undefined } : {}),
      },
      sendConfirmation: sendConfirmationCheckbox?.checked === true,
    };

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.fieldGuestId) markEmailError(data.fieldGuestId, 'Invalid email');
        throw new Error(data?.error || defaultErrorMessage);
      }

      window.location.href = `/${weddingEvent}/rsvp/confirmed`;
    } catch (error) {
      showError(error instanceof Error ? error.message : defaultErrorMessage);

      if (isLocalDev) {
        window.setTimeout(() => {
          window.location.href = `/${weddingEvent}/rsvp/confirmed?mock=dev`;
        }, 1600);
        return;
      }

      restoreSubmitButton();
    }
  });
}

/** Render `<time data-local-timestamp>` values in the visitor's locale. */
export function initTimestamps(): void {
  document.querySelectorAll('time[data-local-timestamp]').forEach((timeEl) => {
    const isoStr = timeEl.getAttribute('datetime');
    if (isoStr) {
      const date = new Date(isoStr);
      const lang = document.documentElement.lang || 'en';
      const formatted = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
      timeEl.textContent = formatted;
    }
  });
}
