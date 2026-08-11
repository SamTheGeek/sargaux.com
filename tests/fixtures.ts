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

// The other half of TEST_GUEST_NAME's party. Named here because the RSVP
// name-write-back test renames this record and restores it: restoring to a
// constant (rather than to whatever was read at the start) means a run that
// dies mid-test self-heals on the next one.
export const TEST_GUEST_PARTNER_NAME = 'Jordan Chen';

// `Also Known As` values on the two synthetic records above, exercising both
// halves of that property against real Notion: a single-token line is a given
// name only, a multi-token line also contributes its last token as a surname
// to the whole household. Set on the Notion rows; nothing derives them.
export const TEST_GUEST_AKA_GIVEN_NAME = 'Lex'; // on Alex Rivera
export const TEST_GUEST_AKA_SURNAME = 'Delacroix'; // via "Jordan Delacroix"

// The full `Also Known As` contents of those two records, as the mutating suite
// must force them back to. A rename now appends the former name to this
// property (preserveFormerName in src/lib/guest-name.ts), so renaming a bot and
// back leaves two extra alias lines behind — it needs the same restore-to-a-
// constant treatment the names get, or every run grows the list.
export const TEST_GUEST_AKA = 'Lex';
export const TEST_GUEST_PARTNER_AKA = 'Jordan Delacroix';

// Country=FRANCE counterpart to TEST_GUEST_NAME, for the locale-defaulting
// tests. Also a 🤖-marked synthetic Notion record (created 2026-08-01), and an
// invented FRANCE entry in the hardcoded fallback list in src/lib/auth.ts.
// Never point these tests at a real guest: their Country is real data that can
// change, and a real guest's name must never appear in this public repo.
export const TEST_GUEST_FRANCE_NAME = 'Riley Dubois';
