export interface GuestRecord {
  id: string; // Notion page ID
  name: string; // Full Name (formula result)
  normalizedName: string; // lowercase, no accents, for auth matching
  eventInvitations: ('nyc' | 'france')[]; // which wedding(s)
  isPlusOne: boolean;
  relatedGuestIds: string[]; // Notion IDs of party members
}
