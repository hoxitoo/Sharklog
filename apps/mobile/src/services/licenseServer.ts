import AsyncStorage from '@react-native-async-storage/async-storage';
import { LICENSE_URL } from './billing';

/*
 * Client for the licence server (a Cloudflare Worker, not in this repository).
 *
 *   GET  /offer                    → { price, currency, plan }
 *   POST /create                   → { inv, nonce, url }   — url is Robokassa's payment page
 *   GET  /license?inv=…&nonce=…    → { status: 'paid', license } | { status: 'pending' }
 *
 * The price comes from the server, not from this file: the number on the
 * button and the number Robokassa charges are then one number, set in one place.
 *
 * Every call answers `null` when the server could not be reached — a different
 * answer from "not paid yet", which the caller must not confuse with it.
 */

const PENDING_KEY = '@sharklog/pending_payment';
const TIMEOUT_MS = 12_000;

export interface Offer {
  price: number;
  currency: 'RUB';
  plan: 'lifetime';
}

export interface PendingPayment {
  inv: string;
  nonce: string;
  url: string;
  createdAt: string;
}

export type LicenseAnswer = { status: 'paid'; license: string } | { status: 'pending' };

export function licenseServerConfigured(): boolean {
  return LICENSE_URL.length > 0;
}

async function call(path: string, init?: RequestInit): Promise<unknown | null> {
  if (!licenseServerConfigured()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${LICENSE_URL}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getOffer(): Promise<Offer | null> {
  const r = await call('/offer') as Partial<Offer> | null;
  if (!r || typeof r.price !== 'number' || !(r.price > 0) || r.currency !== 'RUB' || r.plan !== 'lifetime') return null;
  return { price: r.price, currency: 'RUB', plan: 'lifetime' };
}

/** Opens an invoice on the server and remembers it, so a killed app can pick it up again. */
export async function createPayment(): Promise<PendingPayment | null> {
  const r = await call('/create', { method: 'POST' }) as Partial<PendingPayment> | null;
  if (!r || typeof r.inv !== 'string' || typeof r.nonce !== 'string' || typeof r.url !== 'string') return null;
  // Only ever hand the user Robokassa's own page.
  if (!/^https:\/\/auth\.robokassa\.(ru|kz)\//.test(r.url)) return null;
  const pending: PendingPayment = { inv: r.inv, nonce: r.nonce, url: r.url, createdAt: new Date().toISOString() };
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  return pending;
}

export async function fetchLicense(p: Pick<PendingPayment, 'inv' | 'nonce'>): Promise<LicenseAnswer | null> {
  const q = `?inv=${encodeURIComponent(p.inv)}&nonce=${encodeURIComponent(p.nonce)}`;
  const r = await call(`/license${q}`) as Partial<{ status: string; license: string }> | null;
  if (!r) return null;
  if (r.status === 'paid' && typeof r.license === 'string') return { status: 'paid', license: r.license };
  if (r.status === 'pending') return { status: 'pending' };
  return null;
}

export async function getPendingPayment(): Promise<PendingPayment | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PendingPayment>;
    if (typeof p.inv !== 'string' || typeof p.nonce !== 'string' || typeof p.url !== 'string') return null;
    return { inv: p.inv, nonce: p.nonce, url: p.url, createdAt: p.createdAt ?? new Date().toISOString() };
  } catch {
    return null;
  }
}

export async function clearPendingPayment(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // nothing to do: a stale pending payment only costs one extra check
  }
}
