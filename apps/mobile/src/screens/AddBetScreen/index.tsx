import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import type { Sport, BetType, Strategy, BetStatus } from '@sharklog/core';
import {
  SPORTS, BET_TYPES, STRATEGIES, parseMoneyInput, formatMoney,
} from '@sharklog/core';
import { colors } from '../../theme/colors';
import { useBetsStore } from '../../store/betsStore';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AddBet'>;
type Route = RouteProp<RootStackParamList, 'AddBet'>;

interface FormData {
  event: string;
  pick: string;
  odds: string;
  stake: string;
  sport: Sport;
  betType: BetType;
  strategy: Strategy;
  status: BetStatus;
  notes: string;
  bookmaker: string;
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

function Field({
  label, error, children,
}: {
  label: string; error?: string; children: React.ReactNode;
}) {
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

export function AddBetScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bets, addBet, updateBet, settings } = useBetsStore();

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
      betType: editBet?.betType ?? '1X2',
      strategy: editBet?.strategy ?? 'value',
      status: editBet?.status ?? 'pending',
      notes: editBet?.notes ?? '',
      bookmaker: editBet?.bookmaker ?? (settings.bookmakers[0] ?? ''),
    },
  });

  const odds = parseFloat(watch('odds') || '0');
  const stakeRaw = watch('stake');
  const stakeKopecks = parseMoneyInput(stakeRaw);
  const potentialWin = odds > 0 && stakeKopecks > 0
    ? formatMoney(Math.round(stakeKopecks * odds))
    : null;

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

    if (editBet) {
      updateBet(editBet.id, {
        event: data.event,
        pick: data.pick,
        odds: oddsVal,
        stake: stakeVal,
        sport: data.sport,
        betType: data.betType,
        strategy: data.strategy,
        status: data.status,
        notes: data.notes || undefined,
        bookmaker: data.bookmaker,
      });
    } else {
      addBet({
        id: uuid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        date: defaultDate,
        time: defaultTime,
        event: data.event,
        pick: data.pick,
        odds: oddsVal,
        stake: stakeVal,
        sport: data.sport,
        betType: data.betType,
        strategy: data.strategy,
        status: data.status,
        notes: data.notes || undefined,
        bookmaker: data.bookmaker,
        schemaVersion: 1,
      });
    }
    navigation.goBack();
  }

  const sportOptions = Object.entries(SPORTS).map(([k, v]) => ({ key: k as Sport, label: v }));
  const betTypeOptions = Object.entries(BET_TYPES).map(([k, v]) => ({ key: k as BetType, label: v }));
  const strategyOptions = Object.entries(STRATEGIES).map(([k, v]) => ({ key: k as Strategy, label: v }));

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
              <TextInput
                style={inputStyle}
                placeholder="Команда А vs Команда Б"
                placeholderTextColor={colors.textMuted}
                value={value}
                onChangeText={onChange}
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

        {potentialWin && (
          <View style={styles.winPreview}>
            <Text style={styles.winLabel}>Потенциальный выигрыш</Text>
            <Text style={styles.winAmount}>{potentialWin}</Text>
          </View>
        )}

        <Controller
          control={control}
          name="sport"
          render={({ field: { onChange, value } }) => (
            <SegmentedControl label="Вид спорта" options={sportOptions} value={value} onChange={onChange} />
          )}
        />

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
                ]}
                value={value}
                onChange={onChange}
              />
            )}
          />
        )}

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
