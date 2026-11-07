/*
 * Only Russian (the fallback) is built at startup; another language's
 * dictionary is loaded the first time it is switched to — synchronously, so
 * App.tsx can apply the language before it schedules any notification text.
 */
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

describe('translations', () => {
  it('start with Russian only, and load a language on its first switch', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../i18n') as typeof import('../i18n');
      const i18n = mod.default;
      expect(i18n.hasResourceBundle('ru', 'translation')).toBe(true);
      for (const code of ['en', 'kk', 'be']) expect([code, i18n.hasResourceBundle(code, 'translation')]).toEqual([code, false]);
      mod.applyLanguage('kz');
      // Synchronous: the very next line already reads Kazakh.
      expect(i18n.language).toBe('kk');
      expect(i18n.t('common.close')).toBe(require('../i18n/locales/kz.json').common.close);
      expect(i18n.hasResourceBundle('en', 'translation')).toBe(false);
      mod.applyLanguage('en');
      expect(i18n.t('common.close')).toBe('Close');
      mod.applyLanguage('ru');
      expect(i18n.t('common.close')).toBe('Закрыть');
    });
  });
});
