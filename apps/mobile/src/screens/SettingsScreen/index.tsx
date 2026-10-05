import React, { useState, useEffect, useRef } from 'react';
import { SPACE, RADIUS, TOUCH, hitSlopFor } from '../../theme/layout';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, ActivityIndicator, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { ScreenHeader } from '../../components/ScreenHeader';
import { cardSurface } from '../../components/Card';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FREE_LIMITS, CURRENT_SCHEMA_VERSION } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors, alpha, mix } from '../../theme/colors';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, applyLanguage, type LangCode } from '../../i18n/index';
import { exportBetsCSV } from '../../utils/exportCSV';
import { importFromCSV, importFromJSON } from '../../utils/importBets';
import {
  requestNotificationPermission, scheduleDailyReminder,
  syncBetResultReminders, cancelAllBetResultReminders,
} from '../../utils/notifications';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { ProGate } from '../../components/ProGate';
import { restorePurchases } from '../../services/revenueCat';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { SIZE, GLYPH, numeric } from '../../theme/typography';

/** Re-arm / clear bet reminders from the store's current state. */
function resyncReminders(): void {
  const { bets, settings } = useBetsStore.getState();
  syncBetResultReminders(bets, settings.betResultReminders !== false);
}

const APP_VERSION = '1.0.0';
const DAY_MS = 86_400_000;

/** Stepper buttons are 30pt by design; the slop makes the touch area 44. */
const STEP_BTN = 30;
const STEP_SLOP = hitSlopFor(STEP_BTN, { maxHorizontal: SPACE.xs });
const TOGGLE = { width: 44, height: 26 };
const TOGGLE_SLOP = hitSlopFor(TOGGLE);
/** Language segments sit edge to edge, so neither may claim the other's space. */
const SEG = { width: 44, height: 32 };
const SEG_SLOP = hitSlopFor(SEG, { maxHorizontal: 0 });
const CHIP_X_SLOP = hitSlopFor(20);

// ── Building blocks ───────────────────────────────────────────────────────────

/**
 * A titled card of rows with hairlines BETWEEN them, never above the first or
 * below the last. Rows are often conditional (PRO-only), and a divider baked
 * into each row left a double line or a dangling one whenever one dropped out.
 */
function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <View style={sec.wrap}>
      {title ? <Text style={sec.title}>{title}</Text> : null}
      <View style={sec.card}>
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={sec.divider} />}
            {r}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const sec = StyleSheet.create({
  wrap: { marginHorizontal: SPACE.lg, marginBottom: SPACE.lg },
  title: {
    fontSize: SIZE.caption, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: SPACE.sm, marginLeft: SPACE.xs,
  },
  card: { ...cardSurface, paddingHorizontal: SPACE.lg },
  divider: { height: 1, backgroundColor: colors.border },
});

/**
 * One setting: what it is on the left, its control on the right, and — under
 * the label — what the current value MEANS ("после 3 поражений подряд"), so a
 * bare number in a stepper never has to explain itself.
 */
function Row({ label, hint, right, onPress, chevron, tone, busy }: {
  label: string;
  hint?: string | null;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  tone?: 'danger' | 'gold';
  busy?: boolean;
}) {
  const body = (
    <View style={row.wrap}>
      <View style={row.text}>
        <Text
          style={[row.label, tone === 'danger' && row.danger, tone === 'gold' && row.gold]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {hint ? <Text style={row.hint} numberOfLines={2}>{hint}</Text> : null}
      </View>
      {busy ? <ActivityIndicator size="small" color={colors.purple} /> : right}
      {chevron && !busy ? <Ionicons name="chevron-forward" size={GLYPH.md} color={colors.textMuted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.7}>
      {body}
    </TouchableOpacity>
  );
}

const row = StyleSheet.create({
  wrap: {
    minHeight: TOUCH + SPACE.sm,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  text: { flex: 1 },
  label: { fontSize: SIZE.body, fontWeight: '500', color: colors.textPrimary },
  hint: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: 2 },
  danger: { color: colors.lost, fontWeight: '600' },
  gold: { color: colors.gold, fontWeight: '700' },
});

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
      hitSlop={TOGGLE_SLOP}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={[ctl.toggle, value && ctl.toggleOn]}
    >
      <View style={[ctl.thumb, value && ctl.thumbOn]} />
    </TouchableOpacity>
  );
}

function Stepper({ value, min, max, onChange }: {
  value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <View style={ctl.stepRow}>
      <TouchableOpacity
        style={[ctl.stepBtn, value <= min && ctl.stepBtnOff]}
        hitSlop={STEP_SLOP}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        accessibilityLabel="−"
      >
        <Text style={ctl.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={ctl.stepVal}>{value === 0 && min === 0 ? '∞' : value}</Text>
      <TouchableOpacity
        style={[ctl.stepBtn, value >= max && ctl.stepBtnOff]}
        hitSlop={STEP_SLOP}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        accessibilityLabel="+"
      >
        <Text style={ctl.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Marks a setting a Free user can see but not change; the row opens the paywall. */
function ProBadge() {
  return (
    <View style={ctl.pro}>
      <Ionicons name="lock-closed" size={GLYPH.sm} color={colors.gold} />
      <Text style={ctl.proText}>PRO</Text>
    </View>
  );
}

const ctl = StyleSheet.create({
  toggle: {
    ...TOGGLE, borderRadius: RADIUS.pill, backgroundColor: colors.borderStrong,
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: colors.accent },
  thumb: { width: 20, height: 20, borderRadius: RADIUS.pill, backgroundColor: '#fff' },
  thumbOn: { alignSelf: 'flex-end' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  stepBtn: {
    width: STEP_BTN, height: STEP_BTN, borderRadius: RADIUS.sm,
    backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center',
  },
  stepBtnOff: { backgroundColor: colors.bgElevated },
  stepBtnText: { fontSize: GLYPH.md, color: '#fff', fontWeight: '700', lineHeight: 20 },
  stepVal: { ...numeric, fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary, minWidth: 24, textAlign: 'center' },
  pro: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.xs,
    backgroundColor: alpha(colors.gold, 0.12), borderWidth: 1, borderColor: alpha(colors.gold, 0.4),
  },
  proText: { fontSize: SIZE.micro, fontWeight: '700', color: colors.gold, letterSpacing: 0.5 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const settings = useBetsStore((s) => s.settings);
  const updateSettings = useBetsStore((s) => s.updateSettings);
  const bets = useBetsStore((s) => s.bets);
  const clearAll = useBetsStore((s) => s.clearAll);
  const { t } = useTranslation();
  const [newBookmaker, setNewBookmaker] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState<'csv' | 'json' | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available'>('idle');
  const [latestVersion, setLatestVersion] = useState('');
  const [restoring, setRestoring] = useState(false);

  const isPro = settings.isPro;
  const openPaywall = () => setShowPaywall(true);

  // Days since last backup (null = never)
  const daysSinceBackup = settings.lastBackupAt
    ? Math.floor((Date.now() - new Date(settings.lastBackupAt).getTime()) / DAY_MS)
    : null;
  const showBackupBanner = bets.length > 0 && (daysSinceBackup === null || daysSinceBackup > 30);

  useEffect(() => {
    if (isPro) setShowPaywall(false);
  }, [isPro]);

  useEffect(() => () => {
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
  }, []);

  // ── Subscription ────────────────────────────────────────────────────────────

  async function handleRestorePurchases() {
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        updateSettings({ isPro: true });
        Alert.alert(t('common.success'), t('settings.restoreDone'));
      } else {
        Alert.alert(t('settings.restoreNoneTitle'), t('settings.restoreNoneMsg'));
      }
    } catch {
      Alert.alert(t('common.error'), t('errors.network'));
    } finally {
      setRestoring(false);
    }
  }

  /**
   * Seven taps on the version turn Pro on — in development builds ONLY.
   *
   * The roadmap recorded this as guarded by `__DEV__` long ago, but the guard
   * was never in the code: in a release build seven taps on the subscription
   * row handed out Pro for free. It lives on the version row now, the place
   * Android itself uses for the same trick, so it no longer competes with the
   * row that opens the paywall.
   */
  function handleDevTap() {
    if (!__DEV__ || isPro) return;
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    const next = devTapCount + 1;
    setDevTapCount(next);
    if (next >= 7) {
      setDevTapCount(0);
      updateSettings({ isPro: true });
      Alert.alert('Developer Pro', 'Pro enabled (dev build only)');
    } else {
      devTapTimer.current = setTimeout(() => setDevTapCount(0), 2000);
    }
  }

  // ── Notifications ───────────────────────────────────────────────────────────

  async function handleEnableNotifications() {
    const granted = await requestNotificationPermission();
    if (granted) {
      await scheduleDailyReminder(settings.reminderHour);
      resyncReminders(); // bets logged before permission was granted had no reminder
      Alert.alert(t('common.success'), t('settings.notifEnabled', { time: hh(settings.reminderHour) }));
    } else {
      Alert.alert(t('settings.notifDeniedTitle'), t('settings.notifDeniedMsg'));
    }
  }

  function toggleBetReminders(on: boolean) {
    updateSettings({ betResultReminders: on });
    if (on) resyncReminders();
    else cancelAllBetResultReminders(); // clear the already-armed ones
  }

  // ── Bookmakers ──────────────────────────────────────────────────────────────

  function handleAddBookmaker() {
    const trimmed = newBookmaker.trim();
    if (!trimmed) return;
    // Case-insensitive: "fonbet" next to "Fonbet" is the same bookmaker twice,
    // and the per-bookmaker analytics would split it into two rows.
    if (settings.bookmakers.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert(t('settings.bookmakerExists', { name: trimmed }));
      return;
    }
    updateSettings({ bookmakers: [...settings.bookmakers, trimmed] });
    setNewBookmaker('');
  }

  function handleRemoveBookmaker(bk: string) {
    if (settings.bookmakers.length <= 1) {
      Alert.alert(t('settings.bookmakerLastTitle'), t('settings.bookmakerLastMsg'));
      return;
    }
    updateSettings({ bookmakers: settings.bookmakers.filter((b) => b !== bk) });
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  async function handleBackupJSON() {
    const { bets: allBets, bankroll, diary, teams } = useBetsStore.getState();
    const { isPro: _ip, proExpiresAt: _pe, ...exportableSettings } = settings;
    const backup = JSON.stringify({
      version: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      bets: allBets,
      settings: exportableSettings,
      bankroll,
      diary,
      teams,
    }, null, 2);
    const path = (FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '') + 'sharklog_backup.json';
    try {
      await FileSystem.writeAsStringAsync(path, backup, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: t('settings.backupDialogTitle') });
      await FileSystem.deleteAsync(path, { idempotent: true });
      updateSettings({ lastBackupAt: new Date().toISOString() });
    } catch {
      Alert.alert(t('common.error'), t('settings.backupError'));
    }
  }

  async function pickFile(types: string[]): Promise<string | null> {
    const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  }

  async function handleImportJSON() {
    // One picker at a time: the system document picker rejects a second
    // call while the first is open, and the row spinner only covers its own row.
    if (importing) return;
    setImporting('json');
    try {
      const content = await pickFile(['application/json', 'text/plain', '*/*']);
      if (content == null) return;
      const backup = importFromJSON(content);
      if (!backup) {
        Alert.alert(t('common.error'), t('settings.backupInvalid'));
        return;
      }
      const n = backup.bets.length;
      Alert.alert(t('settings.restoreTitle'), t('settings.restoreMsg', { count: n }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.restoreAppend'),
          onPress: () => {
            const store = useBetsStore.getState();
            useBetsStore.setState({ bets: [...backup.bets, ...store.bets] });
            store.persist();
            resyncReminders();
            Alert.alert(t('common.success'), t('settings.betsAdded', { count: n }));
          },
        },
        {
          text: t('settings.restoreReplace'),
          style: 'destructive',
          onPress: () => {
            const store = useBetsStore.getState();
            useBetsStore.setState({
              bets: backup.bets,
              ...(backup.bankroll ? { bankroll: { ...store.bankroll, ...backup.bankroll } as typeof store.bankroll } : {}),
              ...(backup.diary ? { diary: backup.diary as typeof store.diary } : {}),
              ...(backup.teams ? { teams: backup.teams as typeof store.teams } : {}),
            });
            store.persist();
            resyncReminders(); // replaced bets: drop orphan reminders, arm the new ones
            Alert.alert(t('common.success'), t('settings.betsRestored', { count: n }));
          },
        },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('settings.readError'));
    } finally {
      setImporting(null);
    }
  }

  async function handleExport() {
    if (bets.length === 0) {
      Alert.alert(t('settings.noBetsTitle'), t('settings.noBetsMsg'));
      return;
    }
    setExporting(true);
    try {
      await exportBetsCSV(bets);
    } catch {
      Alert.alert(t('common.error'), t('errors.exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  async function handleImportCSV() {
    // One picker at a time: the system document picker rejects a second
    // call while the first is open, and the row spinner only covers its own row.
    if (importing) return;
    setImporting('csv');
    try {
      const content = await pickFile(['text/csv', 'text/plain', 'text/comma-separated-values', '*/*']);
      if (content == null) return;
      const { bets: imported, skipped } = importFromCSV(content);
      if (imported.length === 0) {
        Alert.alert(t('settings.importNothingTitle'), t('settings.importNothingMsg'));
        return;
      }
      const lines = [
        t('settings.importFound', { count: imported.length }),
        skipped > 0 ? t('settings.importSkipped', { count: skipped }) : null,
        t('settings.importAsk'),
      ].filter(Boolean).join('\n');
      Alert.alert(t('settings.importCSV'), lines, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.importAction'),
          onPress: () => {
            const store = useBetsStore.getState();
            useBetsStore.setState({ bets: [...imported, ...store.bets] });
            store.persist();
            resyncReminders(); // imported bets bypass addBet, so arm them here
            Alert.alert(t('common.success'), t('settings.betsAdded', { count: imported.length }));
          },
        },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('settings.readError'));
    } finally {
      setImporting(null);
    }
  }

  function handleClearData() {
    const notes = [
      t('settings.clearAllMsg'),
      isPro ? t('settings.clearProNote') : null,
      daysSinceBackup === null ? t('settings.clearBackupNote') : null,
    ].filter(Boolean).join('\n\n');
    Alert.alert(t('settings.clearAllConfirm'), notes, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.clearAction'), style: 'destructive', onPress: () => clearAll() },
    ]);
  }

  // ── Updates ─────────────────────────────────────────────────────────────────

  async function handleCheckUpdate() {
    setUpdateStatus('checking');
    try {
      const res = await fetch('https://api.github.com/repos/hoxitoo/Sharklog/releases/latest');
      if (res.status === 404) {
        setUpdateStatus('latest');
        Alert.alert(t('settings.updatesTitle'), t('settings.updateNoReleases'));
        return;
      }
      if (!res.ok) throw new Error('network');
      const data = await res.json() as { tag_name?: unknown };
      const tag = typeof data?.tag_name === 'string' ? data.tag_name : '';
      if (!tag) throw new Error('invalid_response');
      const remote = tag.replace(/^v/, '');
      setLatestVersion(remote);
      setUpdateStatus(remote !== APP_VERSION ? 'available' : 'latest');
    } catch {
      Alert.alert(t('common.error'), t('settings.updateError'));
      setUpdateStatus('idle');
    }
  }

  // ── Derived labels ──────────────────────────────────────────────────────────

  const backupHint = daysSinceBackup === null
    ? t('settings.backupNeverShort')
    : daysSinceBackup === 0
      ? t('settings.backupLastToday')
      : t('settings.backupLast', { count: daysSinceBackup });

  const tiltValue = isPro ? settings.tiltThreshold : FREE_LIMITS.TILT_ALERT_THRESHOLD;
  const limitHint = !isPro || settings.dailyBetLimit === 0
    ? t('settings.dailyLimitOff')
    : t('settings.dailyLimitOn', { count: settings.dailyBetLimit });
  const reminderHour = isPro ? settings.reminderHour : 20;
  const currentLang = (settings.language ?? 'ru') as LangCode;

  const versionRight = updateStatus === 'checking'
    ? <ActivityIndicator size="small" color={colors.purple} />
    : updateStatus === 'latest'
      ? <Text style={styles.statusOk}>{t('settings.updateLatest')}</Text>
      : updateStatus === 'available'
        ? <Text style={styles.statusNew}>{t('settings.updateAvailable', { version: latestVersion })}</Text>
        : (
          <TouchableOpacity style={styles.smallBtn} onPress={handleCheckUpdate} activeOpacity={0.75}>
            <Text style={styles.smallBtnText}>{t('settings.check')}</Text>
          </TouchableOpacity>
        );

  return (
    <>
      <Modal visible={showPaywall} animationType="slide" transparent onRequestClose={() => setShowPaywall(false)}>
        {/* Tap outside the sheet to dismiss (standard bottom-sheet behavior) */}
        <Pressable style={styles.paywallBg} onPress={() => setShowPaywall(false)}>
          <Pressable style={styles.paywallSheet} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity
              style={styles.paywallClose}
              hitSlop={hitSlopFor(32)}
              onPress={() => setShowPaywall(false)}
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={GLYPH.md} color={colors.textSecondary} />
            </TouchableOpacity>
            <ProGate feature={t('settings.proFeature')}>
              <View />
            </ProGate>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Pinned, like every other drawer screen — a hamburger that scrolls away
          takes the only route into the menu with it. */}
      <ScreenHeader title={t('settings.title')} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.container}
        contentContainerStyle={{ paddingTop: SPACE.sm, paddingBottom: insets.bottom + SPACE.xl }}
        showsVerticalScrollIndicator={false}
      >
        {showBackupBanner && (
          <TouchableOpacity style={styles.backupBanner} onPress={handleBackupJSON} activeOpacity={0.8}>
            <Ionicons name="cloud-upload-outline" size={GLYPH.lg} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.backupBannerTitle}>
                {daysSinceBackup === null
                  ? t('settings.backupNever')
                  : t('settings.backupStale', { count: daysSinceBackup })}
              </Text>
              <Text style={styles.backupBannerSub}>{t('settings.backupBannerSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={GLYPH.md} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* 1. What you have: one line for the plan, one to get it back. */}
        <Section title={t('settings.sectionSubscription')}>
          {isPro ? (
            <Row
              label={t('settings.proTitle')}
              hint={t('settings.proSub')}
              tone="gold"
              right={<Ionicons name="checkmark-circle" size={GLYPH.lg} color={colors.gold} />}
            />
          ) : (
            <Row
              label={t('settings.freeTitle')}
              hint={t('settings.freeUsage', { used: bets.length, limit: FREE_LIMITS.MAX_BETS })}
              onPress={openPaywall}
              right={(
                <View style={styles.upgradeBtn}>
                  <Text style={styles.upgradeBtnText}>{t('settings.upgrade')}</Text>
                </View>
              )}
            />
          )}
          <Row
            label={t('settings.restorePurchases')}
            hint={t('settings.restoreHint')}
            onPress={handleRestorePurchases}
            busy={restoring}
            chevron
          />
        </Section>

        {/* 2. How the app looks and reads. */}
        <Section title={t('settings.sectionInterface')}>
          <Row
            label={t('settings.language')}
            hint={LANGUAGES.find((l) => l.code === currentLang)?.label ?? null}
            right={(
              <View style={styles.segment}>
                {LANGUAGES.map((lang) => {
                  const active = currentLang === lang.code;
                  return (
                    <TouchableOpacity
                      key={lang.code}
                      style={[styles.segBtn, active && styles.segBtnActive]}
                      hitSlop={SEG_SLOP}
                      onPress={() => {
                        updateSettings({ language: lang.code });
                        applyLanguage(lang.code);
                      }}
                      activeOpacity={0.75}
                      accessibilityLabel={lang.label}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.segText, active && styles.segTextActive]}>{lang.short}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />
          <Row
            label={t('settings.roundAmounts')}
            hint={t('settings.roundAmountsHint')}
            right={(
              <Toggle
                label={t('settings.roundAmounts')}
                value={settings.roundAmounts}
                onChange={(v) => updateSettings({ roundAmounts: v })}
              />
            )}
          />
        </Section>

        {/* 3. Guard rails. The same four rows for everyone: a Free user sees
            what Pro would change, and the row is the way to it. */}
        <Section title={t('settings.sectionDiscipline')}>
          <Row
            label={t('settings.tiltAlert')}
            hint={t('settings.tiltAfter', { count: tiltValue })}
            {...(isPro ? {} : { onPress: openPaywall })}
            right={isPro
              ? <Stepper value={settings.tiltThreshold} min={2} max={10} onChange={(v) => updateSettings({ tiltThreshold: v })} />
              : <ProBadge />}
          />
          <Row
            label={t('settings.dailyLimit')}
            hint={limitHint}
            {...(isPro ? {} : { onPress: openPaywall })}
            right={isPro
              ? <Stepper value={settings.dailyBetLimit} min={0} max={20} onChange={(v) => updateSettings({ dailyBetLimit: v })} />
              : <ProBadge />}
          />
          <Row
            label={t('settings.checklist')}
            hint={t('settings.checklistHint')}
            {...(isPro ? {} : { onPress: openPaywall })}
            right={isPro
              ? (
                <Toggle
                  label={t('settings.checklist')}
                  value={!settings.disableChecklist}
                  onChange={(on) => updateSettings({ disableChecklist: !on })}
                />
              )
              : <ProBadge />}
          />
          <Row
            label={t('settings.strategyBuilder')}
            hint={settings.generatedStrategy
              ? t('settings.strategyActive', { name: settings.generatedStrategy.name })
              : t('settings.strategyNone')}
            onPress={isPro ? () => navigation.navigate('StrategyBuilder') : openPaywall}
            right={isPro ? null : <ProBadge />}
            chevron={isPro}
          />
        </Section>

        {/* 4. Everything that can ping you, in one place. */}
        <Section title={t('settings.sectionNotifications')}>
          <Row
            label={t('settings.betResultReminders')}
            hint={t('settings.betResultRemindersHint')}
            right={(
              <Toggle
                label={t('settings.betResultReminders')}
                value={settings.betResultReminders !== false}
                onChange={toggleBetReminders}
              />
            )}
          />
          <Row
            label={t('settings.dailyReminder')}
            hint={t('settings.dailyReminderAt', { time: hh(reminderHour) })}
            {...(isPro ? {} : { onPress: openPaywall })}
            right={isPro
              ? (
                <Stepper
                  value={settings.reminderHour}
                  min={6}
                  max={23}
                  onChange={async (v) => {
                    updateSettings({ reminderHour: v });
                    await scheduleDailyReminder(v);
                  }}
                />
              )
              : <ProBadge />}
          />
          <Row
            label={t('settings.enableNotifications')}
            hint={t('settings.enableNotificationsHint')}
            onPress={handleEnableNotifications}
            chevron
          />
        </Section>

        {/* 5. Chips, not a row per bookmaker: the list was the longest thing on
            the screen and every row in it said the same word, "Удалить". */}
        <Section title={t('settings.sectionBookmakers')}>
          <View style={styles.bkBody}>
            <View style={styles.chips}>
              {settings.bookmakers.map((bk) => (
                <View key={bk} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>{bk}</Text>
                  <TouchableOpacity
                    hitSlop={CHIP_X_SLOP}
                    onPress={() => handleRemoveBookmaker(bk)}
                    accessibilityLabel={t('settings.removeBookmaker', { name: bk })}
                  >
                    <Ionicons name="close" size={GLYPH.sm} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                placeholder={t('settings.addBookmakerPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={newBookmaker}
                onChangeText={setNewBookmaker}
                onSubmitEditing={handleAddBookmaker}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addBtn, !newBookmaker.trim() && styles.addBtnOff]}
                onPress={handleAddBookmaker}
                disabled={!newBookmaker.trim()}
                accessibilityLabel={t('common.add')}
              >
                <Ionicons name="add" size={GLYPH.lg} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* 6. Your data. The backup is first because it is the one that
            matters: there is no server, and deleting the app deletes the bets. */}
        <Section title={t('settings.sectionData')}>
          <Row label={t('settings.backup')} hint={backupHint} onPress={handleBackupJSON} chevron />
          <Row
            label={t('settings.restoreBackup')}
            hint={t('settings.restoreBackupHint')}
            onPress={handleImportJSON}
            busy={importing === 'json'}
            chevron
          />
          <Row label={t('settings.exportCSV')} hint={t('settings.exportCSVHint')} onPress={handleExport} busy={exporting} chevron />
          <Row
            label={t('settings.importCSV')}
            hint={t('settings.importCSVHint')}
            onPress={handleImportCSV}
            busy={importing === 'csv'}
            chevron
          />
        </Section>

        {/* 7. One line: which build this is, and whether there is a newer one. */}
        <Section title={t('settings.sectionAbout')}>
          <Row
            label={t('settings.version', { version: APP_VERSION })}
            {...(__DEV__ ? { onPress: handleDevTap } : {})}
            right={versionRight}
          />
          {updateStatus === 'available' && (
            <Row
              label={t('settings.updateHowToTitle', { version: latestVersion })}
              hint={t('settings.updateHowTo')}
            />
          )}
        </Section>

        <Section>
          <Row label={t('settings.clearAll')} tone="danger" onPress={handleClearData} />
        </Section>
      </ScrollView>
    </>
  );
}

/** 9 → "09:00". */
function hh(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  backupBanner: {
    minHeight: TOUCH,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    marginHorizontal: SPACE.lg, marginBottom: SPACE.lg, padding: SPACE.md,
    backgroundColor: mix(colors.gold, colors.bgCard, 0.09), borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: alpha(colors.gold, 0.27),
  },
  backupBannerTitle: { fontSize: SIZE.body, fontWeight: '700', color: colors.gold },
  backupBannerSub: { fontSize: SIZE.caption, color: colors.textSecondary, marginTop: 2 },

  upgradeBtn: {
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.sm, backgroundColor: colors.gold,
  },
  upgradeBtnText: { fontSize: SIZE.caption, fontWeight: '700', color: '#000' },

  segment: {
    flexDirection: 'row', padding: 2, borderRadius: RADIUS.sm,
    backgroundColor: colors.bgSunken, borderWidth: 1, borderColor: colors.border,
  },
  segBtn: { ...SEG, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.xs },
  segBtnActive: { backgroundColor: colors.purple },
  segText: { fontSize: SIZE.caption, fontWeight: '700', color: colors.textMuted },
  segTextActive: { color: '#fff' },

  bkBody: { paddingVertical: SPACE.md, gap: SPACE.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    maxWidth: '100%',
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    paddingLeft: SPACE.md, paddingRight: SPACE.sm, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.pill, backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.border,
  },
  chipText: { flexShrink: 1, fontSize: SIZE.body, color: colors.textPrimary },
  addRow: { flexDirection: 'row', gap: SPACE.sm },
  addInput: {
    flex: 1, minHeight: TOUCH, backgroundColor: colors.bgSunken, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md, color: colors.textPrimary,
    fontSize: SIZE.body, borderWidth: 1, borderColor: colors.border,
  },
  addBtn: {
    width: TOUCH, height: TOUCH, borderRadius: RADIUS.sm,
    backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center',
  },
  addBtnOff: { backgroundColor: colors.bgElevated },

  smallBtn: {
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: alpha(colors.purple, 0.5), backgroundColor: alpha(colors.purple, 0.12),
  },
  smallBtnText: { fontSize: SIZE.caption, fontWeight: '700', color: colors.purpleText },
  statusOk: { fontSize: SIZE.caption, color: colors.textSecondary },
  statusNew: { fontSize: SIZE.caption, fontWeight: '700', color: colors.accent },

  paywallBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  paywallSheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet,
    minHeight: '75%', overflow: 'hidden',
  },
  paywallClose: {
    position: 'absolute', top: SPACE.md, right: SPACE.lg, zIndex: 10,
    width: 32, height: 32, borderRadius: RADIUS.pill,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
});
