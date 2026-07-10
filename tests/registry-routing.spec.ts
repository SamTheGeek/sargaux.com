import { test, expect } from '@playwright/test';
import {
  getRegistryDestination,
  getRegistryLink,
  FRENCH_REGISTRY_URL,
} from '../src/lib/registry-routing';

test.describe('Registry Destination Routing', () => {
  test('French-side countries go to MilleMercis', () => {
    expect(getRegistryDestination('FRANCE')).toBe('millemercis');
    expect(getRegistryDestination('UNITED KINGDOM')).toBe('millemercis');
  });

  test('US-side countries go to Joy', () => {
    expect(getRegistryDestination('USA')).toBe('joy');
    expect(getRegistryDestination('CANADA')).toBe('joy');
  });

  test('missing or unknown countries default to Joy', () => {
    expect(getRegistryDestination(null)).toBe('joy');
    expect(getRegistryDestination(undefined)).toBe('joy');
    expect(getRegistryDestination('')).toBe('joy');
    expect(getRegistryDestination('GERMANY')).toBe('joy');
  });

  test('country matching is exact — Notion select values are uppercase', () => {
    expect(getRegistryDestination('France')).toBe('joy');
    expect(getRegistryDestination('france')).toBe('joy');
  });

  test('registry link resolves to the native page for US-side guests', () => {
    expect(getRegistryLink('USA')).toEqual({ href: '/registry', external: false });
    expect(getRegistryLink(null)).toEqual({ href: '/registry', external: false });
  });

  test('registry link resolves to the external MilleMercis URL for French-side guests', () => {
    expect(getRegistryLink('FRANCE')).toEqual({ href: FRENCH_REGISTRY_URL, external: true });
    expect(getRegistryLink('UNITED KINGDOM')).toEqual({ href: FRENCH_REGISTRY_URL, external: true });
  });

  test('the French registry URL is the couple MilleMercis list over HTTPS', () => {
    expect(FRENCH_REGISTRY_URL).toBe('https://www.millemercismariage.com/sargaux/liste.html');
  });
});
