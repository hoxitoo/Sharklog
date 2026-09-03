import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { NAV_TITLE } from '../components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { BankrollScreen } from '../screens/BankrollScreen';
import { AddBetScreen } from '../screens/AddBetScreen';
import { StrategyBuilderScreen } from '../screens/StrategyBuilderScreen';
import { PartnersScreen } from '../screens/PartnersScreen';
import { PendingScreen } from '../screens/PendingScreen';
import { DrawerNavigator } from './DrawerNavigator';

export type RootStackParamList = {
  Drawer: undefined;
  /** `betId` edits that bet; `duplicateOf` seeds a NEW bet from it. */
  AddBet: { betId?: string; duplicateOf?: string };
  Bankroll: undefined;
  StrategyBuilder: undefined;
  Partners: undefined;
  Pending: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { t } = useTranslation();
  // Same title and same ground as the drawer screens' ScreenHeader, so pushing
  // a screen does not change what a header looks like.
  const headerOpts = {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: NAV_TITLE,
    headerShadowVisible: false,
  };
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Drawer" component={DrawerNavigator} />
      <Stack.Screen
        name="AddBet"
        component={AddBetScreen}
        options={{ presentation: 'modal', headerShown: true, ...headerOpts }}
      />
      <Stack.Screen
        name="Bankroll"
        component={BankrollScreen}
        options={{ headerShown: true, ...headerOpts, title: t('nav.bankroll') }}
      />
      <Stack.Screen
        name="StrategyBuilder"
        component={StrategyBuilderScreen}
        options={{ headerShown: true, ...headerOpts, title: t('nav.strategyBuilder') }}
      />
      <Stack.Screen
        name="Pending"
        component={PendingScreen}
        options={{ headerShown: true, ...headerOpts, title: 'Ждут результата' }}
      />
      <Stack.Screen
        name="Partners"
        component={PartnersScreen}
        options={{ headerShown: true, ...headerOpts, title: t('nav.partners') }}
      />
    </Stack.Navigator>
  );
}
