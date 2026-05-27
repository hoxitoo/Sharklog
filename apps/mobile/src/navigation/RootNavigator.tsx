import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '../theme/colors';
import { BetsScreen } from '../screens/BetsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { DisciplineScreen } from '../screens/DisciplineScreen';
import { BankrollScreen } from '../screens/BankrollScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AddBetScreen } from '../screens/AddBetScreen';
import { StrategyBuilderScreen } from '../screens/StrategyBuilderScreen';

export type RootStackParamList = {
  Tabs: undefined;
  AddBet: { betId?: string };
  Bankroll: undefined;
  StrategyBuilder: undefined;
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, marginTop: -2 },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Bets" component={BetsScreen} options={{ tabBarLabel: 'Ставки' }} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Дашборд' }} />
      <Tab.Screen name="Insights" component={InsightsScreen} options={{ tabBarLabel: 'Инсайты' }} />
      <Tab.Screen name="Discipline" component={DisciplineScreen} options={{ tabBarLabel: 'Дисциплина' }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ tabBarLabel: 'Аналитика' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Настройки' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen
        name="AddBet"
        component={AddBetScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerStyle: { backgroundColor: colors.bgCard },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        }}
      />
      <Stack.Screen
        name="Bankroll"
        component={BankrollScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.bgCard },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
          title: 'Банкролл',
        }}
      />
      <Stack.Screen
        name="StrategyBuilder"
        component={StrategyBuilderScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.bgCard },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
          title: 'Билдер стратегий',
        }}
      />
    </Stack.Navigator>
  );
}
