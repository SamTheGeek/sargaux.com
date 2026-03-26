import type { EventInvitation } from './auth';

const DEFAULT_EVENT_SWITCH_DATE = '2026-10-15';
const ROUTING_TIME_ZONE = 'America/New_York';

function getDateInRoutingTimeZone(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ROUTING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function getPrimaryEventRoute(
  eventInvitations: EventInvitation[],
  now = new Date()
): '/nyc' | '/france' {
  const invitedToNyc = eventInvitations.includes('nyc');
  const invitedToFrance = eventInvitations.includes('france');

  if (invitedToNyc && invitedToFrance) {
    return getDateInRoutingTimeZone(now) < DEFAULT_EVENT_SWITCH_DATE ? '/nyc' : '/france';
  }

  if (invitedToNyc) {
    return '/nyc';
  }

  return '/france';
}

