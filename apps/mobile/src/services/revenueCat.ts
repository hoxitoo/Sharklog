/*
 * UNUSED IN THE RUSTORE BUILD — kept on purpose, do not delete (author's decision).
 *
 * The RuStore build sells through Robokassa (`EXPO_PUBLIC_BILLING=robokassa`,
 * the default — services/billing.ts). There nothing here is called: App.tsx
 * initialises and syncs only when `BILLING === 'revenuecat'`, ProGate renders
 * `StoreCheckout` (offerings, purchase, restore) only for that build, and the
 * Settings «Восстановить покупки» row likewise. The native module
 * `react-native-purchases` is still linked into every build — the price of
 * keeping one codebase for the Google Play / App Store release later, where
 * this file is the payment path (profile `production` in eas.json).
 * Guard: __tests__/revenueCatUnused.test.ts.
 */
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';

// Set these in EAS Secrets or .env.local
const IOS_KEY = process.env['EXPO_PUBLIC_RC_IOS_KEY'] ?? '';
const ANDROID_KEY = process.env['EXPO_PUBLIC_RC_ANDROID_KEY'] ?? '';

export const ENTITLEMENT_PRO = 'pro';

let initialized = false;

export function initRevenueCat(): void {
  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
  if (!apiKey) {
    // Dev mode — RevenueCat not configured, isPro controlled by Settings toggle
    return;
  }
  if (initialized) return;
  Purchases.setLogLevel(
    process.env['EXPO_PUBLIC_ENV'] === 'production' ? LOG_LEVEL.ERROR : LOG_LEVEL.DEBUG,
  );
  Purchases.configure({ apiKey });
  initialized = true;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!initialized) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export function isProFromInfo(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_PRO] !== undefined;
}

export interface OfferingPackages {
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}

export async function getOfferings(): Promise<OfferingPackages> {
  if (!initialized) return { monthly: null, annual: null };
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    return {
      monthly: current?.monthly ?? null,
      annual: current?.annual ?? null,
    };
  } catch {
    return { monthly: null, annual: null };
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return isProFromInfo(customerInfo);
  } catch (e: unknown) {
    // user cancelled — not an error
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

/**
 * true/false when the store answered, null when it could not be reached.
 *
 * It used to answer `false` for both, and the caller then told an offline user
 * who HAD paid that no subscription was found — on the one screen where that
 * reads as "your money is gone". Same contract as `syncEntitlement` below.
 */
export async function restorePurchases(): Promise<boolean | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return isProFromInfo(customerInfo);
  } catch {
    return null;
  }
}

/** Returns true/false if RevenueCat responded, null if unreachable (caller should not change Pro state). */
export async function syncEntitlement(): Promise<boolean | null> {
  const info = await getCustomerInfo();
  if (!info) return null;
  return isProFromInfo(info);
}
