export interface GuestRecord {
  id: string; // Notion page ID
  name: string; // Full Name (formula result)
  normalizedName: string; // lowercase, no accents, for auth matching
  eventInvitations: ('nyc' | 'france')[]; // which wedding(s)
  country?: string | null; // Country select (e.g. 'USA', 'FRANCE') — drives registry destination; always set by parseGuestPage, optional for mocks
  isPlusOne: boolean;
  relatedGuestIds: string[]; // Notion IDs of party members
  email?: string; // Guest email address (optional — may not be on file)
}
