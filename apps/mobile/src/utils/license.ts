import nacl from 'tweetnacl';

/*
 * The Pro licence: a short signed string the app checks on its own, offline,
 * with no account behind it.
 *
 *   SL1.<base64url(payload JSON)>.<base64url(Ed25519 signature)>
 *
 * The licence server (a Cloudflare Worker, kept out of this repository) signs
 * the payload segment with its private key once Robokassa has confirmed the
 * payment; the app holds only the PUBLIC key, so it can check a licence but
 * never make one. Nothing secret ships in the app: the Robokassa passwords and
 * the private key live in the Worker's secrets. (A Robokassa password in the
 * APK would let anyone sign a 1 ₽ payment link or forge a "paid" redirect.)
 *
 * The signature covers the ASCII of the payload segment, not re-serialised
 * JSON, so the bytes signed and the bytes checked are the same bytes.
 *
 * No randomness is needed to VERIFY, so tweetnacl works on Hermes without a
 * crypto module. Everything here is pure — the store and the screens call it.
 */

export const LICENSE_PREFIX = 'SL1';

export type LicensePlan = 'lifetime';

export interface LicensePayload {
  v: 1;
  /** Robokassa invoice number — what the receipt and the merchant panel show. */
  id: string;
  plan: LicensePlan;
  /** Issued at, unix seconds. */
  iat: number;
  /** Expiry, unix seconds. Absent on a lifetime licence; kept for subscriptions later. */
  exp?: number;
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * base64 / base64url → bytes, padding optional. Our own, not atob: Hermes'
 * coverage of atob has moved between releases, and a missing global here would
 * not crash — it would quietly fail every licence.
 */
export function decodeBase64(input: string): Uint8Array | null {
  const s = input.trim().replace(/=+$/, '');
  const alphabet = /[-_]/.test(s) ? B64URL : B64;
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of s) {
    const v = alphabet.indexOf(ch);
    if (v < 0) return null;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function asciiBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function bytesToAscii(bytes: Uint8Array): string | null {
  let s = '';
  for (const b of bytes) {
    // The payload is ASCII by construction; anything else is not ours.
    if (b > 0x7e) return null;
    s += String.fromCharCode(b);
  }
  return s;
}

function isPayload(p: unknown): p is LicensePayload {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return o['v'] === 1
    && typeof o['id'] === 'string' && o['id'].length > 0
    && o['plan'] === 'lifetime'
    && typeof o['iat'] === 'number'
    && (o['exp'] === undefined || typeof o['exp'] === 'number');
}

/**
 * The licence's payload if — and only if — it is signed by `publicKeyB64` and
 * still in force at `now`. Anything else (wrong key, edited payload, expired,
 * garbage pasted into the restore field) is `null`, never a throw: this runs on
 * every launch, and a bad string must cost the user Pro, not the app.
 */
export function verifyLicense(
  token: string | undefined | null,
  publicKeyB64: string | undefined | null,
  now: Date = new Date(),
): LicensePayload | null {
  if (!token || !publicKeyB64) return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) return null;
  const [, payloadSeg, sigSeg] = parts as [string, string, string];

  const publicKey = decodeBase64(publicKeyB64);
  const signature = decodeBase64(sigSeg);
  const payloadBytes = decodeBase64(payloadSeg);
  if (!publicKey || publicKey.length !== nacl.sign.publicKeyLength) return null;
  if (!signature || signature.length !== nacl.sign.signatureLength) return null;
  if (!payloadBytes) return null;

  if (!nacl.sign.detached.verify(asciiBytes(payloadSeg), signature, publicKey)) return null;

  const json = bytesToAscii(payloadBytes);
  if (json === null) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isPayload(payload)) return null;
  if (payload.exp !== undefined && payload.exp * 1000 <= now.getTime()) return null;
  return payload;
}

/**
 * Whether Pro is on, from every source that can grant it. Pure, so the rules
 * live in one place and under test instead of in three `updateSettings` calls.
 *
 * - The owner build and a valid licence always win.
 * - The store (RevenueCat, for the Google Play build) wins when it says yes.
 * - The local 7-day trial holds Pro until it runs out; once it has run out it
 *   no longer does, whatever the cached flag says.
 * - The store saying no ends store-granted Pro.
 * - Otherwise nothing has an opinion — keep the cached flag. That is what a
 *   user upgraded from an older build has, and taking Pro away from them on an
 *   update, with no source left to give it back, would be the wrong default.
 */
export function resolvePro(input: {
  owner: boolean;
  licenseValid: boolean;
  /** End of the local trial (`settings.proExpiresAt`). */
  trialEndsAt?: string | undefined;
  /** true / false when the store answered, null when it was not asked or unreachable. */
  storeEntitled: boolean | null;
  /** The cached `settings.isPro`. */
  previous: boolean;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (input.owner || input.licenseValid) return true;
  if (input.storeEntitled === true) return true;
  if (input.trialEndsAt) {
    const ends = new Date(input.trialEndsAt).getTime();
    if (Number.isFinite(ends)) return ends > now.getTime();
  }
  if (input.storeEntitled === false) return false;
  return input.previous;
}

/** Seven days of Pro for a new user, from the moment onboarding finishes. */
export const TRIAL_DAYS = 7;

export function trialEnd(from: Date = new Date()): string {
  return new Date(from.getTime() + TRIAL_DAYS * 86_400_000).toISOString();
}
