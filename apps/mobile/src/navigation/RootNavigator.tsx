import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { BetsScreen } from '../screens/BetsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { DisciplineScreen } from '../screens/DisciplineScreen';
import { BankrollScreen } from '../screens/BankrollScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AddBetScreen } from '../screens/AddBetScreen';
import { StrategyBuilderScreen } from '../screens/StrategyBuilderScreen';
import { PartnersScreen } from '../screens/PartnersScreen';

export type RootStackParamList = {
  Tabs: undefined;
  AddBet: { betId?: string };
  Bankroll: undefined;
  StrategyBuilder: undefined;
  Partners: undefined;
};

export type TabParamList = {
  Bets: undefined;
  Dashboard: undefined;
  Insights: undefined;
  Discipline: undefined;
  Analytics: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Bets: '📋',
    Dashboard: '📊',
    Insights: '💡',
    Discipline: '🧘',
    Analytics: '🔬',
    Settings: '⚙️',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>
      {icons[name]}
    </Text>
  );
}

function Tabs() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: insets.bottom + 4,
          height: 60 + insets.bottom,
        },
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, marginTop: -2 },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Bets" component={BetsScreen} options={{ tabBarLabel: t('nav.bets') }} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: t('nav.dashboard') }} />
      <Tab.Screen name="Insights" component={InsightsScreen} options={{ tabBarLabel: t('nav.insights') }} />
      <Tab.Screen name="Discipline" component={DisciplineScreen} options={{ tabBarLabel: t('nav.discipline') }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ tabBarLabel: t('nav.analytics') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('nav.settings') }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { t } = useTranslation();
  const headerOpts = {
    headerStyle: { backgroundColor: colors.bgCard },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' as const },
  };
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
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
        name="Partners"
        component={PartnersScreen}
        options={{ headerShown: true, ...headerOpts, title: t('nav.partners') }}
      />
    </Stack.Navigator>
  );
}
