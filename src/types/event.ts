export interface EventRecord {
  id: string; // Notion page ID
  name: string; // Event title
  type: 'Core' | 'Optional';
  wedding: 'nyc' | 'france';
  time?: string;
  date?: string; // YYYY-MM-DD
  location?: string;
  description?: string;
  dayId?: string; // Wedding Timeline page ID (optional)
  showOnWebsite: boolean;
}
