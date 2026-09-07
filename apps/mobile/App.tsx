import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { RootNavigator } from './src/navigation/RootNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { useBetsStore } from './src/store/betsStore';
import { colors } from './src/theme/colors';
import * as Notifications from 'expo-notifications';
import {
  scheduleDailyReminder, registerBetResultCategory,
  setBetPendingResolver, syncBetResultReminders,
} from './src/utils/notifications';
import { initRevenueCat, syncEntitlement } from './src/services/revenueCat';
import { initSentry } from './src/services/sentry';
import { Analytics } from './src/services/analytics';
import './src/i18n/index';
import { applyLanguage } from './src/i18n/index';

// Keep native splash visible until React Native is ready to render
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const load = useBetsStore((s) => s.load);
  const isLoaded = useBetsStore((s) => s.isLoaded);
  const onboardingComplete = useBetsStore((s) => s.settings.onboardingComplete);
  const updateSettings = useBetsStore((s) => s.updateSettings);
  const [splashDone, setSplashDone] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  // Settling a bet straight from a notification button. The action can arrive before
  // the store has loaded (cold start) — applying it then would mutate an EMPTY store
  // and persist that over real data, so buffer it until `isLoaded`.
  const queuedAction = useRef<{ betId: string; status: 'won' | 'lost' } | null>(null);

  const flushQueuedAction = useCallback(() => {
    const queued = queuedAction.current;
    if (!queued) return;
    const store = useBetsStore.getState();
    if (!store.isLoaded) return;
    queuedAction.current = null;
    const bet = store.bets.find((b) => b.id === queued.betId);
    if (!bet || bet.status !== 'pending') return; // already settled elsewhere
    store.updateBet(queued.betId, { status: queued.status });
  }, []);

  useEffect(() => {
    registerBetResultCategory();
    // Foreground guard: never surface a reminder for a bet that is already settled.
    setBetPendingResolver((betId) => {
      const bet = useBetsStore.getState().bets.find((b) => b.id === betId);
      return !!bet && bet.status === 'pending';
    });

    const handle = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification?.request?.content?.data as
        | Record<string, unknown>
        | undefined;
      if (!data || data['type'] !== 'bet_result') return;
      const action = response!.actionIdentifier;
      if (action !== 'won' && action !== 'lost') return;
      const betId = typeof data['betId'] === 'string' ? data['betId'] : '';
      if (!betId) return;
      queuedAction.current = { betId, status: action };
      flushQueuedAction();
    };

    // Cold start: the app was launched by tapping the action button.
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [flushQueuedAction]);

  useEffect(() => { flushQueuedAction(); }, [isLoaded, flushQueuedAction]);

  // Cancelling on settle is fire-and-forget and can be lost (app killed mid-write,
  // CSV import, edits). Re-reconcile reminders on launch and on every foreground.
  useEffect(() => {
    if (!isLoaded) return;
    const reconcile = () => {
      const { bets, settings } = useBetsStore.getState();
      syncBetResultReminders(bets, settings.betResultReminders !== false);
    };
    reconcile();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcile();
    });
    return () => sub.remove();
  }, [isLoaded]);

  useEffect(() => {
    initSentry();
    initRevenueCat();
    Analytics.appOpen();
    load().then(async () => {
      const { settings } = useBetsStore.getState();
      scheduleDailyReminder(settings.reminderHour);
      applyLanguage(settings.language);
      const isPro = await syncEntitlement();
      if (isPro !== null) updateSettings({ isPro });
    });
  }, []);

  // A failed font load must not hang the app on the splash forever.
  const fontsSettled = fontsLoaded || !!fontError;
  const appReady = isLoaded && fontsSettled;

  // Hide native splash once React Native is ready to show our custom JS splash
  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady]);

  // Keep showing splash until the animation is done AND the store is loaded AND
  // the fonts are registered.
  //
  // Without the isLoaded guard, returning users briefly see OnboardingScreen
  // (settings.onboardingComplete defaults to false before load() resolves).
  //
  // The fonts guard matters since the native stack header started naming a
  // family: react-native-screens resolves the typeface once, in the native
  // config, and Android's font manager caches the system fallback under that
  // family key if the asset is not registered yet. A JS `Text` re-renders when
  // the fonts flip; the native header does not, so the miss sticks for the
  // whole session — five screen titles in Roboto.
  if (!splashDone || !appReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        {/* Only once the fonts are registered. The splash names DM Sans, and
            Android measures a Text with whatever font is available at the time:
            mounting first meant the tagline was measured in the fallback and
            then clipped when the wider face arrived — "Трекер ставок" rendered
            as "Трекер". It also means the animation starts when it becomes
            visible, instead of playing its first frames under the native
            splash. */}
        {!splashDone && fontsSettled && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
      </View>
    );
  }

  if (!onboardingComplete) {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <OnboardingScreen />
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
