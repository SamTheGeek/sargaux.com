import type { EventRecord, RSVPResponse } from '../types';

export function getAttendingNames(rsvp: RSVPResponse | null): Set<string> {
  return new Set(
    (rsvp?.guestsAttending ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
  );
}

export function redactEmail(email?: string): string | undefined {
  if (!email) return undefined;

  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return undefined;

  return `${localPart[0]}***@${domain}`;
}

export function getDisplayEventTime(event: EventRecord, nycTimeRange?: string): string | undefined {
  if (event.wedding === 'nyc' && nycTimeRange) {
    return nycTimeRange;
  }

  return event.time;
}

export function formatSubmittedAt(dateString: string, locale: string): string {
  const date = new Date(dateString);

  if (locale === 'fr') {
    const datePart = new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
    const timePart = new Intl.DateTimeFormat('fr-FR', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
    return `${datePart} à ${timePart}`;
  }

  const datePart = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date).replace(' AM', 'AM').replace(' PM', 'PM');

  return `${datePart} at ${timePart}`;
}
