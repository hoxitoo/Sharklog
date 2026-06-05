import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FREE_LIMITS, CURRENT_SCHEMA_VERSION } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type LangCode } from '../../i18n/index';
import i18n from '../../i18n/index';
import { exportBetsCSV } from '../../utils/exportCSV';
import { importFromCSV, importFromJSON } from '../../utils/importBets';
import { requestNotificationPermission, scheduleDailyReminder } from '../../utils/notifications';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { ProGate } from '../../components/ProGate';
import { restorePurchases } from '../../services/revenueCat';
import type { RootStackParamList } from '../../navigation/RootNavigator';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={row.container}>
      <Text style={row.label}>{label}</Text>
      <View style={row.right}>{children}</View>
    </View>
  );
}
const row = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  label: { fontSize: 15, color: colors.textPrimary, flex: 1 },
  right: { alignItems: 'flex-end' },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sec.container}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  );
}
const sec = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 20 },
  title: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: colors.bgCard, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border },
});

function Stepper({ value, min, max, step = 1, onChangeValue }: {
  value: number; min: number; max: number; step?: number; onChangeValue: (v: number) => void;
}) {
  return (
    <View style={step_.row}>
      <TouchableOpacity
        style={[step_.btn, value <= min && step_.btnDisabled]}
        onPress={() => onChangeValue(Math.max(min, value - step))}
        disabled={value <= min}
      >
        <Text style={step_.btnText}>−</Text>
      </TouchableOpacity>
      <Text style={step_.val}>{value}</Text>
      <TouchableOpacity
        style={[step_.btn, value >= max && step_.btnDisabled]}
        onPress={() => onChangeValue(Math.min(max, value + step))}
        disabled={value >= max}
      >
        <Text style={step_.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
const step_ = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: colors.bgElevated },
  btnText: { fontSize: 18, color: '#fff', fontWeight: '700', lineHeight: 22 },
  val: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, minWidth: 28, textAlign: 'center' },
});

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings, updateSettings, bets, clearAll } = useBetsStore();
  const { t } = useTranslation();
  const [newBookmaker, setNewBookmaker] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available'>('idle');
  const [latestVersion, setLatestVersion] = useState('');
  const [restoring, setRestoring] = useState(false);

  const APP_VERSION = '1.0.0';

  // Days since last backup (null = never)
  const daysSinceBackup = settings.lastBackupAt
    ? Math.floor((Date.now() - new Date(settings.lastBackupAt).getTime()) / 86_400_000)
    : null;
  const showBackupBanner = bets.length > 0 && (daysSinceBackup === null || daysSinceBackup > 30);

  async function handleCheckUpdate() {
    setUpdateStatus('checking');
    try {
      const res = await fetch('https://api.github.com/repos/hoxitoo/Sharklog/releases/latest');
      if (!res.ok) throw new Error('network');
      const data = await res.json() as { tag_name?: unknown };
      const tag = typeof data?.tag_name === 'string' ? data.tag_name : '';
      if (!tag) throw new Error('invalid_response');
      const remote = tag.replace(/^v/, '');
      setLatestVersion(remote);
      setUpdateStatus(remote !== APP_VERSION ? 'available' : 'latest');
    } catch {
      Alert.alert('Ошибка', 'Не удалось проверить обновления. Проверь подключение к интернету.');
      setUpdateStatus('idle');
    }
  }

  function handleDevTap() {
    if (settings.isPro) return;
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    const next = devTapCount + 1;
    setDevTapCount(next);
    if (next >= 7) {
      setDevTapCount(0);
      updateSettings({ isPro: true });
      Alert.alert('👑 Developer Pro', 'Pro активирован');
    } else {
      devTapTimer.current = setTimeout(() => setDevTapCount(0), 2000);
    }
  }

  useEffect(() => {
    if (settings.isPro) setShowPaywall(false);
  }, [settings.isPro]);

  async function handleExport() {
    if (bets.length === 0) {
      Alert.alert('Нет ставок', 'Добавь хотя бы одну ставку для экспорта');
      return;
    }
    setExporting(true);
    try {
      await exportBetsCSV(bets);
    } catch {
      Alert.alert('Ошибка', 'Не удалось экспортировать данные');
    } finally {
      setExporting(false);
    }
  }

  async function handleImportCSV() {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const { bets: imported, total, skipped } = importFromCSV(content);
      if (imported.length === 0) {
        Alert.alert('Не удалось импортировать', 'Файл не содержит распознанных ставок. Убедись, что это CSV, экспортированный из SharkLog.');
        return;
      }
      Alert.alert(
        'Импорт CSV',
        `Найдено ${imported.length} ставок${skipped > 0 ? `, пропущено ${skipped} строк` : ''}.\nДобавить к текущим ставкам?`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Импортировать',
            onPress: () => {
              const store = useBetsStore.getState();
              useBetsStore.setState({ bets: [...imported, ...store.bets] });
              store.persist();
              Alert.alert('Готово', `Импортировано ${imported.length} ставок`);
            },
          },
        ],
      );
    } catch {
      Alert.alert('Ошибка', 'Не удалось прочитать файл');
    } finally {
      setImporting(false);
    }
  }

  async function handleImportJSON() {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const backup = importFromJSON(content);
      if (!backup) {
        Alert.alert('Ошибка', 'Файл не является корректным JSON-бэкапом SharkLog');
        return;
      }
      Alert.alert(
        'Восстановить из бэкапа?',
        `В файле ${backup.bets.length} ставок.\n\nВыбери действие:`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Добавить к текущим',
            onPress: () => {
              const store = useBetsStore.getState();
              useBetsStore.setState({ bets: [...backup.bets, ...store.bets] });
              store.persist();
              Alert.alert('Готово', `Добавлено ${backup.bets.length} ставок`);
            },
          },
          {
            text: 'Заменить всё',
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
              Alert.alert('Готово', `Восстановлено ${backup.bets.length} ставок`);
            },
          },
        ],
      );
    } catch {
      Alert.alert('Ошибка', 'Не удалось прочитать файл');
    } finally {
      setImporting(false);
    }
  }

  async function handleEnableNotifications() {
    const granted = await requestNotificationPermission();
    if (granted) {
      await scheduleDailyReminder(settings.reminderHour);
      Alert.alert('Готово', `Ежедневное напоминание в ${String(settings.reminderHour).padStart(2, '0')}:00 включено`);
    } else {
      Alert.alert('Нет разрешения', 'Разреши уведомления в настройках телефона');
    }
  }

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
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Резервная копия SharkLog' });
      await FileSystem.deleteAsync(path, { idempotent: true });
      updateSettings({ lastBackupAt: new Date().toISOString() });
    } catch {
      Alert.alert('Ошибка', 'Не удалось создать резервную копию');
    }
  }

  async function handleRestorePurchases() {
    setRestoring(true);
    try {
      const isPro = await restorePurchases();
      if (isPro) {
        updateSettings({ isPro: true });
        Alert.alert('Готово ✅', 'Подписка Pro восстановлена');
      } else {
        Alert.alert('Ничего не найдено', 'Активная подписка Pro не обнаружена.\n\nЕсли ты уверен что подписывался — убедись что зашёл в тот же Apple ID / Google аккаунт.');
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось связаться с сервером. Проверь интернет-соединение.');
    } finally {
      setRestoring(false);
    }
  }

  function handleClearData() {
    const proNote = settings.isPro
      ? '\n\n✅ Подписка Pro НЕ затрагивается — она привязана к твоему App Store / Google Play аккаунту. После очистки нажми «Восстановить покупки».'
      : '';
    const backupNote = daysSinceBackup === null
      ? '\n\n⚠️ Ты ещё ни разу не делал резервную копию. Рекомендуем сначала нажать «Резервная копия (JSON)».'
      : '';
    Alert.alert(
      'Очистить все данные?',
      `Все ставки, банкролл, дневник и команды будут удалены НАВСЕГДА — без возможности восстановления.${proNote}${backupNote}`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Очистить', style: 'destructive', onPress: () => clearAll() },
      ],
    );
  }

  function handleAddBookmaker() {
    const trimmed = newBookmaker.trim();
    if (!trimmed) return;
    if (settings.bookmakers.includes(trimmed)) {
      Alert.alert('Уже есть', `${trimmed} уже в списке`);
      return;
    }
    updateSettings({ bookmakers: [...settings.bookmakers, trimmed] });
    setNewBookmaker('');
  }

  function handleRemoveBookmaker(bk: string) {
    if (settings.bookmakers.length <= 1) {
      Alert.alert('Нельзя', 'Должен остаться хотя бы один букмекер');
      return;
    }
    updateSettings({ bookmakers: settings.bookmakers.filter((b) => b !== bk) });
  }

  return (
    <>
      {/* Paywall modal */}
      <Modal visible={showPaywall} animationType="slide" transparent>
        <View style={styles.paywallBg}>
          <View style={styles.paywallSheet}>
            <TouchableOpacity style={styles.paywallClose} onPress={() => setShowPaywall(false)}>
              <Text style={styles.paywallCloseText}>✕</Text>
            </TouchableOpacity>
            <ProGate feature="Настройки Pro">
              <View />
            </ProGate>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title}>Настройки</Text>
        </View>

        {/* Backup reminder banner */}
        {showBackupBanner && (
          <TouchableOpacity style={styles.backupBanner} onPress={handleBackupJSON} activeOpacity={0.8}>
            <Text style={styles.backupBannerIcon}>💾</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.backupBannerTitle}>
                {daysSinceBackup === null ? 'Резервная копия не создана' : `Последняя копия: ${daysSinceBackup} дн. назад`}
              </Text>
              <Text style={styles.backupBannerSub}>
                При удалении приложения ставки исчезнут. Нажми чтобы сохранить.
              </Text>
            </View>
            <Text style={styles.backupBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Pro subscription info */}
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionRow}>
            <Text style={styles.subscriptionIcon}>{settings.isPro ? '👑' : '🆓'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.subscriptionTitle}>
                {settings.isPro ? 'SharkLog Pro' : 'Бесплатная версия'}
              </Text>
              <Text style={styles.subscriptionSub}>
                {settings.isPro
                  ? 'Подписка активна. Привязана к App Store / Google Play аккаунту — сохраняется при переустановке.'
                  : 'До 50 ставок. Купи Pro для неограниченного учёта.'}
              </Text>
            </View>
          </View>
          {!settings.isPro && (
            <TouchableOpacity style={styles.proUpgradeBtn} onPress={() => setShowPaywall(true)} activeOpacity={0.8}>
              <Text style={styles.proUpgradeBtnText}>👑 Попробовать Pro</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestorePurchases} disabled={restoring} activeOpacity={0.8}>
            {restoring
              ? <ActivityIndicator size="small" color={colors.purple} />
              : <Text style={styles.restoreBtnText}>🔄 Восстановить покупки</Text>
            }
          </TouchableOpacity>
          <Text style={styles.subscriptionHint}>
            Уже подписан на другом устройстве или после переустановки? Нажми «Восстановить покупки».
          </Text>
        </View>

        {settings.isPro && (
          <TouchableOpacity
            style={styles.strategyBtn}
            onPress={() => navigation.navigate('StrategyBuilder')}
            activeOpacity={0.8}
          >
            <Text style={styles.strategyBtnIcon}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.strategyBtnText}>Билдер стратегий</Text>
              <Text style={styles.strategyBtnSub}>
                {settings.generatedStrategy
                  ? `Активна: ${settings.generatedStrategy.name}`
                  : 'Создай персональную стратегию'}
              </Text>
            </View>
            <Text style={styles.strategyBtnArrow}>→</Text>
          </TouchableOpacity>
        )}

        <Section title="Тилт-контроль">
          <Row label="Порог тилт-алерта">
            {settings.isPro ? (
              <Stepper
                value={settings.tiltThreshold}
                min={2}
                max={10}
                onChangeValue={(v) => updateSettings({ tiltThreshold: v })}
              />
            ) : (
              <Text style={styles.value}>{FREE_LIMITS.TILT_ALERT_THRESHOLD} поражений (Free)</Text>
            )}
          </Row>
          <Row label="Дневной лимит ставок">
            {settings.isPro ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Stepper
                  value={settings.dailyBetLimit}
                  min={0}
                  max={20}
                  onChangeValue={(v) => updateSettings({ dailyBetLimit: v })}
                />
                {settings.dailyBetLimit === 0 && (
                  <Text style={styles.hint}>∞</Text>
                )}
              </View>
            ) : (
              <Text style={styles.value}>Без лимита (Free)</Text>
            )}
          </Row>
        </Section>

        <Section title="Букмекеры">
          {settings.bookmakers.map((bk) => (
            <Row key={bk} label={bk}>
              <TouchableOpacity onPress={() => handleRemoveBookmaker(bk)}>
                <Text style={styles.removeText}>Удалить</Text>
              </TouchableOpacity>
            </Row>
          ))}
          <View style={styles.addBkRow}>
            <TextInput
              style={styles.addBkInput}
              placeholder="Добавить букмекера..."
              placeholderTextColor={colors.textMuted}
              value={newBookmaker}
              onChangeText={setNewBookmaker}
              onSubmitEditing={handleAddBookmaker}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBkBtn} onPress={handleAddBookmaker}>
              <Text style={styles.addBkBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </Section>

        <Section title="Данные">
          <Row label="Всего ставок">
            <Text style={styles.value}>{bets.length}</Text>
          </Row>
          <Row label="Подписка">
            <TouchableOpacity onPress={handleDevTap} activeOpacity={0.7}>
              <Text style={[styles.value, { color: settings.isPro ? colors.gold : colors.textSecondary }]}>
                {settings.isPro ? 'Pro' : `Free · ${Math.max(0, 50 - bets.length)} ставок осталось`}
              </Text>
            </TouchableOpacity>
          </Row>
          <Row label="Округлять суммы">
            <TouchableOpacity
              onPress={() => updateSettings({ roundAmounts: !settings.roundAmounts })}
              activeOpacity={0.7}
              style={[styles.toggle, settings.roundAmounts && styles.toggleOn]}
            >
              <View style={[styles.toggleThumb, settings.roundAmounts && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </Row>
        </Section>

        <Section title={t('settings.language')}>
          <View style={styles.langRow}>
            {LANGUAGES.map((lang) => {
              const active = (settings.language ?? 'ru') === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langChip, active && styles.langChipActive]}
                  onPress={() => {
                    updateSettings({ language: lang.code as LangCode });
                    i18n.changeLanguage(lang.code);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={[styles.langLabel, active && styles.langLabelActive]}>{lang.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        <Section title="Обновления">
          <Row label={`Версия ${APP_VERSION}`}>
            {updateStatus === 'available' ? (
              <Text style={[styles.value, { color: colors.accent }]}>🆕 {latestVersion}</Text>
            ) : updateStatus === 'latest' ? (
              <Text style={[styles.value, { color: colors.textSecondary }]}>Актуальная</Text>
            ) : null}
          </Row>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleCheckUpdate}
            disabled={updateStatus === 'checking'}
          >
            <Text style={styles.actionBtnText}>
              {updateStatus === 'checking' ? '⏳ Проверяем...' : '🔄 Проверить обновления'}
            </Text>
          </TouchableOpacity>
          {updateStatus === 'available' && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.accent + '44', backgroundColor: colors.accent + '11' }]}
              onPress={() => Alert.alert('Обновление', `Версия ${latestVersion} доступна.\nСкачай APK на GitHub или обнови через магазин.`)}
            >
              <Text style={[styles.actionBtnText, { color: colors.accent }]}>
                ⬇️ Скачать {latestVersion}
              </Text>
            </TouchableOpacity>
          )}
        </Section>

        <Section title="Уведомления">
          <Row label="Время напоминания">
            {settings.isPro ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Stepper
                  value={settings.reminderHour}
                  min={6}
                  max={23}
                  onChangeValue={async (v) => {
                    updateSettings({ reminderHour: v });
                    await scheduleDailyReminder(v);
                  }}
                />
                <Text style={styles.hint}>{String(settings.reminderHour).padStart(2, '0')}:00</Text>
              </View>
            ) : (
              <Text style={styles.value}>20:00 (Free)</Text>
            )}
          </Row>
          <TouchableOpacity style={styles.actionBtn} onPress={handleEnableNotifications}>
            <Text style={styles.actionBtnText}>🔔  Включить / обновить напоминание</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Экспорт / Импорт">
          <TouchableOpacity style={styles.actionBtn} onPress={handleExport} disabled={exporting}>
            <Text style={styles.actionBtnText}>
              {exporting ? 'Экспортируется...' : '📤  Экспорт ставок в CSV'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleBackupJSON}>
            <Text style={styles.actionBtnText}>💾  Резервная копия (JSON)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleImportCSV} disabled={importing}>
            <Text style={styles.actionBtnText}>
              {importing ? 'Загружается...' : '📥  Импорт из CSV'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.lastActionBtn]} onPress={handleImportJSON} disabled={importing}>
            <Text style={styles.actionBtnText}>
              {importing ? 'Загружается...' : '📂  Восстановить из JSON'}
            </Text>
          </TouchableOpacity>
        </Section>

        <TouchableOpacity
          style={styles.partnersBtn}
          onPress={() => navigation.navigate('Partners')}
          activeOpacity={0.8}
        >
          <Text style={styles.strategyBtnIcon}>🤝</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.strategyBtnText}>Партнёры</Text>
            <Text style={styles.strategyBtnSub}>Бонусы при регистрации у букмекеров</Text>
          </View>
          <Text style={styles.strategyBtnArrow}>→</Text>
        </TouchableOpacity>

        <Section title="Опасная зона">
          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData}>
            <Text style={styles.dangerBtnText}>Очистить все данные</Text>
          </TouchableOpacity>
        </Section>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  strategyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 16, padding: 14,
    backgroundColor: colors.purple + '14', borderRadius: 12,
    borderWidth: 1, borderColor: colors.purple + '44',
  },
  strategyBtnIcon: { fontSize: 22 },
  strategyBtnText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  strategyBtnSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  strategyBtnArrow: { fontSize: 14, color: colors.textMuted },
  partnersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 16, padding: 14,
    backgroundColor: colors.accent + '14', borderRadius: 12,
    borderWidth: 1, borderColor: colors.accent + '44',
  },
  proBtn: { backgroundColor: colors.gold, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  proBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
  proBadge: {
    backgroundColor: colors.gold + '22', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: colors.gold + '66',
  },
  proBadgeText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  value: { fontSize: 14, color: colors.textSecondary },
  hint: { fontSize: 18, color: colors.textMuted },
  removeText: { fontSize: 13, color: colors.lost },
  addBkRow: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  addBkInput: {
    flex: 1, backgroundColor: colors.bgElevated, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, color: colors.textPrimary,
    fontSize: 14, borderWidth: 1, borderColor: colors.border,
  },
  addBkBtn: {
    backgroundColor: colors.purple, width: 38, height: 38,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  addBkBtnText: { fontSize: 22, color: '#fff', fontWeight: '700', lineHeight: 26 },
  actionBtn: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  lastActionBtn: { borderBottomWidth: 0 },
  actionBtnText: { fontSize: 15, color: colors.purple, fontWeight: '600' },
  toggle: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: colors.border,
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: colors.accent },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  dangerBtn: { paddingVertical: 14, alignItems: 'center' },
  dangerBtnText: { fontSize: 15, color: colors.lost, fontWeight: '600' },
  paywallBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  paywallSheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    minHeight: '75%', overflow: 'hidden',
  },
  paywallClose: {
    position: 'absolute', top: 12, right: 16, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  paywallCloseText: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },

  // Backup banner
  backupBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12, padding: 14,
    backgroundColor: '#F59E0B18', borderRadius: 12,
    borderWidth: 1, borderColor: '#F59E0B44',
  },
  backupBannerIcon: { fontSize: 22 },
  backupBannerTitle: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  backupBannerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  backupBannerArrow: { fontSize: 14, color: colors.textMuted },

  // Subscription card
  subscriptionCard: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: colors.bgCard, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10,
  },
  subscriptionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  subscriptionIcon: { fontSize: 24, marginTop: 2 },
  subscriptionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  subscriptionSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  proUpgradeBtn: {
    backgroundColor: colors.gold, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  proUpgradeBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  restoreBtn: {
    backgroundColor: colors.bgElevated, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  restoreBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  subscriptionHint: { fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },

  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 },
  langChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
  },
  langChipActive: { backgroundColor: colors.purple + '22', borderColor: colors.purple },
  langFlag: { fontSize: 18 },
  langLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  langLabelActive: { color: colors.purple, fontWeight: '700' },
});
