import { generateKeyPairSync, sign, type KeyObject } from 'crypto';
import { verifyLicense, resolvePro, decodeBase64, trialEnd, TRIAL_DAYS } from '../utils/license';

/*
 * The licence is signed by the Worker with WebCrypto's Ed25519 and checked by
 * the app with tweetnacl. Signing here with Node's crypto — the same standard
 * Ed25519 the Worker uses, not tweetnacl's own signer — is what proves the two
 * ends agree on the bytes. A test that signed with tweetnacl would pass even if
 * the Worker and the app disagreed.
 */

const b64url = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url');

function keys(): { privateKey: KeyObject; publicB64: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
  // The app is configured with plain base64, as keygen.html prints it.
  return { privateKey, publicB64: Buffer.from(jwk.x, 'base64url').toString('base64') };
}

function issue(privateKey: KeyObject, payload: object): string {
  const seg = b64url(Buffer.from(JSON.stringify(payload), 'ascii'));
  const sig = sign(null, Buffer.from(seg, 'ascii'), privateKey);
  return `SL1.${seg}.${b64url(sig)}`;
}

const { privateKey, publicB64 } = keys();
const lifetime = { v: 1, id: '184467', plan: 'lifetime', iat: 1_760_000_000 };

describe('verifyLicense', () => {
  it('accepts a licence the Worker signed', () => {
    const p = verifyLicense(issue(privateKey, lifetime), publicB64);
    expect(p).toEqual(lifetime);
  });

  it('tolerates whitespace around a pasted code', () => {
    expect(verifyLicense(`  ${issue(privateKey, lifetime)}\n`, publicB64)).not.toBeNull();
  });

  it('rejects a licence signed by another key', () => {
    const other = keys();
    expect(verifyLicense(issue(other.privateKey, lifetime), publicB64)).toBeNull();
  });

  it('rejects an edited payload', () => {
    const token = issue(privateKey, lifetime);
    const [, , sig] = token.split('.');
    const forged = b64url(Buffer.from(JSON.stringify({ ...lifetime, id: '1' }), 'ascii'));
    expect(verifyLicense(`SL1.${forged}.${sig}`, publicB64)).toBeNull();
  });

  it('rejects garbage, a missing key and a wrong prefix without throwing', () => {
    const token = issue(privateKey, lifetime);
    for (const bad of ['', 'hello', 'SL1..', 'SL1.@@@.@@@', token.replace('SL1', 'SL2')]) {
      expect(verifyLicense(bad, publicB64)).toBeNull();
    }
    expect(verifyLicense(token, '')).toBeNull();
    expect(verifyLicense(token, undefined)).toBeNull();
    expect(verifyLicense(undefined, publicB64)).toBeNull();
  });

  it('rejects a payload that is signed but not a licence', () => {
    expect(verifyLicense(issue(privateKey, { v: 1, id: '7', plan: 'forever', iat: 1 }), publicB64)).toBeNull();
    expect(verifyLicense(issue(privateKey, { v: 2, id: '7', plan: 'lifetime', iat: 1 }), publicB64)).toBeNull();
  });

  it('honours an expiry, for the subscriptions that may come later', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    const exp = Math.floor(now.getTime() / 1000);
    const token = issue(privateKey, { ...lifetime, exp });
    expect(verifyLicense(token, publicB64, new Date(now.getTime() - 1000))).not.toBeNull();
    expect(verifyLicense(token, publicB64, now)).toBeNull();
  });
});

describe('decodeBase64', () => {
  it('reads both alphabets, with and without padding', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(Buffer.from(decodeBase64(bytes.toString('base64'))!)).toEqual(bytes);
    expect(Buffer.from(decodeBase64(bytes.toString('base64url'))!)).toEqual(bytes);
    expect(Buffer.from(decodeBase64('YQ==')!)).toEqual(Buffer.from('a'));
    expect(decodeBase64('a$b')).toBeNull();
  });
});

describe('resolvePro', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  const future = new Date(now.getTime() + 86_400_000).toISOString();
  const past = new Date(now.getTime() - 86_400_000).toISOString();
  const base = { owner: false, licenseValid: false, storeEntitled: null, previous: false, now } as const;

  it('a licence or the owner build always means Pro', () => {
    expect(resolvePro({ ...base, licenseValid: true, trialEndsAt: past, storeEntitled: false })).toBe(true);
    expect(resolvePro({ ...base, owner: true, storeEntitled: false })).toBe(true);
  });

  it('the trial holds Pro until it runs out, then lets go of the cached flag', () => {
    expect(resolvePro({ ...base, trialEndsAt: future })).toBe(true);
    expect(resolvePro({ ...base, trialEndsAt: past, previous: true })).toBe(false);
  });

  it('a running trial is not ended by the store saying no', () => {
    expect(resolvePro({ ...base, trialEndsAt: future, storeEntitled: false })).toBe(true);
  });

  it('the store decides store-granted Pro, and silence keeps what was there', () => {
    expect(resolvePro({ ...base, storeEntitled: true })).toBe(true);
    expect(resolvePro({ ...base, storeEntitled: false, previous: true })).toBe(false);
    // Offline launch of a paying user: no answer is not a "no".
    expect(resolvePro({ ...base, storeEntitled: null, previous: true })).toBe(true);
  });

  it('an older build\'s Pro is kept when nothing else has an opinion', () => {
    expect(resolvePro({ ...base, previous: true })).toBe(true);
    expect(resolvePro({ ...base, previous: false })).toBe(false);
  });
});

describe('trialEnd', () => {
  it(`is ${TRIAL_DAYS} days out`, () => {
    const from = new Date('2026-10-18T12:00:00Z');
    expect(new Date(trialEnd(from)).getTime() - from.getTime()).toBe(TRIAL_DAYS * 86_400_000);
  });
});
