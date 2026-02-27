import type { Lang } from '../content/strings';

export function createTranslator(lang: Lang = 'en') {
  return function t(str: { en: string; fr: string }): string {
    return str[lang] ?? str.en;
  };
}
