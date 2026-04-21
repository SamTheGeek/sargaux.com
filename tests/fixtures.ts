import type { GuestRecord, EventRecord, RSVPSubmission } from '../src/types';

export const mockGuest: GuestRecord = {
  id: 'notion-1',
  name: 'Sam Gross',
  normalizedName: 'sam gross',
  eventInvitations: ['nyc', 'france'],
  isPlusOne: false,
  relatedGuestIds: ['notion-2'],
  eventInvitedIds: [],
  email: 'sam@example.com',
};

export const mockCompanionGuest: GuestRecord = {
  id: 'notion-2',
  name: 'Margaux Ancel',
  normalizedName: 'margaux ancel',
  eventInvitations: ['nyc', 'france'],
  isPlusOne: false,
  relatedGuestIds: ['notion-1'],
  eventInvitedIds: [],
};

export const mockNycGuest: GuestRecord = {
  id: 'notion-3',
  name: 'Charles Gross',
  normalizedName: 'charles gross',
  eventInvitations: ['nyc'],
  isPlusOne: false,
  relatedGuestIds: [],
  eventInvitedIds: [],
};

export const mockFranceGuest: GuestRecord = {
  id: 'notion-4',
  name: 'Dorothée Ancel',
  normalizedName: 'dorothee ancel',
  eventInvitations: ['france'],
  isPlusOne: false,
  relatedGuestIds: [],
  eventInvitedIds: [],
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

export const TEST_GUEST_NAME = 'Sam Gross';
