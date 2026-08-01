export interface GuestRecord {
  id: string; // Notion page ID
  name: string; // Full Name (formula result)
  normalizedName: string; // lowercase, no accents, for auth matching
  eventInvitations: ('nyc' | 'france')[]; // which wedding(s)
  country?: string | null; // Country select (e.g. 'USA', 'FRANCE') — drives registry destination; always set by parseGuestPage, optional for mocks
  isPlusOne: boolean;
  relatedGuestIds: string[]; // Notion IDs of party members
  email?: string; // Guest email address (optional — may not be on file)
  // Name parts and household envelope strings, used by envelope-name login
  // (src/lib/envelope-name.ts). Undefined for mocks and for pre-v2 cache blobs.
  firstName?: string; // 'First Name' text property
  lastName?: string; // 'Last Name' text property
  envelopeNames?: string[]; // 'Envelope Names' text property, split on newlines
  // 'Name of Guest' title — the name actually printed on the invitation, which
  // is what a guest types at login. It is NOT the same as `name`: that is the
  // `Full Name` formula (First Name + Last Name), and the two disagree for
  // nickname/legal-name pairs and for records with a bad name part. Used as a
  // login fallback so one wrong name cell can't lock a guest out entirely.
  invitationTitle?: string;
  isTestGuest?: boolean; // Synthetic record — excluded from counts and outbound email
  // Per-event physical-mail status (Notion status props). Read so RSVP write-back
  // can advance them to 'Received' without an extra fetch. Undefined for mocks.
  nycInviteStatus?: string | null; // 'NYC Invite Sent' status option name
  franceSaveTheDateStatus?: string | null; // 'France Save the Date Sent' status option name
}
