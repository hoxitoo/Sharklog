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

export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return isProFromInfo(customerInfo);
  } catch {
    return false;
  }
}

export async function syncEntitlement(): Promise<boolean> {
  const info = await getCustomerInfo();
  if (!info) return false;
  return isProFromInfo(info);
}
