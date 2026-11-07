import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, DarkTheme, DefaultTheme, type NavigationState } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Each weight from its own module, and useFonts from expo-font: the packages'
// index requires ALL 24 files of a family (every weight and italic), and Metro
// ships every file a module requires — 18 of them unused in the app.
import { useFonts } from 'expo-font';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono/400Regular';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono/500Medium';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RootNavigator } from './src/navigation/RootNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { StorageErrorScreen } from './src/components/StorageErrorScreen';
import { useBetsStore, effectiveReminderHour, resyncBetReminders } from './src/store/betsStore';
import { colors, applyTheme, currentTheme } from './src/theme/colors';
import { PALETTES, THEME_META } from './src/theme/palettes';
import * as Notifications from 'expo-notifications';
import { isOddsFormat } from '@sharklog/core';
import {
  scheduleDailyReminder, registerBetResultCategory,
  setBetPendingResolver, syncRemindersFor, setReminderOddsFormat,
} from './src/utils/notifications';
import { initRevenueCat, syncEntitlement } from './src/services/revenueCat';
import { resumePendingPayment, takePaidNotice, checkLicenseStanding } from './src/services/purchase';
import { BILLING } from './src/services/billing';
import { installCrashCapture, takeLastCrashReport } from './src/services/crashReport';
import { ErrorReportSheet } from './src/components/ErrorReportSheet';
import { RootCrashBoundary } from './src/components/RootCrashBoundary';
import { APP_VERSION } from './src/utils/appVersion';
import { Analytics } from './src/services/analytics';
import './src/i18n/index';
import i18n, { applyLanguage } from './src/i18n/index';

// First thing: a fatal error from here on is kept for the next launch, which
// offers the user a report to send (services/crashReport.ts).
installCrashCapture();

// Keep native splash visible until React Native is ready to render
SplashScreen.preventAutoHideAsync().catch(() => {});

// The palette follows the stored setting — applied from a store subscription
// registered HERE, at module load, before any component subscribes: on every
// write it runs before React gets to re-render, so the tree that renders next
// already reads the new colours. See theme/colors.ts for why `colors` is
// mutated in place rather than passed down.
applyTheme(useBetsStore.getState().settings.theme);
useBetsStore.subscribe((s) => applyTheme(s.settings.theme));

/** react-navigation's own colours (stack background, transitions) from the active palette. */
function navigationTheme() {
  const base = THEME_META[currentTheme()].dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.purple,
      background: colors.bg,
      card: colors.bg,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.lost,
    },
  };
}

function AppRoot() {
  const load = useBetsStore((s) => s.load);
  const isLoaded = useBetsStore((s) => s.isLoaded);
  const loadError = useBetsStore((s) => s.loadError);
  const saveFailed = useBetsStore((s) => s.saveFailed);
  const language = useBetsStore((s) => s.settings.language);
  const oddsFormat = useBetsStore((s) => s.settings.oddsFormat);
  // A number, so the selector is stable; changes with Pro status as well as the hour.
  const reminderHour = useBetsStore((s) => effectiveReminderHour(s.settings));
  const onboardingComplete = useBetsStore((s) => s.settings.onboardingComplete);
  // Keys the app tree: a theme switch REMOUNTS everything, so every screen —
  // hidden, frozen and memoised ones included — renders again with the new
  // palette. The open stack is carried across (navState); the drawer keeps its
  // screen itself (DrawerNavigator's lastScreen).
  const themeKey = useBetsStore((s) => s.settings.theme ?? 'dark');
  const navState = useRef<NavigationState | undefined>(undefined);
  const [splashDone, setSplashDone] = useState(false);
  // The report of the crash the last session closed with, while its window is open.
  const [crashReport, setCrashReport] = useState<string | null>(null);
  const crashOffered = useRef(false);

  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
    // Loaded with the app's own fonts, before the first screen: on demand,
    // the menu and header icons appeared a beat after everything else.
    ...Ionicons.font,
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
    // Foreground guard: never surface a reminder for a bet that is already settled.
    setBetPendingResolver((betId) => {
      const bet = useBetsStore.getState().bets.find((b) => b.id === betId);
      return !!bet && bet.status === 'pending';
    });

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

  // Language FIRST — this effect is declared before the reconcile below on
  // purpose: React runs a commit's effects in declaration order, and every
  // notification bakes its text in when it is scheduled. Applying the language
  // after scheduling (as launch used to) sent English users Russian reminders
  // and registered Russian action buttons for everyone.
  useEffect(() => {
    if (!isLoaded) return;
    applyLanguage(language); // synchronous: i18next's resources are bundled
    // The odds are baked into the text too: a format switch re-issues them.
    setReminderOddsFormat(isOddsFormat(oddsFormat) ? oddsFormat : 'decimal');
    const { bets, settings } = useBetsStore.getState();
    registerBetResultCategory();
    // The launch's (or the switch's) one sync. It re-issues what is scheduled
    // when what a reminder's text is baked from changed — app version (an
    // older build scheduled in Russian), language, odds format — and otherwise
    // only arms what is missing: re-issuing all of it on every launch was up
    // to 50 native calls before the first screen.
    syncRemindersFor(
      bets,
      settings.betResultReminders !== false,
      `${APP_VERSION}|${i18n.language}|${isOddsFormat(oddsFormat) ? oddsFormat : 'decimal'}`,
    );
  }, [isLoaded, language, oddsFormat]);

  // Its own effect, declared AFTER the language one so its text is already in
  // the right language — and keyed on the effective hour, which moves when Pro
  // status does: the entitlement check at launch can end a subscription, and the
  // reminder must drop back to the Free hour right then, not at the next launch.
  useEffect(() => {
    if (!isLoaded) return;
    scheduleDailyReminder(reminderHour);
  }, [isLoaded, language, reminderHour]);

  // Cancelling on settle is fire-and-forget and can be lost (app killed mid-write,
  // CSV import, edits). Re-reconcile reminders on every return to the app. Not
  // at launch: the language effect above already ran the launch's sync — this
  // one ran a second full pass right behind it.
  useEffect(() => {
    if (!isLoaded) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') resyncBetReminders();
    });
    return () => sub.remove();
  }, [isLoaded]);

  useEffect(() => {
    // RevenueCat only in the build that sells through it: in the RuStore build
    // its "no" would take away Pro that an older build left behind.
    if (BILLING === 'revenuecat') initRevenueCat();
    Analytics.appOpen();
    load();
  }, []);

  // Pro from every source, not the store's word alone: a "no" from RevenueCat
  // used to switch off a running trial or a licence with it. Keyed on isLoaded,
  // not chained to the first load(): after a read error, the retry is what
  // loads the store, and the entitlement must be asked then too.
  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      const entitled = BILLING === 'revenuecat' ? await syncEntitlement() : null;
      useBetsStore.getState().refreshPro(entitled);
    })();
  }, [isLoaded]);

  // A Robokassa payment finishes in the browser, outside the app; ask the
  // licence server about it when the user comes back, and at launch (the app
  // may have been killed while the browser was open). The same pass ends a
  // trial that ran out while the app sat in memory, and asks whether the
  // licence was revoked after a refund.
  useEffect(() => {
    if (!isLoaded) return;
    const check = () => {
      useBetsStore.getState().refreshPro(null);
      resumePendingPayment().then((r) => {
        if (r === 'paid' && takePaidNotice()) {
          requestAnimationFrame(() => Alert.alert(i18n.t('proGate.paidTitle'), i18n.t('proGate.paid')));
        }
      });
      if (BILLING === 'robokassa') checkLicenseStanding();
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [isLoaded]);

  // A save that did not reach the disk — most likely a full phone. What is on
  // screen then lives only in memory and goes when the app closes, so say it
  // once per failure and offer a retry. The retry clears the flag first: one
  // that fails again says so again.
  useEffect(() => {
    if (!saveFailed) return;
    Alert.alert(i18n.t('storageError.saveTitle'), i18n.t('storageError.saveBody'), [
      { text: i18n.t('common.ok'), style: 'cancel' },
      {
        text: i18n.t('storageError.retry'),
        onPress: () => {
          useBetsStore.setState({ saveFailed: false });
          useBetsStore.getState().persist();
        },
      },
    ]);
  }, [saveFailed]);

  // ...and save again, quietly, each time the user comes back — they may have
  // just freed space in the phone's settings.
  useEffect(() => {
    if (!isLoaded) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useBetsStore.getState().saveFailed) useBetsStore.getState().persist();
    });
    return () => sub.remove();
  }, [isLoaded]);

  // The last session crashed: offer the report, in the user's language —
  // once; it is forgotten as read.
  // As soon as the app is READY (store and fonts), not after the splash: a
  // crash that came back before the splash ended would never get its report.
  const readyForPrompt = isLoaded && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (!readyForPrompt || crashOffered.current) return;
    crashOffered.current = true;
    takeLastCrashReport().then((report) => {
      if (!report) return;
      Alert.alert(i18n.t('errorReport.lastCrashTitle'), i18n.t('errorReport.lastCrashBody'), [
        { text: i18n.t('errorReport.lastCrashSkip'), style: 'cancel' },
        { text: i18n.t('errorReport.lastCrashView'), onPress: () => setCrashReport(report) },
      ]);
    });
  }, [readyForPrompt]);

  // A failed font load must not hang the app on the splash forever.
  const fontsSettled = fontsLoaded || !!fontError;
  const appReady = isLoaded && fontsSettled;

  // Hide native splash once React Native is ready to show our custom JS splash
  // — or the read-error screen, which must not wait behind it forever.
  useEffect(() => {
    if (appReady || loadError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady, loadError]);

  // The stored data could not be read. isLoaded stays false, so nothing that
  // waits for it runs (reminder sync, payment check, the notification action),
  // and the store writes nothing until a retry reads the data.
  if (loadError) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <StorageErrorScreen />
      </SafeAreaProvider>
    );
  }

  // Keep showing splash until the animation is done AND the store is loaded AND
  // the fonts are registered.
  //
  // Without the isLoaded guard, returning users briefly see OnboardingScreen
  // (settings.onboardingComplete defaults to false before load() resolves).
  //
  // The fonts guard matters since the native stack header started naming a
  // family: react-native-screens resolves the typeface once, in the native
  // config, and Android's font manager caches the system fallback under that
  // family key if the asset is not registered yet. A JS `Text` re-renders when
  // the fonts flip; the native header does not, so the miss sticks for the
  // whole session — five screen titles in Roboto.
  if (!appReady) {
    return (
      // The brand palette, not the theme: the splash continues the native one.
      <View style={{ flex: 1, backgroundColor: PALETTES.dark.bg }}>
        <StatusBar style="light" />
        {/* Only once the app is READY — fonts AND store — not fonts alone.
            Fonts: the splash names DM Sans, and Android measures a Text with
            whatever font is available at the time; mounting first meant the
            tagline was measured in the fallback and clipped when the wider face
            arrived ("Трекер ставок" rendered as "Трекер").
            Store: the language is applied when the store has loaded, so a splash
            started on fonts alone played its tagline in Russian and switched
            mid-animation. And the native splash hides on appReady, so frames
            played before it were played under it, unseen. appReady covers all
            three: right font, right language, and the animation starts when it
            becomes visible. */}
      </View>
    );
  }

  // The splash plays OVER the app, not before it: the app's first render —
  // the heaviest one of the session — runs underneath while the splash plays
  // (its animations are on the native driver), instead of after it. The
  // overlay is last, so it is on top of the tour and takes every touch; its
  // own status bar wins while it is mounted. The splash still mounts only once
  // the app is READY (fonts and store), for the reasons above.
  const splash = splashDone ? null : (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: PALETTES.dark.bg }]}>
      <StatusBar style="light" />
      <AnimatedSplash onFinish={() => setSplashDone(true)} />
    </View>
  );

  const statusBarStyle = THEME_META[currentTheme()].dark ? 'light' : 'dark';
  const crashSheet = (
    <ErrorReportSheet visible={crashReport !== null} report={crashReport ?? ''} onClose={() => setCrashReport(null)} />
  );

  if (!onboardingComplete) {
    return (
      <>
        <ErrorBoundary key={themeKey}>
          <SafeAreaProvider>
            <StatusBar style={statusBarStyle} />
            <OnboardingScreen />
            {crashSheet}
          </SafeAreaProvider>
        </ErrorBoundary>
        {splash}
      </>
    );
  }

  return (
    <>
      <ErrorBoundary key={themeKey}>
        <SafeAreaProvider>
          <NavigationContainer
            theme={navigationTheme()}
            {...(navState.current ? { initialState: navState.current } : {})}
            onStateChange={(s) => { navState.current = s; }}
          >
            <StatusBar style={statusBarStyle} />
            <RootNavigator />
          </NavigationContainer>
          {crashSheet}
        </SafeAreaProvider>
      </ErrorBoundary>
      {splash}
    </>
  );
}

/**
 * Everything under one more boundary: the read-error screen, the splash and
 * the error screen's own window had none above them, and a render error no
 * boundary catches never reaches the global crash handler (RootCrashBoundary).
 */
export default function App() {
  return (
    <RootCrashBoundary>
      <AppRoot />
    </RootCrashBoundary>
  );
}
