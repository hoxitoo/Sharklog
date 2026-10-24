import ru from '../i18n/locales/ru.json';
import en from '../i18n/locales/en.json';
import kz from '../i18n/locales/kz.json';
import by from '../i18n/locales/by.json';

/*
 * The consent line above the buy button quotes the button: "By tapping «Pro
 * forever — 399 ₽» you accept the offer". What it quotes must be what the
 * button says, in every language — the line is what the buyer agreed to — and
 * the offer must be a link in it (`<1>…</1>`, split by the paywall).
 */
const LOCALES = { ru, en, kz, by } as const;

describe('checkout consent line', () => {
  for (const [lang, d] of Object.entries(LOCALES)) {
    it(`${lang}: quotes the button exactly and links the offer once`, () => {
      const consent = d.proGate.consent;
      expect(consent).toContain(d.proGate.lifetime);
      expect(consent.split(/<\/?1>/)).toHaveLength(3);
      expect(consent.match(/<1>/g)).toHaveLength(1);
    });
  }

  it('the RuStore subtitle and support line never say "subscription"', () => {
    // There is no subscription in the Robokassa build; these strings are its.
    const subscription = /подписк|subscri|жазылым|падпіск/i;
    for (const d of Object.values(LOCALES)) {
      expect(d.proGate.inProOnce).not.toMatch(subscription);
      expect(d.support.proSubOnce).not.toMatch(subscription);
    }
  });
});
