import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { SPACE, RADIUS, TOUCH, FAB_SIZE, FAB_BOTTOM } from '../theme/layout';
import {
  View, StyleSheet, TouchableOpacity, Animated, Pressable, ScrollView, Image, Alert, PanResponder, BackHandler,
  Keyboard, Easing,
} from 'react-native';
import { AppText as Text } from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { ChecklistModal } from '../components/ChecklistModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, alpha } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { useBetsStore } from '../store/betsStore';
import { FREE_LIMITS } from '@sharklog/core';
import { Freeze } from 'react-freeze';
import { DrawerContext, type BetsFilter } from '../components/DrawerContext';
import { TourOverlay } from '../components/tour/TourOverlay';
import { AppIcon } from '../components/icons/AppIcon';
import type { GlyphName } from '../components/icons/glyphs';
import { tourTarget, useTourStore, isTourPending } from '../components/tour/tour';
import { trialRunning } from '../utils/license';
import { BetsScreen } from '../screens/BetsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { DisciplineScreen } from '../screens/DisciplineScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { RootStackParamList } from './RootNavigator';
import { SIZE, GLYPH } from '../theme/typography';
import { themedStyles } from '../theme/themed';

export type DrawerScreen = 'Bets' | 'Dashboard' | 'Insights' | 'Analytics' | 'Discipline' | 'Settings';

const DRAWER_WIDTH = 272;

/**
 * The screen on show, outliving this component. Switching the colour theme
 * remounts the whole tree (App.tsx), and without this the user who picked a
 * theme in Settings landed back on Bets. Module state, not storage: a cold
 * start still opens on Bets.
 */
let lastScreen: DrawerScreen = 'Bets';

/**
 * The slide-in must END when it visibly ends. It used to be a spring, and a
 * spring that looks settled after ~250 ms keeps running for ~700 ms more,
 * shaving off sub-pixel motion. The menu items did not take taps for that
 * whole tail — the "dead for about a second after a swipe" bug.
 *
 * Why the tail blocks taps: the slide runs on the native driver, so React's
 * copy of the drawer's layout stays at the starting offset (off-screen) until
 * the animation reports finished. A touchable measures itself against that
 * copy when pressed, finds the finger outside itself at the first jitter, and
 * cancels the press. Hence a timed curve that stops when the motion stops —
 * `__tests__/drawerMotion.test.ts` keeps the spring out.
 */
const OPEN_MS = 240;

interface NavItem {
  screen: DrawerScreen;
  /** The author's two-tone glyph (docs/design/icons): one shape, painted by the theme. */
  icon: GlyphName;
  labelKey: string;
  pro?: boolean;
}

const MAIN_ITEMS: NavItem[] = [
  { screen: 'Bets',       icon: 'bets',       labelKey: 'nav.bets' },
  { screen: 'Dashboard',  icon: 'dashboard',  labelKey: 'nav.dashboard' },
  { screen: 'Insights',   icon: 'insights',   labelKey: 'nav.insights' },
  { screen: 'Analytics',  icon: 'analytics',  labelKey: 'nav.analytics' },
  { screen: 'Discipline', icon: 'discipline', labelKey: 'nav.discipline' },
  { screen: 'Settings',   icon: 'settings',   labelKey: 'nav.settings' },
];

/** Menu glyphs: the box carries ~15% air, so this draws them a little larger than the old 20pt icons. */
const NAV_GLYPH = GLYPH.xl;

/**
 * One extra render before the freeze takes hold.
 *
 * Freezing in the same commit as the navigation denies the outgoing screen the
 * chance to commit its final state — `react-native-screens` wraps `Freeze` the
 * same way, for the same reason. A zero-delay timeout is enough.
 */
function DelayedFreeze({ freeze, children }: { freeze: boolean; children: React.ReactNode }) {
  const [frozen, setFrozen] = useState(freeze);
  useEffect(() => {
    if (!freeze) { setFrozen(false); return; }
    const id = setTimeout(() => setFrozen(true), 0);
    return () => clearTimeout(id);
  }, [freeze]);
  return <Freeze freeze={freeze && frozen}>{children}</Freeze>;
}

/**
 * Memoised: opening the drawer, closing it, or toggling the checklist are
 * drawer state, and without this each of them re-rendered the entire screen
 * behind the drawer — charts, lists and all — while an animation was running.
 */
const ActiveScreen = React.memo(function ActiveScreen({ screen, betsFilter, onClearBetsFilter }: {
  screen: DrawerScreen;
  betsFilter: BetsFilter | null;
  onClearBetsFilter: () => void;
}) {
  switch (screen) {
    case 'Bets': return <BetsScreen filter={betsFilter} onClearFilter={onClearBetsFilter} />;
    case 'Dashboard': return <DashboardScreen />;
    case 'Insights': return <InsightsScreen />;
    case 'Analytics': return <AnalyticsScreen />;
    case 'Discipline': return <DisciplineScreen />;
    case 'Settings': return <SettingsScreen />;
  }
});

export function DrawerNavigator() {
  const [screen, setScreen] = useState<DrawerScreen>(() => lastScreen);
  // Screens are kept once visited, so only the FIRST visit pays for a mount.
  // Lazily, not all six up front — that would move the whole cost to launch.
  const [visited, setVisited] = useState<DrawerScreen[]>(() => [lastScreen]);

  const showScreen = useCallback((s: DrawerScreen) => {
    lastScreen = s;
    setScreen(s);
    setVisited((v) => (v.includes(s) ? v : [...v, s]));
  }, []);
  const [betsFilter, setBetsFilter] = useState<BetsFilter | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const settings = useBetsStore((s) => s.settings);
  const canAddBet = useBetsStore((s) => s.canAddBet);

  // The first-run tour: owed after onboarding (and until finished or skipped,
  // so a kill mid-way shows it again), or asked for again in Settings.
  useEffect(() => {
    let alive = true;
    isTourPending().then((pending) => {
      if (!alive || !pending || useTourStore.getState().active) return;
      useTourStore.getState().start({ inTrial: trialRunning(useBetsStore.getState().settings) });
    });
    return () => { alive = false; };
  }, []);

  // It walks the Bets screen, so a start from anywhere else brings the user
  // there — with the drawer out of the way.
  const tourActive = useTourStore((s) => s.active);
  useEffect(() => {
    if (!tourActive) return;
    if (drawerVisibleRef.current) closeDrawer();
    if (lastScreen !== 'Bets') showScreen('Bets');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive]);

  // Bumped on every open. The close callback checks it rather than `finished`:
  // only a re-OPEN should cancel a pending navigation, but a second close —
  // Android back pressed within the 200ms — reports unfinished too, and used
  // to drop the item the user had just tapped.
  const openToken = useRef(0);

  const openDrawer = useCallback(() => {
    // A keyboard left up behind a full-height drawer is both nonsense to look
    // at and the reason the first tap on a menu item did nothing: RN hands
    // that tap to dismissing the keyboard, not to the item under the finger.
    Keyboard.dismiss();
    openToken.current += 1;
    setDrawerVisible(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: OPEN_MS,
        // Decelerating, so it still lands softly the way the spring did.
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: OPEN_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, overlayOpacity]);

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
    const token = openToken.current;
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
      // Re-opened while we were closing: leave the state alone. Doing
      // otherwise switched pointerEvents off on a drawer that was visually
      // open, and it then ignored every tap until closed and opened again —
      // that was the "sometimes it takes two taps".
      if (openToken.current !== token) return;
      setDrawerVisible(false);
      callback?.();
    });
  }

  // Stable identity: a new arrow on every render re-renders the whole active
  // screen tree, which is the expensive half of this app.
  const clearBetsFilter = useCallback(() => setBetsFilter(null), []);

  const goToBets = useCallback((filter?: BetsFilter) => {
    setBetsFilter(filter ?? null);
    showScreen('Bets');
  }, [showScreen]);

  // Memoised, or React.memo on the screen buys nothing: context bypasses it,
  // and a fresh value object re-rendered every consumer — ScreenHeader on all
  // six screens, plus the Insights and Dashboard trees — on each drawer
  // open, close and checklist toggle.
  const drawerCtx = useMemo(() => ({ openDrawer, goToBets }), [openDrawer, goToBets]);

  function handleNavigate(s: DrawerScreen) {
    setBetsFilter(null); // explicit navigation clears any drill-down
    // Deliberately AFTER the close, not before. Switching first looked like it
    // would hide the mount behind the animation, but on the New Architecture
    // the animation is queued to native in a setImmediate that runs after the
    // React commit — so the drawer would sit still for the whole mount and
    // only then slide. It also exposes the new screen under a scrim that still
    // swallows taps, and shows the bet list's first-mount reflow.
    closeDrawer(() => showScreen(s));
  }

  // Android hardware back. Without this the drawer stays open behind the press
  // and every screen exits the app, so a tap into Analytics costs you the app.
  // Unwind one level at a time instead: drawer → day filter → Bets → exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // A stacked screen (Bankroll, Support, AddBet…) is on top: back is the
      // stack's. RN calls the NEWEST listener first, and this one re-registers
      // on every screen switch, so it outranked the stack's: Back on Support
      // silently flipped the hidden screen to Bets instead of closing Support.
      if (!navigation.isFocused()) return false;
      // The tour is the top layer: back leaves it, as "skip" does.
      if (useTourStore.getState().active) { useTourStore.getState().finish(); return true; }
      if (drawerVisibleRef.current) { closeDrawer(); return true; }
      if (betsFilter) { setBetsFilter(null); return true; }
      if (screen !== 'Bets') { showScreen('Bets'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [screen, betsFilter]);

  function handleAddBet() {
    if (!canAddBet()) {
      // Two different walls behind one `false`: Free ran out of bets, or Pro
      // hit the daily limit they set themselves. One message for both told a
      // paying user to "upgrade to Pro".
      if (settings.isPro) {
        Alert.alert(t('bet.dailyLimitTitle'), t('bet.dailyLimitMsg', { count: settings.dailyBetLimit }));
      } else {
        Alert.alert(t('bet.limitTitle'), t('bet.limitMsg', { count: FREE_LIMITS.MAX_BETS }));
      }
      return;
    }
    if (settings.isPro && !settings.disableChecklist) {
      setShowChecklist(true);
    } else {
      navigation.navigate('AddBet', {});
    }
  }

  return (
    <DrawerContext.Provider value={drawerCtx}>
      <View style={styles.root}>
        {/* Checklist modal (PRO pre-bet) */}
        <ChecklistModal
          visible={showChecklist}
          onConfirm={() => { setShowChecklist(false); navigation.navigate('AddBet', {}); }}
          onCancel={() => setShowChecklist(false)}
        />

        {/* Every screen visited this session stays mounted. `Freeze` is the
            part that makes that affordable: a hidden screen would otherwise
            still re-render on every store write — six trees of charts redrawn
            to settle one bet — because a hook update ignores React.memo.
            Suspending the subtree stops those renders outright, and
            `display: none` keeps it out of layout. */}
        <View style={styles.screen}>
          {visited.map((key) => (
            <View key={key} style={key === screen ? styles.screenActive : styles.screenHidden}>
              <DelayedFreeze freeze={key !== screen}>
                <ActiveScreen
                  screen={key}
                  betsFilter={betsFilter}
                  onClearBetsFilter={clearBetsFilter}
                />
              </DelayedFreeze>
            </View>
          ))}
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
          style={[styles.drawer, drawerVisible && styles.drawerShadow, { transform: [{ translateX }] }]}
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
            ref={tourTarget('fab')}
            style={[styles.fab, { bottom: insets.bottom + FAB_BOTTOM }]}
            onPress={handleAddBet}
            activeOpacity={0.85}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}

        {/* First-run tour — over everything here, the FAB and the drawer included. */}
        <TourOverlay />
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
  const settings = useBetsStore((s) => s.settings);

  function goStack(name: 'Bankroll' | 'StrategyBuilder' | 'Partners' | 'Support') {
    onClose(() => navigation.navigate(name));
  }

  return (
    <View style={[styles.drawerInner, { paddingTop: insets.top + 12 }]}>
      {/* Logo */}
      <View style={styles.drawerLogo}>
        <Image source={require('../../assets/logo-mark.png')} style={styles.logoImg} resizeMode="contain" />
        {/* "Log" in the theme accent, as on the author's sheets. A nested Text
            sets its own weight: AppText resolves the face per element. */}
        <Text style={styles.logoText}>Shark<Text style={styles.logoAccent}>Log</Text></Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
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
                {/* Active: the whole glyph takes the accent, like its label —
                    the kit's own rule for the active state. */}
                <AppIcon
                  name={item.icon}
                  size={NAV_GLYPH}
                  color={active ? colors.purpleText : colors.textSecondary}
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
            <AppIcon name="bankroll" size={NAV_GLYPH} />
            <Text style={styles.navLabel}>{t('nav.bankroll')}</Text>
          </TouchableOpacity>

          {settings.isPro && (
            <TouchableOpacity style={styles.navItem} onPress={() => goStack('StrategyBuilder')} activeOpacity={0.75}>
              <AppIcon name="strategy" size={NAV_GLYPH} />
              <Text style={styles.navLabel}>{t('nav.strategyBuilder')}</Text>
            </TouchableOpacity>
          )}

          {/* An ordinary row while the section is a placeholder — a highlighted
              card for an empty screen promised more than was there. */}
          <TouchableOpacity style={styles.navItem} onPress={() => goStack('Partners')} activeOpacity={0.75}>
            <AppIcon name="partners" size={NAV_GLYPH} />
            <Text style={styles.navLabel}>{t('nav.partners')}</Text>
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>{t('common.soon')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Support the author — the one highlighted card. */}
        <TouchableOpacity
          style={styles.supportCard}
          onPress={() => goStack('Support')}
          activeOpacity={0.8}
        >
          <AppIcon name="support" size={NAV_GLYPH} />
          <View style={{ flex: 1 }}>
            <Text style={styles.supportTitle}>{t('nav.support')}</Text>
            <Text style={styles.supportSub}>{t('nav.supportSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.raspberry} />
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom: version / responsible gambling */}
      <View style={[styles.drawerBottom, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.responsible}>{t('nav.responsible')}</Text>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
  },
  screenActive: { flex: 1 },
  // Out of layout entirely, not just invisible.
  screenHidden: { display: 'none' },
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
  },
  // Only while open. Parked off-screen at -272, the shadow still bled in at the
  // left edge — a grey seam invisible on dark grounds and plain on a light one.
  drawerShadow: {
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
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.lg,
  },
  // The brand is the drawer's headline. logo-mark.png is the mark cropped to its
  // own edges: adaptive-icon.png carries Android's safe-zone margin, and in the
  // 36 pt box it had the mark itself was 18 × 12 — smaller than the word beside it.
  logoImg: {
    // The asset's own proportion (176 × 120), both sides explicit: with
    // aspectRatio alone the box took a width of its own and left a gap.
    width: 44,
    height: 30,
    // The mark is white on transparent: tinted, it follows the theme instead
    // of vanishing into a white card.
    tintColor: colors.textPrimary,
  },
  logoText: {
    fontSize: SIZE.hero,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  logoAccent: {
    fontWeight: '800',
    color: colors.purpleText,
  },
  section: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
  },
  navItem: {
    minHeight: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.sm,
    marginBottom: 1,
  },
  navItemActive: {
    backgroundColor: colors.purple + '1A',
  },
  navLabel: {
    flex: 1,
    fontSize: SIZE.lead,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  navLabelActive: {
    color: colors.purpleText,
    fontWeight: '700',
  },
  proBadge: {
    backgroundColor: colors.gold + '22',
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACE.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.gold + '55',
  },
  proBadgeText: {
    fontSize: SIZE.micro,
    fontWeight: '800',
    color: colors.gold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: SPACE.lg,
    marginVertical: SPACE.sm,
  },
  soonBadge: {
    backgroundColor: colors.bgElevated,
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACE.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  soonBadgeText: {
    fontSize: SIZE.micro,
    fontWeight: '600',
    color: colors.textMuted,
  },
  supportCard: {
    minHeight: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    marginHorizontal: SPACE.sm,
    marginBottom: SPACE.xs,
    padding: SPACE.md,
    backgroundColor: alpha(colors.raspberry, 0.08),
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: alpha(colors.raspberry, 0.32),
  },
  supportTitle: {
    fontSize: SIZE.body,
    fontWeight: '700',
    color: colors.raspberry,
  },
  supportSub: {
    fontSize: SIZE.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  drawerBottom: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  responsible: {
    fontSize: SIZE.caption,
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
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: RADIUS.pill,
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
    // A mark, not type. The line box has to grow with it or the plus clips.
    fontSize: GLYPH.xxl,
    color: '#fff',
    fontWeight: '300',
    lineHeight: 41,
    marginTop: -2,
  },
}));
