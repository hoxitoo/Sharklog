import React, { useEffect, useState } from 'react';
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
import { scheduleDailyReminder } from './src/utils/notifications';
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
