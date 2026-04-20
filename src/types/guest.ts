export interface GuestRecord {
  id: string; // Notion page ID
  name: string; // Full Name (formula result)
  normalizedName: string; // lowercase, no accents, for auth matching
  eventInvitations: ('nyc' | 'france')[]; // which wedding(s)
  isPlusOne: boolean;
  relatedGuestIds: string[]; // Notion IDs of party members
  eventInvitedIds: string[]; // Notion IDs of Event Catalog pages this guest is invited to
  email?: string; // Guest email address (optional — may not be on file)
}
