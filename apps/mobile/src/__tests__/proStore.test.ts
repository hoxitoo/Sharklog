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

function licence(id = '4242'): string {
  const seg = Buffer.from(JSON.stringify({ v: 1, id, plan: 'lifetime', iat: 1_760_000_000 }), 'ascii').toString('base64url');
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

  it('drops the trial date once the store grants Pro, so offline launches keep it', () => {
    useBetsStore.setState({ settings: { ...settings(), isPro: true, proExpiresAt: new Date(Date.now() + 86_400_000).toISOString() } });
    useBetsStore.getState().refreshPro(true);
    expect(settings().proExpiresAt).toBeUndefined();
    useBetsStore.getState().refreshPro(null);
    expect(settings().isPro).toBe(true);
  });
});

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

  it('keeps Pro from an older build that left no trace of where it came from', async () => {
    expect((await loadWith({ isPro: true })).isPro).toBe(true);
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
