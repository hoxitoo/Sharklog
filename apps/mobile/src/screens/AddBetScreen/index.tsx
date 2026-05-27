import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Sport, BetType, Strategy, BetStatus, EsportsDiscipline, Team } from '@sharklog/core';
import {
  SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES, parseMoneyInput, formatMoney,
  impliedProbability, halfKelly, expectedValue, recommendedStake,
} from '@sharklog/core';
import { colors } from '../../theme/colors';
import { useBetsStore } from '../../store/betsStore';
import { haptic } from '../../utils/haptics';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AddBet'>;
type Route = RouteProp<RootStackParamList, 'AddBet'>;

interface FormData {
  event: string;
  pick: string;
  odds: string;
  stake: string;
  sport: Sport;
  discipline: EsportsDiscipline;
  betType: BetType;
  strategy: Strategy;
  status: BetStatus;
  notes: string;
  bookmaker: string;
  tournament: string;
  date: string;
  time: string;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function SegmentedControl<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={sc.container}>
      <Text style={sc.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={sc.row}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[sc.item, value === opt.key && sc.itemActive]}
              onPress={() => onChange(opt.key)}
            >
              <Text style={[sc.text, value === opt.key && sc.textActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const sc = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: 6 },
  item: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  itemActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  text: { fontSize: 13, color: colors.textSecondary },
  textActive: { color: '#fff', fontWeight: '700' },
});

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <View style={field.container}>
      <Text style={field.label}>{label}</Text>
      {children}
      {error ? <Text style={field.error}>{error}</Text> : null}
    </View>
  );
}

const field = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  error: { fontSize: 12, color: colors.lost, marginTop: 4 },
});

const inputStyle = {
  backgroundColor: colors.bgCard,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: colors.textPrimary,
  fontSize: 15,
  borderWidth: 1,
  borderColor: colors.border,
};

// ── Team Autocomplete ──────────────────────────────────────────────────────────

function TeamAutocompleteInput({
  value,
  onChange,
  sport,
  discipline,
}: {
  value: string;
  onChange: (v: string) => void;
  sport: Sport;
  discipline: EsportsDiscipline;
}) {
  const teams = useBetsStore((s) => s.teams);
  const [focused, setFocused] = useState(false);

  // Determine which portion is being actively typed (before or after " vs ")
  const vsParts = value.split(' vs ');
  const hasVs = vsParts.length >= 2;
  const activePart = (vsParts[vsParts.length - 1] ?? '').trimStart();
  const prefix = hasVs ? vsParts.slice(0, -1).join(' vs ') + ' vs ' : '';

  const suggestions = useMemo<Team[]>(() => {
    if (!focused || activePart.length < 1) return [];
    return teams
      .filter((t) => {
        if (t.sport !== sport) return false;
        if (sport === 'esports' && t.discipline && t.discipline !== discipline) return false;
        return t.name.toLowerCase().includes(activePart.toLowerCase());
      })
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 6);
  }, [teams, activePart, sport, discipline, focused]);

  function handleSelect(team: Team) {
    const filled = prefix + team.name;
    // After first team, add " vs " automatically so user can start second team
    onChange(hasVs ? filled : filled + ' vs ');
  }

  return (
    <View style={ac.wrapper}>
      <TextInput
        style={inputStyle}
        placeholder="NaVi vs Virtus.pro"
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 180)}
      />
      {focused && suggestions.length > 0 && (
        <View style={ac.dropdown}>
          {suggestions.map((team) => (
            <TouchableOpacity
              key={team.id}
              style={ac.item}
              onPress={() => handleSelect(team)}
              activeOpacity={0.7}
            >
              <Text style={ac.name}>{team.name}</Text>
              <View style={ac.right}>
                {sport === 'esports' && team.discipline ? (
                  <View style={ac.badge}>
                    <Text style={ac.badgeText}>{ESPORTS_DISCIPLINES[team.discipline]}</Text>
                  </View>
                ) : null}
                <Text style={ac.count}>{team.usageCount}×</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const ac = StyleSheet.create({
  wrapper: { position: 'relative' },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    backgroundColor: colors.purpleDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.purple + '44',
  },
  badgeText: { fontSize: 10, color: colors.purple, fontWeight: '600' },
  count: { fontSize: 11, color: colors.textMuted },
});

// ── Kelly Helper ───────────────────────────────────────────────────────────────

function KellyHelper({ odds, bankKopecks, onApply }: {
  odds: number;
  bankKopecks: number;
  onApply: (roubles: string) => void;
}) {
  const [prob, setProb] = useState(0.5);
  const implied = impliedProbability(odds);
  const ev = expectedValue(odds, prob);
  const kellyPct = halfKelly(odds, prob) * 100;
  const stake = bankKopecks > 0 ? recommendedStake(bankKopecks, odds, prob) : 0;
  const evPositive = ev > 0;

  function step(dir: 1 | -1) {
    setProb((p) => Math.min(0.95, Math.max(0.05, Math.round((p + dir * 0.05) * 100) / 100)));
  }

  return (
    <View style={kl.container}>
      <View style={kl.impliedRow}>
        <Text style={kl.impliedLabel}>Имплицитная вероятность букмекера</Text>
        <Text style={kl.impliedValue}>{(implied * 100).toFixed(1)}%</Text>
      </View>

      <View style={kl.stepRow}>
        <Text style={kl.stepLabel}>Моя оценка</Text>
        <View style={kl.stepper}>
          <TouchableOpacity style={kl.stepBtn} onPress={() => step(-1)} activeOpacity={0.7}>
            <Text style={kl.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={kl.stepValue}>{(prob * 100).toFixed(0)}%</Text>
          <TouchableOpacity style={kl.stepBtn} onPress={() => step(1)} activeOpacity={0.7}>
            <Text style={kl.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={kl.resultsRow}>
        <View style={kl.resultCell}>
          <Text style={[kl.resultValue, { color: evPositive ? colors.won : colors.lost }]}>
            {ev >= 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
          </Text>
          <Text style={kl.resultLabel}>EV</Text>
        </View>
        <View style={kl.resultCell}>
          <Text style={kl.resultValue}>{kellyPct.toFixed(1)}%</Text>
          <Text style={kl.resultLabel}>Half-Kelly</Text>
        </View>
        <View style={kl.resultCell}>
          <Text style={[kl.resultValue, { color: stake > 0 ? colors.accent : colors.textMuted }]}>
            {stake > 0 ? formatMoney(stake) : '—'}
          </Text>
          <Text style={kl.resultLabel}>Рек. ставка</Text>
        </View>
      </View>

      {stake > 0 && (
        <TouchableOpacity style={kl.applyBtn} onPress={() => onApply(String(stake / 100))} activeOpacity={0.8}>
          <Text style={kl.applyText}>Применить {formatMoney(stake)}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const kl = StyleSheet.create({
  container: {
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  impliedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  impliedLabel: { fontSize: 12, color: colors.textMuted },
  impliedValue: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, color: colors.textPrimary, lineHeight: 22 },
  stepValue: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, minWidth: 44, textAlign: 'center' },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  resultCell: { alignItems: 'center', gap: 3 },
  resultValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  resultLabel: { fontSize: 10, color: colors.textMuted },
  applyBtn: {
    backgroundColor: colors.accent + '22',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent + '66',
  },
  applyText: { fontSize: 14, fontWeight: '700', color: colors.accent },
});

// ── Main Screen ────────────────────────────────────────────────────────────────

export function AddBetScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bets, addBet, updateBet, settings, bankroll } = useBetsStore();
  const [kellyOpen, setKellyOpen] = useState(false);

  const editBet = route.params?.betId
    ? bets.find((b) => b.id === route.params?.betId)
    : undefined;

  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0] ?? '';
  const defaultTime = now.toTimeString().slice(0, 5);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      event: editBet?.event ?? '',
      pick: editBet?.pick ?? '',
      odds: editBet ? String(editBet.odds) : '',
      stake: editBet ? String(editBet.stake / 100) : '',
      sport: editBet?.sport ?? 'football',
      discipline: editBet?.discipline ?? 'csgo',
      betType: editBet?.betType ?? '1X2',
      strategy: editBet?.strategy ?? 'value',
      status: editBet?.status ?? 'pending',
      notes: editBet?.notes ?? '',
      bookmaker: editBet?.bookmaker ?? (settings.bookmakers[0] ?? ''),
      tournament: editBet?.tournament ?? '',
      date: editBet?.date ?? defaultDate,
      time: editBet?.time ?? defaultTime,
    },
  });

  const watchedOdds = parseFloat(watch('odds') || '0');
  const stakeRaw = watch('stake');
  const watchedSport = watch('sport');
  const watchedDiscipline = watch('discipline');
  const stakeKopecks = parseMoneyInput(stakeRaw);
  const potentialProfit = watchedOdds > 0 && stakeKopecks > 0
    ? formatMoney(Math.round(stakeKopecks * watchedOdds) - stakeKopecks)
    : null;

  const bankKopecks = useMemo(() => {
    const deposited = bankroll.transactions.reduce(
      (sum, t) => (t.type === 'deposit' ? sum + t.amount : sum - t.amount), 0,
    );
    const pnl = bets.reduce((sum, b) => {
      if (b.status === 'won') return sum + Math.round(b.stake * b.odds) - b.stake;
      if (b.status === 'lost') return sum - b.stake;
      return sum;
    }, 0);
    return deposited + pnl;
  }, [bankroll.transactions, bets]);

  useEffect(() => {
    navigation.setOptions({ title: editBet ? 'Редактировать ставку' : 'Новая ставка' });
  }, [editBet]);

  function onSubmit(data: FormData) {
    const oddsVal = parseFloat(data.odds);
    if (isNaN(oddsVal) || oddsVal <= 1) {
      Alert.alert('Ошибка', 'Коэффициент должен быть больше 1');
      return;
    }
    const stakeVal = parseMoneyInput(data.stake);
    if (stakeVal <= 0) {
      Alert.alert('Ошибка', 'Укажи сумму ставки');
      return;
    }

    const extras = {
      ...(data.sport === 'esports' ? { discipline: data.discipline } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      ...(data.tournament?.trim() ? { tournament: data.tournament.trim() } : {}),
    };

    const dateVal = data.date.trim() || defaultDate;
    const timeVal = data.time.trim() || defaultTime;

    if (editBet) {
      updateBet(editBet.id, {
        event: data.event, pick: data.pick, odds: oddsVal, stake: stakeVal,
        sport: data.sport, betType: data.betType, strategy: data.strategy,
        status: data.status, bookmaker: data.bookmaker,
        date: dateVal, time: timeVal, ...extras,
      });
    } else {
      addBet({
        id: uuid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        date: dateVal, time: timeVal,
        event: data.event, pick: data.pick, odds: oddsVal, stake: stakeVal,
        sport: data.sport, betType: data.betType, strategy: data.strategy,
        status: data.status, bookmaker: data.bookmaker, schemaVersion: 1,
        ...extras,
      });
    }
    haptic.success();
    navigation.goBack();
  }

  const sportOptions = Object.entries(SPORTS).map(([k, v]) => ({ key: k as Sport, label: v }));
  const betTypeOptions = Object.entries(BET_TYPES).map(([k, v]) => ({ key: k as BetType, label: v }));
  const strategyOptions = Object.entries(STRATEGIES).map(([k, v]) => ({ key: k as Strategy, label: v }));
  const disciplineOptions = Object.entries(ESPORTS_DISCIPLINES).map(([k, v]) => ({ key: k as EsportsDiscipline, label: v }));

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Событие *" error={errors.event?.message}>
          <Controller
            control={control}
            name="event"
            rules={{ required: 'Введи название события' }}
            render={({ field: { onChange, value } }) => (
              <TeamAutocompleteInput
                value={value}
                onChange={onChange}
                sport={watchedSport}
                discipline={watchedDiscipline}
              />
            )}
          />
        </Field>

        <Field label="Выбор *" error={errors.pick?.message}>
          <Controller
            control={control}
            name="pick"
            rules={{ required: 'Укажи выбор' }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={inputStyle}
                placeholder="П1, ТБ 2.5, Ф1(-1.5)..."
                placeholderTextColor={colors.textMuted}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </Field>

        <View style={styles.row2}>
          <Field label="Коэффициент *" error={errors.odds?.message}>
            <Controller
              control={control}
              name="odds"
              rules={{ required: 'Укажи коэффициент' }}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[inputStyle, styles.halfInput]}
                  placeholder="1.85"
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="decimal-pad"
                />
              )}
            />
          </Field>

          <Field label="Сумма (₽) *" error={errors.stake?.message}>
            <Controller
              control={control}
              name="stake"
              rules={{ required: 'Укажи сумму' }}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[inputStyle, styles.halfInput]}
                  placeholder="1000"
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="decimal-pad"
                />
              )}
            />
          </Field>
        </View>

        {potentialProfit && (
          <View style={styles.winPreview}>
            <Text style={styles.winLabel}>Прибыль при победе</Text>
            <Text style={styles.winAmount}>{potentialProfit}</Text>
          </View>
        )}

        {watchedOdds > 1 && (
          <TouchableOpacity
            style={[styles.kellyToggle, kellyOpen && styles.kellyToggleActive]}
            onPress={() => { haptic.selection(); setKellyOpen((v) => !v); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.kellyToggleText, kellyOpen && styles.kellyToggleTextActive]}>
              📊 Калькулятор Келли {kellyOpen ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
        )}

        {kellyOpen && watchedOdds > 1 && (
          <KellyHelper
            odds={watchedOdds}
            bankKopecks={bankKopecks}
            onApply={(v) => { setValue('stake', v); haptic.success(); }}
          />
        )}

        <Controller
          control={control}
          name="sport"
          render={({ field: { onChange, value } }) => (
            <SegmentedControl label="Вид спорта" options={sportOptions} value={value} onChange={onChange} />
          )}
        />

        {watchedSport === 'esports' && (
          <Controller
            control={control}
            name="discipline"
            render={({ field: { onChange, value } }) => (
              <SegmentedControl label="Дисциплина" options={disciplineOptions} value={value} onChange={onChange} />
            )}
          />
        )}

        <Controller
          control={control}
          name="betType"
          render={({ field: { onChange, value } }) => (
            <SegmentedControl label="Тип ставки" options={betTypeOptions} value={value} onChange={onChange} />
          )}
        />

        <Controller
          control={control}
          name="strategy"
          render={({ field: { onChange, value } }) => (
            <SegmentedControl label="Стратегия" options={strategyOptions} value={value} onChange={onChange} />
          )}
        />

        <Field label="Букмекер">
          <Controller
            control={control}
            name="bookmaker"
            render={({ field: { onChange, value } }) => (
              <View style={styles.bookmakers}>
                {settings.bookmakers.map((bk) => (
                  <TouchableOpacity
                    key={bk}
                    style={[styles.bkBtn, value === bk && styles.bkBtnActive]}
                    onPress={() => onChange(bk)}
                  >
                    <Text style={[styles.bkText, value === bk && styles.bkTextActive]}>{bk}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
        </Field>

        <View style={styles.row2}>
          <Field label="Дата">
            <Controller
              control={control}
              name="date"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[inputStyle, styles.halfInput]}
                  placeholder="ГГГГ-ММ-ДД"
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="numbers-and-punctuation"
                />
              )}
            />
          </Field>
          <Field label="Время">
            <Controller
              control={control}
              name="time"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[inputStyle, styles.halfInput]}
                  placeholder="ЧЧ:ММ"
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="numbers-and-punctuation"
                />
              )}
            />
          </Field>
        </View>

        {editBet && (
          <Controller
            control={control}
            name="status"
            render={({ field: { onChange, value } }) => (
              <SegmentedControl
                label="Статус"
                options={[
                  { key: 'pending' as BetStatus, label: 'Ожидание' },
                  { key: 'won' as BetStatus, label: 'Победа' },
                  { key: 'lost' as BetStatus, label: 'Проигрыш' },
                  { key: 'refund' as BetStatus, label: 'Возврат' },
                  { key: 'cashout' as BetStatus, label: 'Выкуп' },
                ]}
                value={value}
                onChange={onChange}
              />
            )}
          />
        )}

        <Field label="Турнир / Лига">
          <Controller
            control={control}
            name="tournament"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={inputStyle}
                placeholder="Лига Чемпионов, РПЛ, CS2 Major..."
                placeholderTextColor={colors.textMuted}
                value={value}
                onChangeText={onChange}
                returnKeyType="next"
              />
            )}
          />
        </Field>

        <Field label="Заметки">
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[inputStyle, styles.notes]}
                placeholder="Анализ, причины выбора..."
                placeholderTextColor={colors.textMuted}
                value={value}
                onChangeText={onChange}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          />
        </Field>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit(onSubmit)} activeOpacity={0.85}>
          <Text style={styles.submitText}>
            {editBet ? 'Сохранить изменения' : 'Добавить ставку'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  row2: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  winPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accentDim,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  winLabel: { fontSize: 13, color: colors.accent },
  winAmount: { fontSize: 16, fontWeight: '700', color: colors.accent },
  kellyToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  kellyToggleActive: { borderColor: colors.accent + '66', backgroundColor: colors.accentDim },
  kellyToggleText: { fontSize: 13, color: colors.textSecondary },
  kellyToggleTextActive: { color: colors.accent, fontWeight: '600' },
  bookmakers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bkBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  bkBtnActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  bkText: { fontSize: 13, color: colors.textSecondary },
  bkTextActive: { color: '#fff', fontWeight: '700' },
  notes: { height: 80 },
  submitBtn: {
    backgroundColor: colors.purple,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
