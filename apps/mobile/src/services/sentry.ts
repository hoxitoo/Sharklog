import * as Sentry from '@sentry/react-native';

const DSN = process.env['EXPO_PUBLIC_SENTRY_DSN'] ?? '';
const ENV = process.env['EXPO_PUBLIC_ENV'] ?? 'development';

export function initSentry(): void {
  if (!DSN) return; // dev mode — Sentry not configured
  Sentry.init({
    dsn: DSN,
    environment: ENV,
    enabled: ENV === 'production' || ENV === 'preview',
    tracesSampleRate: ENV === 'production' ? 0.2 : 1.0,
    debug: ENV === 'development',
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!DSN) {
    console.error('[Sentry]', error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function setUserContext(userId: string, isPro: boolean): void {
  if (!DSN) return;
  Sentry.setUser({ id: userId });
  Sentry.setTag('is_pro', String(isPro));
}

export function clearUserContext(): void {
  if (!DSN) return;
  Sentry.setUser(null);
}
