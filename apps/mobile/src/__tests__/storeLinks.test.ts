import appJson from '../../app.json';
import easJson from '../../eas.json';
import { ANDROID_PACKAGE, distribution, storeReviewUrls, supportUrl } from '../utils/storeLinks';

describe('store links', () => {
  it('use the package the app is actually published under', () => {
    expect(ANDROID_PACKAGE).toBe(appJson.expo.android.package);
  });

  it('send a RuStore build to its RuStore page, not to Google Play where the app is not', () => {
    expect(storeReviewUrls('android', 'rustore')).toEqual([`https://apps.rustore.ru/app/${ANDROID_PACKAGE}`]);
  });

  it('open the Play Store app first in a store build, the web page as the fallback', () => {
    expect(storeReviewUrls('android', 'store')).toEqual([
      `market://details?id=${ANDROID_PACKAGE}`,
      `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
    ]);
  });

  it('send nowhere from an APK installed by hand: there is no store page to rate it on', () => {
    expect(storeReviewUrls('android', 'direct')).toBeNull();
  });

  it('send nowhere on iOS until there is an App Store id', () => {
    expect(storeReviewUrls('ios', 'store', '')).toBeNull();
    expect(storeReviewUrls('ios', 'store', '123')?.[0]).toBe('itms-apps://apps.apple.com/app/id123?action=write-review');
    // A development build is not from the App Store either.
    expect(storeReviewUrls('ios', 'direct', '123')).toBeNull();
  });

  it('read the distribution channel strictly; anything unknown is a hand-installed APK', () => {
    expect(distribution('rustore')).toBe('rustore');
    expect(distribution(' store ')).toBe('store');
    expect(distribution(undefined)).toBe('direct');
    expect(distribution('RuStore')).toBe('direct');
  });

  it('take the support contact from the environment only, and drop anything that is not an https link', () => {
    expect(supportUrl(undefined)).toBeNull();
    expect(supportUrl('  ')).toBeNull();
    expect(supportUrl('tg://resolve?domain=x')).toBeNull();
    expect(supportUrl(' https://t.me/example_bot ')).toBe('https://t.me/example_bot');
  });
});

describe('EAS build profiles', () => {
  const profiles = easJson.build as Record<string, { env?: Record<string, string> }>;

  it('name the distribution channel in every profile, so no build falls back to a guess', () => {
    for (const [name, p] of Object.entries(profiles)) {
      expect(`${name}: ${p.env?.['EXPO_PUBLIC_DISTRIBUTION'] ?? 'missing'}`).toMatch(/: (rustore|store|direct)$/);
    }
  });

  it('pair each store with the payment it allows', () => {
    // RuStore: Robokassa (RuStore Pay is closed to the self-employed).
    expect(profiles['rustore']?.env).toMatchObject({ EXPO_PUBLIC_DISTRIBUTION: 'rustore', EXPO_PUBLIC_BILLING: 'robokassa' });
    // Google Play: its own billing only — an outside payment there breaks Play's rules.
    expect(profiles['production']?.env).toMatchObject({ EXPO_PUBLIC_DISTRIBUTION: 'store', EXPO_PUBLIC_BILLING: 'revenuecat' });
  });

  it('never switch on owner Pro — set in a profile, it would give Pro to everyone who installs that build', () => {
    // The owner's own Pro comes from apps/mobile/.env.local (local builds) or an
    // EAS variable of the "preview" environment — never from eas.json, and never
    // the "production" environment, which the rustore profile also uses.
    for (const [name, p] of Object.entries(profiles)) {
      expect(`${name}: ${p.env?.['EXPO_PUBLIC_OWNER_PRO'] ?? 'unset'}`).toBe(`${name}: unset`);
    }
  });

  it('name the EAS environment of every profile, so the owner variable of "preview" never reaches a store build', () => {
    const env = (name: string) => (profiles[name] as { environment?: string } | undefined)?.environment;
    expect(env('preview')).toBe('preview');
    expect(env('development')).toBe('development');
    expect(env('rustore')).toBe('production');
  });
});
