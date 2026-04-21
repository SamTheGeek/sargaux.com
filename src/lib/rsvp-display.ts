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

export function getDisplayEventTime(event: EventRecord): string | undefined {
  return event.time;
}

export function formatEventDate(dateStr: string | undefined, lang: string): string | undefined {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function parseTimeMinutes(time?: string): number {
  if (!time) return 0;
  const match = time.match(/(\d+)(?::(\d+))?\s*(AM|PM)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] ?? '0');
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function sortEventsByDateTime(events: EventRecord[]): EventRecord[] {
  return [...events].sort((a, b) => {
    const dateA = a.date ?? '';
    const dateB = b.date ?? '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return parseTimeMinutes(a.time) - parseTimeMinutes(b.time);
  });
}
