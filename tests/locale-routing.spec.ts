import { test, expect } from '@playwright/test';
import { getDefaultLocale, detectLocaleFromAcceptLanguage } from '../src/lib/locale-routing';

test.describe('Default Locale Routing', () => {
  test('France and Canada default to French', () => {
    expect(getDefaultLocale('FRANCE')).toBe('fr');
    expect(getDefaultLocale('CANADA')).toBe('fr');
  });

  test('other countries default to English', () => {
    expect(getDefaultLocale('USA')).toBe('en');
    expect(getDefaultLocale('UNITED KINGDOM')).toBe('en');
    expect(getDefaultLocale('GERMANY')).toBe('en');
  });

  test('missing or unknown countries default to English', () => {
    expect(getDefaultLocale(null)).toBe('en');
    expect(getDefaultLocale(undefined)).toBe('en');
    expect(getDefaultLocale('')).toBe('en');
  });

  test('country matching is exact — Notion select values are uppercase', () => {
    expect(getDefaultLocale('France')).toBe('en');
    expect(getDefaultLocale('france')).toBe('en');
  });
});

test.describe('Accept-Language detection', () => {
  const detect = detectLocaleFromAcceptLanguage;

  test('French-first headers resolve to French', () => {
    expect(detect('fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7')).toBe('fr');
    expect(detect('fr')).toBe('fr');
    expect(detect('fr-CA')).toBe('fr'); // regional variants count as French
    expect(detect('fr-CH,de;q=0.8')).toBe('fr');
  });

  test('English-first headers stay English', () => {
    expect(detect('en-US,en;q=0.9,fr;q=0.8')).toBe('en');
    expect(detect('en-GB')).toBe('en');
  });

  test('quality values decide, not header order', () => {
    expect(detect('en;q=0.5,fr;q=0.9')).toBe('fr');
    expect(detect('fr;q=0.5,en;q=0.9')).toBe('en');
  });

  test('an equal tie stays English', () => {
    // Ties are not evidence of a French preference — do not flip the default.
    expect(detect('en,fr')).toBe('en');
    expect(detect('fr;q=0.8,en;q=0.8')).toBe('en');
  });

  test('q=0 means "not acceptable" and cannot win', () => {
    expect(detect('fr;q=0')).toBe('en');
    expect(detect('fr;q=0,en;q=0')).toBe('en');
  });

  test('unrelated and wildcard languages fall back to English', () => {
    expect(detect('de-DE,de;q=0.9')).toBe('en');
    expect(detect('*')).toBe('en');
    expect(detect('ja,ko;q=0.9')).toBe('en');
  });

  test('a missing or malformed header falls back to English', () => {
    expect(detect(null)).toBe('en');
    expect(detect(undefined)).toBe('en');
    expect(detect('')).toBe('en');
    expect(detect(';;;')).toBe('en');
    // A malformed q must not disqualify an otherwise valid tag
    expect(detect('fr;q=banana')).toBe('fr');
  });

  test('casing and whitespace are tolerated', () => {
    expect(detect('FR-fr, EN;q=0.5')).toBe('fr');
    expect(detect('  fr-FR ,  en ; q=0.5 ')).toBe('fr');
  });
});
