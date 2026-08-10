import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { BankrollScreen } from '../screens/BankrollScreen';
import { AddBetScreen } from '../screens/AddBetScreen';
import { StrategyBuilderScreen } from '../screens/StrategyBuilderScreen';
import { PartnersScreen } from '../screens/PartnersScreen';
import { PendingScreen } from '../screens/PendingScreen';
import { DrawerNavigator } from './DrawerNavigator';

export type RootStackParamList = {
  Drawer: undefined;
  AddBet: { betId?: string };
  Bankroll: undefined;
  StrategyBuilder: undefined;
  Partners: undefined;
  Pending: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { t } = useTranslation();
  const headerOpts = {
    headerStyle: { backgroundColor: colors.bgCard },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' as const },
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
