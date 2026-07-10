import { test, expect } from '@playwright/test';
import { getDefaultLocale } from '../src/lib/locale-routing';

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
