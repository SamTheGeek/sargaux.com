export interface EventRecord {
  id: string; // Notion page ID
  name: string; // Event title
  type: 'Core' | 'Optional';
  wedding: 'nyc' | 'france';
  time?: string; // Display-only time string (e.g. "6:00 PM")
  startTime?: string; // ICS start time (e.g. "7:00 PM") — authoritative for calendar
  duration?: string; // ICS duration (e.g. "3h", "2h30m", "90m")
  date?: string; // YYYY-MM-DD
  location?: string;
  description?: string;
  dayId?: string; // Wedding Timeline page ID (optional)
  showOnWebsite: boolean;
}
