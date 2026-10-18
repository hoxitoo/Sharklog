import { useBetsStore } from '../store/betsStore';
import { Analytics } from './analytics';
import { clearPendingPayment, fetchLicense, getPendingPayment } from './licenseServer';

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

/** An invoice nobody paid in a week was abandoned; stop asking about it. */
const ABANDON_MS = 7 * 86_400_000;

let inFlight: Promise<ResumeResult> | null = null;

export function resumePendingPayment(): Promise<ResumeResult> {
  // Foreground, launch and a tap can land together; one request answers all.
  inFlight ??= run().finally(() => { inFlight = null; });
  return inFlight;
}

async function run(): Promise<ResumeResult> {
  const pending = await getPendingPayment();
  if (!pending) return 'none';
  const answer = await fetchLicense(pending);
  if (answer === null) return 'unreachable';
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
  Analytics.proUpgradeCompleted();
  return 'paid';
}
