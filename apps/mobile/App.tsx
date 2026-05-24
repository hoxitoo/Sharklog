import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
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
    load().then(async () => {
      // Read reminderHour from store after load completes so we use the persisted value
      const { settings } = useBetsStore.getState();
      scheduleDailyReminder(settings.reminderHour);
      const isPro = await syncEntitlement();
      // Only upgrade to pro — never downgrade on network failure
      if (isPro) updateSettings({ isPro: true });
    });
  }, []);

  if (!isLoaded || !fontsLoaded) {
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
