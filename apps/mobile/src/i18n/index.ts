import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { installPluralRules } from './pluralRules';

import ru from './locales/ru.json';
import en from './locales/en.json';
import kz from './locales/kz.json';
import by from './locales/by.json';

// Before init: i18next builds its plural resolver from Intl.PluralRules, and
// without one it silently degrades every language to "1 → one, else other".
installPluralRules();

/**
 * `code` is what the app stores in settings — and it is a COUNTRY code for two
 * of these (kz, by), kept because it is already persisted on devices.
 * `i18n` is the language code i18next is actually given (ISO 639-1: kk, be).
 *
 * The difference is not cosmetic. Plural rules are looked up by language, and
 * `by` is not one: `Intl.PluralRules('by')` resolves to English, so Belarusian
 * got two plural forms instead of four, and "21 стаўка" / "5 ставак" came out
 * as one and the same string.
 */
export const LANGUAGES = [
  { code: 'ru', i18n: 'ru', label: 'Русский', short: 'RU', flag: '🇷🇺' },
  { code: 'en', i18n: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { code: 'kz', i18n: 'kk', label: 'Қазақша', short: 'KZ', flag: '🇰🇿' },
  { code: 'by', i18n: 'be', label: 'Беларуская', short: 'BY', flag: '🇧🇾' },
] as const;

export type LangCode = typeof LANGUAGES[number]['code'];

/** App code → the code i18next must be given. */
export function toI18nCode(code: LangCode): string {
  return LANGUAGES.find((l) => l.code === code)?.i18n ?? 'ru';
}

function detectDeviceLanguage(): LangCode {
  const locales = getLocales();
  const tag = locales[0]?.languageTag ?? '';
  if (tag.startsWith('kk')) return 'kz';
  if (tag.startsWith('be')) return 'by';
  if (tag.startsWith('en')) return 'en';
  return 'ru';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      kk: { translation: kz },
      be: { translation: by },
    },
    lng: 'ru',
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

/** BCP 47 tag for dates in the current language. */
const DATE_LOCALES: Record<string, string> = { ru: 'ru-RU', en: 'en-US', kk: 'kk-KZ', be: 'be-BY' };

/**
 * The locale for `toLocaleDateString`. Screens used to pick it with
 * `language === 'en' ? 'en-US' : 'ru-RU'`, so a Kazakh or Belarusian screen
 * still printed Russian month names. An engine without data for a tag falls
 * back to its default — no worse than the hardcoded Russian it replaces.
 */
export function dateLocale(): string {
  return DATE_LOCALES[i18n.language] ?? 'ru-RU';
}

/** The only way the app should switch language — it owns the code mapping. */
export function applyLanguage(lang: LangCode | undefined) {
  i18n.changeLanguage(toI18nCode(lang ?? detectDeviceLanguage()));
}

export default i18n;
