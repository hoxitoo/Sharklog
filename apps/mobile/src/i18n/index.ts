import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

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
    resources: { ru: { translation: ru }, en: { translation: en }, kz: { translation: kz }, by: { translation: by } },
    lng: 'ru',
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export function applyLanguage(lang: LangCode | undefined) {
  i18n.changeLanguage(lang ?? detectDeviceLanguage());
}

export default i18n;
