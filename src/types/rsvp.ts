/**
 * RSVP submission payload from the frontend form
 */
export interface RSVPSubmission {
  event: 'nyc' | 'france';
  guestsAttending: {
    name: string;
    attending: boolean;
  }[];
  guestEmails?: RSVPGuestEmail[];
  eventsAttending: string[]; // Event IDs (for optional events)
  dietary?: string;
  message?: string;
  email?: string; // Capture email if not already on file
  sendConfirmation?: boolean;
  details?: RSVPDetails; // Event-specific fields
}

export interface RSVPGuestEmail {
  guestId: string;
  name: string;
  email?: string;
}

/**
 * Event-specific RSVP details stored as JSON
 */
export interface RSVPDetails {
  // France-specific
  accommodation?: 'yes' | 'no' | 'unsure';
  allergens?: string; // EU allergen requirements
  transport?: 'yes' | 'no' | 'unsure';
}

/**
 * RSVP response data from Notion (for pre-filling forms)
 */
export interface RSVPResponse {
  id: string; // Notion page ID
  guestId: string; // Guest List relation ID
  event: 'nyc' | 'france';
  submittedAt: string; // ISO datetime
  status: 'Attending' | 'Declined' | 'Partial';
  guestsAttending: string; // Comma-separated names
  dietary?: string;
  message?: string;
  details?: RSVPDetails;
  eventsAttending?: string[]; // Event IDs parsed from Details JSON
}
