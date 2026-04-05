import type { RSVPResponse } from '../types/rsvp';

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
