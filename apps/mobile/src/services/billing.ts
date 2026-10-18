/*
 * Which way this build takes money.
 *
 * - `robokassa` — the RuStore build (the default): a one-time purchase paid on
 *   Robokassa's page, confirmed by our licence server, kept as a signed licence
 *   on the device. RuStore's own payment SDK is closed to the self-employed
 *   since February 2026, and Google Play billing does not work for users in
 *   Russia.
 * - `revenuecat` — kept for a Google Play / App Store release later: store
 *   subscriptions through RevenueCat, exactly as before.
 *
 * Set per build with EXPO_PUBLIC_BILLING. The licence server's address and
 * public key come from the environment too (EAS variables or `.env.local`),
 * not from this public repository — the server is not part of it.
 */

export type BillingProvider = 'robokassa' | 'revenuecat';

export const BILLING: BillingProvider =
  process.env['EXPO_PUBLIC_BILLING'] === 'revenuecat' ? 'revenuecat' : 'robokassa';

/** Base URL of the licence server, no trailing slash. Empty = purchases unavailable. */
export const LICENSE_URL = (process.env['EXPO_PUBLIC_LICENSE_URL'] ?? '').replace(/\/+$/, '');

/** Ed25519 public key (base64) the licences are checked against. */
export const LICENSE_PUBKEY = process.env['EXPO_PUBLIC_LICENSE_PUBKEY'] ?? '';

/** Where the privacy policy lives — shown under the purchase button. */
export const PRIVACY_URL = 'https://hoxitoo.github.io/Sharklog/privacy.html';
