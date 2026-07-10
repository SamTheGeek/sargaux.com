/**
 * Event localization.
 *
 * Event Catalog rows carry optional French display variants ("* FR"
 * properties in Notion). `localizeEvent` resolves the display fields for a
 * language, falling back to the English field whenever the French one is
 * unset — a partially translated event is always safe to render.
 *
 * Only display text is localized. Timing (startTime/duration/date) is
 * language-neutral and always read from the canonical English fields.
 */

import type { EventRecord } from '../types';
import type { Lang } from '../content/strings';

export interface LocalizedEventFields {
  name: string;
  time?: string;
  location?: string;
  description?: string;
}

export function localizeEvent(event: EventRecord, lang: Lang): LocalizedEventFields {
  if (lang !== 'fr') {
    return {
      name: event.name,
      time: event.time,
      location: event.location,
      description: event.description,
    };
  }
  return {
    name: event.nameFr || event.name,
    time: event.timeFr || event.time,
    location: event.locationFr || event.location,
    description: event.descriptionFr || event.description,
  };
}
