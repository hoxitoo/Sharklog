import { useBetsStore } from '../store/betsStore';
import { readLicense } from '../utils/license';
import { Analytics } from './analytics';
import { clearPendingPayment, fetchLicense, getPendingPayment, isRevoked } from './licenseServer';

/*
 * Picking up a Robokassa payment after the browser.
 *
 * The user pays on Robokassa's page, outside the app. Robokassa tells the
 * licence server, never the app; so the app asks the server, by the invoice it
 * opened, whether the money arrived. It asks when the user comes back to the
 * app, at launch (the app may have been killed while the browser was open) and
 * when the user taps "check". The invoice is kept until a licence arrives, so
 * none of those three can lose a paid purchase.
 */

export type ResumeResult = 'paid' | 'pending' | 'none' | 'unreachable';

/**
 * An invoice nobody paid in a month was abandoned; stop asking about it. Long
 * on purpose: Robokassa may still take a payment on an old link, and once the
 * app forgets the invoice, its licence can only come back through support.
 */
const ABANDON_MS = 30 * 86_400_000;

let inFlight: Promise<ResumeResult> | null = null;
let paidNotice = false;

export function resumePendingPayment(): Promise<ResumeResult> {
  // Foreground, launch and a tap can land together; one request answers all.
  inFlight ??= run().finally(() => { inFlight = null; });
  return inFlight;
}

/**
 * True exactly once per purchase that arrived. Several callers can await the
 * same check (a tap during the foreground check); the first to ask says
 * "Pro is on", the rest stay quiet — two stacked alerts read as two charges.
 */
export function takePaidNotice(): boolean {
  if (!paidNotice) return false;
  paidNotice = false;
  return true;
}

/*
 * A refund takes the code back. The author revokes the invoice on the licence
 * server (`/revoke` in the support bot); the app asks about its own licence at
 * launch and when it comes back to the foreground, and drops it if revoked.
 * Without this every refund was a lifetime of free Pro. "Could not ask" is
 * never "revoked": an offline user who paid keeps Pro.
 */

export type StandingResult = 'ok' | 'revoked' | 'none' | 'unreachable';

let standing: Promise<StandingResult> | null = null;

export function checkLicenseStanding(): Promise<StandingResult> {
  standing ??= checkStanding().finally(() => { standing = null; });
  return standing;
}

async function checkStanding(): Promise<StandingResult> {
  const id = readLicense(useBetsStore.getState().settings.license)?.id;
  if (!id) return 'none';
  const revoked = await isRevoked(id);
  if (revoked === null) return 'unreachable';
  if (!revoked) return 'ok';
  // The licence may have changed while the server was being asked (a restore
  // code entered meanwhile): revokeLicense drops it only if it is this invoice's.
  useBetsStore.getState().revokeLicense(id);
  return 'revoked';
}

async function run(): Promise<ResumeResult> {
  const pending = await getPendingPayment();
  if (!pending) return 'none';
  const answer = await fetchLicense(pending);
  if (answer === null) return 'unreachable';
  if (answer.status === 'unknown') {
    // The server does not know this phone's invoice — nothing will ever
    // arrive for it. Keeping it would hold the paywall on "awaiting" forever.
    await clearPendingPayment();
    return 'none';
  }
  if (answer.status === 'pending') {
    if (Date.now() - new Date(pending.createdAt).getTime() > ABANDON_MS) {
      await clearPendingPayment();
      return 'none';
    }
    return 'pending';
  }
  // A licence that does not verify means the app and the server disagree on
  // the key — a configuration error, not a payment problem. Keep the invoice:
  // a fixed build will pick the same licence up.
  if (!useBetsStore.getState().applyLicense(answer.license)) return 'unreachable';
  await clearPendingPayment();
  paidNotice = true;
  Analytics.proUpgradeCompleted();
  return 'paid';
}
