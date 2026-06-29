import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ru from './locales/ru.json';
import en from './locales/en.json';
import kz from './locales/kz.json';
import by from './locales/by.json';

export const LANGUAGES = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'kz', label: 'Қазақша', flag: '🇰🇿' },
  { code: 'by', label: 'Беларуская', flag: '🇧🇾' },
] as const;

export type LangCode = typeof LANGUAGES[number]['code'];

/** Map an app language code to a BCP-47 locale for Intl date/number formatting. */
export function dateLocale(lang: string): string {
  return ({ ru: 'ru-RU', en: 'en-US', kz: 'kk-KZ', by: 'be-BY' } as Record<string, string>)[lang] ?? 'ru-RU';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ru: { translation: ru }, en: { translation: en }, kz: { translation: kz }, by: { translation: by } },
    lng: 'ru',
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'sharklog-lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
