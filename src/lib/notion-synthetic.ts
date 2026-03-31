import type { GuestRecord } from '../types/guest';
import type { EventRecord } from '../types/event';
import type { RSVPDetails, RSVPResponse, RSVPSubmission } from '../types/rsvp';

export const SYNTHETIC_PRIMARY_GUEST_ID = '11111111-1111-4111-8111-111111111111';
const CHARLES_ID = '22222222-2222-4222-8222-222222222222';

const NYC_DAY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FRANCE_DAY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const NYC_WELCOME_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NYC_BRUNCH_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const FRANCE_CEREMONY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const FRANCE_BRUNCH_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cloneGuest(guest: GuestRecord): GuestRecord {
  return {
    ...guest,
    eventInvitations: [...guest.eventInvitations],
    relatedGuestIds: [...guest.relatedGuestIds],
  };
}

function cloneEvent(event: EventRecord): EventRecord {
  return { ...event };
}

function cloneRSVP(rsvp: RSVPResponse): RSVPResponse {
  return {
    ...rsvp,
    details: rsvp.details ? { ...rsvp.details } : undefined,
    eventsAttending: rsvp.eventsAttending ? [...rsvp.eventsAttending] : undefined,
  };
}

const baseGuests: GuestRecord[] = [
  {
    id: SYNTHETIC_PRIMARY_GUEST_ID,
    name: 'Sam Gross',
    normalizedName: normalizeName('Sam Gross'),
    eventInvitations: ['nyc', 'france'],
    isPlusOne: false,
    relatedGuestIds: [CHARLES_ID],
  },
  {
    id: CHARLES_ID,
    name: 'Charles Gross',
    normalizedName: normalizeName('Charles Gross'),
    eventInvitations: ['nyc', 'france'],
    isPlusOne: false,
    relatedGuestIds: [],
    email: 'charles@example.com',
  },
];

const baseEvents: EventRecord[] = [
  {
    id: NYC_WELCOME_ID,
    name: 'Welcome Drinks',
    type: 'Core',
    wedding: 'nyc',
    time: '6:00 PM',
    location: 'Brooklyn',
    description: 'Kick off the wedding weekend.',
    dayId: NYC_DAY_ID,
    showOnWebsite: true,
  },
  {
    id: NYC_BRUNCH_ID,
    name: 'Farewell Brunch',
    type: 'Optional',
    wedding: 'nyc',
    time: '11:00 AM',
    location: 'Williamsburg',
    description: 'Casual brunch the next morning.',
    dayId: NYC_DAY_ID,
    showOnWebsite: true,
  },
  {
    id: FRANCE_CEREMONY_ID,
    name: 'Ceremony & Dinner',
    type: 'Core',
    wedding: 'france',
    time: '4:00 PM',
    location: 'South of France',
    description: 'Ceremony followed by dinner.',
    dayId: FRANCE_DAY_ID,
    showOnWebsite: true,
  },
  {
    id: FRANCE_BRUNCH_ID,
    name: 'Sunday Brunch',
    type: 'Optional',
    wedding: 'france',
    time: '11:30 AM',
    location: 'Village Square',
    description: 'A relaxed brunch send-off.',
    dayId: FRANCE_DAY_ID,
    showOnWebsite: true,
  },
];

const guestEventIds = new Map<string, string[]>([
  [SYNTHETIC_PRIMARY_GUEST_ID, [NYC_WELCOME_ID, NYC_BRUNCH_ID, FRANCE_CEREMONY_ID, FRANCE_BRUNCH_ID]],
  [CHARLES_ID, [NYC_WELCOME_ID, FRANCE_CEREMONY_ID]],
]);

const dayDates = new Map<string, string>([
  [NYC_DAY_ID, '2026-10-11'],
  [FRANCE_DAY_ID, '2027-05-22'],
]);

let guests = baseGuests.map(cloneGuest);
let rsvps: RSVPResponse[] = [];
let syntheticResponseCounter = 0;

function buildRSVPResponse(guestId: string, submission: RSVPSubmission, id: string): RSVPResponse {
  const attendingNames = submission.guestsAttending
    .filter((guest) => guest.attending)
    .map((guest) => guest.name);

  let status: RSVPResponse['status'];
  if (attendingNames.length === 0) {
    status = 'Declined';
  } else if (attendingNames.length === submission.guestsAttending.length) {
    status = 'Attending';
  } else {
    status = 'Partial';
  }

  const details: RSVPDetails | undefined = submission.details
    ? { ...submission.details }
    : undefined;

  return {
    id,
    guestId,
    event: submission.event,
    submittedAt: new Date().toISOString(),
    status,
    guestsAttending: attendingNames.join(', '),
    dietary: submission.dietary,
    message: submission.message,
    details,
    eventsAttending: [...submission.eventsAttending],
  };
}

export function resetSyntheticNotionState(): void {
  guests = baseGuests.map(cloneGuest);
  rsvps = [];
  syntheticResponseCounter = 0;
}

export async function fetchAllGuests(): Promise<GuestRecord[]> {
  return guests.map(cloneGuest);
}

export async function updateGuestEmail(guestId: string, email: string): Promise<void> {
  guests = guests.map((guest) => (guest.id === guestId ? { ...guest, email } : guest));
}

export async function getEventCatalog(wedding: 'nyc' | 'france'): Promise<EventRecord[]> {
  return baseEvents.filter((event) => event.wedding === wedding).map(cloneEvent);
}

export async function getGuestEvents(guestId: string): Promise<EventRecord[]> {
  const invitedEventIds = guestEventIds.get(guestId) ?? [];
  return baseEvents
    .filter((event) => invitedEventIds.includes(event.id))
    .map(cloneEvent);
}

export async function getGuestParty(guestId: string): Promise<GuestRecord[]> {
  const primaryGuest = guests.find((guest) => guest.id === guestId);
  if (!primaryGuest) {
    throw new Error(`Guest not found: ${guestId}`);
  }

  const relatedGuests = primaryGuest.relatedGuestIds
    .map((relatedId) => guests.find((guest) => guest.id === relatedId))
    .filter((guest): guest is GuestRecord => Boolean(guest));

  return [primaryGuest, ...relatedGuests].map(cloneGuest);
}

export async function submitRSVP(guestId: string, submission: RSVPSubmission): Promise<string> {
  const existing = rsvps.find((rsvp) => rsvp.guestId === guestId && rsvp.event === submission.event);
  const responseId = existing?.id ?? `synthetic-rsvp-${++syntheticResponseCounter}`;
  const next = buildRSVPResponse(guestId, submission, responseId);

  rsvps = [
    ...rsvps.filter((rsvp) => rsvp.id !== responseId),
    next,
  ];

  return responseId;
}

export async function getLatestRSVP(
  guestId: string,
  event: 'nyc' | 'france'
): Promise<RSVPResponse | null> {
  const matching = rsvps
    .filter((rsvp) => rsvp.guestId === guestId && rsvp.event === event)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return matching[0] ? cloneRSVP(matching[0]) : null;
}

export async function deleteRSVP(guestId: string, event: 'nyc' | 'france'): Promise<boolean> {
  const beforeCount = rsvps.length;
  rsvps = rsvps.filter((rsvp) => !(rsvp.guestId === guestId && rsvp.event === event));
  return rsvps.length !== beforeCount;
}

export async function fetchDayDate(dayId: string): Promise<string | undefined> {
  return dayDates.get(dayId);
}
