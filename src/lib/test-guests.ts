import type { GuestRecord } from '../types';
import { normalize } from './normalize';

/**
 * Synthetic Notion Guest List party used by Playwright, CI, and
 * LOCAL_TESTING_USERNAME. Keep in sync with tests/fixtures.ts and
 * scripts/lib/test-guests.mjs.
 */
export const TEST_GUEST_DISPLAY_NAMES = ['Alex Rivera', 'Jordan Chen'] as const;

export const TEST_GUEST_NORMALIZED_NAMES = new Set(
  TEST_GUEST_DISPLAY_NAMES.map((name) => normalize(name))
);

/** Notion Guest List checkbox — durable marker on synthetic records. */
export function isTestGuestFromNotionProps(
  props: Record<string, { checkbox?: boolean } | unknown>
): boolean {
  const field = props['Test Guest'];
  if (field && typeof field === 'object' && field !== null && 'checkbox' in field) {
    return (field as { checkbox?: boolean }).checkbox === true;
  }
  return false;
}

export function isTestGuest(
  guest:
    | Pick<GuestRecord, 'normalizedName' | 'isTestGuest'>
    | { name: string; normalizedName?: string }
): boolean {
  if ('isTestGuest' in guest && guest.isTestGuest) return true;
  const normalized =
    'normalizedName' in guest && guest.normalizedName
      ? guest.normalizedName
      : normalize(guest.name);
  return TEST_GUEST_NORMALIZED_NAMES.has(normalized);
}

export function excludeTestGuests<T extends Parameters<typeof isTestGuest>[0]>(guests: T[]): T[] {
  return guests.filter((guest) => !isTestGuest(guest));
}
