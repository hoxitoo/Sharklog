import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
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
import { scheduleDailyReminder, registerBetResultCategory } from './src/utils/notifications';
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

  const [fontsLoaded] = useFonts({
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

  const appReady = isLoaded && fontsLoaded;

  // Hide native splash once React Native is ready to show our custom JS splash
  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady]);

  // Keep showing splash until BOTH animation is done AND store is loaded.
  // Without the isLoaded guard, returning users briefly see OnboardingScreen
  // (settings.onboardingComplete defaults to false before load() resolves).
  if (!splashDone || !isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
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
