import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { useBetsStore } from './src/store/betsStore';
import { colors } from './src/theme/colors';
import { scheduleDailyReminder } from './src/utils/notifications';
import { initRevenueCat, syncEntitlement } from './src/services/revenueCat';
import { initSentry } from './src/services/sentry';

export default function App() {
  const load = useBetsStore((s) => s.load);
  const isLoaded = useBetsStore((s) => s.isLoaded);
  const onboardingComplete = useBetsStore((s) => s.settings.onboardingComplete);
  const updateSettings = useBetsStore((s) => s.updateSettings);

  useEffect(() => {
    initSentry();
    initRevenueCat();
    load().then(async () => {
      scheduleDailyReminder();
      const isPro = await syncEntitlement();
      // Only upgrade to pro — never downgrade on network failure
      if (isPro) updateSettings({ isPro: true });
    });
  }, []);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.purple} size="large" />
      </View>
    );
  }

  if (!onboardingComplete) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <OnboardingScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
