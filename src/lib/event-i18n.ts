/**
 * Event localization.
 *
 * Event Catalog rows carry optional French variants ("* FR" properties in
 * Notion). `localizeEvent` resolves the display fields for a language,
 * falling back to the English field whenever the French one is unset —
 * a partially translated event is always safe to render.
 */

import type { EventRecord } from '../types';
import type { Lang } from '../content/strings';

export interface LocalizedEventFields {
  name: string;
  time?: string;
  startTime?: string;
  duration?: string;
  location?: string;
  description?: string;
}

export function localizeEvent(event: EventRecord, lang: Lang): LocalizedEventFields {
  if (lang !== 'fr') {
    return {
      name: event.name,
      time: event.time,
      startTime: event.startTime,
      duration: event.duration,
      location: event.location,
      description: event.description,
    };
  }
  return {
    name: event.nameFr || event.name,
    time: event.timeFr || event.time,
    startTime: event.startTimeFr || event.startTime,
    duration: event.durationFr || event.duration,
    location: event.locationFr || event.location,
    description: event.descriptionFr || event.description,
  };
}
