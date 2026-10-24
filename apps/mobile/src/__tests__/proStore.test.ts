import { generateKeyPairSync, sign } from 'crypto';

/*
 * Pro in the store: the trial, a licence, the store's answer. The rules
 * themselves are `resolvePro` (license.test.ts); this is the wiring — that the
 * store asks them at the right moments and keeps what it should.
 */

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const pub = Buffer.from((publicKey.export({ format: 'jwk' }) as { x: string }).x, 'base64url').toString('base64');
// Read by services/billing at import — set before the store is required.
process.env['EXPO_PUBLIC_LICENSE_PUBKEY'] = pub;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useBetsStore, defaultSettings, ownsPro } = require('../store/betsStore') as typeof import('../store/betsStore');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

function licence(id = '4242', extra: object = {}): string {
  const seg = Buffer.from(JSON.stringify({ v: 1, id, plan: 'lifetime', iat: 1_760_000_000, ...extra }), 'ascii').toString('base64url');
  return `SL1.${seg}.${sign(null, Buffer.from(seg, 'ascii'), privateKey).toString('base64url')}`;
}

const settings = () => useBetsStore.getState().settings;

beforeEach(() => {
  useBetsStore.setState({ settings: { ...defaultSettings, onboardingComplete: true }, isLoaded: true });
});

describe('startTrial', () => {
  it('gives a new user seven days of Pro', () => {
    useBetsStore.getState().startTrial();
    expect(settings().isPro).toBe(true);
    const days = (new Date(settings().proExpiresAt!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
  });

  it('never twice — a second onboarding pass does not move the date', () => {
    useBetsStore.getState().startTrial();
    const first = settings().proExpiresAt;
    useBetsStore.setState({ settings: { ...settings(), isPro: false } });
    useBetsStore.getState().startTrial();
    expect(settings().proExpiresAt).toBe(first);
    expect(settings().isPro).toBe(false);
  });

  it('never over a licence', () => {
    useBetsStore.getState().applyLicense(licence());
    useBetsStore.getState().startTrial();
    expect(settings().proExpiresAt).toBeUndefined();
  });
});

describe('applyLicense', () => {
  it('takes the code out of the shared message, line breaks and all', () => {
    const code = licence();
    const pasted = `Код восстановления SharkLog Pro (никому не показывай): ${code.slice(0, 40)}\n${code.slice(40)}`;
    expect(useBetsStore.getState().applyLicense(pasted)).toBe(true);
    expect(settings().license).toBe(code);
  });

  it('drops the trial date once Pro is bought', () => {
    useBetsStore.getState().startTrial();
    useBetsStore.getState().applyLicense(licence());
    expect(settings().proExpiresAt).toBeUndefined();
  });

  it('keeps a licence that verifies and turns Pro on', () => {
    expect(useBetsStore.getState().applyLicense(`  ${licence()}  `)).toBe(true);
    expect(settings().isPro).toBe(true);
    expect(settings().license).toBe(licence());
  });

  it('changes nothing for a code that does not verify', () => {
    // A character in the middle of the signature: the LAST base64 character of
    // a 64-byte signature carries two unused bits, and changing only those
    // leaves the signature — and so the verdict — exactly as it was.
    const token = licence();
    const at = token.length - 20;
    const forged = token.slice(0, at) + (token[at] === 'A' ? 'B' : 'A') + token.slice(at + 1);
    expect(useBetsStore.getState().applyLicense(forged)).toBe(false);
    expect(useBetsStore.getState().applyLicense('hello')).toBe(false);
    expect(settings().isPro).toBe(false);
    expect(settings().license).toBeUndefined();
  });
});

describe('refreshPro', () => {
  it('ends a trial that ran out', () => {
    useBetsStore.setState({ settings: { ...settings(), isPro: true, proExpiresAt: new Date(Date.now() - 1000).toISOString() } });
    useBetsStore.getState().refreshPro(null);
    expect(settings().isPro).toBe(false);
  });

  it('does not let the store\'s "no" end a licence', () => {
    useBetsStore.getState().applyLicense(licence());
    useBetsStore.getState().refreshPro(false);
    expect(settings().isPro).toBe(true);
  });

  it('drops the trial date once the store grants Pro, so offline launches keep it (Google Play build)', () => {
    const { useBetsStore: play, defaultSettings: defaults } = isolatedStore({ EXPO_PUBLIC_BILLING: 'revenuecat' }).store;
    play.setState({ settings: { ...defaults, onboardingComplete: true, isPro: true, proExpiresAt: new Date(Date.now() + 86_400_000).toISOString() } });
    play.getState().refreshPro(true);
    expect(play.getState().settings.proExpiresAt).toBeUndefined();
    play.getState().refreshPro(null);
    expect(play.getState().settings.isPro).toBe(true);
  });
});

/** The store as another build sees it: env read at import, so a fresh module registry. */
function isolatedStore(env: Record<string, string>) {
  let store!: typeof import('../store/betsStore');
  let storage!: { setItem: (k: string, v: string) => Promise<void> };
  jest.isolateModules(() => {
    Object.assign(process.env, env);
    store = require('../store/betsStore');
    storage = require('@react-native-async-storage/async-storage').default;
  });
  for (const k of Object.keys(env)) delete process.env[k];
  return { store, storage };
}

describe('load', () => {
  async function loadWith(saved: object) {
    await AsyncStorage.setItem('@sharklog/data', JSON.stringify({
      bets: [], diary: [], teams: [], version: 3,
      settings: { ...defaultSettings, onboardingComplete: true, ...saved },
    }));
    await useBetsStore.getState().load();
    return settings();
  }

  it('trusts a stored licence — it was verified on the way in', async () => {
    expect((await loadWith({ isPro: false, license: licence() })).isPro).toBe(true);
    // Not licence-shaped at all: no Pro from it.
    expect((await loadWith({ isPro: true, license: 'hello', proExpiresAt: new Date(0).toISOString() })).isPro).toBe(false);
  });

  it('does not keep a bare Pro flag in the Robokassa build — that was the old APK\'s seven taps', async () => {
    expect((await loadWith({ isPro: true })).isPro).toBe(false);
  });

  it('a trial dated past what a trial can be is not Pro', async () => {
    expect((await loadWith({ isPro: true, proExpiresAt: '2036-01-01T00:00:00.000Z' })).isPro).toBe(false);
  });

  it('drops a revoked licence it still holds', async () => {
    const s = await loadWith({ isPro: true, license: licence('77'), revokedLicenses: ['77'] });
    expect(s.isPro).toBe(false);
    expect(s.license).toBeUndefined();
  });
});

describe('revokeLicense', () => {
  it('takes Pro away and refuses the same code afterwards, offline too', () => {
    const code = licence('91');
    useBetsStore.getState().applyLicense(code);
    useBetsStore.getState().revokeLicense('91');
    expect(settings().isPro).toBe(false);
    expect(settings().license).toBeUndefined();
    expect(useBetsStore.getState().applyLicense(code)).toBe(false);
    // Another purchase is untouched.
    expect(useBetsStore.getState().applyLicense(licence('92'))).toBe(true);
  });

  it('leaves the stored licence alone when another invoice is revoked', () => {
    useBetsStore.getState().applyLicense(licence('93'));
    useBetsStore.getState().revokeLicense('94');
    expect(settings().isPro).toBe(true);
    expect(settings().revokedLicenses).toEqual(['94']);
  });
});

describe('test-mode licences', () => {
  it('a hand-installed build (testers, the owner) takes them', () => {
    expect(useBetsStore.getState().applyLicense(licence('5', { test: true }))).toBe(true);
  });

  it('they run out on a phone that keeps one: expiry is checked at every launch, not only on entry', async () => {
    const lapsed = licence('9', { test: true, exp: Math.floor(Date.now() / 1000) - 60 });
    await AsyncStorage.setItem('@sharklog/data', JSON.stringify({
      bets: [], diary: [], teams: [], version: 3,
      settings: { ...defaultSettings, onboardingComplete: true, isPro: true, license: lapsed },
    }));
    await useBetsStore.getState().load();
    expect(settings().isPro).toBe(false);
    expect(settings().license).toBeUndefined();
  });

  it('a RuStore build refuses them, and drops one left by a test build installed underneath', async () => {
    const { store, storage } = isolatedStore({ EXPO_PUBLIC_DISTRIBUTION: 'rustore' });
    const { useBetsStore: rustore, defaultSettings: defaults } = store;

    await storage.setItem('@sharklog/data', JSON.stringify({
      bets: [], diary: [], teams: [], version: 3,
      settings: { ...defaults, onboardingComplete: true, isPro: true, license: licence('8', { test: true }) },
    }));
    await rustore.getState().load();
    expect(rustore.getState().settings.isPro).toBe(false);
    expect(rustore.getState().settings.license).toBeUndefined();

    expect(rustore.getState().applyLicense(licence('6', { test: true }))).toBe(false);
    expect(rustore.getState().applyLicense(licence('7'))).toBe(true);
  });
});

describe('ownsPro', () => {
  it('a trial is Pro but not owned — the offer must still be shown', () => {
    expect(ownsPro({ isPro: true, proExpiresAt: new Date(Date.now() + 1000).toISOString() })).toBe(false);
  });
  it('a licence, or Pro with no trial behind it, is owned', () => {
    expect(ownsPro({ isPro: true, license: licence() })).toBe(true);
    expect(ownsPro({ isPro: true })).toBe(true);
    expect(ownsPro({ isPro: false })).toBe(false);
  });
});
