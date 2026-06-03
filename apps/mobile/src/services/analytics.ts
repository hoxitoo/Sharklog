import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const HOST = process.env['EXPO_PUBLIC_POSTHOG_HOST'] ?? 'https://eu.posthog.com';
const KEY = process.env['EXPO_PUBLIC_POSTHOG_KEY'] ?? '';

const DEVICE_ID_KEY = '@sharklog/device_id';

let deviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) { deviceId = stored; return stored; }
  const id = crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  deviceId = id;
  return id;
}

export async function trackEvent(event: string, props?: Record<string, unknown>): Promise<void> {
  if (!KEY) return;
  try {
    const distinct_id = await getDeviceId();
    await fetch(`${HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id,
        properties: {
          $os: Platform.OS,
          $os_version: String(Platform.Version),
          app_version: process.env['EXPO_PUBLIC_APP_VERSION'] ?? '1.0.0',
          ...props,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // analytics must never crash the app
  }
}

// ─── Typed event helpers ────────────────────────────────────────────────────

export const Analytics = {
  appOpen: () => trackEvent('app_open'),
  onboardingComplete: () => trackEvent('onboarding_complete'),

  betAdded: (p: { sport: string; betType: string; bookmaker: string; status: string }) =>
    trackEvent('bet_added', p),

  betResultSet: (p: { status: string }) =>
    trackEvent('bet_result_set', p),

  proScreenViewed: (screen: string) =>
    trackEvent('pro_screen_viewed', { screen }),

  proUpgradeStarted: (source: string) =>
    trackEvent('pro_upgrade_started', { source }),

  proUpgradeCompleted: () =>
    trackEvent('pro_upgrade_completed'),

  exportTriggered: (format: 'csv' | 'json') =>
    trackEvent('export_triggered', { format }),

  importTriggered: (format: 'csv' | 'json') =>
    trackEvent('import_triggered', { format }),

  strategyBuilt: () =>
    trackEvent('strategy_built'),

  kellyUsed: () =>
    trackEvent('kelly_used'),

  partnerLinkTapped: (partner: string) =>
    trackEvent('partner_link_tapped', { partner }),
};
