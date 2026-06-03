const HOST = import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.posthog.com';
const KEY = import.meta.env.VITE_POSTHOG_KEY ?? '';

function getDeviceId(): string {
  const stored = localStorage.getItem('sharklog-device-id');
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem('sharklog-device-id', id);
  return id;
}

export function trackEvent(event: string, props?: Record<string, unknown>): void {
  if (!KEY) return;
  const distinct_id = getDeviceId();
  // fire-and-forget, never await, never throw
  fetch(`${HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: KEY,
      event,
      distinct_id,
      properties: {
        $os: navigator.platform,
        app_version: import.meta.env.VITE_APP_VERSION ?? '1.0.0',
        ...props,
      },
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {});
}

// ─── Typed event helpers ────────────────────────────────────────────────────

export const Analytics = {
  appOpen: () => trackEvent('app_open'),
  onboardingComplete: () => trackEvent('onboarding_complete'),

  betAdded: (p: { sport: string; betType: string; bookmaker: string; status: string }) =>
    trackEvent('bet_added', p),

  betResultSet: (p: { betId: string; status: string }) =>
    trackEvent('bet_result_set', p),

  proScreenViewed: (screen: string) =>
    trackEvent('pro_screen_viewed', { screen }),

  proUpgradeStarted: (source: string) =>
    trackEvent('pro_upgrade_started', { source }),

  exportTriggered: (format: 'csv' | 'json' | 'xlsx') =>
    trackEvent('export_triggered', { format }),

  importTriggered: (format: 'csv' | 'xlsx' | 'json') =>
    trackEvent('import_triggered', { format }),

  strategyBuilt: () =>
    trackEvent('strategy_built'),

  kellyUsed: () =>
    trackEvent('kelly_used'),

  partnerLinkTapped: (partner: string) =>
    trackEvent('partner_link_tapped', { partner }),
};
