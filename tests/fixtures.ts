import type { GuestRecord, EventRecord, RSVPSubmission } from '../src/types';

export const mockGuest: GuestRecord = {
  id: 'notion-1',
  name: 'Alex Rivera',
  normalizedName: 'alex rivera',
  eventInvitations: ['nyc', 'france'],
  isPlusOne: false,
  relatedGuestIds: ['notion-2'],
  email: 'alex@example.com',
};

export const mockCompanionGuest: GuestRecord = {
  id: 'notion-2',
  name: 'Jordan Chen',
  normalizedName: 'jordan chen',
  eventInvitations: ['nyc', 'france'],
  isPlusOne: false,
  relatedGuestIds: ['notion-1'],
};

export const mockNycGuest: GuestRecord = {
  id: 'notion-3',
  name: 'Casey Morgan',
  normalizedName: 'casey morgan',
  eventInvitations: ['nyc'],
  isPlusOne: false,
  relatedGuestIds: [],
};

export const mockFranceGuest: GuestRecord = {
  id: 'notion-4',
  name: 'Riley Dubois',
  normalizedName: 'riley dubois',
  eventInvitations: ['france'],
  isPlusOne: false,
  relatedGuestIds: [],
};

export const mockNycEvents: EventRecord[] = [
  {
    id: 'event-nyc-1',
    name: 'Dinner',
    type: 'Core',
    wedding: 'nyc',
    time: '7:00 PM',
    location: 'New York, NY',
    showOnWebsite: true,
  },
  {
    id: 'event-nyc-2',
    name: 'Dancing',
    type: 'Optional',
    wedding: 'nyc',
    time: '9:00 PM',
    location: 'New York, NY',
    showOnWebsite: true,
  },
];

export const mockFranceEvents: EventRecord[] = [
  {
    id: 'event-france-1',
    name: 'Cérémonie',
    type: 'Core',
    wedding: 'france',
    time: '4:00 PM',
    location: 'Village De Sully',
    showOnWebsite: true,
  },
  {
    id: 'event-france-2',
    name: 'Dîner',
    type: 'Core',
    wedding: 'france',
    time: '7:00 PM',
    location: 'Village De Sully',
    showOnWebsite: true,
  },
];

export function mockRSVPSubmission(event: 'nyc' | 'france'): RSVPSubmission {
  const guests = event === 'nyc'
    ? [mockGuest, mockCompanionGuest]
    : [mockGuest, mockCompanionGuest];

  return {
    event,
    guestsAttending: guests.map((g) => ({ name: g.name, attending: true })),
    eventsAttending: event === 'nyc'
      ? [mockNycEvents[0].id, mockNycEvents[1].id]
      : [mockFranceEvents[0].id, mockFranceEvents[1].id],
    dietary: 'No restrictions',
    sendConfirmation: false,
    details: event === 'france' ? { accommodation: 'yes' } : {},
  };
}

// Dedicated synthetic test guest that exists BOTH in the Notion Guest List
// (party of two with Jordan Chen, invited to NYC + France, Country USA;
// created 2026-07-11) AND in the hardcoded dev fallback list in
// src/lib/auth.ts, so login works in every backend mode. Notion-backed RSVP
// tests write and delete real rows for this party — it exists precisely so
// those tests never touch the couple's or any real guest's records. Matches
// the Notion "Full Name" formula (First Name + Last Name).
export const TEST_GUEST_NAME = 'Alex Rivera';
