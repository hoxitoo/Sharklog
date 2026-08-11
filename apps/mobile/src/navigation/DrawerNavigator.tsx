import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Pressable, ScrollView, Image, Alert, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChecklistModal } from '../components/ChecklistModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { useBetsStore } from '../store/betsStore';
import { DrawerContext } from '../components/DrawerContext';
import { BetsScreen } from '../screens/BetsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { DisciplineScreen } from '../screens/DisciplineScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { RootStackParamList } from './RootNavigator';

export type DrawerScreen = 'Bets' | 'Dashboard' | 'Insights' | 'Analytics' | 'Discipline' | 'Settings';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const DRAWER_WIDTH = 272;

interface NavItem {
  screen: DrawerScreen;
  icon: IoniconsName;
  iconActive: IoniconsName;
  labelKey: string;
  pro?: boolean;
}

const MAIN_ITEMS: NavItem[] = [
  { screen: 'Bets',       icon: 'receipt-outline',   iconActive: 'receipt',        labelKey: 'nav.bets' },
  { screen: 'Dashboard',  icon: 'bar-chart-outline',  iconActive: 'bar-chart',      labelKey: 'nav.dashboard' },
  { screen: 'Insights',   icon: 'bulb-outline',       iconActive: 'bulb',           labelKey: 'nav.insights' },
  { screen: 'Analytics',  icon: 'flask-outline',      iconActive: 'flask',          labelKey: 'nav.analytics' },
  { screen: 'Discipline', icon: 'leaf-outline',       iconActive: 'leaf',           labelKey: 'nav.discipline' },
  { screen: 'Settings',   icon: 'settings-outline',   iconActive: 'settings',       labelKey: 'nav.settings' },
];

function ActiveScreen({ screen, betsDateFilter, onClearBetsDateFilter }: {
  screen: DrawerScreen;
  betsDateFilter: string | null;
  onClearBetsDateFilter: () => void;
}) {
  switch (screen) {
    case 'Bets': return <BetsScreen dateFilter={betsDateFilter} onClearDateFilter={onClearBetsDateFilter} />;
    case 'Dashboard': return <DashboardScreen />;
    case 'Insights': return <InsightsScreen />;
    case 'Analytics': return <AnalyticsScreen />;
    case 'Discipline': return <DisciplineScreen />;
    case 'Settings': return <SettingsScreen />;
  }
}

export function DrawerNavigator() {
  const [screen, setScreen] = useState<DrawerScreen>('Bets');
  const [betsDateFilter, setBetsDateFilter] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const { settings, canAddBet } = useBetsStore();

  function openDrawer() {
    setDrawerVisible(true);
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 14,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }

  const drawerVisibleRef = useRef(false);
  drawerVisibleRef.current = drawerVisible;

  const edgePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) =>
        e.nativeEvent.pageX < 28 && !drawerVisibleRef.current,
      onMoveShouldSetPanResponder: (_, g) =>
        !drawerVisibleRef.current && g.dx > 8 && Math.abs(g.dy) < 60,
      onPanResponderRelease: (e, g) => {
        if (!drawerVisibleRef.current && g.dx > 20) openDrawer();
      },
    }),
  ).current;

  function closeDrawer(callback?: () => void) {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDrawerVisible(false);
      callback?.();
    });
  }

  function goToBets(date?: string) {
    setBetsDateFilter(date ?? null);
    setScreen('Bets');
  }

  function handleNavigate(s: DrawerScreen) {
    setBetsDateFilter(null); // explicit navigation clears any day drill-down
    closeDrawer(() => setScreen(s));
  }

  function handleAddBet() {
    if (!canAddBet()) {
      Alert.alert('Лимит достигнут', 'Бесплатный план — до 50 ставок. Перейди на Pro для безлимитного трекинга.');
      return;
    }
    if (settings.isPro && !settings.disableChecklist) {
      setShowChecklist(true);
    } else {
      navigation.navigate('AddBet', {});
    }
  }

  return (
    <DrawerContext.Provider value={{ openDrawer, goToBets }}>
      <View style={styles.root}>
        {/* Checklist modal (PRO pre-bet) */}
        <ChecklistModal
          visible={showChecklist}
          onConfirm={() => { setShowChecklist(false); navigation.navigate('AddBet', {}); }}
          onCancel={() => setShowChecklist(false)}
        />

        {/* Active screen */}
        <View style={styles.screen}>
          <ActiveScreen
            screen={screen}
            betsDateFilter={betsDateFilter}
            onClearBetsDateFilter={() => setBetsDateFilter(null)}
          />
        </View>

        {/* Left-edge swipe zone — opens drawer */}
        {!drawerVisible && (
          <View style={styles.swipeEdge} {...edgePan.panHandlers} />
        )}

        {/* Drawer overlay */}
        {drawerVisible && (
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closeDrawer()} />
          </Animated.View>
        )}

        {/* Drawer panel */}
        <Animated.View
          style={[styles.drawer, { transform: [{ translateX }] }]}
          pointerEvents={drawerVisible ? 'auto' : 'none'}
        >
          <DrawerContent
            currentScreen={screen}
            onNavigate={handleNavigate}
            onClose={closeDrawer}
            insets={insets}
          />
        </Animated.View>

        {/* FAB — Add Bet (only on Bets screen) */}
        {screen === 'Bets' && (
          <TouchableOpacity
            style={[styles.fab, { bottom: insets.bottom + 20 }]}
            onPress={handleAddBet}
            activeOpacity={0.85}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    </DrawerContext.Provider>
  );
}

interface DrawerContentProps {
  currentScreen: DrawerScreen;
  onNavigate: (s: DrawerScreen) => void;
  onClose: (callback?: () => void) => void;
  insets: { top: number; bottom: number };
}

function DrawerContent({ currentScreen, onNavigate, onClose, insets }: DrawerContentProps) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings } = useBetsStore();

  function goStack(name: 'Bankroll' | 'StrategyBuilder' | 'Partners') {
    onClose(() => navigation.navigate(name));
  }

  return (
    <View style={[styles.drawerInner, { paddingTop: insets.top + 12 }]}>
      {/* Logo */}
      <View style={styles.drawerLogo}>
        <Image source={require('../../assets/adaptive-icon.png')} style={styles.logoImg} resizeMode="contain" />
        <Text style={styles.logoText}>SharkLog</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* Main nav items */}
        <View style={styles.section}>
          {MAIN_ITEMS.map((item) => {
            const active = currentScreen === item.screen;
            return (
              <TouchableOpacity
                key={item.screen}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => onNavigate(item.screen)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={20}
                  color={active ? colors.purple : colors.textSecondary}
                  style={styles.navIcon}
                />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {t(item.labelKey)}
                </Text>
                {item.pro && !settings.isPro && (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.divider} />

        {/* Secondary items */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.navItem} onPress={() => goStack('Bankroll')} activeOpacity={0.75}>
            <Ionicons name="wallet-outline" size={20} color={colors.textSecondary} style={styles.navIcon} />
            <Text style={styles.navLabel}>{t('nav.bankroll')}</Text>
          </TouchableOpacity>

          {settings.isPro && (
            <TouchableOpacity style={styles.navItem} onPress={() => goStack('StrategyBuilder')} activeOpacity={0.75}>
              <Ionicons name="options-outline" size={20} color={colors.textSecondary} style={styles.navIcon} />
              <Text style={styles.navLabel}>{t('nav.strategyBuilder')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />

        {/* Partners — highlighted */}
        <TouchableOpacity
          style={styles.partnersCard}
          onPress={() => goStack('Partners')}
          activeOpacity={0.8}
        >
          <Ionicons name="gift-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.partnersTitle}>{t('nav.partners')}</Text>
            <Text style={styles.partnersSub}>{t('nav.partnersSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom: version / responsible gambling */}
      <View style={[styles.drawerBottom, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.responsible}>18+ · Играй ответственно</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.bgCard,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  drawerInner: {
    flex: 1,
  },
  drawerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  logoImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  section: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 1,
  },
  navItemActive: {
    backgroundColor: colors.purple + '1A',
  },
  navIcon: {
    width: 24,
    textAlign: 'center',
  },
  navLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  navLabelActive: {
    color: colors.purple,
    fontWeight: '700',
  },
  proBadge: {
    backgroundColor: colors.gold + '22',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.gold + '55',
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.gold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  partnersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 8,
    marginBottom: 4,
    padding: 12,
    backgroundColor: colors.accent + '14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  partnersTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  partnersSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  drawerBottom: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  responsible: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  swipeEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 24,
    zIndex: 9,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  fabText: {
    fontSize: 30,
    color: '#fff',
    fontWeight: '300',
    lineHeight: 36,
    marginTop: -2,
  },
});
